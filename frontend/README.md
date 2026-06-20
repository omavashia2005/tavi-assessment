# Tavi frontend

Next.js app for work-order intake and vendor management.

## Architecture

### Component & data flow

```mermaid
graph TD
  WP["WorkflowProvider<br/>React context + localStorage"]
  ES["EventSource<br/>GET /api/receive-messages"]
  PC["PipecatClient<br/>WebRTC transport"]

  WP -- subscribes --> ES
  ES -- vendor messages --> WP

  IntakePage["/ — Intake"] -- voice --> PC
  IntakePage -- text chat --> ChatAPI["POST /api/chat"]
  IntakePage -- place order --> WorkOrderAPI["POST /api/work-order"]

  OrdersPage["/orders — Orders"] -- send message --> SendAPI["POST /api/send-message"]

  WP --> IntakePage
  WP --> OrdersPage
  PC -- work order tool call --> WP
```

### Intake page modes

```mermaid
flowchart LR
  A([User opens /]) --> B{choose mode}
  B -- voice --> C["PipecatClient<br/>WebRTC to /start"]
  B -- text --> D["fetch POST /api/chat"]
  C --> E["LLM fills work order<br/>via server message"]
  D --> E
  E --> F{all fields filled?}
  F -- yes --> G["Place Order<br/>POST /api/work-order"]
  G --> H["/orders — vendor cards<br/>+ SSE replies"]
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
