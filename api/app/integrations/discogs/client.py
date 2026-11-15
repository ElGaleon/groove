"""Discogs API client: OAuth 1.0a signing, a shared rate limiter, retries with backoff.

Secrets (application key/secret, member tokens) never leave this module's callers on the server.
"""

import re
import threading
import time
from collections import deque
from collections.abc import Callable
from urllib.parse import parse_qsl

import httpx
from oauthlib.oauth1 import SIGNATURE_PLAINTEXT, Client

from app.core.config import Settings

# Tests replace this to route every call to a mocked Discogs.
_transport: httpx.BaseTransport | None = None


def set_transport(transport: httpx.BaseTransport | None) -> None:
    global _transport
    _transport = transport


class DiscogsError(Exception):
    """Base error. `message` is safe to show to a member (English)."""

    message = "Discogs error"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.message)
        self.message = message or self.message


class DiscogsUnauthorized(DiscogsError):
    message = "Discogs rejected the authorisation: connect the account again"


class DiscogsForbidden(DiscogsError):
    message = "The collection on Discogs is private"


class DiscogsNotFound(DiscogsError):
    message = "Not found on Discogs"


class DiscogsUnavailable(DiscogsError):
    message = "Discogs is not responding, try again later"


class RateLimiter:
    """At most `per_minute` calls in any sliding 60 s window, shared by every request."""

    def __init__(
        self,
        per_minute: int,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.per_minute = per_minute
        self._clock = clock
        self._sleep = sleep
        self._stamps: deque[float] = deque()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        while True:
            with self._lock:
                now = self._clock()
                while self._stamps and now - self._stamps[0] >= 60:
                    self._stamps.popleft()
                if len(self._stamps) < self.per_minute:
                    self._stamps.append(now)
                    return
                wait = 60 - (now - self._stamps[0])
            self._sleep(max(wait, 0.01))


_limiter: RateLimiter | None = None


def get_limiter(settings: Settings) -> RateLimiter:
    global _limiter
    if _limiter is None or _limiter.per_minute != settings.discogs_rate_per_minute:
        _limiter = RateLimiter(settings.discogs_rate_per_minute)
    return _limiter


class DiscogsClient:
    def __init__(
        self,
        settings: Settings,
        token: str | None = None,
        token_secret: str | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.settings = settings
        self.token = token
        self.token_secret = token_secret
        self._sleep = sleep
        self._http = httpx.Client(
            transport=_transport,
            timeout=20,
            headers={"User-Agent": settings.discogs_user_agent},
        )

    def close(self) -> None:
        self._http.close()

    # --- low level --------------------------------------------------------------------------

    def _oauth_headers(
        self, url: str, method: str, callback: str | None = None, verifier: str | None = None
    ) -> dict[str, str]:
        oauth = Client(
            self.settings.discogs_consumer_key,
            client_secret=self.settings.discogs_consumer_secret,
            resource_owner_key=self.token,
            resource_owner_secret=self.token_secret,
            callback_uri=callback,
            verifier=verifier,
            signature_method=SIGNATURE_PLAINTEXT,
        )
        _, headers, _ = oauth.sign(url, http_method=method)
        return headers

    def _send(
        self,
        method: str,
        url: str,
        *,
        params: dict | None = None,
        signed: bool = True,
        limited: bool = True,
        callback: str | None = None,
        verifier: str | None = None,
    ) -> httpx.Response:
        attempts = self.settings.discogs_max_retries + 1
        for attempt in range(attempts):
            if limited:
                get_limiter(self.settings).acquire()
            headers = self._oauth_headers(url, method, callback, verifier) if signed else {}
            try:
                response = self._http.request(method, url, params=params, headers=headers)
            except httpx.TransportError:
                response = None
            status = response.status_code if response is not None else 599
            if status == 401:
                raise DiscogsUnauthorized()
            if status == 403:
                raise DiscogsForbidden()
            if status == 404:
                raise DiscogsNotFound()
            if status < 400:
                return response
            retryable = status == 429 or status >= 500
            if not retryable:
                raise DiscogsError(f"Discogs answered with error {status}")
            if attempt == attempts - 1:
                break
            delay = self.settings.discogs_backoff_seconds * (2**attempt)
            retry_after = response.headers.get("Retry-After") if response is not None else None
            if retry_after and retry_after.isdigit():
                delay = max(delay, float(retry_after))
            self._sleep(delay)
        raise DiscogsUnavailable()

    def _get_json(self, path: str, params: dict | None = None) -> dict:
        response = self._send("GET", self.settings.discogs_api_url + path, params=params)
        return response.json()

    # --- OAuth ------------------------------------------------------------------------------

    def request_token(self, callback: str) -> tuple[str, str]:
        response = self._send(
            "POST", self.settings.discogs_api_url + "/oauth/request_token", callback=callback
        )
        data = dict(parse_qsl(response.text))
        if "oauth_token" not in data or "oauth_token_secret" not in data:
            raise DiscogsError("Invalid answer from Discogs")
        return data["oauth_token"], data["oauth_token_secret"]

    def authorize_url(self, request_token: str) -> str:
        return f"{self.settings.discogs_web_url}/oauth/authorize?oauth_token={request_token}"

    def access_token(self, verifier: str) -> tuple[str, str]:
        response = self._send(
            "POST", self.settings.discogs_api_url + "/oauth/access_token", verifier=verifier
        )
        data = dict(parse_qsl(response.text))
        if "oauth_token" not in data or "oauth_token_secret" not in data:
            raise DiscogsError("Invalid answer from Discogs")
        return data["oauth_token"], data["oauth_token_secret"]

    # --- data -------------------------------------------------------------------------------

    def identity(self) -> dict:
        return self._get_json("/oauth/identity")

    def collection_page(self, username: str, page: int, per_page: int) -> dict:
        return self._get_json(
            f"/users/{username}/collection/folders/0/releases",
            {"page": page, "per_page": per_page, "sort": "added", "sort_order": "asc"},
        )

    def search(self, query: str, page: int = 1, per_page: int = 12) -> dict:
        """Free text (artist, title, catalogue number); 8-14 digits are searched as a barcode."""
        digits = re.sub(r"[\s-]", "", query)
        term = {"barcode": digits} if re.fullmatch(r"\d{8,14}", digits) else {"q": query}
        return self._get_json(
            "/database/search",
            {**term, "type": "release", "format": "Vinyl", "page": page, "per_page": per_page},
        )

    def marketplace_stats(self, release_id: int, currency: str) -> dict:
        """Lowest price for sale and number of copies for sale of a release."""
        return self._get_json(f"/marketplace/stats/{release_id}", {"curr_abbr": currency})

    def release(self, release_id: int) -> dict:
        return self._get_json(f"/releases/{release_id}")

    def download_image(self, url: str) -> bytes | None:
        """Best effort: a cover that cannot be fetched is skipped, never fatal."""
        try:
            response = self._send("GET", url, signed=False, limited=False)
        except DiscogsError:
            return None
        return response.content
