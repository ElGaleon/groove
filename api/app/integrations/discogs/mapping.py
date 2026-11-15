"""Discogs data to our record fields."""

import re

_DISAMBIGUATION = re.compile(r"\s+\(\d+\)$")  # Discogs writes "Artist (2)" for namesakes


def _clean_name(name: str) -> str:
    return _DISAMBIGUATION.sub("", name).strip()


def map_release(item: dict) -> dict:
    """Turn one entry of the Discogs collection listing into record fields."""
    info = item.get("basic_information") or {}
    artists = [_clean_name(a.get("name", "")) for a in info.get("artists") or []]
    artists = [a for a in artists if a]
    labels = [_clean_name(x.get("name", "")) for x in info.get("labels") or []]
    labels = [x for x in labels if x]
    catnos = [
        (x.get("catno") or "").strip()
        for x in info.get("labels") or []
        if (x.get("catno") or "").strip() and (x.get("catno") or "").strip().lower() != "none"
    ]
    formats = info.get("formats") or []
    format_text = None
    if formats:
        first = formats[0]
        parts = [first.get("name", "")] + list(first.get("descriptions") or [])
        format_text = ", ".join(p for p in parts if p)[:100] or None
    year = info.get("year") or None
    title = (info.get("title") or "").strip() or "Senza titolo"
    artist = ", ".join(artists) or "Artista sconosciuto"
    return {
        "title": title[:300],
        "artist": artist[:300],
        "year": year,
        "label": labels[0][:200] if labels else None,
        "catalog_no": catnos[0][:100] if catnos else None,
        "genres": [g for g in info.get("genres") or [] if g],
        "format": format_text,
        "discogs_release_id": item.get("id") or info.get("id"),
        "discogs_instance_id": item.get("instance_id"),
        "cover_url": info.get("cover_image") or info.get("thumb") or None,
    }
