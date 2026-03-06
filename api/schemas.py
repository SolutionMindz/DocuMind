from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    filename: str


class SectionOut(BaseModel):
    id: uuid.UUID
    type: str
    content: str
    page_num: int
    bbox_json: dict | None
    order_idx: int

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    created_at: datetime
    structured_json: dict | None = None
    sections: list[SectionOut] = []

    class Config:
        from_attributes = True


class DocumentListItem(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentStatus(BaseModel):
    status: str


class QueryRequest(BaseModel):
    document_id: uuid.UUID
    question: str
