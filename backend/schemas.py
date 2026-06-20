import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ADDRESS = re.compile(r"^\d+\s+[^,]+,\s+[A-Za-z .'-]+\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    siteLocation: str = ""
    serviceType: str = ""
    budget: str = ""
    requiredServiceDate: str = ""
    outreachMessage: str = ""

    @field_validator("siteLocation")
    @classmethod
    def validate_site_location(cls, value: str) -> str:
        if value and not ADDRESS.fullmatch(value):
            raise ValueError("Use: Street Number Street Name, City State ZIP")
        return value

    @field_validator("requiredServiceDate")
    @classmethod
    def validate_service_date(cls, value: str) -> str:
        if value and not DATE.fullmatch(value):
            raise ValueError("Use ISO date format: YYYY-MM-DD")
        return value


class VendorResult(BaseModel):
    id: str = ""
    name: str = Field(description="Full business name")
    contactInfo: str = Field(description="Phone number")
    reviewScore: str = Field(description="BBB rating or brief review summary")
    avgCost: str = Field(default="", description="Average cost estimate, empty if unavailable")
    vendorState: Literal[
        "AWAITING_RESPONSE", "NEGOTIATING", "QUOTE_RECEIVED", "SELECTED"
    ] = "AWAITING_RESPONSE"


class VendorSearchResponse(BaseModel):
    vendors: list[VendorResult] = Field(
        description="Businesses ranked best to worst by BBB rating and customer reviews"
    )


class WorkOrderResponse(VendorSearchResponse):
    work_order_id: str


class ChatTurn(BaseModel):
    role: Literal["user", "agent"]
    text: str


class ChatRequest(BaseModel):
    turns: list[ChatTurn]
    workOrder: WorkOrder


class ChatResponse(BaseModel):
    assistant: str
    workOrder: WorkOrder


class ReceiveMessageRequest(BaseModel):
    vendor_id: str
    work_order_id: str
    generated_message: str


class VendorReply(BaseModel):
    agent_response: str
    quote: str = Field(description="Quoted price, or empty if none was stated")
    service_date: str = Field(description="Proposed service date, or empty if unknown")
    service_time: str = Field(description="Proposed service time, or empty if unknown")
    contact_info: str = Field(description="New contact information, or empty if none")
    vendor_state: Literal[
        "AWAITING_RESPONSE", "NEGOTIATING", "QUOTE_RECEIVED", "SELECTED"
    ]


class VendorConversation(VendorReply):
    work_order_id: str
    vendor_id: str
    vendor_response: str


class SendMessageRequest(BaseModel):
    vendor_id: str = Field(alias="vendorId")
    response: str = Field(min_length=1)


class StateTransition(BaseModel):
    work_order_state: Literal[
        "CONTACTING_VENDORS", "AUCTIONING", "VENDOR ASSIGNED", "SITE_VISIT", "COMPLETE"
    ]
    vendor_state: Literal[
        "AWAITING_RESPONSE", "NEGOTIATING", "QUOTE_RECEIVED", "SELECTED"
    ]


class SendMessageResponse(BaseModel):
    work_order_id: str
    work_order_state: Literal[
        "Contacting Vendors",
        "Auctioning",
        "Vendor Assigned",
        "Site Visit",
        "Order Complete",
    ]
    vendor_id: str
    vendor_state: Literal[
        "AWAITING_RESPONSE", "NEGOTIATING", "QUOTE_RECEIVED", "SELECTED"
    ]
