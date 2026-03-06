"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DocumentIntakePanel from "../../components/DocumentIntakePanel";
import QueryBox from "../../components/QueryBox";
import StructureSummary from "../../components/StructureSummary";
import StructuredViewer from "../../components/StructuredViewer";
import { getDocument, getDocumentStatus, type DocumentDetail } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  processing: "Processing...",
  ready: "Ready",
  error: "Error",
};

const STATUS_COLOR: Record<string, string> = {
  queued: "text-yellow-600",
  processing: "text-blue-600",
  ready: "text-green-600",
  error: "text-red-600",
};

export default function DocumentPage() {
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const data = await getDocument(id);
      setDoc(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  // Poll status until ready or error
  useEffect(() => {
    if (!doc || doc.status === "ready" || doc.status === "error") return;

    const interval = setInterval(async () => {
      try {
        const { status } = await getDocumentStatus(id);
        if (status === "ready" || status === "error") {
          clearInterval(interval);
          fetchDoc();
        } else {
          setDoc((prev) =>
            prev
              ? { ...prev, status: status as DocumentDetail["status"] }
              : prev
          );
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [doc?.status, id, fetchDoc]);

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!doc) return null;

  const statusColor = STATUS_COLOR[doc.status] ?? "text-gray-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Back
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="flex-1 truncate text-xl font-bold text-gray-900">{doc.filename}</h1>
        <span className={`text-sm font-medium ${statusColor}`}>
          {STATUS_LABEL[doc.status] ?? doc.status}
          {doc.status === "processing" && (
            <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
        </span>
      </div>

      {/* Document Intake Panel: upload status, processing stage, validation, file size, pages */}
      <DocumentIntakePanel
        document={{
          filename: doc.filename,
          status: doc.status,
          file_size: doc.file_size ?? undefined,
          sections: doc.sections ?? [],
        }}
        showUpload={false}
      />

      {doc.status === "ready" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 overflow-y-auto max-h-[75vh]">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Document Structure
            </h2>
            <StructureSummary sections={doc.sections ?? []} />
            <div className="mt-4">
              <StructuredViewer sections={doc.sections ?? []} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 flex flex-col max-h-[75vh]">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Ask AI
            </h2>
            <QueryBox documentId={doc.id} disabled={doc.status !== "ready"} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-500">
            {doc.status === "error"
              ? "Processing failed. Please try uploading again."
              : "Processing your document... this may take a minute."}
          </p>
        </div>
      )}
    </div>
  );
}
