from __future__ import annotations

import httpx

from api.dependencies import get_settings
from core.structure.structure_builder import StructuredSection


async def embed_text(text: str) -> list[float]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.ollama_base_url}/api/embeddings",
            json={"model": settings.ollama_embed_model, "prompt": text},
        )
        resp.raise_for_status()
        return resp.json()["embedding"]


async def embed_sections(sections: list[StructuredSection]) -> list[list[float]]:
    vectors = []
    for section in sections:
        if section.type == "figure":
            vectors.append([0.0] * 768)
            continue
        vec = await embed_text(section.content[:2000])  # cap token length
        vectors.append(vec)
    return vectors
