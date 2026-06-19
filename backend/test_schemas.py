from pydantic import ValidationError

from schemas import WorkOrder


def test_work_order_matches_frontend_shape() -> None:
    work_order = WorkOrder(siteLocation="Warehouse A")

    assert work_order.model_dump() == {
        "siteLocation": "Warehouse A",
        "serviceType": "",
        "budget": "",
        "requiredServiceDate": "",
        "outreachMessage": "",
    }


def test_work_order_rejects_unknown_fields() -> None:
    try:
        WorkOrder.model_validate({"unknown": "value"})
    except ValidationError:
        return
    raise AssertionError("unknown fields must be rejected")
