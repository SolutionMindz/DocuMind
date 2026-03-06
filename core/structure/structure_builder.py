from __future__ import annotations

from dataclasses import asdict, dataclass

from core.layout.layout_detector import LayoutBlock
from core.tables.table_extractor import ExtractedTable


@dataclass
class StructuredSection:
    type: str  # heading, paragraph, list, table, figure
    content: str
    page_num: int
    bbox: tuple | None
    order_idx: int
    table_data: dict | None = None  # only for type == "table"


def build(
    layout_blocks: list[LayoutBlock],
    tables: list[ExtractedTable],
) -> tuple[dict, list[StructuredSection]]:
    sections: list[StructuredSection] = []

    # Add layout blocks
    for block in layout_blocks:
        sections.append(
            StructuredSection(
                type=block.block_type,
                content=block.text,
                page_num=block.page_num,
                bbox=block.bbox,
                order_idx=block.order_idx,
            )
        )

    # Inject tables — find insertion point by page and approximate y-position
    base_order = len(sections)
    for i, table in enumerate(tables):
        table_text = _table_to_markdown(table)
        sections.append(
            StructuredSection(
                type="table",
                content=table_text,
                page_num=table.page_num,
                bbox=table.bbox,
                order_idx=base_order + i,
                table_data={"columns": table.columns, "rows": table.rows},
            )
        )

    # Sort by page, then order_idx
    sections.sort(key=lambda s: (s.page_num, s.order_idx))
    # Re-index after sort
    for idx, sec in enumerate(sections):
        sec.order_idx = idx

    # Build top-level JSON structure
    title = next((s.content for s in sections if s.type == "heading"), "Untitled")
    structured = {
        "title": title,
        "pages": _group_by_page(sections),
        "tables": [{"page": t.page_num, "columns": t.columns, "rows": t.rows} for t in tables],
    }

    return structured, sections


def _table_to_markdown(table: ExtractedTable) -> str:
    if not table.columns:
        return ""
    header = "| " + " | ".join(table.columns) + " |"
    separator = "| " + " | ".join("---" for _ in table.columns) + " |"
    rows = ["| " + " | ".join(row) + " |" for row in table.rows]
    return "\n".join([header, separator] + rows)


def _group_by_page(sections: list[StructuredSection]) -> list[dict]:
    pages: dict[int, list[dict]] = {}
    for sec in sections:
        pages.setdefault(sec.page_num, []).append(
            {
                "type": sec.type,
                "content": sec.content,
                "order_idx": sec.order_idx,
                **({"table_data": sec.table_data} if sec.table_data else {}),
            }
        )
    return [{"page": p, "sections": secs} for p, secs in sorted(pages.items())]
