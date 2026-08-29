from fastapi.testclient import TestClient

from tests.conftest import auth_header


def test_register_and_login(client: TestClient) -> None:
    register = client.post(
        "/api/auth/register",
        json={
            "name": "Dr. A",
            "email": "A@Example.com",
            "password": "supersecret1",
            "role": "physiotherapist",
        },
    )
    assert register.status_code == 201
    assert register.json()["user"]["role"] == "physiotherapist"
    # Email is normalised to lower case, so login is case-insensitive.
    login = client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "supersecret1"}
    )
    assert login.status_code == 200


def test_duplicate_email_rejected(client: TestClient, therapist: dict) -> None:
    again = client.post(
        "/api/auth/register",
        json={
            "name": "Someone Else",
            "email": "rao@example.com",
            "password": "supersecret1",
            "role": "patient",
        },
    )
    assert again.status_code == 409


def test_wrong_password_is_rejected(client: TestClient, therapist: dict) -> None:
    response = client.post(
        "/api/auth/login", json={"email": "rao@example.com", "password": "wrongwrong"}
    )
    assert response.status_code == 401
    # The message must not reveal whether the account exists.
    assert response.json()["detail"] == "Incorrect email or password"


def test_short_password_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"name": "Dr. B", "email": "b@example.com", "password": "short", "role": "patient"},
    )
    assert response.status_code == 422


def test_protected_route_requires_token(client: TestClient) -> None:
    assert client.get("/api/patients").status_code == 401
    assert client.get("/api/patients", headers=auth_header("garbage")).status_code == 401


def test_me_returns_profile_ids(client: TestClient, patient: dict) -> None:
    response = client.get("/api/auth/me", headers=auth_header(patient["token"]))
    body = response.json()
    assert body["role"] == "patient"
    assert body["patient_profile_id"] is not None
    assert body["therapist_profile_id"] is None
