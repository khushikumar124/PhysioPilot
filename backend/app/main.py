"""PhysioPilot API entrypoint."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import auth, exercises, me, patients, plans, sessions
from .seed import ensure_catalogue

logger = logging.getLogger("physiopilot")
settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Create tables and keep the exercise catalogue in sync on boot."""
    if settings.secret_key.startswith("dev-only"):
        logger.warning(
            "PHYSIOPILOT_SECRET_KEY is unset and a development default is in use. "
            "Set it before running anywhere other than your own machine."
        )
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_catalogue(db)
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version="0.1.0",
    description=(
        "PhysioPilot is a rehabilitation support tool. It is not a diagnostic "
        "system and does not replace a physiotherapist."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Never leak a stack trace to a patient's phone."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Something went wrong. Please try again."},
    )


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


for router in (auth.router, exercises.router, patients.router, plans.router, sessions.router, me.router):
    app.include_router(router)
