from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF


@dataclass
class TextBlock:
    text: str
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1
    font_size: float
    font_name: str
    page_num: int
    block_no: int


@dataclass
class ParsedPage:
    page_num: int
    width: float
    height: float
    text_blocks: list[TextBlock] = field(default_factory=list)
    image: bytes | None = None  # PNG bytes for OCR fallback
    is_scanned: bool = False


def parse(file_path: str | Path) -> list[ParsedPage]:
    doc = fitz.open(str(file_path))
    pages = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_num = page_idx + 1
        rect = page.rect

        parsed = ParsedPage(
            page_num=page_num,
            width=rect.width,
            height=rect.height,
        )

        raw = page.get_text("dict")
        blocks = raw.get("blocks", [])

        text_blocks = []
        for block in blocks:
            if block.get("type") != 0:  # 0 = text block
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    text_blocks.append(
                        TextBlock(
                            text=text,
                            bbox=tuple(span["bbox"]),
                            font_size=round(span.get("size", 12.0), 2),
                            font_name=span.get("font", ""),
                            page_num=page_num,
                            block_no=block.get("number", 0),
                        )
                    )

        parsed.text_blocks = text_blocks

        # Detect scanned pages: very few text characters but has images
        total_chars = sum(len(b.text) for b in text_blocks)
        image_list = page.get_images()
        if total_chars < 50 and len(image_list) > 0:
            parsed.is_scanned = True
            mat = fitz.Matrix(2.0, 2.0)  # 2x scale for better OCR
            clip = page.get_pixmap(matrix=mat)
            parsed.image = clip.tobytes("png")

        pages.append(parsed)

    doc.close()
    return pages
