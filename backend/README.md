#: Tavi backend

Requires Python 3.11+ and an OpenAI API key.

```bash
cd backend
cp .env.example .env
# Add OPENAI_API_KEY to .env
uv sync
uv run python bot.py -t webrtc
```

FastAPI runs at `http://localhost:7860`; stop it with `Ctrl+C`.

The frontend uses `POST /start` for Pipecat voice sessions and `POST /api/chat`
for plain OpenAI text chat. Both return validated work-order data.

## SQLite storage

Create or verify `tavi-assessment.db`:

```bash
uv run python db.py
```

Use the CRUD functions from Python:

```python
from db import (
    create_vendor,
    create_work_order,
    delete_vendor,
    delete_work_order,
    get_vendor,
    get_work_order,
    list_vendors,
    list_work_orders,
    update_vendor,
    update_work_order,
)

work_order = create_work_order(
    location="712 S Forest Ave, Tempe AZ 85281",
    date="2026-06-29",
    budget=10_000,
    type="HVAC",
)

vendor = create_vendor(
    work_order_id=work_order["work_order_id"],
    name="Desert HVAC",
    price=8_500,
    outreach_message="Can you quote this job?",
)

update_vendor(vendor["vendor_id"], vendor_state="QUOTE_RECEIVED", price=8_250)
update_work_order(
    work_order["work_order_id"],
    vendor_id=vendor["vendor_id"],
    state="VENDOR ASSIGNED",
)

get_work_order(work_order["work_order_id"])
get_vendor(vendor["vendor_id"])
list_work_orders()
list_vendors(work_order["work_order_id"])
delete_vendor(vendor["vendor_id"])
delete_work_order(work_order["work_order_id"])
```

Work-order states are `CONTACTING_VENDORS`, `AUCTIONING`,
`VENDOR ASSIGNED`, `SITE_VISIT`, and `COMPLETE`. Vendor states are
`AWAITING_RESPONSE`, `NEGOTIATING`, `QUOTE_RECEIVED`, and `SELECTED`.


