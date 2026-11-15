from sqlalchemy import text

from app.core.db import get_engine


def test_count_queries_sees_each_statement(count_queries):
    with count_queries() as log:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
    assert len([s for s in log if s.strip() == "SELECT 1"]) == 1


def test_count_queries_filters_by_table(count_queries):
    with count_queries() as log:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT count(*) FROM records"))
            conn.execute(text("SELECT 1"))
    assert len(log.on("records")) == 1
