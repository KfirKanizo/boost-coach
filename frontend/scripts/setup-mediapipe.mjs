/**
 * Offline-first MediaPipe asset provisioning.
 *
 * Copies the tasks-vision WASM runtime out of node_modules and downloads the
 * PoseLandmarker Lite `.task` model so the app never depends on a CDN at
 * runtime (required for Capacitor/cached-webview builds).
 *
 * Wired as `postinstall` (and `setup:mediapipe` for manual re-runs). The model
 * fetch is best-effort: a pre-existing model is reused, and a network failure
 * logs a warning without failing the install so offline builds still succeed.
 */

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(
  packageRoot,
  'node_modules',
  '@mediapipe',
  'tasks-vision',
  'wasm',
);
const tasksOutDir = join(packageRoot, 'public', 'mediapipe', 'tasks-vision');
const wasmOutDir = join(tasksOutDir, 'wasm');
const modelOut = join(tasksOutDir, 'pose_landmarker_lite.task');
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const fail = (message) => {
  console.error(`[setup-mediapipe] ERROR: ${message}`);
  process.exit(1);
};

console.log('[setup-mediapipe] Copying tasks-vision WASM runtime…');

if (!existsSync(wasmSrc)) {
  fail(
    `WASM source not found at ${wasmSrc}. Run "npm install" first (this script runs as postinstall).`,
  );
}
mkdirSync(wasmOutDir, { recursive: true });
cpSync(wasmSrc, wasmOutDir, { recursive: true });
for (const file of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
]) {
  if (!existsSync(join(wasmOutDir, file))) {
    fail(`WASM asset missing after copy: ${file}`);
  }
}
console.log(
  `[setup-mediapipe] WASM runtime copied to ${wasmOutDir} (${wasmSrc} → ${wasmOutDir}).`,
);

const alreadyPresent =
  existsSync(modelOut) && statSync(modelOut).size > 1_000_000;

if (alreadyPresent) {
  console.log(`[setup-mediapipe] Model already present (${modelOut}), skipping download.`);
} else {
  console.log('[setup-mediapipe] Downloading pose_landmarker_lite.task…');
  let response;
  try {
    response = await fetch(modelUrl);
  } catch (error) {
    console.warn(
      `[setup-mediapipe] WARNING: could not reach ${modelUrl} (${error instanceof Error ? error.message : String(error)}). ` +
        'The model file is missing; the PoseLandmarker worker will fail until setup-mediapipe runs with network access.',
    );
    process.exit(0);
  }
  if (!response.ok) {
    fail(`model download failed: HTTP ${response.status} for ${modelUrl}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1_000_000) {
    fail(`model download looks truncated (${bytes.byteLength} bytes).`);
  }
  writeFileSync(modelOut, bytes);
  console.log(`[setup-mediapipe] Model written to ${modelOut} (${bytes.byteLength} bytes).`);
}

console.log('[setup-mediapipe] Done.');
