"""Therapist-authored exercises: ownership, isolation, and honest tracking."""

from fastapi.testclient import TestClient

from tests.conftest import auth_header


def create(client: TestClient, token: str, **overrides) -> dict:
    payload = {
        "name": "Ankle Pumps",
        "patient_cue": "Point your toes away, then pull them back towards you.",
        "description": "Seated ankle mobility for circulation.",
        "body_region": "ankle",
        "difficulty": "easy",
    }
    payload.update(overrides)
    return client.post("/api/exercises", json=payload, headers=auth_header(token))


def test_therapist_can_add_an_exercise(client: TestClient, therapist: dict) -> None:
    response = create(client, therapist["access_token"])
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Ankle Pumps"
    assert body["patient_cue"].startswith("Point your toes")
    assert body["is_custom"] is True


def test_custom_exercise_is_never_marked_camera_tracked(
    client: TestClient, therapist: dict
) -> None:
    """A written exercise has no movement model, so it cannot claim tracking."""
    body = create(client, therapist["access_token"]).json()
    assert body["cv_supported"] is False
    assert body["tracker_key"] is None
    assert body["default_target_rom"] is None


def test_client_cannot_force_camera_tracking(client: TestClient, therapist: dict) -> None:
    """Extra fields in the request must not become tracking claims."""
    response = client.post(
        "/api/exercises",
        json={
            "name": "Fake Tracked Move",
            "patient_cue": "Do the thing.",
            "cv_supported": True,
            "tracker_key": "knee_flexion",
            "default_target_rom": 120,
        },
        headers=auth_header(therapist["access_token"]),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["cv_supported"] is False
    assert body["tracker_key"] is None
    assert body["default_target_rom"] is None


def test_patient_cannot_add_an_exercise(client: TestClient, patient: dict) -> None:
    assert create(client, patient["token"]).status_code == 403


def test_custom_exercise_is_private_to_its_author(
    client: TestClient, therapist: dict
) -> None:
    create(client, therapist["access_token"])

    other = client.post(
        "/api/auth/register",
        json={
            "name": "Dr. Other",
            "email": "other@example.com",
            "password": "supersecret1",
            "role": "physiotherapist",
        },
    ).json()

    mine = client.get("/api/exercises", headers=auth_header(therapist["access_token"])).json()
    theirs = client.get("/api/exercises", headers=auth_header(other["access_token"])).json()

    assert "Ankle Pumps" in [e["name"] for e in mine]
    assert "Ankle Pumps" not in [e["name"] for e in theirs]
    # Both still see the shared built-in catalogue.
    assert "Knee Flexion" in [e["name"] for e in theirs]


def test_duplicate_name_is_rejected(client: TestClient, therapist: dict) -> None:
    create(client, therapist["access_token"])
    again = create(client, therapist["access_token"], name="ankle pumps")
    assert again.status_code == 409

    # Clashing with a built-in name is refused too, so the list stays readable.
    builtin = create(client, therapist["access_token"], name="Knee Flexion")
    assert builtin.status_code == 409


def test_custom_exercise_can_be_prescribed_and_reaches_the_patient(
    client: TestClient, therapist: dict, patient: dict
) -> None:
    custom = create(client, therapist["access_token"]).json()

    from datetime import date

    plan = client.post(
        f"/api/patients/{patient['profile']['id']}/plans",
        json={
            "title": "Week 1",
            "start_date": str(date.today()),
            "items": [
                {
                    "exercise_id": custom["id"],
                    "sets": 2,
                    "repetitions": 12,
                    "frequency_per_day": 1,
                    "instructions": "Do these while sitting in your chair.",
                }
            ],
        },
        headers=auth_header(therapist["access_token"]),
    )
    assert plan.status_code == 201, plan.text

    routine = client.get("/api/me/routine", headers=auth_header(patient["token"])).json()
    item = routine["items"][0]
    assert item["exercise"]["name"] == "Ankle Pumps"
    assert item["repetitions"] == 12
    # The patient app must know not to promise camera tracking for this one.
    assert item["exercise"]["cv_supported"] is False


def test_custom_exercise_session_records_adherence_without_quality(
    client: TestClient, therapist: dict, patient: dict
) -> None:
    custom = create(client, therapist["access_token"]).json()
    from datetime import date

    plan = client.post(
        f"/api/patients/{patient['profile']['id']}/plans",
        json={
            "title": "Week 1",
            "start_date": str(date.today()),
            "items": [{"exercise_id": custom["id"], "sets": 1, "repetitions": 10}],
        },
        headers=auth_header(therapist["access_token"]),
    ).json()

    headers = auth_header(patient["token"])
    session_id = client.post(
        "/api/sessions/start",
        json={"prescribed_exercise_id": plan["prescribed_exercises"][0]["id"]},
        headers=headers,
    ).json()["id"]

    result = client.post(
        f"/api/sessions/{session_id}/complete",
        json={"reps_attempted": 10, "tracking_mode": "self_reported", "reps": []},
        headers=headers,
    ).json()

    assert result["reps_attempted"] == 10      # adherence is real
    assert result["quality_score"] is None     # quality is not invented
    assert result["rom_max"] is None


def test_name_and_cue_are_validated(client: TestClient, therapist: dict) -> None:
    short_name = create(client, therapist["access_token"], name="A")
    assert short_name.status_code == 422
    no_cue = create(client, therapist["access_token"], name="Valid Name", patient_cue="")
    assert no_cue.status_code == 422
