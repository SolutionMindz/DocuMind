"use client";

import type { Section } from "@/lib/api";

interface Props {
  sections: Section[];
}

const TYPE_LABEL: Record<string, string> = {
  heading: "headings",
  paragraph: "paragraphs",
  list: "lists",
  table: "tables",
  figure: "figures",
};

function getCountsByType(sections: Section[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of sections) {
    counts[s.type] = (counts[s.type] ?? 0) + 1;
  }
  return counts;
}

function formatSummary(counts: Record<string, number>): string {
  const parts: string[] = [];
  const order = ["heading", "paragraph", "table", "list", "figure"];
  for (const type of order) {
    const n = counts[type] ?? 0;
    if (n > 0) parts.push(`${n} ${TYPE_LABEL[type] ?? type}`);
  }
  return parts.length > 0 ? parts.join(", ") : "No sections";
}

export default function StructureSummary({ sections }: Props) {
  if (!sections.length) {
    return (
      <p className="text-sm text-gray-500">No structure data yet.</p>
    );
  }

  const counts = getCountsByType(sections);
  const summary = formatSummary(counts);
  const hasTables = (counts.table ?? 0) > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm font-medium text-gray-700">{summary}</p>
      <p className="mt-1 text-xs text-gray-500">
        Layout: headings detected, sections segmented
        {hasTables ? ", tables extracted" : ""}.
      </p>
    </div>
  );
}
