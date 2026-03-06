from core.layout.layout_detector import LayoutBlock
from core.structure.structure_builder import build
from core.tables.table_extractor import ExtractedTable


def test_build_basic():
    blocks = [
        LayoutBlock(text="Annual Report", block_type="heading", bbox=(0, 0, 200, 30), font_size=18, page_num=1, order_idx=0),
        LayoutBlock(text="This is the introduction.", block_type="paragraph", bbox=(0, 40, 500, 60), font_size=12, page_num=1, order_idx=1),
    ]
    structured, sections = build(blocks, [])
    assert structured["title"] == "Annual Report"
    assert len(sections) == 2
    assert sections[0].type == "heading"


def test_build_with_table():
    blocks = [
        LayoutBlock(text="Revenue Table", block_type="heading", bbox=(0, 0, 200, 30), font_size=18, page_num=1, order_idx=0),
    ]
    tables = [
        ExtractedTable(columns=["Name", "Amount"], rows=[["Alice", "100"]], page_num=1, bbox=None)
    ]
    structured, sections = build(blocks, tables)
    assert len(structured["tables"]) == 1
    assert structured["tables"][0]["columns"] == ["Name", "Amount"]
    table_sections = [s for s in sections if s.type == "table"]
    assert len(table_sections) == 1
