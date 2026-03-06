"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadDocument, type DocumentDetail } from "@/lib/api";

interface Props {
  onUploaded: (doc: DocumentDetail) => void;
}

export default function UploadZone({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true);
      setError(null);
      try {
        const doc = await uploadDocument(accepted[0]);
        onUploaded(doc);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Upload failed";
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
        isDragActive
          ? "border-violet-500 bg-violet-50"
          : "border-violet-200 bg-violet-50/50 hover:border-violet-300 hover:bg-violet-50"
      } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <svg
          className="h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {uploading ? (
          <p className="text-sm font-medium text-violet-600">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-sm font-medium text-gray-700">Drop your PDF here</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">
              Drag and drop a PDF, or click to browse
            </p>
            <p className="text-xs text-gray-500">PDF files only</p>
          </>
        )}
        {error && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
