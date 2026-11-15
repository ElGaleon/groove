import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.db import get_engine
from app.models import ImportJob
from app.services import importer
from tests.discogs_mock import release


@pytest.fixture
def connected(owner, discogs):
    owner.post("/api/discogs/connect")
    owner.get("/api/discogs/callback?oauth_token=REQTOKEN&oauth_verifier=V")
    return owner


def run_worker():
    return importer.process_jobs(
        sessionmaker(bind=get_engine(), expire_on_commit=False), get_settings()
    )


def start(client, shared=False):
    r = client.post("/api/discogs/import", json={"shared": shared})
    assert r.status_code == 202, r.text
    return r.json()


def records(client):
    return client.get("/api/records?limit=100").json()["items"]


def test_mapping():
    mapped = importer.map_release(
        release(3, artists=[{"name": "Pino (2)"}, {"name": "Gino"}], year=0)
    )
    assert mapped["artist"] == "Pino, Gino" and mapped["year"] is None
    assert mapped["format"] == 'Vinyl, 12", LP'
    assert mapped["label"] == "Label 3" and mapped["genres"] == ["Rock"]
    assert mapped["discogs_release_id"] == 1003 and mapped["discogs_instance_id"] == 5003


def test_import_requires_connection(owner):
    r = owner.post("/api/discogs/import", json={})
    assert r.status_code == 409 and r.json()["code"] == "discogs_not_connected"


def test_first_import_owned_by_importer_with_covers(connected, discogs):
    job = start(connected)
    assert job["status"] == "pending"
    run_worker()
    done = connected.get("/api/discogs/import/latest").json()
    assert (done["status"], done["total"], done["processed"], done["added"]) == ("done", 5, 5, 5)
    items = records(connected)
    assert len(items) == 5
    me = connected.get("/api/auth/me").json()["id"]
    assert {i["owner_id"] for i in items} == {me}
    assert all(i["has_cover"] for i in items)
    assert connected.get(f"/api/records/{items[0]['id']}/cover").status_code == 200


def test_import_as_shared(connected):
    start(connected, shared=True)
    run_worker()
    assert {i["owner_id"] for i in records(connected)} == {None}


def test_reimport_adds_only_new_and_keeps_edits(connected, discogs):
    start(connected)
    run_worker()
    first = sorted(records(connected), key=lambda r: r["title"])[0]
    connected.patch(f"/api/records/{first['id']}", json={"note": "Edge rovinato", "owner_id": None})
    discogs.releases.append(release(6))
    start(connected)
    run_worker()
    items = records(connected)
    assert len(items) == 6
    again = next(i for i in items if i["id"] == first["id"])
    assert again["note"] == "Edge rovinato" and again["owner_id"] is None
    assert connected.get("/api/discogs/import/latest").json()["added"] == 1


def test_release_removed_on_discogs_is_not_deleted(connected, discogs):
    start(connected)
    run_worker()
    discogs.releases = discogs.releases[:2]
    start(connected)
    run_worker()
    assert len(records(connected)) == 5


def test_deleted_record_is_not_brought_back(connected):
    start(connected)
    run_worker()
    victim = records(connected)[0]
    connected.delete(f"/api/records/{victim['id']}")
    start(connected)
    run_worker()
    assert victim["id"] not in {i["id"] for i in records(connected)}


def test_pages_and_resume_after_restart(connected, discogs, db):
    discogs.releases = [release(i) for i in range(1, 251)]
    start(connected)
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with factory() as s:
        job_id = s.scalar(select(ImportJob.id))
        importer.run_job(s, job_id, get_settings(), max_pages=1)  # then "the process dies"
    with factory() as s:
        job = s.get(ImportJob, job_id)
        assert job.status == "running" and job.processed == 100 and job.next_page == 2
    run_worker()  # a new process picks the running job up where it stopped
    done = connected.get("/api/discogs/import/latest").json()
    assert (done["status"], done["processed"], done["added"]) == ("done", 250, 250)
    assert connected.get("/api/records?limit=1").json()["total"] == 250
    assert set(discogs.per_page_seen) == {100}


def test_only_one_import_at_a_time(connected):
    a = start(connected)
    b = start(connected)
    assert a["id"] == b["id"]


def test_empty_collection(connected, discogs):
    discogs.releases = []
    start(connected)
    run_worker()
    done = connected.get("/api/discogs/import/latest").json()
    assert done["status"] == "done" and done["added"] == 0
    assert done["message"] == "empty_or_private"


def test_private_collection(connected, discogs):
    discogs.collection_status = 403
    start(connected)
    run_worker()
    done = connected.get("/api/discogs/import/latest").json()
    assert done["status"] == "failed" and done["message"] == "private_collection"


def test_rate_limit_waits_and_continues(connected, discogs):
    discogs.fail_next = [429, 429]
    start(connected)
    run_worker()
    assert connected.get("/api/discogs/import/latest").json()["status"] == "done"
    assert len(records(connected)) == 5


def test_discogs_unavailable_keeps_imported_and_can_rerun(connected, discogs):
    discogs.releases = [release(i) for i in range(1, 151)]
    start(connected)
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with factory() as s:
        job_id = s.scalar(select(ImportJob.id))
        importer.run_job(s, job_id, get_settings(), max_pages=1)
    discogs.fail_next = [503] * 30
    run_worker()
    failed = connected.get("/api/discogs/import/latest").json()
    assert failed["status"] == "failed" and failed["added"] == 100
    assert failed["message"] == "discogs_unavailable"
    assert connected.get("/api/records?limit=1").json()["total"] == 100
    discogs.fail_next = []
    start(connected)
    run_worker()
    assert connected.get("/api/records?limit=1").json()["total"] == 150


def test_rejected_authorisation_marks_connection_expired(connected, discogs, db):
    discogs.fail_next = [401]
    start(connected)
    run_worker()
    assert connected.get("/api/discogs/import/latest").json()["status"] == "failed"
    assert connected.get("/api/discogs/status").json()["status"] == "expired"
    r = connected.post("/api/discogs/import", json={})
    assert r.status_code == 409 and r.json()["code"] == "discogs_expired"
