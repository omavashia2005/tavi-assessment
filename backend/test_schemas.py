from schemas import WorkOrder


def test_work_order_schema() -> None:
    work_order = WorkOrder(siteLocation="Warehouse A")

    assert work_order.model_dump() == {
        "siteLocation": "Warehouse A",
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


if __name__ == "__main__":
    test_work_order_schema()
