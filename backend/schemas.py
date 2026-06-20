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
    name: str = Field(description="Full business name")
    contactInfo: str = Field(description="Phone number")
    reviewScore: str = Field(description="BBB rating or brief review summary")
    avgCost: str = Field(default="", description="Average cost estimate, empty if unavailable")


class VendorSearchResponse(BaseModel):
    vendors: list[VendorResult] = Field(
        description="Businesses ranked best to worst by BBB rating and customer reviews"
    )


class ChatTurn(BaseModel):
    role: Literal["user", "agent"]
    text: str


class ChatRequest(BaseModel):
    turns: list[ChatTurn]
    workOrder: WorkOrder


class ChatResponse(BaseModel):
    assistant: str
    workOrder: WorkOrder
