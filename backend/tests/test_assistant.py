"""The assistant answers from the prescription and never modifies it."""

from fastapi.testclient import TestClient

from app.services import assistant
from tests.conftest import auth_header


def ask(client: TestClient, token: str, message: str) -> dict:
    response = client.post(
        "/api/me/assistant", json={"message": message}, headers=auth_header(token)
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_lists_todays_prescribed_exercises(client: TestClient, patient: dict, plan: dict) -> None:
    body = ask(client, patient["token"], "What exercises do I have today?")
    assert "Knee Flexion" in body["reply"]
    assert body["redirected"] is False


def test_reports_prescribed_repetitions(client: TestClient, patient: dict, plan: dict) -> None:
    body = ask(client, patient["token"], "How many repetitions should I do?")
    assert "10 repetitions" in body["reply"]
    assert "3 sets" in body["reply"]


def test_refuses_to_add_an_exercise(client: TestClient, patient: dict, plan: dict) -> None:
    body = ask(client, patient["token"], "Can I add squats to my plan?")
    assert body["redirected"] is True
    assert "physiotherapist" in body["reply"].lower()
    # It must not agree, and must not name an exercise that was never prescribed.
    assert "squat" not in body["reply"].lower()


def test_refuses_dose_changes(client: TestClient, patient: dict, plan: dict) -> None:
    for message in (
        "Can I do 20 reps instead?",
        "Should I skip today's session?",
        "I want to increase my repetitions",
    ):
        assert ask(client, patient["token"], message)["redirected"] is True


def test_refuses_medical_questions(client: TestClient, patient: dict, plan: dict) -> None:
    body = ask(client, patient["token"], "Should I take a painkiller before exercising?")
    assert body["redirected"] is True
    assert "medic" in body["reply"].lower()


def test_directs_urgent_symptoms_to_emergency_help(
    client: TestClient, patient: dict, plan: dict
) -> None:
    body = ask(client, patient["token"], "I have severe pain and my knee is swollen")
    assert body["redirected"] is True
    assert "emergency" in body["reply"].lower()


def test_out_of_scope_question_is_redirected(client: TestClient, patient: dict, plan: dict) -> None:
    body = ask(client, patient["token"], "What is the capital of France?")
    assert "physiotherapist" in body["reply"].lower()


def test_conversation_is_recorded(client: TestClient, patient: dict, plan: dict) -> None:
    ask(client, patient["token"], "What exercises do I have today?")
    history = client.get(
        "/api/me/assistant/history", headers=auth_header(patient["token"])
    ).json()
    assert len(history) == 1
    assert history[0]["user_message"] == "What exercises do I have today?"


def test_assistant_has_no_write_path_to_the_prescription(
    client: TestClient, patient: dict, plan: dict
) -> None:
    """Asking for a change must leave the plan byte-identical."""
    before = client.get("/api/me/routine", headers=auth_header(patient["token"])).json()
    ask(client, patient["token"], "Please add 5 more repetitions to my exercise")
    ask(client, patient["token"], "Change my plan to include running")
    after = client.get("/api/me/routine", headers=auth_header(patient["token"])).json()
    assert before == after


def test_guardrail_blocks_a_model_reply_that_would_change_the_plan() -> None:
    """Even if the model produced a prescription change, it is not passed on."""
    ctx = assistant.PlanContext(
        patient_name="Test", condition=None, plan_title=None,
        exercises=[{"name": "Knee Flexion", "sets": 3, "repetitions": 10, "instructions": ""}],
    )
    original = assistant._llm_reply
    assistant._llm_reply = lambda message, context: "You should add squats and increase your reps to 20."
    try:
        result = assistant.answer("Tell me about my knee", ctx)
    finally:
        assistant._llm_reply = original
    assert result.source == "guardrail"
    assert result.redirected is True
