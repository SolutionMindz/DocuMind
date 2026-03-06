# DocuMind — AI Document Intelligence Engine

**DocuMind** is an AI-powered document intelligence platform that converts unstructured documents (PDFs, scanned pages) into structured, machine-readable knowledge. Upload a PDF, and the system parses it, detects layout (headings, paragraphs, tables), runs OCR where needed, builds a structured representation, stores embeddings in PostgreSQL (pgvector), and lets you query documents with natural language via an LLM.

The long-term goal is to build an open, modular alternative to enterprise document intelligence platforms.

---

## Features

- **Document upload** — PDF upload with drag-and-drop; processing runs in the background (Celery).
- **Document parsing** — PyMuPDF-based parser; extracts text blocks, metadata, and page images for OCR.
- **OCR** — PaddleOCR for scanned or image-heavy pages.
- **Layout detection** — Classifies blocks (headings, paragraphs, lists, tables, figures).
- **Table extraction** — Structured table extraction from documents.
- **Structure builder** — Combines parser, OCR, and layout into a single structured document (sections with type and content).
- **Vector storage** — Section-level embeddings (Ollama) stored in PostgreSQL with pgvector for semantic search.
- **AI document querying** — Ask questions in natural language; the system retrieves relevant sections and generates answers via an LLM (Ollama).
- **Web UI** — Next.js frontend: document list, upload zone, document detail with structure viewer and query box; optional nginx setup for a custom host (e.g. `documind.packt.localhost`).

---

## Architecture (high-level)

```
Document Upload
    ↓
Document Parser (PyMuPDF)
    ↓
Layout Detection
    ↓
OCR (PaddleOCR, for scanned pages)
    ↓
Table Extraction
    ↓
Structure Builder
    ↓
Structured output (sections) → PostgreSQL + pgvector (embeddings)
    ↓
AI Query (embed query → vector search → LLM) — Ollama
```

---

## Technology stack

| Layer        | Technology |
|-------------|------------|
| **Backend** | Python, FastAPI, SQLAlchemy (async), asyncpg |
| **Document**| PyMuPDF, PaddleOCR, pdfplumber |
| **Database**| PostgreSQL, pgvector |
| **Queue**   | Redis, Celery |
| **AI**      | Ollama (LLM + embedding models) |
| **Frontend**| Next.js 15, React 19, TailwindCSS |

---

## Project structure

```
DocuMind/
├── api/                    # FastAPI app and routers
│   ├── main.py              # App entry, CORS, lifespan
│   ├── dependencies.py      # Settings (env), get_db
│   ├── schemas.py           # Pydantic models
│   └── routers/
│       ├── documents.py     # Upload, list, get document, status
│       └── queries.py       # POST /documents/query (streaming)
├── core/                    # Document processing pipeline
│   ├── parser/              # PDF parsing (PyMuPDF)
│   ├── ocr/                 # PaddleOCR
│   ├── layout/              # Layout/block classification
│   ├── tables/              # Table extraction
│   └── structure/           # Structure builder
├── ai/
│   ├── embeddings/          # Ollama embeddings, section embedding
│   └── reasoning/           # Query engine (embed → search → LLM)
├── db/                      # Database
│   ├── database.py          # Async engine, session, init
│   └── models.py            # Document, Section, Embedding
├── workers/                 # Background jobs
│   ├── celery_app.py
│   └── tasks.py             # process_document task
├── alembic/                 # Migrations
├── tests/                   # Pytest (API, parser, layout, structure)
├── frontend/                # Next.js app
│   ├── app/
│   │   ├── page.tsx         # Documents list + upload
│   │   ├── documents/[id]/  # Document detail, structure, query
│   │   ├── components/      # UploadZone, DocumentIntakePanel, QueryBox, etc.
│   │   └── layout.tsx, error.tsx
│   ├── e2e/                 # Playwright e2e tests
│   └── lib/api.ts           # API client
├── scripts/
│   └── run-local.sh        # Start API + frontend (port 8990)
├── documind_project.md      # Project vision and design
├── pyproject.toml           # Python deps (uv/pip)
└── README.md                # This file
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** (for frontend)
- **PostgreSQL** with [pgvector](https://github.com/pgvector/pgvector) extension
- **Redis** (for Celery)
- **Ollama** (for embeddings and LLM; can be local or remote)

---

## Installation

### 1. Clone and backend setup

```bash
cd /path/to/DocuMind
uv sync   # or: pip install -e .
```

Create a `.env` in the project root (see [Configuration](#configuration)).

### 2. Database and migrations

Ensure PostgreSQL is running and the `documind` database exists. Enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run migrations:

```bash
uv run alembic upgrade head
```

(Use `uv run` so that project dependencies like `pgvector` are available.)

### 3. Frontend

```bash
cd frontend
npm install
```

---

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL (async). Use `postgresql+asyncpg://...` for the app; Alembic uses a sync URL derived from this. | `postgresql+asyncpg://user:pass@localhost:5432/documind` |
| `REDIS_URL` | Redis for Celery | `redis://localhost:6379/0` |
| `OLLAMA_BASE_URL` | Ollama server | `http://localhost:11434` or remote URL |
| `OLLAMA_MODEL` | LLM for query answering | `llama3.2`, `phi3:mini`, etc. |
| `OLLAMA_EMBED_MODEL` | Embedding model | `nomic-embed-text` |
| `UPLOAD_DIR` | Directory for uploaded PDFs | `./uploads` |

