"""A tiny fake Discogs for the browser tests (stdlib only; Pillow draws the covers).

Run: python scripts/mock_discogs.py 8020
Control: GET /__mode?cancel=1 makes the next authorisation end without a verifier;
         GET /__mode?delay=1.5 sets the pause before each collection page (seconds).
"""

import io
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

from PIL import Image

STATE = {"cancel": False, "delay": 1.5, "callback": None}
TOTAL = 230


def release(n: int) -> dict:
    return {
        "id": 10000 + n,
        "instance_id": 50000 + n,
        "basic_information": {
            "id": 10000 + n,
            "title": f"Disco importato {n}",
            "year": 1960 + n % 60,
            "cover_image": f"http://localhost:{PORT}/img/{n}.jpg",
            "artists": [{"name": f"Artista {n % 17}"}],
            "labels": [{"name": f"Etichetta {n % 9}"}],
            "genres": ["Rock", "Pop"][: 1 + n % 2],
            "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
        },
    }


def jpeg(n: int) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (400, 400), ((n * 37) % 255, (n * 91) % 255, (n * 53) % 255)).save(buf, "JPEG")
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, status=200, body=b"", ctype="application/json", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        url = urlparse(self.path)
        q = parse_qs(url.query)
        path = url.path
        if path == "/__mode":
            if "cancel" in q:
                STATE["cancel"] = q["cancel"][0] == "1"
            if "delay" in q:
                STATE["delay"] = float(q["delay"][0])
            return self.send(200, {"ok": True})
        if path == "/oauth/authorize":
            callback = STATE["callback"]
            target = f"{callback}?oauth_token={q['oauth_token'][0]}"
            if not STATE["cancel"]:
                target += "&oauth_verifier=VERIFIER"
            return self.send(302, b"", headers={"Location": target})
        if path.startswith("/img/"):
            return self.send(200, jpeg(int(path[5:].split(".")[0])), "image/jpeg")
        if path == "/oauth/identity":
            return self.send(200, {"id": 1, "username": "anna_d"})
        if path.endswith("/collection/folders/0/releases"):
            time.sleep(STATE["delay"])
            page, per = int(q["page"][0]), int(q["per_page"][0])
            items = [release(n) for n in range(1, TOTAL + 1)][(page - 1) * per : page * per]
            pages = -(-TOTAL // per)
            return self.send(
                200,
                {
                    "pagination": {"page": page, "pages": pages, "per_page": per, "items": TOTAL},
                    "releases": items,
                },
            )
        if path == "/database/search":
            term = q.get("q", [""])[0].lower()
            barcode = q.get("barcode", [""])[0]
            page = int(q.get("page", ["1"])[0])
            catalogue = [
                (2001, "Pink Floyd - The Wall", 1979, "Harvest", "SHDW 411", "UK", "5099902988320"),
                (
                    2003,
                    "Pink Floyd - The Wall",
                    2016,
                    "Pink Floyd Records",
                    "PFRLP14",
                    "Europe",
                    "825646122974",
                ),
                (
                    2002,
                    "Miles Davis - Kind of Blue",
                    1959,
                    "Columbia",
                    "CL 1355",
                    "US",
                    "074646493416",
                ),
            ]
            found = [
                {
                    "id": i,
                    "title": title,
                    "year": str(year),
                    "label": [label],
                    "catno": catno,
                    "country": country,
                    "genre": ["Rock"],
                    "format": ["Vinyl", "LP"],
                    "cover_image": f"http://localhost:{PORT}/img/{i % 100}.jpg",
                }
                for i, title, year, label, catno, country, code in catalogue
                if (barcode and barcode == code)
                or (not barcode and (term in title.lower() or term == catno.lower()))
            ]
            # two pages: the second one repeats the search with an extra, older pressing
            if page == 2:
                found = (
                    [
                        {
                            **found[0],
                            "id": 2100,
                            "year": "1980",
                            "label": ["Columbia"],
                            "catno": "PC 36183",
                            "country": "Japan",
                        }
                    ]
                    if found
                    else []
                )
            return self.send(200, {"pagination": {"page": page, "pages": 2}, "results": found})
        if path.startswith("/marketplace/stats/"):
            rid = int(path.rsplit("/", 1)[1])
            if rid == 2001:
                return self.send(
                    200,
                    {
                        "lowest_price": {"value": 61.5, "currency": "EUR"},
                        "num_for_sale": 12,
                        "blocked_from_sale": False,
                    },
                )
            return self.send(
                200, {"lowest_price": None, "num_for_sale": 0, "blocked_from_sale": False}
            )
        if path.startswith("/releases/"):
            return self.send(
                200, {"tracklist": [{"position": "A1", "title": "Brano uno", "duration": "3:10"}]}
            )
        self.send(404, {"message": "not found"})

    def do_POST(self):  # noqa: N802
        path = urlparse(self.path).path
        if path == "/oauth/request_token":
            auth = self.headers.get("Authorization", "")
            for part in auth.split(","):
                part = part.strip().removeprefix("OAuth ").strip()
                if part.startswith("oauth_callback="):
                    STATE["callback"] = unquote(part.split("=", 1)[1].strip('"'))
            return self.send(
                200,
                "oauth_token=REQTOKEN&oauth_token_secret=REQSECRET",
                "application/x-www-form-urlencoded",
            )
        if path == "/oauth/access_token":
            return self.send(
                200,
                "oauth_token=ACCESSTOKEN&oauth_token_secret=ACCESSSECRET",
                "application/x-www-form-urlencoded",
            )
        self.send(404, {"message": "not found"})


PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8020

if __name__ == "__main__":
    ThreadingHTTPServer((os.environ.get("MOCK_HOST", "127.0.0.1"), PORT), Handler).serve_forever()
