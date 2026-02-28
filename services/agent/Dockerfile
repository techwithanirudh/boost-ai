FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

# Workspace metadata required by uv
COPY pyproject.toml uv.lock ./
COPY services/pyhub/pyproject.toml services/pyhub/pyproject.toml
COPY services/agent/pyproject.toml services/agent/pyproject.toml

# Install only agent dependencies
RUN uv sync --frozen --package agent

# App source
COPY services/agent /app/services/agent

ENV PYTHONUNBUFFERED=1
WORKDIR /app/services/agent

CMD ["uv", "run", "--package", "agent", "python", "agent.py"]
