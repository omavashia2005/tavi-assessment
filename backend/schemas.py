import re

from pydantic import BaseModel, ConfigDict, field_validator

ADDRESS = re.compile(r"^\d+\s+[^,]+,\s+[A-Za-z .'-]+\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$")


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
