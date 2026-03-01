from pydantic import BaseModel, Field


class MotionCommand(BaseModel):
    value: float = Field(..., description="Distance in cm for linear movement or degrees for turn")
    speed: float = Field(default=0.5, ge=0.0, le=1.0)
