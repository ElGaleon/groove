"""Cover images: validated, cropped to a square and re-encoded, kept on disk."""

import io
import uuid
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.core.config import Settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
Image.MAX_IMAGE_PIXELS = 25_000_000  # refuse decompression bombs


class InvalidCover(ValueError):
    """A rejected cover image; `code` tells the client why."""

    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code


def cover_file(settings: Settings, record_id: uuid.UUID, *, back: bool = False) -> Path:
    return Path(settings.covers_dir) / (f"{record_id}.back.jpg" if back else f"{record_id}.jpg")


def process_cover(data: bytes, settings: Settings) -> bytes:
    """Return a square JPEG (cover_size px) from a JPEG, PNG or WebP upload."""
    if len(data) > settings.max_cover_bytes:
        raise InvalidCover("image_too_large", "The image is larger than the limit")
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ALLOWED_FORMATS:
                raise InvalidCover(
                    "unsupported_image_format", "Unsupported format: use JPEG, PNG or WebP"
                )
            image.load()
            rgb = image.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise InvalidCover("invalid_image", "The file is not a valid image") from None

    side = min(rgb.size)
    left, top = (rgb.width - side) // 2, (rgb.height - side) // 2
    square = rgb.crop((left, top, left + side, top + side)).resize(
        (settings.cover_size, settings.cover_size), Image.LANCZOS
    )
    out = io.BytesIO()
    square.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()


def save_cover(settings: Settings, record_id: uuid.UUID, jpeg: bytes, *, back: bool = False) -> str:
    path = cover_file(settings, record_id, back=back)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(jpeg)
    tmp.replace(path)  # atomic: a failed write never leaves a half-written cover
    return path.name
