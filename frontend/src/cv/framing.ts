/**
 * Camera positioning guidance.
 *
 * This is a deliberately simple check: are the landmarks this exercise needs
 * visible, and is the body framed sensibly in the picture? It does not verify
 * the camera angle or the plane of movement - doing that reliably is beyond
 * this prototype, and the session screen tells the patient to sit side-on
 * rather than pretending to detect it.
 */

import { LM, meanVisibility, type Landmark } from "./landmarks";
import type { TrackerDefinition } from "./trackers";

export type FramingStatus = "no_person" | "partly_visible" | "too_close" | "too_far" | "ready";

export interface FramingResult {
  status: FramingStatus;
  message: string;
  ready: boolean;
}

const MESSAGES: Record<FramingStatus, string> = {
  no_person: "I cannot see you yet. Please stand or sit in front of the camera.",
  partly_visible: "Please make sure your whole leg is inside the picture.",
  too_close: "Please move the phone a little farther away.",
  too_far: "Please come a little closer to the phone.",
  ready: "Good. You are ready.",
};

const MIN_JOINT_VISIBILITY = 0.6;
const MIN_BODY_HEIGHT_FRACTION = 0.28;
const MAX_BODY_HEIGHT_FRACTION = 0.98;

export function checkFraming(
  landmarks: Landmark[] | null,
  tracker: TrackerDefinition,
): FramingResult {
  const build = (status: FramingStatus): FramingResult => ({
    status,
    message: MESSAGES[status],
    ready: status === "ready",
  });

  if (!landmarks || landmarks.length < 33) return build("no_person");

  const torso = meanVisibility(landmarks, [LM.leftHip, LM.rightHip, LM.leftShoulder, LM.rightShoulder]);
  if (torso < 0.3) return build("no_person");

  const jointVisibility = Math.max(
    meanVisibility(landmarks, tracker.requiredLandmarks.left),
    meanVisibility(landmarks, tracker.requiredLandmarks.right),
  );
  if (jointVisibility < MIN_JOINT_VISIBILITY) return build("partly_visible");

  // Landmarks are normalised to the frame, so the visible span of the body is
  // a usable proxy for distance.
  const relevant = [
    ...tracker.requiredLandmarks.left,
    ...tracker.requiredLandmarks.right,
    LM.leftHip,
    LM.rightHip,
  ]
    .map((index) => landmarks[index])
    .filter((landmark) => (landmark?.visibility ?? 0) > 0.4);

  if (relevant.length < 3) return build("partly_visible");

  const xs = relevant.map((l) => l.x);
  const ys = relevant.map((l) => l.y);
  const span = Math.max(Math.max(...ys) - Math.min(...ys), Math.max(...xs) - Math.min(...xs));

  // Anything clipped by an edge means part of the movement happens off-camera.
  const clipped = relevant.some((l) => l.x < 0.02 || l.x > 0.98 || l.y < 0.02 || l.y > 0.98);
  if (clipped) return build("too_close");

  if (span > MAX_BODY_HEIGHT_FRACTION) return build("too_close");
  if (span < MIN_BODY_HEIGHT_FRACTION) return build("too_far");
  return build("ready");
}
