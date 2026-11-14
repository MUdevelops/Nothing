// Copies runtime WASM assets out of node_modules into public/ so NOTHING never needs a CDN.
import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs';

const mp = 'node_modules/@mediapipe/tasks-vision/wasm';
if (existsSync(mp)) {
  cpSync(mp, 'public/wasm', { recursive: true });
  console.log('[NOTHING] copied MediaPipe WASM -> public/wasm');
} else console.warn('[NOTHING] MediaPipe WASM not found; run npm install');

const ortCandidates = [
  'node_modules/onnxruntime-web/dist',
  'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist',
];
const ort = ortCandidates.find(existsSync);
if (ort) {
  mkdirSync('public/ort', { recursive: true });
  let n = 0;
  for (const f of readdirSync(ort)) {
    if (/^ort-wasm.*\.(wasm|mjs)$/.test(f)) { cpSync(`${ort}/${f}`, `public/ort/${f}`); n++; }
  }
  console.log(`[NOTHING] copied ${n} ONNX Runtime WASM files -> public/ort`);
} else console.warn('[NOTHING] onnxruntime-web not found; local AI needs it');
