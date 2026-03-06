import type { Section } from "@/lib/api";

interface Props {
  sections: Section[];
}

export default function StructuredViewer({ sections }: Props) {
  if (!sections.length) {
    return <p className="text-sm text-gray-400">No content available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sections.map((sec) => (
        <SectionBlock key={sec.id} section={sec} />
      ))}
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  switch (section.type) {
    case "heading":
      return (
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-1">
          {section.content}
        </h2>
      );
    case "table":
      return <TableBlock content={section.content} />;
    case "list":
      return (
        <p className="pl-4 text-sm text-gray-700 border-l-2 border-indigo-200">
          {section.content}
        </p>
      );
    case "figure":
      return (
        <div className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-400 italic">
          [Figure on page {section.page_num}]
        </div>
      );
    default:
      return <p className="text-sm leading-relaxed text-gray-700">{section.content}</p>;
  }
}

function TableBlock({ content }: { content: string }) {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return <pre className="text-xs text-gray-600">{content}</pre>;

  const parseRow = (line: string) =>
    line
      .split("|")
      .filter((_, i, arr) => i > 0 && i < arr.length - 1)
      .map((cell) => cell.trim());

  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);

  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 text-xs">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
