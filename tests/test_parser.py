import io
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


def _make_mock_doc(spans: list[dict]):
    span_mock = MagicMock()
    span_mock.get.side_effect = lambda k, d=None: {
        "text": "Sample heading",
        "bbox": (10.0, 10.0, 200.0, 30.0),
        "size": 18.0,
        "font": "Arial-Bold",
    }.get(k, d)

    line_mock = MagicMock()
    line_mock.get.return_value = [span_mock]

    block_mock = MagicMock()
    block_mock.get.side_effect = lambda k, d=None: {
        "type": 0,
        "lines": [line_mock],
        "number": 0,
    }.get(k, d)

    page_mock = MagicMock()
    page_mock.rect = MagicMock(width=595.0, height=842.0)
    page_mock.get_text.return_value = {"blocks": [block_mock]}
    page_mock.get_images.return_value = []

    doc_mock = MagicMock()
    doc_mock.__len__ = MagicMock(return_value=1)
    doc_mock.__getitem__ = MagicMock(return_value=page_mock)
    return doc_mock


def test_parse_returns_pages():
    with patch("fitz.open") as mock_open:
        mock_open.return_value = _make_mock_doc([])
        from core.parser.pdf_parser import parse
        pages = parse("/fake/path.pdf")
        assert len(pages) == 1
        assert pages[0].page_num == 1


def test_parse_extracts_text_blocks():
    with patch("fitz.open") as mock_open:
        mock_open.return_value = _make_mock_doc([])
        from core.parser.pdf_parser import parse
        pages = parse("/fake/path.pdf")
        assert len(pages[0].text_blocks) == 1
        assert pages[0].text_blocks[0].text == "Sample heading"
        assert pages[0].text_blocks[0].font_size == 18.0
