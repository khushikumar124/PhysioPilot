/**
 * Pose landmark utilities.
 *
 * Indices follow the MediaPipe BlazePose 33-point topology. Angles are
 * computed in 2D image space: this is enough for the sagittal-plane knee and
 * hip movements the prototype tracks, and it degrades predictably when the
 * patient is not perfectly side-on. It is not a 3D goniometer, and the UI
 * says so.
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftFoot: 31,
  rightFoot: 32,
} as const;

export type Side = "left" | "right";

/** Interior angle at point `b`, in degrees (0-180). */
export function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magnitude = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (magnitude === 0) return 0;
  const cosine = Math.min(1, Math.max(-1, dot / magnitude));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function visibilityOf(landmark: Landmark | undefined): number {
  return landmark?.visibility ?? 0;
}

/** Mean visibility across a set of landmark indices. */
export function meanVisibility(landmarks: Landmark[], indices: number[]): number {
  if (!landmarks.length) return 0;
  const total = indices.reduce((sum, index) => sum + visibilityOf(landmarks[index]), 0);
  return total / indices.length;
}

/**
 * Pick the better-visible side, so the patient can lie or sit either way round
 * without being told which leg to point at the camera.
 */
export function pickSide(
  landmarks: Landmark[],
  leftIndices: number[],
  rightIndices: number[],
): { side: Side; visibility: number } {
  const left = meanVisibility(landmarks, leftIndices);
  const right = meanVisibility(landmarks, rightIndices);
  return left >= right ? { side: "left", visibility: left } : { side: "right", visibility: right };
}
