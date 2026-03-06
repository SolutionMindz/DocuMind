from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pdfplumber


@dataclass
class ExtractedTable:
    columns: list[str]
    rows: list[list[str]]
    page_num: int
    bbox: tuple[float, float, float, float] | None


def extract(file_path: str | Path, page_nums: list[int] | None = None) -> list[ExtractedTable]:
    tables = []

    with pdfplumber.open(str(file_path)) as pdf:
        pages = pdf.pages if page_nums is None else [pdf.pages[n - 1] for n in page_nums if 0 < n <= len(pdf.pages)]

        for page in pages:
            page_num = page.page_number
            for table in page.extract_tables():
                if not table or len(table) < 1:
                    continue

                # First row is header if it exists
                raw_header = table[0] if table else []
                columns = [str(c).strip() if c else f"col_{i}" for i, c in enumerate(raw_header)]

                rows = []
                for row in table[1:]:
                    rows.append([str(cell).strip() if cell is not None else "" for cell in row])

                bbox = None
                try:
                    tb = page.find_tables()
                    if tb:
                        bbox_obj = tb[len(tables) % len(tb)].bbox
                        bbox = tuple(bbox_obj)
                except Exception:
                    pass

                tables.append(ExtractedTable(columns=columns, rows=rows, page_num=page_num, bbox=bbox))

    return tables
