import asyncio
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import BackgroundTasks

from bot import (
    _persist_work_order_vendors,
    generate_response,
    receive_message,
    submit_work_order,
)
from db import init_db, list_vendors, list_work_orders
from schemas import ReceiveMessageRequest, VendorResult, VendorSearchResponse, WorkOrder


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
        vendorState="SELECTED",
    )
    for index in range(1, 7)
]


def test_submit_work_order() -> None:
    async def fake_vendor_search(order: WorkOrder) -> VendorSearchResponse:
        return VendorSearchResponse(vendors=VENDORS)

    saved_work_order = {"work_order_id": "order-1"}
    saved_vendors = [{"vendor_id": f"vendor-{index}"} for index in range(5)]
    background_tasks = BackgroundTasks()
    with (
        patch("bot.vendor_search", fake_vendor_search),
        patch(
            "bot._persist_work_order_vendors",
            return_value=(saved_work_order, saved_vendors),
        ),
        patch("bot.random.choice", return_value=saved_vendors[0]),
    ):
        response = asyncio.run(submit_work_order(ORDER, background_tasks))

    assert [vendor.vendorState for vendor in response.vendors] == [
        "AWAITING_RESPONSE"
    ] * 5
    assert [vendor.vendorId for vendor in response.vendors] == [
        f"vendor-{index}" for index in range(5)
    ]
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].func is generate_response
    assert background_tasks.tasks[0].args == (
        ORDER.outreachMessage,
        "vendor-0",
        "order-1",
    )


def test_persist_work_order_vendors() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as file:
        init_db(file.name)
        vendors = [
            vendor.model_copy(update={"vendorState": "AWAITING_RESPONSE"})
            for vendor in VENDORS[:5]
        ]
        work_order, persisted_vendors = _persist_work_order_vendors(
            ORDER, vendors, db_path=file.name
        )
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
    assert work_order["work_order_id"] == work_orders[0]["work_order_id"]
    assert persisted_vendors == saved_vendors


def test_generate_response_gets_receive_message() -> None:
    with (
        patch(
            "bot.openai.responses.create",
            return_value=SimpleNamespace(output_text="We can quote $8,500."),
        ) as create,
        patch("bot._get_json", return_value={}) as get,
        patch.dict("os.environ", {"INTERNAL_API_URL": "http://backend.test"}),
    ):
        asyncio.run(generate_response("Please quote the job.", "vendor-1", "order-1"))

    create.assert_awaited_once()
    get.assert_called_once_with(
        "http://backend.test/api/receive-messages",
        {
            "vendor_id": "vendor-1",
            "work_order_id": "order-1",
            "generated_message": "We can quote $8,500.",
        },
    )


def test_receive_message_posts_conversation_to_frontend() -> None:
    request = ReceiveMessageRequest(
        vendor_id="vendor-1",
        work_order_id="order-1",
        generated_message="We can quote $8,500.",
    )
    with (
        patch("bot.get_work_order", return_value={"work_order_id": "order-1"}),
        patch(
            "bot.get_vendor",
            return_value={
                "vendor_id": "vendor-1",
                "work_order_id": "order-1",
                "outreach_message": ORDER.outreachMessage,
            },
        ),
        patch(
            "bot.openai.responses.create",
            return_value=SimpleNamespace(output_text="Can you complete it by June 29?"),
        ) as create,
        patch("bot._post_json", return_value={}) as post,
        patch.dict(
            "os.environ",
            {"FRONTEND_RECEIVE_MESSAGE_URL": "http://frontend.test/api/messages"},
        ),
    ):
        response = asyncio.run(receive_message(request))

    create.assert_awaited_once()
    assert response.vendor_id == "vendor-1"
    post.assert_called_once_with(
        "http://frontend.test/api/messages",
        {
            "vendor_id": "vendor-1",
            "vendor_response": "We can quote $8,500.",
            "agent_response": "Can you complete it by June 29?",
        },
    )


if __name__ == "__main__":
    test_submit_work_order()
    test_persist_work_order_vendors()
    test_generate_response_gets_receive_message()
    test_receive_message_posts_conversation_to_frontend()
