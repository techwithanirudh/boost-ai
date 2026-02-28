import json
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends
from sqlmodel import Field, Session, SQLModel, create_engine, select

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../../storage/pyhub.db")

if DATABASE_URL.startswith("sqlite:///"):
    raw_path = DATABASE_URL.removeprefix("sqlite:///")
    resolved = Path(raw_path)
    if not resolved.is_absolute():
        resolved = (Path(__file__).resolve().parent / resolved).resolve()
    DATABASE_URL = f"sqlite:///{resolved}"

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
    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL.removeprefix("sqlite:///")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(_engine)


def get_session():
    with Session(_engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
