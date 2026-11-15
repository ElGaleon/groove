import re
from typing import Literal

from pydantic import Field

Currency = Field(min_length=3, max_length=3, pattern="^[A-Za-z]{3}$")


Channel = Literal["physical", "online"]


def _dedupe(genres: list[str]) -> list[str]:
    seen: list[str] = []
    for genre in genres:
        genre = genre.strip()
        if genre and genre not in seen:
            seen.append(genre)
    return seen


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


LocationKind = Literal["physical", "online", "both"]


_URL = re.compile(r"^https?://[^\s./]+\.[^\s]+$", re.IGNORECASE)
