import json
import os
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends
from sqlmodel import Field, Session, SQLModel, create_engine, select

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pyhub.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
_engine = create_engine(DATABASE_URL, connect_args=_connect_args)


class CommandLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    command_id: str = Field(index=True)
    primitive: str
    args: str
    ok: bool = True
    error: str | None = None
    duration_ms: float | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def create_tables() -> None:
    SQLModel.metadata.create_all(_engine)


def get_session():
    with Session(_engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
