"""The API surface (paths, parameters, JSON keys, error codes) is named in English."""

import json
import re

from app.main import app

ITALIAN = re.compile(
    r"\b(disc[oh]i?|vinil[ei]|famigli[ae]|impostazion[ei]|mappa|luog[ho]|acquist[oi]|"
    r"copertin[ae]|proprietari[oa]|importa|accedi|registrati|invito|valore|prezzo|etichetta|"
    r"paese|anno|scaffale|elenco)\b",
    re.IGNORECASE,
)


def test_no_italian_word_in_paths_parameters_or_schema_keys():
    spec = app.openapi()
    names: list[str] = list(spec["paths"])
    for ops in spec["paths"].values():
        for op in ops.values():
            names += [p["name"] for p in op.get("parameters", [])]
    for schema in spec["components"]["schemas"].values():
        names += list(schema.get("properties", {}))
    offenders = sorted({n for n in names if ITALIAN.search(n)})
    assert offenders == [], json.dumps(offenders)
