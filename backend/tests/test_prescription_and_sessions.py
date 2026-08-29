"""Prescription authoring, patient routine, session recording and adherence."""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import auth_header


def _reps(count: int, peak: float, duration: float = 3.0, visibility: float = 0.9) -> list[dict]:
    return [
        {
            "index": i,
            "min_angle": 5.0,
            "max_angle": peak,
            "duration_seconds": duration,
            "mean_visibility": visibility,
        }
        for i in range(count)
    ]


def test_therapist_creates_plan_and_patient_sees_it(
    client: TestClient, patient: dict, plan: dict
) -> None:
    routine = client.get("/api/me/routine", headers=auth_header(patient["token"])).json()
    assert routine["plan_title"] == "Week 1 - knee"
    assert len(routine["items"]) == 1
    item = routine["items"][0]
    assert item["repetitions"] == 10
    assert item["sets"] == 3
    assert item["instructions"] == "Bend the knee slowly."
    assert item["exercise"]["cv_supported"] is True


def test_plan_rejects_unknown_exercise_and_bad_dates(
    client: TestClient, therapist: dict, patient: dict
) -> None:
    headers = auth_header(therapist["access_token"])
    patient_id = patient["profile"]["id"]

    unknown = client.post(
        f"/api/patients/{patient_id}/plans",
        json={
            "title": "Bad plan",
            "start_date": str(date.today()),
            "items": [{"exercise_id": 9999, "sets": 3, "repetitions": 10}],
        },
        headers=headers,
    )
    assert unknown.status_code == 422

    empty = client.post(
        f"/api/patients/{patient_id}/plans",
        json={"title": "Bad plan", "start_date": str(date.today()), "items": []},
        headers=headers,
    )
    assert empty.status_code == 422


def test_therapist_modifies_prescription_and_patient_sees_the_change(
    client: TestClient, therapist: dict, patient: dict, plan: dict, knee_flexion_id: int
) -> None:
    updated = client.patch(
        f"/api/plans/{plan['id']}",
        json={
            "items": [
                {
                    "exercise_id": knee_flexion_id,
                    "sets": 2,
                    "repetitions": 15,
                    "frequency_per_day": 2,
                    "instructions": "Slower, and hold for three seconds.",
                    "target_rom": 100,
                }
            ]
        },
        headers=auth_header(therapist["access_token"]),
    )
    assert updated.status_code == 200

    routine = client.get("/api/me/routine", headers=auth_header(patient["token"])).json()
    item = routine["items"][0]
    assert item["repetitions"] == 15
    assert item["sessions_due_today"] == 2
    assert item["target_rom"] == 100
    # The prescribed_exercise row is reused, so session history stays attached.
    assert item["prescribed_exercise_id"] == plan["prescribed_exercises"][0]["id"]


def test_full_session_flow_scores_movement_quality(
    client: TestClient, patient: dict, plan: dict
) -> None:
    headers = auth_header(patient["token"])
    prescribed_id = plan["prescribed_exercises"][0]["id"]

    started = client.post(
        "/api/sessions/start", json={"prescribed_exercise_id": prescribed_id}, headers=headers
    )
    assert started.status_code == 201
    session_id = started.json()["id"]
    assert started.json()["reps_prescribed"] == 10

    # 8 full-range repetitions, 2 that stop short of the 90 degree target.
    reps = _reps(8, 95.0) + _reps(2, 55.0)
    for i, rep in enumerate(reps):
        rep["index"] = i

    completed = client.post(
        f"/api/sessions/{session_id}/complete",
        json={
            "reps_attempted": 10,
            "tracking_mode": "camera",
            "pose_coverage": 0.95,
            "reps": reps,
        },
        headers=headers,
    )
    assert completed.status_code == 200, completed.text
    body = completed.json()

    assert body["status"] == "completed"
    assert body["reps_attempted"] == 10           # session adherence
    assert body["reps_valid"] == 8                # movement quality, kept separate
    assert body["rom_max"] == 95.0
    assert 0 < body["quality_score"] < 100
    assert len(body["reps"]) == 10
    assert body["reps"][9]["classification"] == "incomplete_range"
    assert any("8 of 10" in line for line in body["patient_summary"])


