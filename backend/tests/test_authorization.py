"""Role-based and cross-tenant access control."""

from fastapi.testclient import TestClient

from tests.conftest import auth_header


def test_patient_cannot_use_therapist_endpoints(client: TestClient, patient: dict) -> None:
    headers = auth_header(patient["token"])
    assert client.get("/api/patients", headers=headers).status_code == 403
    assert client.get("/api/patients/overview", headers=headers).status_code == 403
    assert (
        client.post(
            "/api/patients",
            json={"name": "X Y", "email": "x@e.com", "password": "supersecret1"},
            headers=headers,
        ).status_code
        == 403
    )


def test_therapist_cannot_use_patient_endpoints(client: TestClient, therapist: dict) -> None:
    headers = auth_header(therapist["access_token"])
    assert client.get("/api/me/routine", headers=headers).status_code == 403
    assert (
        client.post("/api/sessions/start", json={"prescribed_exercise_id": 1}, headers=headers).status_code
        == 403
    )


def test_therapist_cannot_reach_another_therapists_patient(
    client: TestClient, therapist: dict, patient: dict
) -> None:
    other = client.post(
        "/api/auth/register",
        json={
            "name": "Dr. Other",
            "email": "other@example.com",
            "password": "supersecret1",
            "role": "physiotherapist",
        },
    ).json()
    patient_id = patient["profile"]["id"]
    headers = auth_header(other["access_token"])

    # 404, not 403: another clinic's records must not be confirmed to exist.
    assert client.get(f"/api/patients/{patient_id}", headers=headers).status_code == 404
    assert client.get(f"/api/patients/{patient_id}/adherence", headers=headers).status_code == 404
    assert (
        client.post(
            f"/api/patients/{patient_id}/plans",
            json={
                "title": "Sneaky plan",
                "start_date": "2026-01-01",
                "items": [{"exercise_id": 1, "sets": 3, "repetitions": 10}],
            },
            headers=headers,
        ).status_code
        == 404
    )


def test_patient_cannot_start_another_patients_exercise(
    client: TestClient, therapist: dict, patient: dict, plan: dict
) -> None:
    second = client.post(
        "/api/patients",
        json={"name": "Second Patient", "email": "second@example.com", "password": "supersecret1"},
        headers=auth_header(therapist["access_token"]),
    )
    assert second.status_code == 201
    token = client.post(
        "/api/auth/login", json={"email": "second@example.com", "password": "supersecret1"}
    ).json()["access_token"]

    prescribed_id = plan["prescribed_exercises"][0]["id"]
    response = client.post(
        "/api/sessions/start",
        json={"prescribed_exercise_id": prescribed_id},
        headers=auth_header(token),
    )
    assert response.status_code == 404
