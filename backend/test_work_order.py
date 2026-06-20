import asyncio
import tempfile
from unittest.mock import patch

from fastapi import BackgroundTasks

from bot import _persist_work_order_vendors, submit_work_order
from db import init_db, list_vendors, list_work_orders
from schemas import VendorResult, VendorSearchResponse, WorkOrder


ORDER = WorkOrder(
    siteLocation="712 S Forest Ave, Tempe AZ 85281",
    serviceType="HVAC",
    budget="$10,000",
    requiredServiceDate="2026-06-29",
    outreachMessage="Please quote this HVAC job.",
)
VENDORS = [
    VendorResult(
        name=f"Vendor {index}",
        contactInfo="555-0100",
        reviewScore="A",
        avgCost=f"${index},000",
    )
    for index in range(1, 7)
]


def test_submit_work_order() -> None:
    async def fake_vendor_search(order: WorkOrder) -> VendorSearchResponse:
        return VendorSearchResponse(vendors=VENDORS)

    background_tasks = BackgroundTasks()
    with patch("bot.vendor_search", fake_vendor_search):
        response = asyncio.run(submit_work_order(ORDER, background_tasks))

    assert response.vendors == VENDORS[:5]
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].args == (ORDER, VENDORS[:5])


def test_persist_work_order_vendors() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as file:
        init_db(file.name)
        _persist_work_order_vendors(ORDER, VENDORS[:5], db_path=file.name)
        work_orders = list_work_orders(db_path=file.name)
        saved_vendors = list_vendors(
            work_orders[0]["work_order_id"], db_path=file.name
        )

    assert len(work_orders) == 1
    assert len(saved_vendors) == 5
    assert {vendor["name"] for vendor in saved_vendors} == {
        vendor.name for vendor in VENDORS[:5]
    }
    assert {vendor["vendor_state"] for vendor in saved_vendors} == {
        "AWAITING_RESPONSE"
    }


if __name__ == "__main__":
    test_submit_work_order()
    test_persist_work_order_vendors()
