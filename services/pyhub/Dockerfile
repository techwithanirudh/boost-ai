FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git bluez \
    && rm -rf /var/lib/apt/lists/*

# Workspace metadata required by uv
COPY pyproject.toml uv.lock ./
COPY services/pyhub/pyproject.toml services/pyhub/pyproject.toml
COPY services/agent/pyproject.toml services/agent/pyproject.toml

# Install only pyhub dependencies
RUN uv sync --frozen --package pyhub

# App source
COPY services/pyhub /app/services/pyhub

ENV PYTHONUNBUFFERED=1
WORKDIR /app/services/pyhub

CMD ["uv", "run", "--package", "pyhub", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
