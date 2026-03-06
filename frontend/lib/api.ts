/** Base URL for API. Port 8990 = DocuMind frontend; use localhost:8000 for API. Port 80 = nginx; use same origin. */
function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    if (["8990", "8991", "3000"].includes(window.location.port)) return "http://localhost:8000";
    return ""; // same origin (e.g. documind.packt.localhost:80) — nginx proxies /documents, /queries
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

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
  file_size?: number | null; // size in bytes
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
  const base = getApiBase();
  const res = await fetch(`${base}/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

const FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  const res = await fetchWithTimeout(`${getApiBase()}/documents/`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const res = await fetch(`${getApiBase()}/documents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function getDocumentStatus(id: string): Promise<DocumentStatus> {
  const res = await fetch(`${getApiBase()}/documents/${id}/status`);
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function* streamQuery(
  documentId: string,
  question: string
): AsyncGenerator<{ type: "token"; content: string } | { type: "done"; sources: QuerySource[] }> {
  const res = await fetch(`${getApiBase()}/documents/query`, {
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
