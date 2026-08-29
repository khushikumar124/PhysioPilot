/**
 * Exercise-specific movement logic.
 *
 * A tracker turns a stream of pose landmarks into (a) a live "flexion angle"
 * signal and (b) completed repetitions. Adding an exercise means adding a
 * `TrackerDefinition` here - nothing else in the app changes.
 *
 * The angle convention is the same for every tracker: 0 degrees means the
 * joint is in its neutral/extended position, and larger numbers mean more
 * movement. That lets one repetition detector serve all of them.
 */

import { LM, angleAt, meanVisibility, pickSide, type Landmark, type Side } from "./landmarks";

export interface AngleReading {
  /** Flexion angle in degrees, or null when the joint could not be measured. */
  angle: number | null;
  /** Mean visibility of the landmarks this reading depends on (0-1). */
  visibility: number;
  side: Side | null;
}

export interface TrackerDefinition {
  key: string;
  label: string;
  /** Landmarks that must be visible for the exercise to be measurable. */
  requiredLandmarks: { left: number[]; right: number[] };
  measure: (landmarks: Landmark[]) => AngleReading;
  /** Spoken/'‑displayed cues, in order, during a repetition. */
  cues: { start: string; peak: string; return: string };
}

const MIN_LANDMARK_VISIBILITY = 0.5;

function sagittalTracker(
  key: string,
  label: string,
  joint: { left: [number, number, number]; right: [number, number, number] },
  cues: TrackerDefinition["cues"],
): TrackerDefinition {
  const leftIndices = joint.left as unknown as number[];
  const rightIndices = joint.right as unknown as number[];

  return {
    key,
    label,
    requiredLandmarks: { left: leftIndices, right: rightIndices },
    cues,
    measure(landmarks) {
      if (!landmarks || landmarks.length < 33) {
        return { angle: null, visibility: 0, side: null };
      }
      const { side, visibility } = pickSide(landmarks, leftIndices, rightIndices);
      if (visibility < MIN_LANDMARK_VISIBILITY) {
        return { angle: null, visibility, side };
      }
      const [a, b, c] = side === "left" ? joint.left : joint.right;
      const interior = angleAt(landmarks[a], landmarks[b], landmarks[c]);
      // Interior 180 deg = fully extended, so flexion is its complement.
      return { angle: Math.max(0, 180 - interior), visibility, side };
    },
  };
}

/** Knee flexion: hip - knee - ankle. Used for knee bends and heel slides. */
export const kneeFlexionTracker = sagittalTracker(
  "knee_flexion",
  "Knee bend",
  {
    left: [LM.leftHip, LM.leftKnee, LM.leftAnkle],
    right: [LM.rightHip, LM.rightKnee, LM.rightAnkle],
  },
  {
    start: "Slowly bend your knee.",
    peak: "Hold.",
    return: "Now straighten.",
  },
);

/** Hip flexion: shoulder - hip - knee. Used for the straight leg raise. */
export const hipFlexionTracker = sagittalTracker(
  "hip_flexion",
  "Leg raise",
  {
    left: [LM.leftShoulder, LM.leftHip, LM.leftKnee],
    right: [LM.rightShoulder, LM.rightHip, LM.rightKnee],
  },
  {
    start: "Slowly lift your leg, keeping it straight.",
    peak: "Hold.",
    return: "Now lower it down.",
  },
);

export const TRACKERS: Record<string, TrackerDefinition> = {
  knee_flexion: kneeFlexionTracker,
  hip_flexion: hipFlexionTracker,
};

export function getTracker(key: string | null | undefined): TrackerDefinition | null {
  if (!key) return null;
  return TRACKERS[key] ?? null;
}

export function landmarkVisibility(tracker: TrackerDefinition, landmarks: Landmark[]): number {
  if (!landmarks?.length) return 0;
  return Math.max(
    meanVisibility(landmarks, tracker.requiredLandmarks.left),
    meanVisibility(landmarks, tracker.requiredLandmarks.right),
  );
}
