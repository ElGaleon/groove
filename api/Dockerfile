FROM python:3.12-slim
# Pinned: a new uv release must not change the image without a commit.
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/api
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
# The API runs as an unprivileged user; only the covers volume is writable by it.
RUN useradd --system --uid 10001 --home-dir /srv/api groove && mkdir -p covers
ENV PATH="/srv/api/.venv/bin:$PATH"
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
# Starts as root only to hand the covers volume (root-owned on older installs) to the app user,
# then drops privileges, applies the migrations and starts the API.
CMD ["sh", "-c", "chown -R groove:groove /srv/api/covers && exec setpriv --reuid=groove --regid=groove --init-groups sh -c 'alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-server-header'"]
