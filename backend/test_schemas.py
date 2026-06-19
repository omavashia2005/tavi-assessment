from schemas import WorkOrder


def test_work_order_schema() -> None:
    work_order = WorkOrder(siteLocation="712 S Forest Ave, Tempe AZ 85281")

    assert work_order.model_dump() == {
        "siteLocation": "712 S Forest Ave, Tempe AZ 85281",
        "serviceType": "",
        "budget": "",
        "requiredServiceDate": "",
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


if __name__ == "__main__":
    test_work_order_schema()
