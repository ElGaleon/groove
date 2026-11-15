"""The web app generates its zod schemas from a committed copy of the OpenAPI document.

If a model or an endpoint changes, this fails until the copy is refreshed with `npm run schemas`
(in web/), so the browser's checks cannot drift from the API.
"""

import json
from pathlib import Path

from scripts.export_openapi import document

SNAPSHOT = Path(__file__).resolve().parents[2] / "web/src/shared/schemas/openapi.json"


def test_the_committed_openapi_document_matches_the_api():
    assert SNAPSHOT.exists(), "run `npm run schemas` in web/ to create the OpenAPI snapshot"
    committed = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    current = json.loads(document())
    changed = sorted(
        name
        for name in set(committed["components"]["schemas"]) | set(current["components"]["schemas"])
        if committed["components"]["schemas"].get(name)
        != current["components"]["schemas"].get(name)
    )
    assert not changed, f"schemas changed, run `npm run schemas` in web/: {changed}"
    assert committed == current, "paths changed, run `npm run schemas` in web/"
