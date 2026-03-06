from core.layout.layout_detector import classify
from core.parser.pdf_parser import TextBlock


def _block(text: str, font_size: float, page: int = 1, block_no: int = 0) -> TextBlock:
    return TextBlock(
        text=text,
        bbox=(0.0, 0.0, 100.0, 20.0),
        font_size=font_size,
        font_name="Arial",
        page_num=page,
        block_no=block_no,
    )


def test_heading_classification():
    blocks = [
        _block("Introduction", font_size=20.0, block_no=0),
        _block("This is a paragraph with more text here.", font_size=12.0, block_no=1),
    ]
    result = classify(blocks)
    types = {b.text: b.block_type for b in result}
    assert types["Introduction"] == "heading"
    assert types["This is a paragraph with more text here."] == "paragraph"


def test_list_classification():
    blocks = [
        _block("- First item", font_size=12.0, block_no=0),
        _block("• Second item", font_size=12.0, block_no=1),
    ]
    result = classify(blocks)
    for b in result:
        assert b.block_type == "list"


def test_empty_blocks():
    assert classify([]) == []
