from __future__ import annotations

import asyncio
import uuid

from celery import shared_task
from celery.utils.log import get_task_logger
from sqlalchemy import select

from api.dependencies import get_settings
from core.layout.layout_detector import classify
from core.ocr.ocr_engine import extract as ocr_extract
from core.parser.pdf_parser import parse as pdf_parse
from core.structure.structure_builder import build as build_structure
from core.tables.table_extractor import extract as table_extract
from db.database import get_session_factory, init_engine
from db.models import Document, Embedding, Section
from workers.celery_app import celery_app

logger = get_task_logger(__name__)


def _get_session_factory():
    settings = get_settings()
    init_engine(settings.database_url)
    return get_session_factory()


@celery_app.task(bind=True, name="workers.tasks.process_document")
def process_document(self, document_id: str):
    asyncio.run(_process_document_async(document_id))


async def _process_document_async(document_id: str):
    from ai.embeddings.embedder import embed_sections

    session_factory = _get_session_factory()
    doc_uuid = uuid.UUID(document_id)

    async with session_factory() as session:
        result = await session.execute(select(Document).where(Document.id == doc_uuid))
        doc = result.scalar_one_or_none()
        if not doc:
            logger.error(f"Document {document_id} not found")
            return

        try:
            doc.status = "processing"
            await session.commit()

            # Step 1: Parse PDF
            pages = pdf_parse(doc.file_path)
            logger.info(f"Parsed {len(pages)} pages from {doc.filename}")

            # Step 2: OCR for scanned pages
            all_text_blocks = []
            for page in pages:
                if page.is_scanned and page.image:
                    ocr_blocks = ocr_extract(page.image, page.page_num)
                    # Convert OcrBlock to TextBlock-compatible for layout detection
                    from core.parser.pdf_parser import TextBlock
                    for ob in ocr_blocks:
                        all_text_blocks.append(
                            TextBlock(
                                text=ob.text,
                                bbox=ob.bbox,
                                font_size=12.0,
                                font_name="ocr",
                                page_num=ob.page_num,
                                block_no=0,
                            )
                        )
                else:
                    all_text_blocks.extend(page.text_blocks)

            # Step 3: Layout classification
            layout_blocks = classify(all_text_blocks)

            # Step 4: Table extraction
            tables = table_extract(doc.file_path)
            logger.info(f"Extracted {len(tables)} tables")

            # Step 5: Build structured output
            structured_json, sections = build_structure(layout_blocks, tables)
            doc.structured_json = structured_json

            # Step 6: Persist sections
            section_records = []
            for sec in sections:
                record = Section(
                    id=uuid.uuid4(),
                    document_id=doc_uuid,
                    type=sec.type,
                    content=sec.content,
                    page_num=sec.page_num,
                    bbox_json={"bbox": list(sec.bbox)} if sec.bbox else None,
                    order_idx=sec.order_idx,
                )
                session.add(record)
                section_records.append((record, sec))

            await session.flush()

            # Step 7: Embed sections
            structured_sections = [s for _, s in section_records]
            vectors = await embed_sections(structured_sections)

            for (record, _), vector in zip(section_records, vectors):
                if any(v != 0.0 for v in vector):
                    emb = Embedding(id=uuid.uuid4(), section_id=record.id, embedding=vector)
                    session.add(emb)

            doc.status = "ready"
            await session.commit()
            logger.info(f"Document {document_id} processed successfully")

        except Exception as exc:
            doc.status = "error"
            await session.commit()
            logger.exception(f"Error processing document {document_id}: {exc}")
            raise
