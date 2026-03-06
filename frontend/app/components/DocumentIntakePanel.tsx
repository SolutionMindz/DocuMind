"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadDocument, type DocumentDetail } from "@/lib/api";

type ProcessingStage = "Queued" | "Processing..." | "Done" | "Error";
type ValidationStatus = "Valid" | "Validation Failed" | "Pending";

interface StatusPanelProps {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}

function StatusPanel({ label, value, valueClassName = "font-semibold text-gray-900" }: StatusPanelProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-sm ${valueClassName}`}>{value}</p>
    </div>
  );
}

interface DocumentIntakePanelProps {
  /** When viewing an existing document, pass its data to show status grid only (no upload). */
  document?: {
    filename: string;
    status: string;
    file_size?: number | null;
    sections?: { page_num: number; type?: string }[];
  } | null;
  /** Called after a new document is uploaded (e.g. redirect to document page). */
  onUploaded?: (doc: DocumentDetail) => void;
  /** If true, show the upload zone. If false and document is set, show read-only doc name in dashed area. */
  showUpload?: boolean;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getProcessingStage(status: string): ProcessingStage {
  const map: Record<string, ProcessingStage> = {
    queued: "Queued",
    processing: "Processing...",
    ready: "Done",
    error: "Error",
  };
  return map[status] ?? (status as ProcessingStage);
}

function getValidationStatus(status: string): ValidationStatus {
  if (status === "ready") return "Valid";
  if (status === "error") return "Validation Failed";
  return "Pending";
}

export default function DocumentIntakePanel({
  document: doc,
  onUploaded,
  showUpload = true,
}: DocumentIntakePanelProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length || !onUploaded) return;
      setUploading(true);
      setError(null);
      try {
        const newDoc = await uploadDocument(accepted[0]);
        onUploaded(newDoc);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: false,
    disabled: uploading || (!showUpload && !!doc),
  });

  const uploadStatus = doc ? "Uploaded" : uploading ? "Uploading..." : "—";
  const processingStage = doc ? getProcessingStage(doc.status) : "—";
  const validationStatus = doc ? getValidationStatus(doc.status) : "—";
  const fileSize = doc?.file_size != null ? formatFileSize(doc.file_size) : (doc ? "—" : "—");
  const sections = doc?.sections ?? [];
  const pageCount =
    sections.length > 0
      ? String(Math.max(...sections.map((s) => s.page_num)))
      : doc
        ? "—"
        : "—";

  const structureLabel =
    sections.length > 0
      ? (() => {
          const byType: Record<string, number> = {};
          for (const s of sections) {
            const t = s.type ?? "paragraph";
            byType[t] = (byType[t] ?? 0) + 1;
          }
          const head = byType.heading ? `${byType.heading} heading${byType.heading !== 1 ? "s" : ""}` : "";
          const tbl = byType.table ? `${byType.table} table${byType.table !== 1 ? "s" : ""}` : "";
          const parts = [head, tbl].filter(Boolean);
          return parts.length > 0 ? parts.join(", ") : `${sections.length} sections`;
        })()
      : doc
        ? "—"
        : "—";

  const showStatusGrid = doc != null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">1. Document Intake Panel</h2>

      {/* Upload / document area */}
      {showUpload && !doc ? (
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragActive
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/50"
          } ${uploading ? "opacity-60" : ""}`}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-gray-500">
            Drag & drop .docx or .pdf here, or click to select
          </p>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      ) : doc ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-10 text-center">
          <p className="text-sm font-medium text-gray-700">{doc.filename}</p>
          <p className="mt-1 text-xs text-gray-400">Document loaded</p>
        </div>
      ) : null}

      {/* Status and info grid */}
      {showStatusGrid && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatusPanel label="UPLOAD STATUS" value={uploadStatus} />
          <StatusPanel label="PROCESSING STAGE" value={processingStage} />
          <StatusPanel
            label="VALIDATION STATUS"
            value={validationStatus}
            valueClassName={
              validationStatus === "Validation Failed"
                ? "font-semibold rounded bg-red-600 px-2 py-0.5 text-white inline-block"
                : "font-semibold text-gray-900"
            }
          />
          <StatusPanel label="FILE SIZE" value={fileSize} />
          <StatusPanel label="PAGES" value={pageCount} />
          <StatusPanel label="SECTIONS" value={structureLabel} />
        </div>
      )}
    </div>
  );
}
