from schemas import ChatResponse, ReceiveMessageRequest, VendorConversation, WorkOrder


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
        vendor_id="vendor-1",
        vendor_response="I can visit Tuesday.",
        agent_response="Tuesday works.",
    ).model_dump() == {
        "vendor_id": "vendor-1",
        "vendor_response": "I can visit Tuesday.",
        "agent_response": "Tuesday works.",
    }


if __name__ == "__main__":
    test_work_order_schema()
