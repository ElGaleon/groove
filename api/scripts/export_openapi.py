"""Write the OpenAPI document of the API to a file, without starting a server.

Usage: uv run python -m scripts.export_openapi [path]
The web app generates its zod schemas from this file (see web/scripts/gen-schemas.mjs).
"""

import json
import sys
from pathlib import Path

from app.main import app

DEFAULT = Path(__file__).resolve().parents[2] / "web/src/shared/schemas/openapi.json"


def document() -> str:
    return json.dumps(app.openapi(), indent=1, sort_keys=True, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(document(), encoding="utf-8")
    print(f"OpenAPI written to {target}")
