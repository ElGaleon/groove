import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.money import SUPPORTED_CURRENCIES

# Upper bounds on free text from anonymous callers: argon2 over a megabyte-long password is a
# cheap way to burn the server's CPU. Tokens are 43 characters; 128 leaves room.
MAX_PASSWORD = 256
MAX_TOKEN = 128


class HouseholdOut(BaseModel):
    id: uuid.UUID
    name: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    default_currency: str | None = None
    language: str | None = None
    household: HouseholdOut


class PreferencesIn(BaseModel):
    """Only the fields that are sent change; sending null clears one."""

    default_currency: str | None = Field(default=None, min_length=3, max_length=3)
    language: Literal["it", "en"] | None = None

    @field_validator("default_currency")
    @classmethod
    def _supported(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.upper()
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError("default_currency")
        return v


class MemberOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=MAX_PASSWORD)
    display_name: str = Field(min_length=1, max_length=80)
    household_name: str | None = Field(default=None, min_length=1, max_length=120)
    invite_token: str | None = Field(default=None, max_length=MAX_TOKEN)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=MAX_PASSWORD)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=MAX_PASSWORD)
    new_password: str = Field(max_length=MAX_PASSWORD)


class InviteCreated(BaseModel):
    id: uuid.UUID
    token: str  # shown once; only its hash is stored
    expires_at: datetime


class InviteOut(BaseModel):
    id: uuid.UUID
    created_by: uuid.UUID | None
    created_at: datetime
    expires_at: datetime
    status: str  # valid | used | revoked | expired


class InviteCheck(BaseModel):
    status: str
    household_name: str | None = None


class PasswordResetCreated(BaseModel):
    token: str  # shown once; only its hash is stored
    expires_at: datetime


class PasswordResetCheck(BaseModel):
    status: str  # valid | used | expired | invalid
    display_name: str | None = None


class PasswordResetIn(BaseModel):
    token: str = Field(min_length=1, max_length=MAX_TOKEN)
    new_password: str = Field(max_length=MAX_PASSWORD)


class LeaveIn(BaseModel):
    confirm_delete_collection: bool = False


class SetupStatus(BaseModel):
    needs_setup: bool  # true until the first household exists
    min_password_length: int  # so the forms apply the same limit as the server


class HouseholdDetail(BaseModel):
    id: uuid.UUID
    name: str
    members: list[MemberOut]
