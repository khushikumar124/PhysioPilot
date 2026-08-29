/** Draws the pose skeleton over the video so the patient can see what the app sees. */

import type { Landmark } from "./landmarks";
import { POSE_CONNECTIONS } from "./poseTracker";

export function drawPose(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: Landmark[] | null,
  options: { highlight?: number[]; ready: boolean } = { ready: false },
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = video.videoWidth || canvas.width;
  const height = video.videoHeight || canvas.height;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const colour = options.ready ? "#14b8a6" : "#f59e0b";
  const point = (index: number) => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
    visible: (landmarks[index].visibility ?? 0) > 0.4,
  });

  context.lineWidth = Math.max(2, width / 180);
  context.strokeStyle = colour;
  context.lineCap = "round";

  POSE_CONNECTIONS.forEach(([from, to]) => {
    const a = point(from);
    const b = point(to);
    if (!a.visible || !b.visible) return;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  });

  const highlight = new Set(options.highlight ?? []);
  landmarks.forEach((landmark, index) => {
    if ((landmark.visibility ?? 0) < 0.4) return;
    const isJoint = highlight.has(index);
    context.beginPath();
    context.arc(
      landmark.x * width,
      landmark.y * height,
      isJoint ? Math.max(6, width / 90) : Math.max(3, width / 160),
      0,
      Math.PI * 2,
    );
    context.fillStyle = isJoint ? "#ffffff" : colour;
    context.fill();
    if (isJoint) {
      context.strokeStyle = colour;
      context.stroke();
    }
  });
}
