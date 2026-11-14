# BUILD STATUS

`npm run typecheck` and `npm run build` pass. The production build was generated with Vite 5.4.21; browser behavior has not been tested end-to-end.

## First run
1. `npm install` (postinstall copies MediaPipe + ONNX Runtime WASM into public/wasm and public/ort)
2. `npm run dev`
3. Open Vision and import or download `hand_landmarker.task`

## Remaining / known limits
- Camera, MediaPipe, Transformers.js, and Three.js behavior still needs real-browser testing.
- MediaPipe runs on the main thread; Transformers.js runs in a worker.
- Gesture classification is rule-based on real landmarks.
- Imported HF model folders are served by the service worker, so they work in the production build (`npm run build && npm run preview`), or put files in public/models/hf/.
- No unit tests are written. PNG icons are generated; replace with designed art if desired.
