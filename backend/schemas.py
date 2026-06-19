from pydantic import BaseModel, ConfigDict


class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    siteLocation: str = ""
    serviceType: str = ""
    budget: str = ""
    requiredServiceDate: str = ""
    outreachMessage: str = ""
