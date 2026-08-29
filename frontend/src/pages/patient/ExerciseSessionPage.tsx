import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { RoutineItem, SessionResult } from "../../api/types";
import { useAsync } from "../../lib/useAsync";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FullPageSpinner } from "../../components/ui/Spinner";
import { checkFraming, type FramingResult } from "../../cv/framing";
import { drawPose } from "../../cv/overlay";
import { CameraError, startPoseTracking, type PoseTrackerHandles } from "../../cv/poseTracker";
import { RepDetector, type DetectedRep } from "../../cv/repDetector";
import { getTracker } from "../../cv/trackers";
import { createSpeaker, isVoiceEnabled, setVoiceEnabled } from "../../voice/speech";

type Step = "ready" | "positioning" | "exercising" | "self_report" | "finished";

/** Frames of continuous good framing before the session starts on its own. */
const READY_FRAMES = 30;

export function ExerciseSessionPage() {
  const { prescribedExerciseId } = useParams();
  const prescribedId = Number(prescribedExerciseId);
  const navigate = useNavigate();

  const routine = useAsync(() => api.routine(), []);
  const item: RoutineItem | undefined = routine.data?.items.find(
    (candidate) => candidate.prescribed_exercise_id === prescribedId,
  );
  const tracker = useMemo(() => getTracker(item?.exercise.tracker_key), [item]);

  const [step, setStep] = useState<Step>("ready");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [framing, setFraming] = useState<FramingResult | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [liveFeedback, setLiveFeedback] = useState<string>("");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(isVoiceEnabled);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handlesRef = useRef<PoseTrackerHandles | null>(null);
  const detectorRef = useRef<RepDetector | null>(null);
  const readyFramesRef = useRef(0);
  const finishingRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);
  const stepRef = useRef<Step>("ready");

  const speaker = useMemo(
    () => createSpeaker(routine.data ? "en" : "en", voiceOn),
    [voiceOn, routine.data],
  );

  const targetRom = item?.target_rom ?? item?.exercise.default_target_rom ?? 90;
  const prescribedReps = item?.repetitions ?? 10;

  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const stopCamera = useCallback(() => {
    handlesRef.current?.stop();
    handlesRef.current = null;
  }, []);

  // Leaving mid-session must not leave a dangling "in progress" record: an
  // unfinished session is explicitly abandoned so it never counts as adherence.
  useEffect(
    () => () => {
      stopCamera();
      speaker.cancel();
      if (sessionIdRef.current && stepRef.current !== "finished") {
        api.abandonSession(sessionIdRef.current).catch(() => undefined);
      }
    },
    [speaker, stopCamera],
  );

  const finishSession = useCallback(
    async (reps: DetectedRep[], trackingMode: "camera" | "self_reported", attempted: number) => {
      if (finishingRef.current || !sessionIdRef.current) return;
      finishingRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      speaker.cancel();
      try {
        const payload = await api.completeSession(sessionIdRef.current, {
          reps_attempted: attempted,
          tracking_mode: trackingMode,
          pose_coverage: detectorRef.current?.poseCoverage ?? null,
          reps: reps.map((rep) => ({
            index: rep.index,
            min_angle: rep.minAngle,
            max_angle: rep.maxAngle,
            duration_seconds: rep.durationSeconds,
            peak_velocity: rep.peakVelocity,
            mean_visibility: rep.meanVisibility,
          })),
        });
        stopCamera();
        setResult(payload);
        setStep("finished");
        speaker.speak(`Great job. ${payload.patient_summary[0] ?? ""}`, { interrupt: true });
      } catch (error) {
        finishingRef.current = false;
        setSubmitError(
          error instanceof Error ? error.message : "We could not save this session.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [speaker, stopCamera],
  );

  const handleFrame = useCallback(
    (frame: { timestamp: number; landmarks: Parameters<typeof drawPose>[2] }) => {
      if (!tracker || !videoRef.current || !canvasRef.current) return;

      const reading = tracker.measure(frame.landmarks ?? []);
      const currentStep = stepRef.current;

      drawPose(canvasRef.current, videoRef.current, frame.landmarks, {
        highlight: tracker.requiredLandmarks.left.concat(tracker.requiredLandmarks.right),
        ready: currentStep === "exercising",
      });

      if (currentStep === "positioning") {
        const check = checkFraming(frame.landmarks, tracker);
        setFraming(check);
        readyFramesRef.current = check.ready ? readyFramesRef.current + 1 : 0;
        if (check.ready && readyFramesRef.current >= READY_FRAMES) {
          setStep("exercising");
          speaker.speak(`Good. You are ready. ${tracker.cues.start}`, { interrupt: true });
        } else if (!check.ready && readyFramesRef.current === 0) {
          speaker.speak(check.message);
        }
        return;
      }

      if (currentStep !== "exercising") return;

      const detector = detectorRef.current;
      if (!detector) return;
      const rep = detector.push({
        t: frame.timestamp,
        angle: reading.angle,
        visibility: reading.visibility,
      });
      setLiveAngle(detector.smoothedAngle);

      if (rep) {
        const count = detector.reps.length;
        setRepCount(count);

        // Immediate encouragement, mirroring the server's rules. The recorded
        // assessment is the server's; this line is only to keep the patient
        // moving without waiting for a round trip.
        if (rep.meanVisibility < 0.5) {
          setLiveFeedback("I could not see that one clearly.");
        } else if (rep.maxAngle < targetRom * 0.9) {
          setLiveFeedback("Try to move a little further next time.");
        } else if (rep.durationSeconds < 1) {
          setLiveFeedback("Try moving a little more slowly.");
        } else {
          setLiveFeedback("Good movement.");
        }

        if (count >= prescribedReps) {
          speaker.speak("That is all of them. Well done.", { interrupt: true });
          void finishSession(detector.reps, "camera", count);
        } else {
          speaker.speak(String(count));
        }
      }
    },
    [finishSession, prescribedReps, speaker, targetRom, tracker],
  );

  const cameraVisible = step === "positioning" || step === "exercising";

  async function beginTrackedSession() {
    if (!item) return;
    setCameraError(null);
    detectorRef.current = new RepDetector({ targetRom });
    readyFramesRef.current = 0;
    setRepCount(0);
    setStep("positioning");

    // The camera is requested before anything is awaited, so the browser still
    // sees this as happening inside the user's tap. Creating the session over
    // the network first would spend that gesture and Safari would refuse the
    // camera without ever prompting.
    try {
      handlesRef.current = await startPoseTracking(videoRef.current!, handleFrame);
    } catch (error) {
      const message =
        error instanceof CameraError
          ? error.message
          : "The camera could not be started. Please try again.";
      setCameraError(message);
      setStep("self_report");
      return;
    }

    speaker.speak("Place your phone so your whole leg is visible.", { interrupt: true });

    // Only now record the attempt. If this fails there is nothing to track
    // into, so release the camera rather than leaving it running.
    try {
      const session = await api.startSession(item.prescribed_exercise_id);
      setSessionId(session.id);
      sessionIdRef.current = session.id;
    } catch (error) {
      handlesRef.current?.stop();
      handlesRef.current = null;
      setSubmitError(error instanceof Error ? error.message : "Could not start the session.");
      setStep("ready");
    }
  }

  async function beginSelfReportedSession() {
    if (!item) return;
    try {
      const session = await api.startSession(item.prescribed_exercise_id);
      setSessionId(session.id);
      sessionIdRef.current = session.id;
      setStep("self_report");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not start the session.");
    }
  }

  if (routine.loading) return <FullPageSpinner label="Getting your exercise ready" />;
  if (routine.error || !item) {
    return (
      <div className="patient-scale mx-auto max-w-xl p-5">
        <Alert tone="error" title="We could not open this exercise">
          {routine.error ?? "This exercise is not part of your current plan."}
        </Alert>
        <Button size="lg" className="mt-4 w-full" onClick={() => navigate("/today")}>
          Back to today
        </Button>
      </div>
    );
  }

  const canTrack = Boolean(tracker && item.exercise.cv_supported);

  return (
    <div className="patient-scale min-h-screen bg-ink-50">
      <div className="mx-auto max-w-xl px-4 py-6">
        {/* ---------------- Step 1: get ready ---------------- */}
        {step === "ready" && (
          <div className="space-y-5">
            <div>
              <p className="text-ink-500">Exercise</p>
              <h1 className="text-3xl font-semibold text-ink-900">{item.exercise.name}</h1>
              <p className="mt-1 text-xl text-ink-700">
                {item.sets} sets × {item.repetitions} times
              </p>
            </div>

            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <h2 className="text-xl font-semibold text-ink-900">Let's get ready</h2>
              <p className="mt-2 text-ink-700">{item.instructions}</p>
              {canTrack && (
                <>
                  <PhonePlacementIllustration />
                  <ul className="mt-3 space-y-2 text-ink-700">
                    <li>Place your phone so your whole leg can be seen.</li>
                    <li>Sit or lie with your side facing the phone.</li>
                    <li>Make sure the room is bright enough.</li>
                  </ul>
                </>
              )}
            </div>

            {submitError && <Alert tone="error">{submitError}</Alert>}

            {canTrack ? (
              <>
                <Button size="xl" className="w-full" onClick={beginTrackedSession}>
                  Start with camera
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={beginSelfReportedSession}
                >
                  Do it without the camera
                </Button>
              </>
            ) : (
              <>
                <Alert tone="info">
                  This exercise is not tracked by the camera. Do it as your physiotherapist
                  described, then tell us you finished.
                </Alert>
                <Button size="xl" className="w-full" onClick={beginSelfReportedSession}>
                  Start
                </Button>
              </>
            )}

            <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate("/today")}>
              Go back
            </Button>
          </div>
        )}

        {/* ---------------- Steps 2-6: camera ----------------
            The camera surface stays mounted even when hidden. getUserMedia has
            to be called while the tap on START still counts as a user gesture,
            which leaves no time to wait for a conditional render first. */}
        <div className={cameraVisible ? "space-y-4" : "hidden"} aria-hidden={!cameraVisible}>
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-ink-900">
              <video
                ref={videoRef}
                className="w-full -scale-x-100"
                playsInline
                muted
                aria-label="Camera view"
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
              />
              {step === "exercising" && (
                <div className="absolute left-3 top-3 rounded-xl bg-white/95 px-4 py-2">
                  <p className="text-sm text-ink-500">Repetitions</p>
                  <p className="text-4xl font-semibold tabular-nums text-ink-900">
                    {repCount} / {prescribedReps}
                  </p>
                </div>
              )}
              {step === "exercising" && liveAngle !== null && (
                <div className="absolute right-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-right">
                  <p className="text-xs text-ink-500">Movement</p>
                  <p className="text-2xl font-semibold tabular-nums text-ink-900">
                    {Math.round(liveAngle)}°
                  </p>
                </div>
              )}
            </div>

            {step === "positioning" && (
              <div className="rounded-2xl border border-ink-200 bg-white p-5 text-center">
                <p className="text-2xl font-medium text-ink-900">
                  {framing?.message ?? "Starting the camera…"}
                </p>
                {framing?.ready && (
                  <p className="mt-2 text-ink-500">Hold still for a moment…</p>
                )}
              </div>
            )}

            {step === "exercising" && (
              <>
                <div className="rounded-2xl border border-ink-200 bg-white p-5 text-center">
                  <p className="text-2xl font-medium text-ink-900">
                    {liveFeedback || item.exercise.patient_cue}
                  </p>
                  {detectorRef.current?.currentState === "lost" && (
                    <p className="mt-2 text-[color:var(--color-caution)]">
                      I cannot see you at the moment.
                    </p>
                  )}
                </div>
                <RangeBar value={liveAngle} target={targetRom} />
              </>
            )}

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                loading={submitting}
                onClick={() =>
                  finishSession(
                    detectorRef.current?.reps ?? [],
                    "camera",
                    detectorRef.current?.reps.length ?? 0,
                  )
                }
              >
                Finish now
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setVoiceOn((on) => {
                    setVoiceEnabled(!on);
                    return !on;
                  });
                  speaker.cancel();
                }}
              >
                {voiceOn ? "Turn voice off" : "Turn voice on"}
              </Button>
            </div>
          </div>
        </div>

        {/* ---------------- Fallback: no camera ---------------- */}
        {step === "self_report" && (
          <div className="space-y-5">
            <h1 className="text-3xl font-semibold text-ink-900">{item.exercise.name}</h1>
            {cameraError && (
              <Alert tone="warning" title="Camera not available">
                {cameraError} You can still do the exercise and tell us when you finish.
              </Alert>
            )}
            <div className="rounded-2xl border border-ink-200 bg-white p-5">
              <p className="text-xl text-ink-800">{item.instructions}</p>
              <p className="mt-3 text-2xl font-semibold text-ink-900">
                {item.sets} sets × {item.repetitions} times
              </p>
            </div>
            {submitError && <Alert tone="error">{submitError}</Alert>}
            <Button
              size="xl"
              className="w-full"
              loading={submitting}
              onClick={() => finishSession([], "self_reported", item.repetitions)}
            >
              I finished all {item.repetitions}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              loading={submitting}
              onClick={() =>
                finishSession([], "self_reported", Math.max(0, Math.floor(item.repetitions / 2)))
              }
            >
              I did some of them
            </Button>
            <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate("/today")}>
              Stop for now
            </Button>
          </div>
        )}

        {/* ---------------- Step 8: finished ---------------- */}
        {step === "finished" && result && (
          <div className="space-y-5 text-center">
            <p className="text-6xl" aria-hidden="true">🎉</p>
            <h1 className="text-3xl font-semibold text-ink-900">Great job!</h1>
            <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-5 text-left">
              {result.patient_summary.map((line) => (
                <p key={line} className="text-xl text-ink-800">
                  {line}
                </p>
              ))}
              {result.rom_max !== null && (
                <p className="text-ink-500">
                  Your best movement today was {Math.round(result.rom_max)} degrees.
                </p>
              )}
            </div>
            <Button size="xl" className="w-full" onClick={() => navigate("/today")}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Simple, non-decorative illustration of where to put the phone. */
function PhonePlacementIllustration() {
  return (
    <figure className="mt-4">
      <svg
        viewBox="0 0 260 100"
        className="w-full rounded-xl bg-ink-100"
        role="img"
        aria-label="A phone placed about two metres away, with the patient's side facing it"
      >
        <rect x="18" y="24" width="26" height="46" rx="5" fill="var(--color-ink-800)" />
        <rect x="21" y="28" width="20" height="38" rx="3" fill="var(--color-brand-300)" />
        <path d="M48 47 L92 47" stroke="var(--color-ink-400)" strokeWidth="2" strokeDasharray="5 5" />
        <circle cx="150" cy="26" r="11" fill="var(--color-ink-700)" />
        <path
          d="M150 37 L150 62 L178 74 M150 62 L124 76"
          stroke="var(--color-ink-700)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <figcaption className="mt-2 text-center text-base text-ink-500">
        About 2 metres away, with your side facing the phone
      </figcaption>
    </figure>
  );
}

/** A single, wordless progress bar: how far this repetition has travelled. */
function RangeBar({ value, target }: { value: number | null; target: number }) {
  const pct = value === null ? 0 : Math.min(100, Math.max(0, (value / target) * 100));
  return (
    <div>
      <div className="h-6 w-full overflow-hidden rounded-full bg-ink-200">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-center text-sm text-ink-500">
        The bar fills as you move further.
      </p>
    </div>
  );
}
