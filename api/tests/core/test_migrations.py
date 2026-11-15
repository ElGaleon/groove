import os
import subprocess
import sys

import psycopg

from tests.conftest import ADMIN_URL, API_DIR

SCRATCH = "groove_migrate_check"


def alembic(*args: str) -> None:
    base = ADMIN_URL.rsplit("/", 1)[0].replace("postgresql://", "postgresql+psycopg://")
    url = f"{base}/{SCRATCH}"
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=API_DIR,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
        capture_output=True,
    )


def test_latest_migration_goes_up_down_and_up_again_on_a_scratch_database():
    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {SCRATCH} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {SCRATCH}")
    try:
        alembic("upgrade", "head")
        alembic("downgrade", "-1")
        alembic("upgrade", "head")
    finally:
        with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
            conn.execute(f"DROP DATABASE IF EXISTS {SCRATCH} WITH (FORCE)")
