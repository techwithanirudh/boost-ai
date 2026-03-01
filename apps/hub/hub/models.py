from typing import Literal

from pydantic import BaseModel, Field

ActionType = Literal["forward_cm", "backward_cm", "turn_deg", "stop"]


class ExecuteMotionCommand(BaseModel):
    action: ActionType
    value: float = Field(default=0.0, description="Distance cm for linear actions, degrees for turn")
    speed: float = Field(default=0.5, ge=0.0, le=1.0)
    text: str | None = Field(default=None, description="Human-readable rationale from AI")
