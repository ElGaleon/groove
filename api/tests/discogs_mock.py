"""A fake Discogs served through httpx.MockTransport, shared by the Discogs tests."""

import io
import json
from urllib.parse import parse_qs

import httpx
from PIL import Image


def jpeg_bytes(color=(200, 30, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 300), color).save(buf, "JPEG")
    return buf.getvalue()


def release(n: int, **over) -> dict:
    basic = {
        "id": 1000 + n,
        "title": f"Album {n}",
        "year": 1970 + n % 30,
        "cover_image": f"https://i.discogs.com/cover{n}.jpg",
        "artists": [{"name": f"Artist {n}"}],
        "labels": [{"name": f"Label {n}"}],
        "genres": ["Rock"],
        "formats": [{"name": "Vinyl", "descriptions": ['12"', "LP"]}],
    }
    basic.update(over)
    return {"id": 1000 + n, "instance_id": 5000 + n, "basic_information": basic}


class MockDiscogs:
    def __init__(self):
        self.username = "anna_d"
        self.releases = [release(i) for i in range(1, 6)]
        self.per_page_seen = []
        self.calls: list[tuple[str, str]] = []
        self.fail_next: list[int] = []  # status codes to answer before behaving
        self.access_ok = True
        self.collection_status = 200
        self.tracklists = {1001: [{"position": "A1", "title": "Song", "duration": "3:00"}]}
        self.search_results = []
        self.search_pages = 1
        self.search_params: list[dict] = []
        self.stats: dict[int, dict] = {}  # release id -> marketplace stats answer
        self.auth_headers: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.calls.append((request.method, path))
        self.auth_headers.append(request.headers.get("authorization", ""))
        assert request.headers["user-agent"]
        if self.fail_next and not path.endswith(".jpg"):
            status = self.fail_next.pop(0)
            return httpx.Response(status, headers={"Retry-After": "0"}, text="no")
        if path.endswith(".jpg"):
            return httpx.Response(200, content=jpeg_bytes())
        if path == "/oauth/request_token":
            return httpx.Response(200, text="oauth_token=REQTOKEN&oauth_token_secret=REQSECRET")
        if path == "/oauth/access_token":
            if not self.access_ok:
                return httpx.Response(401, text="bad verifier")
            return httpx.Response(200, text="oauth_token=ACCESSTOK&oauth_token_secret=ACCESSSEC")
        if path == "/oauth/identity":
            return httpx.Response(200, json={"id": 7, "username": self.username})
        if path.endswith("/collection/folders/0/releases"):
            if self.collection_status != 200:
                return httpx.Response(self.collection_status, text="x")
            q = parse_qs(request.url.query.decode())
            page, per = int(q["page"][0]), int(q["per_page"][0])
            self.per_page_seen.append(per)
            chunk = self.releases[(page - 1) * per : page * per]
            pages = max(1, -(-len(self.releases) // per))
            return httpx.Response(
                200,
                json={
                    "pagination": {
                        "page": page,
                        "pages": pages,
                        "per_page": per,
                        "items": len(self.releases),
                    },
                    "releases": chunk,
                },
            )
        if path == "/database/search":
            q = {k: v[0] for k, v in parse_qs(request.url.query.decode()).items()}
            self.search_params.append(q)
            return httpx.Response(
                200,
                json={
                    "pagination": {"page": int(q.get("page", 1)), "pages": self.search_pages},
                    "results": self.search_results,
                },
            )
        if path.startswith("/marketplace/stats/"):
            rid = int(path.rsplit("/", 1)[1])
            return httpx.Response(
                200, json=self.stats.get(rid, {"lowest_price": None, "num_for_sale": 0})
            )
        if path.startswith("/releases/"):
            rid = int(path.rsplit("/", 1)[1])
            return httpx.Response(200, json={"id": rid, "tracklist": self.tracklists.get(rid, [])})
        return httpx.Response(404, text=json.dumps({"message": "nope"}))

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handler)
