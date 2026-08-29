"""Constrained rehabilitation assistant.

Design rules (see docs/ARCHITECTURE.md, "AI must not control the prescription"):

1. The assistant only ever *reads* the prescription. It has no write path to
   plans, prescribed exercises or sessions - there is no tool it could call.
2. Every answer is grounded in a context object built from the patient's own
   records on the server. Nothing is answered from model memory alone.
3. A guardrail runs before and after generation. Requests to add exercises,
   change doses, diagnose, or advise on medication are redirected to the
   physiotherapist regardless of what the model would have said.
4. If no LLM key is configured the deterministic responder handles the same
   intents, so the feature works offline and in the demo.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

import httpx

from ..config import get_settings

REFER_TO_THERAPIST = (
    "That is a decision for your physiotherapist. Please ask them before "
    "changing anything in your plan."
)
EMERGENCY_REPLY = (
    "If you feel unwell, have severe pain, chest pain, or trouble breathing, "
    "stop exercising and contact your doctor or local emergency services now. "
    "I am not able to give medical advice."
)
OUT_OF_SCOPE = (
    "I can only help with the rehabilitation plan your physiotherapist set for "
    "you. Please consult your physiotherapist about anything else."
)

# --- Guardrail patterns -----------------------------------------------------
_EMERGENCY = re.compile(
    r"\b(chest pain|can'?t breathe|cannot breathe|breathing|fainted|faint|"
    r"severe pain|unbearable|bleeding|numb|swollen|swelling|emergency)\b",
    re.I,
)
# A change to dose, frequency or plan membership. Deliberately does not
# include the generic verb "do", so "how do I do this exercise?" is answered
# rather than redirected.
_PRESCRIPTION_CHANGE = re.compile(
    r"\b(add|adding|include|swap|replace|skip|drop|stop|increase|decrease|"
    r"reduce|raise|lower|change|double|halve|more|less|extra|fewer)\b.{0,40}"
    r"\b(exercise|exercises|workout|rep|reps|repetition|repetitions|set|sets|"
    r"session|sessions|plan|routine|day|days|week)\b",
    re.I,
)
# Activities that are not in the prescribable catalogue at all. Any mention is
# redirected to the physiotherapist.
# Dose negotiation phrased as a substitution ("20 reps instead", "just one set").
_DOSE_NEGOTIATION = re.compile(
    r"\b(instead|rather than)\b|"
    r"\b(only|just)\b.{0,20}\b(rep|reps|set|sets|session|sessions)\b",
    re.I,
)
_UNPRESCRIBED_ACTIVITY = re.compile(
    r"\b(squat|squats|lunge|lunges|deadlift|jog|jogging|running|treadmill|gym|"
    r"weights|dumbbell|yoga|pilates|cycling|swimming|stairs climbing)\b",
    re.I,
)
_MEDICAL = re.compile(
    r"\b(medicine|medication|tablet|tablets|pill|pills|dose|painkiller|"
    r"diagnos\w*|surgery|operation|x-?ray|mri|infection|is it normal that)\b",
    re.I,
)


@dataclass
class PlanContext:
    """Everything the assistant is allowed to know, assembled server-side."""

    patient_name: str
    condition: str | None
    plan_title: str | None
    exercises: list[dict] = field(default_factory=list)
    sessions_done_today: int = 0
    sessions_due_today: int = 0
    adherence_pct: float | None = None
    last_session: dict | None = None

    def as_prompt_block(self) -> str:
        return json.dumps(
            {
                "patient_name": self.patient_name,
                "condition": self.condition,
                "plan_title": self.plan_title,
                "todays_exercises": self.exercises,
                "sessions_done_today": self.sessions_done_today,
                "sessions_due_today": self.sessions_due_today,
                "adherence_percent_last_14_days": self.adherence_pct,
                "last_session": self.last_session,
            },
            indent=2,
            default=str,
        )


SYSTEM_PROMPT = """You are the PhysioPilot assistant. You support a patient in \
following the rehabilitation plan their physiotherapist prescribed.

You may:
- Tell the patient which exercises, sets and repetitions they were prescribed.
- Repeat the physiotherapist's written instructions.
- Explain, in plain language, what a movement message from the app meant.
- Encourage the patient and describe their own recorded progress.

You must NOT:
- Diagnose, or comment on what a symptom means.
- Prescribe, add, remove or modify any exercise, repetition count, set count or
  frequency, or suggest the patient do so.
- Give advice about medication.
- Contradict the physiotherapist or claim clinical certainty.
- Answer anything outside this rehabilitation plan.

