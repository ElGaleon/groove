from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import sessionmaker

from app.api.routers import (
    auth,
    backup,
    discogs,
    household,
    invites,
    locations,
    purchases,
    records,
)
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.errors import CSRF_HEADER_MISSING, AppError
from app.services.importer import Worker


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start the import worker; jobs left running by a previous process resume from the database."""
    settings = get_settings()
    worker = None
    if settings.import_worker_enabled:
        worker = Worker(sessionmaker(bind=get_engine(), expire_on_commit=False), settings)
        worker.start()
    yield
    if worker:
        worker.stop()


_docs = get_settings().api_docs_enabled  # off in production: no public map of the API
app = FastAPI(
    title="Groove API",
    docs_url="/api/docs" if _docs else None,
    redoc_url="/api/redoc" if _docs else None,
    openapi_url="/api/openapi.json" if _docs else None,
    lifespan=lifespan,
)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "groove"


@app.middleware("http")
async def require_csrf_header(request: Request, call_next):
    """With SameSite=Lax cookies this blocks cross-site form posts: browsers cannot add a custom
    header to those, so every state-changing request must carry it."""
    if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        return JSONResponse(
            {"code": CSRF_HEADER_MISSING, "detail": "Missing security header"}, status_code=403
        )
    return await call_next(request)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(invites.router)
app.include_router(household.router)
app.include_router(records.router)
app.include_router(locations.router)
app.include_router(purchases.router)
app.include_router(discogs.router)
app.include_router(backup.router)


def _validation_code(error: dict) -> str:
    """Pydantic error type to one of our codes."""
    kind = error.get("type", "")
    if kind == "missing":
        return "required"
    if kind == "string_too_short" and (error.get("ctx") or {}).get("min_length") == 1:
        return "required"
    if kind == "value_error" and "required" in str(error.get("msg", "")):
        return "required"
    return "invalid"


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """Name the first wrong field and say whether it is missing or invalid; list all the fields."""
    errors = [e for e in exc.errors() if e.get("loc")]
    fields = [str(e["loc"][-1]) for e in errors]
    if not errors:
        return JSONResponse({"code": "invalid", "detail": "Invalid data"}, status_code=422)
    first = errors[0]
    code = _validation_code(first)
    detail = f"Field '{fields[0]}' is {'required' if code == 'required' else 'invalid'}"
    return JSONResponse(
        {"code": code, "detail": detail, "field": fields[0], "fields": fields}, status_code=422
    )


@app.exception_handler(AppError)
async def app_error(_: Request, exc: AppError):
    return JSONResponse(exc.body(), status_code=exc.status_code, headers=exc.headers)
