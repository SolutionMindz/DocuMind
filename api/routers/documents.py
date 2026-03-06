from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.dependencies import get_settings
from api.schemas import DocumentListItem, DocumentOut, DocumentStatus
from db.database import get_db
from db.models import Document
from workers.tasks import process_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentOut, status_code=202)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    doc_id = uuid.uuid4()
    file_path = upload_dir / f"{doc_id}_{file.filename}"

    content = await file.read()
    file_path.write_bytes(content)

    doc = Document(
        id=doc_id,
        filename=file.filename,
        file_path=str(file_path),
        status="queued",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Enqueue processing task
    process_document.delay(str(doc_id))

    # Build response directly — avoids lazy-loading the sections relationship
    # in an async context (would raise MissingGreenlet).
    return DocumentOut(
        id=doc.id,
        filename=doc.filename,
        status=doc.status,
        created_at=doc.created_at,
        structured_json=doc.structured_json,
        sections=[],
    )


@router.get("/", response_model=list[DocumentListItem])
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.sections))
        .where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/{document_id}/status", response_model=DocumentStatus)
async def get_document_status(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document.status).where(Document.id == document_id))
    status = result.scalar_one_or_none()
    if status is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentStatus(status=status)
