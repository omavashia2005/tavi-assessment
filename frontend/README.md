# Tavi frontend

Next.js app for work-order intake and vendor management.

## Getting Started

First, install the requirements with `npm install`.
 
 Then, start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

The frontend now should be running on localhost 3000
## Architecture

### Component & data flow

```mermaid
graph TD
  WP[WorkflowProvider]
  ES[EventSource SSE]
  PC[PipecatClient WebRTC]

  WP -- subscribes --> ES
  ES -- vendor messages --> WP

  IntakePage[Intake /] -- voice --> PC
  IntakePage -- text chat --> ChatAPI["POST /api/chat"]
  IntakePage -- place order --> WorkOrderAPI["POST /api/work-order"]

  OrdersPage["Orders /orders"] -- send message --> SendAPI["POST /api/send-message"]

  WP --> IntakePage
  WP --> OrdersPage
  PC -- work order update --> WP
```

### Intake page modes

```mermaid
flowchart LR
  A([User opens /]) --> B{mode?}
  B -- voice --> C[PipecatClient WebRTC]
  B -- text --> D["POST /api/chat"]
  C --> E[LLM fills work order]
  D --> E
  E --> F{all fields filled?}
  F -- yes --> G["POST /api/work-order"]
  G --> H["/orders with vendor cards"]
```