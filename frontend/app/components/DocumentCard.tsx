import Link from "next/link";
import type { DocumentListItem } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  ready: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

interface Props {
  doc: DocumentListItem;
}

export default function DocumentCard({ doc }: Props) {
  const badgeClass = STATUS_STYLES[doc.status] ?? "bg-gray-100 text-gray-600";
  const date = new Date(doc.created_at).toLocaleString();

  return (
    <Link
      href={`/d/${doc.id}`}
      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:shadow-md"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-900">{doc.filename}</p>
        <p className="mt-0.5 text-xs text-gray-400">{date}</p>
      </div>
      <span className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
        {doc.status}
      </span>
    </Link>
  );
}
