import pytest

from app.core.config import get_settings
from app.integrations.discogs import client as d
from tests.discogs_mock import MockDiscogs


def make(mock, token="tok", secret="sec"):
    d.set_transport(mock.transport())
    return d.DiscogsClient(get_settings(), token, secret, sleep=lambda s: None)


@pytest.fixture(autouse=True)
def _reset():
    yield
    d.set_transport(None)


def test_sends_user_agent_and_oauth_header():
    mock = MockDiscogs()
    client = make(mock)
    assert client.identity()["username"] == "anna_d"
    assert mock.auth_headers[-1].startswith("OAuth ")
    assert 'oauth_token="tok"' in mock.auth_headers[-1]


def test_retries_on_429_then_succeeds():
    mock = MockDiscogs()
    mock.fail_next = [429, 429]
    client = make(mock)
    assert client.identity()["id"] == 7
    assert len(mock.calls) == 3


def test_retries_on_5xx_then_gives_up():
    mock = MockDiscogs()
    mock.fail_next = [503] * 20
    client = make(mock)
    with pytest.raises(d.DiscogsUnavailable):
        client.identity()
    assert len(mock.calls) == get_settings().discogs_max_retries + 1


def test_401_raises_unauthorized_without_retry():
    mock = MockDiscogs()
    mock.fail_next = [401]
    client = make(mock)
    with pytest.raises(d.DiscogsUnauthorized):
        client.identity()
    assert len(mock.calls) == 1


def test_private_collection_is_forbidden():
    mock = MockDiscogs()
    mock.collection_status = 403
    with pytest.raises(d.DiscogsForbidden):
        make(mock).collection_page("anna_d", 1, 100)


def test_rate_limiter_waits_when_window_is_full():
    now = [0.0]
    slept = []

    def sleep(s):
        slept.append(s)
        now[0] += s

    limiter = d.RateLimiter(3, clock=lambda: now[0], sleep=sleep)
    for _ in range(3):
        limiter.acquire()
    assert slept == []
    limiter.acquire()  # fourth call must wait for the first to leave the window
    assert slept and abs(sum(slept) - 60) < 0.5
