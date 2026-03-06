const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface DocumentListItem {
  id: string;
  filename: string;
  status: "queued" | "processing" | "ready" | "error";
  created_at: string;
}

export interface Section {
  id: string;
  type: "heading" | "paragraph" | "list" | "table" | "figure";
  content: string;
  page_num: number;
  bbox_json: Record<string, unknown> | null;
  order_idx: number;
}

export interface DocumentDetail extends DocumentListItem {
  structured_json: Record<string, unknown> | null;
  sections: Section[];
}

export interface DocumentStatus {
  status: string;
}

export interface QuerySource {
  id: string;
  content: string;
}

export async function uploadDocument(file: File): Promise<DocumentDetail> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  const res = await fetch(`${API_BASE}/documents/`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const res = await fetch(`${API_BASE}/documents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function getDocumentStatus(id: string): Promise<DocumentStatus> {
  const res = await fetch(`${API_BASE}/documents/${id}/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function* streamQuery(
  documentId: string,
  question: string
): AsyncGenerator<{ type: "token"; content: string } | { type: "done"; sources: QuerySource[] }> {
  const res = await fetch(`${API_BASE}/documents/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId, question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Query failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}
