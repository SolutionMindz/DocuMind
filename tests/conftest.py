"""
Shared pytest fixtures for DocuMind tests.

asyncpg's connection pool binds to the current event loop at creation time.
pytest-asyncio (in its default "function" loop scope) creates a fresh event
loop per test, so we must re-initialize the engine inside each async fixture
rather than in a session-scoped fixture.
"""
from __future__ import annotations

import io
import uuid
from collections.abc import AsyncGenerator

import fitz  # PyMuPDF
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from api.dependencies import get_settings
from api.main import app
from db.database import get_session_factory, init_engine
from db.models import Document


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """
    Async HTTP client wired to the FastAPI ASGI app.

    Re-initializes the DB engine inside this fixture so the asyncpg
    connection pool is bound to the current test's event loop.
    """
    settings = get_settings()
    init_engine(settings.database_url)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Minimal in-memory PDF with text content for upload tests."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "DocuMind Integration Test", fontsize=18)
    page.insert_text((72, 120), "This is a paragraph used for API testing.", fontsize=12)
    page.insert_text((72, 150), "- First list item", fontsize=12)
    page.insert_text((72, 170), "- Second list item", fontsize=12)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


@pytest_asyncio.fixture
async def cleanup_documents() -> AsyncGenerator[list[uuid.UUID], None]:
    """
    Yields a list that tests can append document UUIDs to.
    After the test all listed documents are deleted from the DB.
    """
    created: list[uuid.UUID] = []
    yield created

    if created:
        factory = get_session_factory()
        async with factory() as session:
            await session.execute(
                delete(Document).where(Document.id.in_(created))
            )
            await session.commit()
