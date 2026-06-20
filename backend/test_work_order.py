import asyncio
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import BackgroundTasks

from bot import (
    _persist_work_order_vendors,
    generate_response,
    process_vendor_message,
    receive_messages,
    send_message,
    submit_work_order,
    vendor_messages,
)
from db import init_db, list_vendors, list_work_orders, update_order_vendor_states
from schemas import (
    ReceiveMessageRequest,
    SendMessageRequest,
    StateTransition,
    VendorResult,
    VendorSearchResponse,
    WorkOrder,
)


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
    assert response.work_order_id == "order-1"
    assert [vendor.id for vendor in response.vendors] == [
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


def test_update_order_vendor_states() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as file:
        init_db(file.name)
        work_order, vendors = _persist_work_order_vendors(
            ORDER, VENDORS[:1], db_path=file.name
        )
        updated = update_order_vendor_states(
            work_order["work_order_id"],
            vendors[0]["vendor_id"],
            "AUCTIONING",
            "NEGOTIATING",
            db_path=file.name,
        )

    assert updated
    assert updated[0]["state"] == "AUCTIONING"
    assert updated[1]["vendor_state"] == "NEGOTIATING"


def test_generate_response_processes_vendor_message() -> None:
    with (
        patch(
            "bot.get_work_order",
            return_value={"work_order_id": "order-1", "state": "AUCTIONING"},
        ),
        patch(
            "bot.get_vendor",
            return_value={
                "vendor_id": "vendor-1",
                "work_order_id": "order-1",
                "name": "Vendor 1",
                "vendor_state": "NEGOTIATING",
            },
        ),
        patch(
            "bot.openai.responses.create",
            return_value=SimpleNamespace(output_text="We can quote $8,500."),
        ) as create,
        patch("bot.process_vendor_message") as process,
    ):
        asyncio.run(generate_response("Please quote the job.", "vendor-1", "order-1"))

    create.assert_awaited_once()
    process.assert_awaited_once_with(
        ReceiveMessageRequest(
            vendor_id="vendor-1",
            work_order_id="order-1",
            generated_message="We can quote $8,500.",
        )
    )


def test_vendor_message_is_available_to_stream() -> None:
    async def first_event() -> tuple[object, str]:
        stream = await receive_messages()
        event = await anext(stream.body_iterator)
        await stream.body_iterator.aclose()
        return stream, event

    vendor_messages.clear()
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
    ):
        response = asyncio.run(process_vendor_message(request))
        stream, event = asyncio.run(first_event())

    create.assert_awaited_once()
    assert response.vendor_id == "vendor-1"
    assert vendor_messages["vendor-1"] == response
    assert stream.media_type == "text/event-stream"
    assert '"vendor_id":"vendor-1"' in event
    vendor_messages.clear()


def test_send_message_updates_states_and_continues_conversation() -> None:
    background_tasks = BackgroundTasks()
    with (
        patch(
            "bot.get_vendor",
            return_value={
                "vendor_id": "vendor-1",
                "work_order_id": "order-1",
                "vendor_state": "AWAITING_RESPONSE",
            },
        ),
        patch(
            "bot.get_work_order",
            return_value={"work_order_id": "order-1", "state": "AUCTIONING"},
        ),
        patch(
            "bot.openai.responses.parse",
            return_value=SimpleNamespace(
                output_parsed=StateTransition(
                    work_order_state="CONTACTING_VENDORS",
                    vendor_state="NEGOTIATING",
                )
            ),
        ) as parse,
        patch(
            "bot.update_order_vendor_states",
            return_value=(
                {"work_order_id": "order-1", "state": "AUCTIONING"},
                {"vendor_id": "vendor-1", "vendor_state": "NEGOTIATING"},
            ),
        ) as update,
    ):
        response = asyncio.run(
            send_message(
                SendMessageRequest(vendorId="vendor-1", response="Can you do $8,000?"),
                background_tasks,
            )
        )

    parse.assert_awaited_once()
    assert "Can you do $8,000?" in parse.call_args.kwargs["input"]
    update.assert_called_once_with(
        "order-1", "vendor-1", "AUCTIONING", "NEGOTIATING"
    )
    assert response.model_dump() == {
        "work_order_state": "Auctioning",
        "vendor_state": "NEGOTIATING",
        "work_order_id": "order-1",
        "vendor_id": "vendor-1",
    }
    assert background_tasks.tasks[0].args == (
        "Can you do $8,000?",
        "vendor-1",
        "order-1",
    )


if __name__ == "__main__":
    test_submit_work_order()
    test_persist_work_order_vendors()
    test_update_order_vendor_states()
    test_generate_response_processes_vendor_message()
    test_vendor_message_is_available_to_stream()
    test_send_message_updates_states_and_continues_conversation()
