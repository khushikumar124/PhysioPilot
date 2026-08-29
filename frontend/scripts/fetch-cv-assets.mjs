/**
 * Fetch the pose-estimation assets the patient app needs.
 *
 * ~39 MB of binaries that are deliberately not committed. The wasm runtime is
 * copied out of node_modules so it always matches the installed @mediapipe
 * version, and the model is downloaded once.
 *
 * Written in Node rather than shell, and confined to this directory, because
 * it runs as the frontend service's prebuild step on Vercel where the working
 * directory is frontend/ and bash is not guaranteed.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const publicDir = join(root, "public", "mediapipe");
const vendorDir = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const modelPath = join(publicDir, "models", "pose_landmarker_lite.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

if (!existsSync(vendorDir)) {
  console.error("@mediapipe/tasks-vision is not installed. Run npm install first.");
  process.exit(1);
}

await mkdir(join(publicDir, "wasm"), { recursive: true });
await mkdir(join(publicDir, "models"), { recursive: true });

console.log("→ Copying MediaPipe wasm runtime");
for (const file of await readdir(vendorDir)) {
  await copyFile(join(vendorDir, file), join(publicDir, "wasm", file));
}

if (existsSync(modelPath) && (await stat(modelPath)).size > 1_000_000) {
  console.log("→ Pose model already present");
} else {
  console.log("→ Downloading pose model (~5.5 MB)");
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    console.error(`Model download failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  await writeFile(modelPath, Buffer.from(await response.arrayBuffer()));
}

console.log("Computer-vision assets ready in frontend/public/mediapipe/");
