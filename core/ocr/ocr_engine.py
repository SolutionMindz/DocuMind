from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image

_ocr = None


def _get_ocr():
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR
        _ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr


@dataclass
class OcrBlock:
    text: str
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1
    confidence: float
    page_num: int


def extract(image_bytes: bytes, page_num: int = 1) -> list[OcrBlock]:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    ocr = _get_ocr()
    result = ocr.ocr(image, cls=True)

    blocks = []
    if not result or not result[0]:
        return blocks

    for line in result[0]:
        if not line:
            continue
        poly, (text, confidence) = line
        # poly is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        bbox = (min(xs), min(ys), max(xs), max(ys))
        blocks.append(OcrBlock(text=text.strip(), bbox=bbox, confidence=confidence, page_num=page_num))

    return blocks
