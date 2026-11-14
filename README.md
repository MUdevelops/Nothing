# NOTHING — INTELLIGENCE WITHOUT THE CLOUD.
*Everything happens here. Nothing leaves your device.* · by **MUdevelops**

A browser-native AI environment powered by local machine learning. Real-time computer vision, hand tracking, gesture interaction and creative intelligence. No backend, no AI API keys, no database.

> Status: TypeScript validation and production build pass. See [BUILD_STATUS.md](BUILD_STATUS.md) for runtime testing and known limits.

## Features
Desktop (windows, dock, launcher, Ctrl+K palette, notifications) · Vision (MediaPipe hand landmarks, gestures, FPS) · Air Canvas · Gesture Control · Creative Engine (Three.js) · Local Brain (Transformers.js) · Voice · Image Intelligence · Model Center · Privacy Center · Settings.

## Stack
React, Vite, TypeScript, Tailwind, Framer Motion, Three.js, @mediapipe/tasks-vision, @huggingface/transformers, Web Worker, Cache Storage, PWA service worker.

## Install & develop
```
npm install
npm run dev
npm run build && npm run preview   # production + service worker
```

## Local model setup
- **Hand model**: put `hand_landmarker.task` in `public/models/`, or import/download it in-app (explicit button; static weights only).
- **Transformers.js models**: use Hugging Face repo layout in `public/models/hf/<org>/<model>/` (config.json, tokenizer files, `onnx/model_quantized.onnx`…), or import the folder in Model Center. Remote model resolution is disabled in the worker.

## Privacy architecture
No telemetry, no keys, no remote inference. Preferences in localStorage; model files in Cache Storage. Optional network use: explicit hand-model download only. Privacy Center lists any cross-origin requests observed.

## Offline
App shell, WASM runtimes and installed models are cached by the service worker after first load. Features without an installed model stay unavailable.

## Deployment
Netlify: `netlify.toml` included. GitHub Pages: `VITE_BASE=/NOTHING/ npm run build`.

## Structure
`src/app` registry/provider · `src/components` desktop shell · `src/features` modules · `src/services` tracker, AI client, model store · `src/workers` AI worker · `public/sw.js`.

## Roadmap
MediaPipe in a worker, segmentation, tests, designed icons.

## License
MIT.
