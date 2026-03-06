from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.reasoning.query_engine import query_document
from api.schemas import QueryRequest
from db.database import get_db
from db.models import Document

router = APIRouter(prefix="/documents", tags=["queries"])


@router.post("/query")
async def query(request: QueryRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document.status).where(Document.id == request.document_id)
    )
    status = result.scalar_one_or_none()
    if status is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if status != "ready":
        raise HTTPException(status_code=400, detail=f"Document is not ready (status: {status})")

    async def event_stream():
        async for chunk in query_document(request.document_id, request.question, db):
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/event-stream")
