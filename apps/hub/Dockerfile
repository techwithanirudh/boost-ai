# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /venv

COPY apps/hub/requirements.txt .
RUN /venv/bin/pip install --upgrade pip && \
    /venv/bin/pip install -r requirements.txt

FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/venv/bin:$PATH"

RUN adduser --system --uid 1001 app

COPY --from=builder /venv /venv
COPY apps/hub .

RUN chown -R app:app /app
USER app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').getcode()==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
