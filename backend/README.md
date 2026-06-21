# Tavi backend

Requires Python 3.11+ and an OpenAI API key.

Get Firecrawl API key: http://firecrawl.dev

```bash
cd backend
cp .env.example .env
# Add OPENAI_API_KEY and FIRECRAWL_API_KEY  to .env
uv sync
uv pip install geopy
uv run python db.py
uv run python bot.py -t webrtc
```

In case pipecat (the voice agent framwork this project uses) throws errors or causes issues (ideally should not), 

Download the pipecat-docs mcp server and ask your coding agent of choice to set the project dependencies for pipecat up. https://docs.pipecat.ai/api-reference/context-hub#claude-code

FastAPI runs at `http://localhost:7860`; stop it with `Ctrl+C`.

The frontend uses `POST /start` for Pipecat voice sessions and `POST /api/chat`
for plain OpenAI text chat. Both return validated work-order data.

## SQLite storage and schema

Create or verify `tavi-assessment.db`:

```bash
uv run python db.py
```

```mermaid
erDiagram
  work_orders {
    TEXT work_order_id PK
    TEXT location
    TEXT date
    REAL budget
    TEXT type
    TEXT vendor_id FK
    TEXT state
  }
  vendors {
    TEXT vendor_id PK
    TEXT work_order_id FK
    TEXT name
    REAL price
    TEXT outreach_message
    TEXT vendor_state
  }
  work_orders ||--o{ vendors : "has"
  work_orders |o--o| vendors : "selected vendor"
```

## Architecture

### Work-order & vendor message flow

```mermaid
sequenceDiagram
  participant FM as Facility Manager
  participant API as FastAPI
  participant OAI as OpenAI
  participant FC as Firecrawl
  participant DB as SQLite

  note over FM,API: Text intake (POST /api/chat)
  FM->>API: POST /api/chat (turns + current work order)
  API->>OAI: structured chat completion
  OAI-->>API: assistant reply + updated work order fields
  API-->>FM: assistant text + work order

  note over FM,DB: Place order (POST /api/work-order)
  FM->>API: POST /api/work-order
  API->>FC: scrape BBB for local vendors
  FC-->>API: vendor list
  API->>DB: save work order + vendors
  API-->>FM: work_order_id + vendors
  API-)OAI: (background) generate first vendor reply
  OAI-->>API: vendor message + extracted state
  API-)FM: SSE  GET /api/receive-messages

  note over FM,DB: Facility manager replies (POST /api/send-message)
  FM->>API: POST /api/send-message
  API->>OAI: classify state transition
  OAI-->>API: new work-order & vendor states
  API->>DB: update states
  API-)OAI: (background) generate next vendor reply
  API-->>FM: updated states
```

### Voice pipeline (`POST /start`)

```mermaid
graph LR
  Mic -->|audio in| STT[STT gpt-4o-transcribe]
  STT --> AGG[User aggregator]
  AGG --> LLM[LLM gpt-4.1-mini]
  LLM -->|update_work_order| UI[Frontend UI]
  LLM --> TTS[TTS gpt-4o-mini-tts]
  TTS -->|audio out| Speaker
```

### State machines

```mermaid
stateDiagram-v2
  direction LR
  state "Work Order" as WO {
    [*] --> CONTACTING_VENDORS
    CONTACTING_VENDORS --> AUCTIONING
    AUCTIONING --> VENDOR_ASSIGNED : vendor selected
    VENDOR_ASSIGNED --> SITE_VISIT
    SITE_VISIT --> COMPLETE
  }

  state "Vendor" as V {
    [*] --> AWAITING_RESPONSE
    AWAITING_RESPONSE --> NEGOTIATING
    NEGOTIATING --> QUOTE_RECEIVED
    QUOTE_RECEIVED --> SELECTED
  }
```