Optional frontend (e.g. `frontend/.env.local`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Override API base URL (e.g. `http://localhost:8000`). If unset, the app uses same-origin when not on port 3000/8990. |

---

## Running the application

DocuMind uses **port 8990** for the frontend by default to avoid overlapping with other apps.

### Option A: Run script (API + frontend)

```bash
chmod +x scripts/run-local.sh
./scripts/run-local.sh
```

- API: **http://127.0.0.1:8000**
- Frontend: **http://127.0.0.1:8990**

### Option B: Run manually

**Terminal 1 — API**

```bash
uv run uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Celery worker** (for document processing)

```bash
uv run celery -A workers.celery_app worker --loglevel=info
```

**Terminal 3 — Frontend**

```bash
cd frontend && npm run dev
```

Frontend will be at **http://127.0.0.1:8990**.

### Using http://documind.packt.localhost

If you use nginx to serve the app at `http://documind.packt.localhost`:

1. Point the frontend proxy to **port 8990** (see `documind.packt.com.conf` or equivalent).
2. Reload nginx: `sudo nginx -s reload`.
3. Ensure the API is reachable (either via nginx proxy for `/documents`, `/queries`, `/health`, or set `NEXT_PUBLIC_API_URL`).

The frontend detects when it’s not on port 3000/8990 and uses same-origin API calls so nginx can proxy to the backend.

---

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/documents/upload` | Upload PDF (multipart); returns document with status `queued` |
| GET | `/documents/` | List documents |
| GET | `/documents/{id}` | Get document (with sections) |
| GET | `/documents/{id}/status` | Get processing status |
| POST | `/documents/query` | Query document (JSON: `document_id`, `question`); streams SSE response |

---

## Testing

**Backend (pytest)**

```bash
uv run pytest
```

**Frontend (Playwright)**

Default base URL is **http://localhost:8990**. Start the app, then:

```bash
cd frontend
npm run test:e2e
```

Or against a specific URL:

```bash
BASE_URL=http://documind.packt.localhost npm run test:e2e
```

---

## Development roadmap (from project vision)

- **Phase 1 — Basic document processing** — Document upload API, PDF parsing, basic OCR pipeline. ✅ In place.
- **Phase 2 — Layout understanding** — Heading detection, section segmentation, table extraction. ✅ In place.
- **Phase 3 — AI integration** — Document summarization, semantic search, AI document querying. ✅ In place.
- **Phase 4 — Platform features** — Web interface, knowledge base indexing, API integrations. ✅ Web UI and APIs in place; more integrations possible.

---

## Troubleshooting

**`/_next/static/chunks/fallback/` 404 or "Cannot find module './999.js'"**

- Caused by stale build cache or the browser using a page that expects dev-only chunks. Fix:
  1. Clean and rebuild: `cd frontend && rm -rf .next node_modules/.cache && npm run build`
  2. For **documind.packt.localhost**: run the app with `npm run start` (production) so no dev fallback chunks are requested, or run `npm run dev` if you need the dev error overlay
  3. Hard-refresh the site (Cmd+Shift+R / Ctrl+Shift+R) or clear the site’s cache for documind.packt.localhost

---

## Future enhancements (from project vision)

- Contract analysis, invoice data extraction, research paper parsing
- Diagram and chart recognition
- Multilingual document support
- Document comparison tools

---

## Product vision

Most enterprise knowledge is trapped inside documents. **DocuMind** turns those documents into structured, searchable, AI-ready knowledge that systems can understand and use.

For full vision, architecture, and module descriptions, see [documind_project.md](./documind_project.md).
