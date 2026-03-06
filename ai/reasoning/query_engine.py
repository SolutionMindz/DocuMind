from __future__ import annotations

import json
import uuid
from typing import AsyncIterator

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ai.embeddings.embedder import embed_text
from api.dependencies import get_settings
from db.models import Embedding, Section


async def query_document(
    document_id: uuid.UUID,
    question: str,
    session: AsyncSession,
) -> AsyncIterator[str]:
    settings = get_settings()

    # 1. Embed the question
    question_vec = await embed_text(question)
    vec_str = "[" + ",".join(str(v) for v in question_vec) + "]"

    # 2. Find top-5 similar sections via pgvector cosine distance
    stmt = (
        select(Section)
        .join(Embedding, Embedding.section_id == Section.id)
        .where(Section.document_id == document_id)
        .order_by(text(f"embeddings.embedding <=> '{vec_str}'::vector"))
        .limit(5)
    )
    result = await session.execute(stmt)
    sections = result.scalars().all()

    # 3. Build prompt
    context_parts = []
    for i, sec in enumerate(sections, 1):
        context_parts.append(f"[{i}] ({sec.type}) {sec.content[:800]}")

    context_text = "\n\n".join(context_parts)
    prompt = (
        f"You are a document analysis assistant. Use only the following document excerpts to answer the question.\n\n"
        f"Document excerpts:\n{context_text}\n\n"
        f"Question: {question}\n\n"
        f"Answer:"
    )

    # 4. Stream Ollama completion
    source_ids = [str(sec.id) for sec in sections]
    source_contents = [sec.content[:200] for sec in sections]

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.ollama_base_url}/api/generate",
            json={"model": settings.ollama_model, "prompt": prompt, "stream": True},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = chunk.get("response", "")
                if token:
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                if chunk.get("done"):
                    yield f"data: {json.dumps({'type': 'done', 'sources': [{'id': sid, 'content': sc} for sid, sc in zip(source_ids, source_contents)]})}\n\n"
                    return
