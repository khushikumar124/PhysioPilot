/**
 * MediaPipe Pose Landmarker wrapper.
 *
 * Pose estimation runs entirely in the browser: video frames never leave the
 * device, and only derived measurements (joint angles per repetition) are sent
 * to the server. The model and wasm runtime are served from /public, so the
 * demo works without internet access.
 */

import type { PoseLandmarker, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Landmark } from "./landmarks";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/pose_landmarker_lite.task";

export type CameraErrorKind =
  | "permission_denied"
  | "camera_busy"
  | "no_camera"
  | "insecure_context"
  | "model_failed"
  | "unknown";

export class CameraError extends Error {
  kind: CameraErrorKind;
  constructor(kind: CameraErrorKind, message: string) {
    super(message);
    this.name = "CameraError";
    this.kind = kind;
  }
}

export const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  permission_denied:
    "The camera is blocked. Allow camera access for this site, then try again. " +
    "On a phone or laptop you may also need to allow the camera for your browser " +
    "in the device's own privacy settings.",
  // NotReadableError is common in practice: a video call or camera app is
  // still holding the device. Saying so saves the patient a lot of guessing.
  camera_busy:
    "Another app seems to be using the camera. Close it, then try again.",
  no_camera: "No camera was found on this device.",
  insecure_context:
    "The camera needs a secure connection. Open the app over https or on localhost.",
  model_failed: "Movement tracking could not start on this device.",
  unknown: "The camera could not be started. Please try again.",
};

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/**
 * Load the pose model once and share it across sessions.
 *
 * The MediaPipe bundle is several hundred kilobytes, so it is imported lazily:
 * a patient who only checks today's routine never downloads it.
 */
async function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

export interface PoseFrame {
  timestamp: number;
  landmarks: Landmark[] | null;
}

export interface PoseTrackerHandles {
  stop: () => void;
}

/**
 * Attach the camera to `video` and call `onFrame` for every processed frame.
 * `onFrame` receives `landmarks: null` when no person was detected, so callers
 * can distinguish "not moving" from "not visible".
 */
export async function startPoseTracking(
  video: HTMLVideoElement,
  onFrame: (frame: PoseFrame) => void,
): Promise<PoseTrackerHandles> {
  if (!window.isSecureContext) {
    throw new CameraError("insecure_context", CAMERA_ERROR_MESSAGES.insecure_context);
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("no_camera", CAMERA_ERROR_MESSAGES.no_camera);
  }

  // Ask for the camera FIRST, while the user's tap on START is still counted
  // as an active gesture. Safari only honours getUserMedia inside that window,
  // and loading the model beforehand (a 5.5 MB download on first run) spends
  // it - the call is then rejected with NotAllowedError and no prompt is ever
  // shown. Requesting first also puts the permission dialog in front of the
  // patient immediately instead of after a silent wait.
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (error) {
    const name = (error as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CameraError("permission_denied", CAMERA_ERROR_MESSAGES.permission_denied);
    }
    if (name === "NotReadableError" || name === "AbortError") {
      throw new CameraError("camera_busy", CAMERA_ERROR_MESSAGES.camera_busy);
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new CameraError("no_camera", CAMERA_ERROR_MESSAGES.no_camera);
    }
    throw new CameraError("unknown", CAMERA_ERROR_MESSAGES.unknown);
  }

  let landmarker: PoseLandmarker;
  try {
    landmarker = await loadLandmarker();
  } catch {
    // Release the camera we just acquired, or its light stays on with nothing
    // reading from it.
    stream.getTracks().forEach((track) => track.stop());
    throw new CameraError("model_failed", CAMERA_ERROR_MESSAGES.model_failed);
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => {
    /* autoplay can be refused; the loop below still reads frames once playing */
  });

  let running = true;
  let rafId = 0;
  let lastVideoTime = -1;

  const loop = () => {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      let result: PoseLandmarkerResult | null = null;
      try {
        result = landmarker.detectForVideo(video, performance.now());
      } catch {
        // A single bad frame must never end the session.
        result = null;
      }
      const landmarks = result?.landmarks?.[0] ?? null;
      onFrame({
        timestamp: performance.now(),
        landmarks: landmarks ? (landmarks as Landmark[]) : null,
      });
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}

/** Skeleton connections used by the on-screen overlay. */
export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32],
];
