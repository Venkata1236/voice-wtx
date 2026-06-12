from pydantic import BaseModel


class FeatureFlagUpdate(BaseModel):
    is_enabled: bool


class FeatureFlagResponse(BaseModel):
    flag_name: str
    is_enabled: bool