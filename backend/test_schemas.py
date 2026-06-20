from schemas import (
    ChatResponse,
    ReceiveMessageRequest,
    SendMessageRequest,
    SendMessageResponse,
    VendorConversation,
    VendorReply,
    WorkOrder,
    WorkOrderResponse,
)


def test_work_order_schema() -> None:
    work_order = WorkOrder(
        siteLocation="712 S Forest Ave, Tempe AZ 85281",
        requiredServiceDate="2026-06-29",
    )

    assert work_order.model_dump() == {
        "siteLocation": "712 S Forest Ave, Tempe AZ 85281",
        "serviceType": "",
        "budget": "",
        "requiredServiceDate": "2026-06-29",
        "outreachMessage": "",
    }
    try:
        WorkOrder.model_validate({"unknown": "value"})
    except ValueError:
        pass
    else:
        raise AssertionError("unknown fields must be rejected")

    try:
        WorkOrder(siteLocation="Warehouse A")
    except ValueError:
        pass
    else:
        raise AssertionError("invalid addresses must be rejected")

    try:
        WorkOrder(requiredServiceDate="in 10 days")
    except ValueError:
        pass
    else:
        raise AssertionError("service dates must use YYYY-MM-DD")

    assert ChatResponse(
        assistant="What is the service address?",
        workOrder=WorkOrder(),
    ).model_dump()["assistant"] == "What is the service address?"
    assert ReceiveMessageRequest(
        vendor_id="vendor-1",
        work_order_id="order-1",
        generated_message="I can visit Tuesday.",
    ).vendor_id == "vendor-1"
    assert VendorConversation(
        work_order_id="order-1",
        vendor_id="vendor-1",
        vendor_response="I can visit Tuesday.",
        agent_response="Tuesday works.",
        quote="",
        service_date="Tuesday",
        service_time="",
        contact_info="",
        vendor_state="NEGOTIATING",
    ).model_dump() == {
        "agent_response": "Tuesday works.",
        "quote": "",
        "service_date": "Tuesday",
        "service_time": "",
        "contact_info": "",
        "vendor_state": "NEGOTIATING",
        "work_order_id": "order-1",
        "vendor_id": "vendor-1",
        "vendor_response": "I can visit Tuesday.",
    }
    assert VendorReply(
        agent_response="Thanks.",
        quote="$8,500",
        service_date="2026-06-29",
        service_time="9:00 AM",
        contact_info="",
        vendor_state="QUOTE_RECEIVED",
    ).quote == "$8,500"
    assert SendMessageRequest(vendorId="vendor-1", response="Approved.").vendor_id == (
        "vendor-1"
    )
    assert SendMessageResponse(
        work_order_id="order-1",
        work_order_state="Auctioning",
        vendor_id="vendor-1",
        vendor_state="NEGOTIATING",
    ).vendor_state == "NEGOTIATING"
    assert WorkOrderResponse(work_order_id="order-1", vendors=[]).work_order_id == (
        "order-1"
    )


if __name__ == "__main__":
    test_work_order_schema()
