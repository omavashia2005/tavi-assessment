# Tavi — Facility Operations

AI-assisted work-order intake and vendor management.

## System Architecture

```mermaid
graph LR
  FE["Frontend<br/>Next.js :3000"]
  BE["Backend<br/>FastAPI :7860"]
  OAI["OpenAI API<br/>LLM · STT · TTS"]
  FC["Firecrawl<br/>scrape BBB.org"]
  DB[("SQLite")]

  FE -- "WebRTC (voice)" --> BE
  FE -- "REST + SSE" --> BE
  BE --> OAI
  BE --> FC
  BE --- DB
```

## Repos

| Directory | Stack | Readme |
|-----------|-------|--------|
| `frontend/` | Next.js + Pipecat client | [frontend/README.md](frontend/README.md) |
| `backend/` | FastAPI + Pipecat server | [backend/README.md](backend/README.md) |
