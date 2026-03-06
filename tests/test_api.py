"""
API integration tests for the DocuMind FastAPI application.

Tests run against the real PostgreSQL database using the ASGI transport
(no actual HTTP server needed). The Celery task is NOT awaited — we only
verify the HTTP contract (status codes, response shapes, DB side-effects).
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


async def test_health(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Document list
# ---------------------------------------------------------------------------


async def test_list_documents_returns_list(client: AsyncClient) -> None:
    resp = await client.get("/documents/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------


async def test_upload_pdf_success(
    client: AsyncClient,
    sample_pdf_bytes: bytes,
    cleanup_documents: list[uuid.UUID],
) -> None:
    resp = await client.post(
        "/documents/upload",
        files={"file": ("test.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["filename"] == "test.pdf"
    assert body["status"] == "queued"
    assert "id" in body
    assert body["sections"] == []
    cleanup_documents.append(uuid.UUID(body["id"]))


async def test_upload_non_pdf_rejected(
    client: AsyncClient,
) -> None:
    resp = await client.post(
        "/documents/upload",
        files={"file": ("report.docx", b"fake content", "application/octet-stream")},
    )
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


async def test_upload_no_file_rejected(client: AsyncClient) -> None:
    resp = await client.post("/documents/upload")
    assert resp.status_code == 422  # FastAPI validation error


# ---------------------------------------------------------------------------
# Get document
# ---------------------------------------------------------------------------


async def test_get_document_returns_correct_shape(
    client: AsyncClient,
    sample_pdf_bytes: bytes,
    cleanup_documents: list[uuid.UUID],
) -> None:
    # Upload first
    up = await client.post(
        "/documents/upload",
        files={"file": ("shape_test.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert up.status_code == 202
    doc_id = up.json()["id"]
    cleanup_documents.append(uuid.UUID(doc_id))

    # Fetch
    resp = await client.get(f"/documents/{doc_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == doc_id
    assert body["filename"] == "shape_test.pdf"
    assert "status" in body
    assert "sections" in body
    assert isinstance(body["sections"], list)


async def test_get_document_not_found(client: AsyncClient) -> None:
    missing_id = uuid.uuid4()
    resp = await client.get(f"/documents/{missing_id}")
    assert resp.status_code == 404


async def test_get_document_invalid_uuid(client: AsyncClient) -> None:
    resp = await client.get("/documents/not-a-uuid")
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Document status
# ---------------------------------------------------------------------------


async def test_get_status_after_upload(
    client: AsyncClient,
    sample_pdf_bytes: bytes,
    cleanup_documents: list[uuid.UUID],
) -> None:
    up = await client.post(
        "/documents/upload",
        files={"file": ("status_test.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert up.status_code == 202
    doc_id = up.json()["id"]
    cleanup_documents.append(uuid.UUID(doc_id))

    resp = await client.get(f"/documents/{doc_id}/status")
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body
    assert body["status"] in {"queued", "processing", "ready", "error"}


async def test_get_status_not_found(client: AsyncClient) -> None:
    missing_id = uuid.uuid4()
    resp = await client.get(f"/documents/{missing_id}/status")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Query — document not ready
# ---------------------------------------------------------------------------


async def test_query_document_not_ready_returns_400(
    client: AsyncClient,
    sample_pdf_bytes: bytes,
    cleanup_documents: list[uuid.UUID],
) -> None:
    up = await client.post(
        "/documents/upload",
        files={"file": ("query_test.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert up.status_code == 202
    doc_id = up.json()["id"]
    cleanup_documents.append(uuid.UUID(doc_id))

    # Document is freshly queued — query should be rejected
    resp = await client.post(
        "/documents/query",
        json={"document_id": doc_id, "question": "What is this document about?"},
    )
    assert resp.status_code == 400
    assert "not ready" in resp.json()["detail"].lower()


async def test_query_document_not_found_returns_404(
    client: AsyncClient,
) -> None:
    missing_id = uuid.uuid4()
    resp = await client.post(
        "/documents/query",
        json={"document_id": str(missing_id), "question": "Anything?"},
    )
    assert resp.status_code == 404


async def test_query_missing_question_returns_422(
    client: AsyncClient,
    sample_pdf_bytes: bytes,
    cleanup_documents: list[uuid.UUID],
) -> None:
    up = await client.post(
        "/documents/upload",
        files={"file": ("val_test.pdf", sample_pdf_bytes, "application/pdf")},
    )
    doc_id = up.json()["id"]
    cleanup_documents.append(uuid.UUID(doc_id))

    resp = await client.post(
        "/documents/query",
        json={"document_id": doc_id},  # missing 'question'
    )
    assert resp.status_code == 422
