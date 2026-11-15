"""Drop and recreate the end-to-end test database, then migrate it.

Used by the Playwright setup so every run starts with no household.
"""

import os
from pathlib import Path

import psycopg
from alembic.config import Config

from alembic import command

ADMIN_URL = os.environ.get("E2E_ADMIN_URL", "postgresql://groove:groove@localhost:5432/postgres")
DB = "groove_e2e"
API_DIR = Path(__file__).resolve().parent.parent

with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
    conn.execute(f"DROP DATABASE IF EXISTS {DB} WITH (FORCE)")
    conn.execute(f"CREATE DATABASE {DB}")

os.environ["DATABASE_URL"] = (
    ADMIN_URL.rsplit("/", 1)[0].replace("postgresql://", "postgresql+psycopg://") + f"/{DB}"
)
command.upgrade(Config(str(API_DIR / "alembic.ini")), "head")
print(f"{DB} ready")
