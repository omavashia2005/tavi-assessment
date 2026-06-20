# Tavi — Facility Operations

AI-assisted work-order intake and vendor management.

## System Architecture

```mermaid
graph LR
  FE[Frontend Next.js] -- WebRTC voice --> BE[Backend FastAPI]
  FE -- REST + SSE --> BE
  BE --> OAI[OpenAI API]
  BE --> FC[Firecrawl]
  BE --- DB[(SQLite)]
```

## Repos

| Directory | Stack | Readme |
|-----------|-------|--------|
| `frontend/` | Next.js + Pipecat client | [frontend/README.md](frontend/README.md) |
| `backend/` | FastAPI + Pipecat server | [backend/README.md](backend/README.md) |
