"use client";

import { useCallback, useEffect, useState } from "react";
import DocumentCard from "./components/DocumentCard";
import UploadZone from "./components/UploadZone";
import { listDocuments, type DocumentDetail, type DocumentListItem } from "@/lib/api";

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setListError(null);
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  function handleUploaded(doc: DocumentDetail) {
    setDocuments((prev) => [doc, ...prev]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a PDF to extract structure and query it with AI.
        </p>
      </div>

      <UploadZone onUploaded={handleUploaded} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Recent documents
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : listError ? (
          <p className="text-sm text-amber-600">
            {listError}. Ensure the API is running on port 8000.
          </p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-500">No documents yet. Upload one above.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
