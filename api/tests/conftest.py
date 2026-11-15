import os
import tempfile
from pathlib import Path

import psycopg
import pytest

# Point the app at a throwaway database BEFORE the app modules are imported.
ADMIN_URL = os.environ.get("TEST_ADMIN_URL", "postgresql://groove:groove@localhost:5432/postgres")
TEST_DB = "groove_test"
os.environ["DATABASE_URL"] = (
    ADMIN_URL.rsplit("/", 1)[0].replace("postgresql://", "postgresql+psycopg://") + f"/{TEST_DB}"
)

from alembic.config import Config  # noqa: E402
from cryptography.fernet import Fernet  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

os.environ["FERNET_KEY"] = Fernet.generate_key().decode()
os.environ["DISCOGS_CONSUMER_KEY"] = "test-consumer-key"
os.environ["DISCOGS_CONSUMER_SECRET"] = "test-consumer-secret"
os.environ["IMPORT_WORKER_ENABLED"] = "false"
os.environ["DISCOGS_BACKOFF_SECONDS"] = "0"
os.environ["DISCOGS_RATE_PER_MINUTE"] = "100000"
os.environ.setdefault("COVERS_DIR", tempfile.mkdtemp(prefix="groove-covers-"))

from alembic import command  # noqa: E402
from app.core.db import get_engine  # noqa: E402
from app.main import app  # noqa: E402

API_DIR = Path(__file__).resolve().parent.parent
HEADERS = {"X-Requested-With": "groove"}


@pytest.fixture(scope="session", autouse=True)
def database():
    """Create an empty database and migrate it (proves the migrations run from scratch)."""
    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {TEST_DB}")
    command.upgrade(Config(str(API_DIR / "alembic.ini")), "head")
    yield
    get_engine().dispose()


@pytest.fixture(autouse=True)
def clean_tables(database):
    with get_engine().begin() as conn:
        names = conn.execute(
            text(
                "SELECT string_agg(quote_ident(tablename), ', ') FROM pg_tables "
                "WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
            )
        ).scalar()
        if names:
            conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


class QueryLog(list):
    """SQL statements run while a `count_queries` block is open."""

    def on(self, table: str) -> list[str]:
        """Statements that read or write `table` (auth and session lookups are left out)."""
        return [s for s in self if f" {table}" in s or f'"{table}"' in s]


@pytest.fixture
def count_queries():
    """Use as `with count_queries() as log:`; keeps per-endpoint query budgets honest."""
    from contextlib import contextmanager

    from sqlalchemy import event

    @contextmanager
    def counting():
        log = QueryLog()

        def record(conn, cursor, statement, *args):
            log.append(statement)

        engine = get_engine()
        event.listen(engine, "before_cursor_execute", record)
        try:
            yield log
        finally:
            event.remove(engine, "before_cursor_execute", record)

    return counting


@pytest.fixture
def db():
    with Session(get_engine()) as session:
        yield session


def make_client() -> TestClient:
    """A browser: its own cookie jar, sending the header the API requires on writes."""
    return TestClient(app, headers=HEADERS)


@pytest.fixture
def client() -> TestClient:
    return make_client()


@pytest.fixture
def new_client():
    return make_client


PASSWORD = "correct horse battery"


@pytest.fixture
def owner(client):
    """A signed-in first member who created the household."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "anna@example.com",
            "password": PASSWORD,
            "display_name": "Anna",
            "household_name": "Famiglia Rossi",
        },
    )
    assert response.status_code == 201, response.text
    return client


@pytest.fixture
def discogs():
    """A mocked Discogs wired into every Discogs call made by the app."""
    from app.integrations.discogs import client as discogs_module
    from tests.discogs_mock import MockDiscogs

    mock = MockDiscogs()
    discogs_module.set_transport(mock.transport())
    yield mock
    discogs_module.set_transport(None)