If asked for any of those, reply briefly and say the patient should ask their
physiotherapist. Never invent an exercise or a number: use only the plan data
given to you. Write short, simple sentences suitable for an older patient with
low digital literacy. Two or three sentences at most. No markdown, no lists,
no emoji."""


def _fmt_exercise(item: dict) -> str:
    return f"{item['name']}, {item['sets']} sets of {item['repetitions']} repetitions"


def deterministic_reply(message: str, ctx: PlanContext) -> str:
    """Intent-matched responder used when no LLM is configured.

    Covers the questions the product promises to answer; anything else is
    referred to the physiotherapist rather than guessed at.
    """
    text = message.lower().strip()

    if not ctx.exercises:
        return (
            "You do not have any exercises assigned right now. Your "
            "physiotherapist will add them to your plan."
        )

    # Intents are ordered most specific first; the first match wins.
    if re.search(r"\b(warning|incomplete|why did|feedback|score|quality|last session)\b", text):
        last = ctx.last_session
        if not last:
            return "You have not finished a tracked session yet, so there is nothing to explain."
        return (
            f"In your last session you completed {last['reps_attempted']} repetitions and "
            f"{last['reps_valid']} matched the movement range your physiotherapist set. "
            "Try moving slowly and going as far as is comfortable."
        )

    if re.search(r"\b(progress|adherence|how am i|am i doing|doing well|streak|improving)\b", text):
        if ctx.adherence_pct is None:
            return "I do not have enough completed sessions yet to show your progress."
        return (
            f"Over the last two weeks you completed {ctx.adherence_pct:.0f} percent of "
            "your prescribed sessions. Keep going at your own pace."
        )

    if re.search(r"\b(how do i|how should i|instruction|instructions|perform|technique|correctly|properly)\b", text):
        first = ctx.exercises[0]
        instruction = first.get("instructions") or first.get("cue") or ""
        if not instruction:
            return f"Your physiotherapist did not add written notes for {first['name']}."
        return f"For {first['name']}: {instruction}".strip().rstrip(".") + "."

    if re.search(r"\b(left|remaining|finished|done|still to do)\b", text):
        remaining = max(0, ctx.sessions_due_today - ctx.sessions_done_today)
        return (
            f"You have finished {ctx.sessions_done_today} of {ctx.sessions_due_today} "
            f"sessions today. {remaining} left."
        )

    if re.search(r"\b(how many|how much|reps?|repetition|repetitions|sets?)\b", text):
        parts = "; ".join(_fmt_exercise(e) for e in ctx.exercises)
        return f"Your physiotherapist prescribed {parts}."

    if re.search(r"\b(today|exercise|exercises|routine|plan|schedule)\b", text):
        names = [e["name"] for e in ctx.exercises]
        joined = ", ".join(names[:-1]) + (f" and {names[-1]}" if len(names) > 1 else names[0])
        return (
            f"You have {len(names)} exercise"
            f"{'s' if len(names) > 1 else ''} today: {joined}."
        )

    return OUT_OF_SCOPE


def _llm_reply(message: str, ctx: PlanContext) -> str | None:
    """Call the configured LLM. Returns None on any failure so we can fall back."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    try:
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": settings.assistant_model,
                "max_tokens": 300,
                "system": SYSTEM_PROMPT,
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            "Here is the patient's prescription data. Use only this:\n"
                            f"{ctx.as_prompt_block()}\n\n"
                            f"Patient's question: {message}"
                        ),
                    }
                ],
            },
            timeout=20.0,
        )
        response.raise_for_status()
        blocks = response.json().get("content", [])
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        return text.strip() or None
    except Exception:  # network, auth, schema - all fall back to deterministic
        return None


@dataclass
class AssistantResult:
    reply: str
    source: str
    redirected: bool


def answer(message: str, ctx: PlanContext) -> AssistantResult:
    """Guardrail -> generate -> guardrail."""
    if _EMERGENCY.search(message):
        return AssistantResult(EMERGENCY_REPLY, "guardrail", True)
    if _MEDICAL.search(message):
        return AssistantResult(
            "I cannot help with medical questions or medicines. " + REFER_TO_THERAPIST,
            "guardrail",
            True,
        )
    if (
        _PRESCRIPTION_CHANGE.search(message)
        or _UNPRESCRIBED_ACTIVITY.search(message)
        or _DOSE_NEGOTIATION.search(message)
    ):
        names = ", ".join(e["name"] for e in ctx.exercises) or "no exercises yet"
        return AssistantResult(
            f"Your plan today is: {names}. Only your physiotherapist can change "
            "what you do, how many repetitions, or how often. " + REFER_TO_THERAPIST,
            "guardrail",
            True,
        )

    llm = _llm_reply(message, ctx)
    if llm:
        # Post-check: refuse to pass through anything that reads like a change
        # to the prescription, even if the model produced it.
        if _PRESCRIPTION_CHANGE.search(llm) and re.search(
            r"\b(you should|you can|i suggest|i recommend|try adding)\b", llm, re.I
        ):
            return AssistantResult(REFER_TO_THERAPIST, "guardrail", True)
        return AssistantResult(llm, "llm", False)

    reply = deterministic_reply(message, ctx)
    return AssistantResult(reply, "deterministic", reply == OUT_OF_SCOPE)


SUGGESTED_QUESTIONS = [
    "What exercises do I have today?",
    "How many repetitions should I do?",
    "How do I do this exercise?",
    "How am I doing so far?",
]
