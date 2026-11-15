"""The error contract of the API: a stable English `code`, an English `detail` for developers and
logs, and, for validation errors, the `field`. Clients translate the code, never the detail."""

from fastapi import HTTPException


class AppError(HTTPException):
    """An HTTP error with a machine-readable `code`, optionally the `field` and extra values."""

    def __init__(
        self,
        status_code: int,
        code: str,
        detail: str,
        *,
        field: str | None = None,
        headers: dict[str, str] | None = None,
        **extra: object,
    ):
        super().__init__(status_code, detail, headers=headers)
        self.code = code
        self.field = field
        self.extra = extra

    def body(self) -> dict:
        body: dict = {"code": self.code, "detail": self.detail}
        if self.field is not None:
            body["field"] = self.field
        body.update(self.extra)
        return body


# Codes used by the API (kept here so the list stays in one place). Never change a meaning.
NOT_AUTHENTICATED = "not_authenticated"
CSRF_HEADER_MISSING = "csrf_header_missing"
INVALID_CREDENTIALS = "invalid_credentials"
TOO_MANY_ATTEMPTS = "too_many_attempts"
EMAIL_TAKEN = "email_taken"
INVITE_REQUIRED = "invite_required"
INVITE_INVALID = "invite_invalid"
INVITE_NOT_FOUND = "invite_not_found"
PASSWORD_TOO_SHORT = "password_too_short"
WRONG_CURRENT_PASSWORD = "wrong_current_password"
LAST_MEMBER_CONFIRMATION = "last_member_confirmation_required"
RECORD_NOT_FOUND = "record_not_found"
LOCATION_NOT_FOUND = "location_not_found"
REQUIRED = "required"
INVALID = "invalid"
