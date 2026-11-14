/* Local AI worker: all inference runs here, in the browser, off the UI thread. */
import { env, pipeline } from '@huggingface/transformers';
import { BASE } from '../lib/paths';

env.allowRemoteModels = false; // never resolve models from a remote hub
env.allowLocalModels = true;
env.localModelPath = `${BASE}models/hf/`;
env.useBrowserCache = false;
const onnx = env.backends.onnx as unknown as { wasm?: { wasmPaths?: string } };
if (onnx.wasm) onnx.wasm.wasmPaths = `${self.location.origin}${BASE}ort/`; // local runtime, no CDN

type Pipe = (...args: unknown[]) => Promise<unknown>;
const cache = new Map<string, { pipe: Pipe; backend: string }>();

interface Req { id: number; type: 'load' | 'run'; task: string; model: string; args?: unknown[]; preferGpu: boolean }

async function getPipe(task: string, model: string, preferGpu: boolean, progress: (p: unknown) => void) {
  const key = `${task}|${model}`;
  const hit = cache.get(key);
  if (hit) return { ...hit, key };
  const devices = ['wasm'];
  let last: unknown;
  for (const device of devices) {
    try {
      const pipe = (await pipeline(task as never, model, { device, progress_callback: progress } as never)) as unknown as Pipe;
      cache.set(key, { pipe, backend: device });
      return { pipe, backend: device, key };
    } catch (e) { last = e; }
  }
  throw last;
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, type, task, model, args = [], preferGpu } = e.data;
  const post = (m: object) => self.postMessage({ id, ...m });
  try {
    const t0 = performance.now();
    const entry = await getPipe(task, model, preferGpu, (data) => post({ type: 'progress', data }));
    if (type === 'load') { post({ type: 'done', result: null, backend: entry.backend, ms: performance.now() - t0, key: entry.key }); return; }
    const t1 = performance.now();
    const result = await entry.pipe(...args);
    post({ type: 'done', result, backend: entry.backend, ms: performance.now() - t1, key: entry.key });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
