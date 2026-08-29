"""Test fixtures: every test runs against a fresh in-memory-ish SQLite file."""

import os
import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

# Configure the app before it is imported anywhere.
_TMP_DB = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["PHYSIOPILOT_DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ["PHYSIOPILOT_SECRET_KEY"] = "test-secret"
os.environ["PHYSIOPILOT_ANTHROPIC_API_KEY"] = ""

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import ensure_catalogue  # noqa: E402


@pytest.fixture()
def client() -> Iterator[TestClient]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_catalogue(db)
    with TestClient(app) as test_client:
        yield test_client


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def therapist(client: TestClient) -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Dr. Test Rao",
            "email": "rao@example.com",
            "password": "supersecret1",
            "role": "physiotherapist",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def patient(client: TestClient, therapist: dict) -> dict:
    response = client.post(
        "/api/patients",
        json={
            "name": "Test Patient",
            "email": "patient@example.com",
            "password": "supersecret1",
        },
        headers=auth_header(therapist["access_token"]),
    )
    assert response.status_code == 201, response.text
    login = client.post(
        "/api/auth/login",
        json={"email": "patient@example.com", "password": "supersecret1"},
    )
    return {"profile": response.json(), "token": login.json()["access_token"]}


@pytest.fixture()
def knee_flexion_id(client: TestClient, therapist: dict) -> int:
    exercises = client.get(
        "/api/exercises", headers=auth_header(therapist["access_token"])
    ).json()
    return next(e["id"] for e in exercises if e["slug"] == "knee_flexion")


@pytest.fixture()
def plan(client: TestClient, therapist: dict, patient: dict, knee_flexion_id: int) -> dict:
    from datetime import date, timedelta

    response = client.post(
        f"/api/patients/{patient['profile']['id']}/plans",
        json={
            "title": "Week 1 - knee",
            "condition": "Post-operative knee rehabilitation",
            "start_date": str(date.today() - timedelta(days=6)),
            "end_date": str(date.today() + timedelta(days=21)),
            "items": [
                {
                    "exercise_id": knee_flexion_id,
                    "sets": 3,
                    "repetitions": 10,
                    "frequency_per_day": 1,
                    "instructions": "Bend the knee slowly.",
                    "target_rom": 90,
                }
            ],
        },
        headers=auth_header(therapist["access_token"]),
    )
    assert response.status_code == 201, response.text
    return response.json()
