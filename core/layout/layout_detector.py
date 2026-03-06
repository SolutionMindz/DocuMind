from __future__ import annotations

import re
import statistics
from dataclasses import dataclass

from core.parser.pdf_parser import TextBlock


@dataclass
class LayoutBlock:
    text: str
    block_type: str  # heading, paragraph, list, figure
    bbox: tuple[float, float, float, float]
    font_size: float
    page_num: int
    order_idx: int


_LIST_PATTERN = re.compile(r"^(\s*[-•*]|\s*\d+[.)]\s)")


def classify(text_blocks: list[TextBlock]) -> list[LayoutBlock]:
    if not text_blocks:
        return []

    # Compute median font size across all spans
    sizes = [b.font_size for b in text_blocks if b.font_size > 0]
    median_size = statistics.median(sizes) if sizes else 12.0

    # Group consecutive spans with same block_no on same page into logical blocks
    grouped: dict[tuple[int, int], list[TextBlock]] = {}
    for block in text_blocks:
        key = (block.page_num, block.block_no)
        grouped.setdefault(key, []).append(block)

    layout_blocks = []
    order_idx = 0

    for (page_num, _), spans in sorted(grouped.items()):
        combined_text = " ".join(s.text for s in spans).strip()
        if not combined_text:
            continue

        max_font = max(s.font_size for s in spans)
        x0 = min(s.bbox[0] for s in spans)
        y0 = min(s.bbox[1] for s in spans)
        x1 = max(s.bbox[2] for s in spans)
        y1 = max(s.bbox[3] for s in spans)
        bbox = (x0, y0, x1, y1)

        # Classify
        if max_font >= median_size * 1.2 or (len(combined_text) < 80 and max_font >= median_size * 1.1):
            block_type = "heading"
        elif _LIST_PATTERN.match(combined_text):
            block_type = "list"
        else:
            block_type = "paragraph"

        layout_blocks.append(
            LayoutBlock(
                text=combined_text,
                block_type=block_type,
                bbox=bbox,
                font_size=max_font,
                page_num=page_num,
                order_idx=order_idx,
            )
        )
        order_idx += 1

    return layout_blocks