def test_self_reported_session_records_no_invented_quality(
    client: TestClient, patient: dict, plan: dict
) -> None:
    headers = auth_header(patient["token"])
    prescribed_id = plan["prescribed_exercises"][0]["id"]
    session_id = client.post(
        "/api/sessions/start", json={"prescribed_exercise_id": prescribed_id}, headers=headers
    ).json()["id"]

    body = client.post(
        f"/api/sessions/{session_id}/complete",
        json={"reps_attempted": 10, "tracking_mode": "self_reported", "reps": []},
        headers=headers,
    ).json()

    assert body["reps_attempted"] == 10
    assert body["reps_valid"] is None
    assert body["quality_score"] is None
    assert body["rom_max"] is None


def test_session_cannot_be_completed_twice(client: TestClient, patient: dict, plan: dict) -> None:
    headers = auth_header(patient["token"])
    prescribed_id = plan["prescribed_exercises"][0]["id"]
    session_id = client.post(
        "/api/sessions/start", json={"prescribed_exercise_id": prescribed_id}, headers=headers
    ).json()["id"]
    payload = {"reps_attempted": 10, "tracking_mode": "self_reported", "reps": []}
    assert client.post(f"/api/sessions/{session_id}/complete", json=payload, headers=headers).status_code == 200
    assert client.post(f"/api/sessions/{session_id}/complete", json=payload, headers=headers).status_code == 409


def test_abandoned_session_does_not_count_towards_adherence(
    client: TestClient, patient: dict, plan: dict
) -> None:
    headers = auth_header(patient["token"])
    prescribed_id = plan["prescribed_exercises"][0]["id"]
    session_id = client.post(
        "/api/sessions/start", json={"prescribed_exercise_id": prescribed_id}, headers=headers
    ).json()["id"]
    client.post(f"/api/sessions/{session_id}/abandon", headers=headers)

    adherence = client.get("/api/me/adherence?window_days=7", headers=headers).json()
    assert adherence["sessions_completed"] == 0


def test_adherence_counts_only_days_the_plan_was_active(
    client: TestClient, patient: dict, plan: dict
) -> None:
    headers = auth_header(patient["token"])
    # Plan started 6 days ago at 1 session/day => 7 due in a 14 day window.
    adherence = client.get("/api/me/adherence?window_days=14", headers=headers).json()
    assert adherence["sessions_due"] == 7
    assert adherence["sessions_completed"] == 0
    assert adherence["adherence_pct"] == 0.0

    prescribed_id = plan["prescribed_exercises"][0]["id"]
    session_id = client.post(
        "/api/sessions/start", json={"prescribed_exercise_id": prescribed_id}, headers=headers
    ).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/complete",
        json={"reps_attempted": 10, "tracking_mode": "self_reported", "reps": []},
        headers=headers,
    )

    adherence = client.get("/api/me/adherence?window_days=14", headers=headers).json()
    assert adherence["sessions_completed"] == 1
    assert adherence["current_streak_days"] == 1
    assert adherence["adherence_pct"] == round(100 / 7, 1)


def test_progress_metric_is_recorded_for_tracked_sessions(
    client: TestClient, therapist: dict, patient: dict, plan: dict
) -> None:
    headers = auth_header(patient["token"])
    prescribed_id = plan["prescribed_exercises"][0]["id"]
    session_id = client.post(
        "/api/sessions/start", json={"prescribed_exercise_id": prescribed_id}, headers=headers
    ).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/complete",
        json={
            "reps_attempted": 10,
            "tracking_mode": "camera",
            "pose_coverage": 0.9,
            "reps": _reps(10, 88.0),
        },
        headers=headers,
    )

    progress = client.get(
        f"/api/patients/{patient['profile']['id']}/progress",
        headers=auth_header(therapist["access_token"]),
    ).json()
    assert len(progress) == 1
    assert progress[0]["unit"] == "degrees"
    assert progress[0]["points"][-1]["value"] == 88.0
    # A single point is never enough to claim a direction.
    assert progress[0]["trend"] == "insufficient_data"
