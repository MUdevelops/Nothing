import { abs, asset } from '../../lib/paths';

/** Same cache name as public/sw.js, so imported files are served to Transformers.js by the service worker. */
export const MODEL_CACHE = 'nothing-models-v1';
export const HAND_PATH = 'models/hand_landmarker.task';
export const HAND_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export const hfBase = (id: string): string => `models/hf/${id}/`;
export const MODELS_CHANGED = 'nothing:models-changed';
const changed = () => window.dispatchEvent(new Event(MODELS_CHANGED));

const MIME: Record<string, string> = { json: 'application/json', onnx: 'application/octet-stream', txt: 'text/plain', task: 'application/octet-stream' };
const mime = (p: string) => MIME[p.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

async function putFile(path: string, blob: Blob): Promise<void> {
  const c = await caches.open(MODEL_CACHE);
  await c.put(abs(path), new Response(blob, { headers: { 'Content-Type': mime(path), 'Content-Length': String(blob.size) } }));
}

const looksLikeHtml = (r: Response) => (r.headers.get('content-type') ?? '').includes('html');

// ---- Hand landmarker -------------------------------------------------------
export async function getHandModelBuffer(): Promise<Uint8Array | null> {
  const c = await caches.open(MODEL_CACHE);
  const hit = await c.match(abs(HAND_PATH));
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  try {
    const r = await fetch(asset(HAND_PATH), { cache: 'no-store' });
    if (r.ok && !looksLikeHtml(r)) {
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.byteLength > 100_000) return buf;
    }
  } catch { /* offline / missing */ }
  return null;
}

export async function handModelPresent(): Promise<boolean> {
  const c = await caches.open(MODEL_CACHE);
  if (await c.match(abs(HAND_PATH))) return true;
  try {
    const r = await fetch(asset(HAND_PATH), { method: 'HEAD', cache: 'no-store' });
    return r.ok && !looksLikeHtml(r) && Number(r.headers.get('content-length') ?? 1_000_000) > 100_000;
  } catch { return false; }
}

export async function importHandModel(file: File): Promise<void> {
  if (!file.name.endsWith('.task')) throw new Error('Expected a .task file (hand_landmarker.task).');
  if (file.size < 100_000 || file.size > 100_000_000) throw new Error('File size looks wrong for a MediaPipe model.');
  await putFile(HAND_PATH, file);
  changed();
}

/** Explicit, user-initiated download of the official static model weights (not an AI API). */
export async function downloadHandModel(onProgress: (frac: number) => void, signal?: AbortSignal): Promise<void> {
  const r = await fetch(HAND_URL, { signal });
  if (!r.ok || !r.body) throw new Error(`Download failed (HTTP ${r.status}).`);
  const total = Number(r.headers.get('content-length') ?? 0);
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.byteLength;
    if (total) onProgress(got / total);
  }
  await putFile(HAND_PATH, new Blob(parts as BlobPart[]));
  changed();
}

// ---- Transformers.js models ------------------------------------------------
export async function isHfInstalled(id: string): Promise<boolean> {
  const u = abs(hfBase(id) + 'config.json');
  const c = await caches.open(MODEL_CACHE);
  if (await c.match(u)) return true;
  try {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok || looksLikeHtml(r)) return false;
    await r.json();
    return true;
  } catch { return false; }
}

/** Import a model folder (chosen with a directory picker) into Cache Storage under models/hf/<id>/. */
export async function importHfFolder(id: string, files: File[]): Promise<number> {
  const rel = (f: File) => (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name;
  const usable = files.filter((f) => !rel(f).split('/').some((s) => s.startsWith('.')));
  if (!usable.some((f) => rel(f) === 'config.json')) throw new Error('config.json not found at the top level of the chosen folder.');
  if (!usable.some((f) => rel(f).endsWith('.onnx'))) throw new Error('No .onnx files found. Expected an onnx/ sub-folder.');
  for (const f of usable) await putFile(hfBase(id) + rel(f), f);
  changed();
  return usable.length;
}

async function keysWithPrefix(prefix: string): Promise<Request[]> {
  const c = await caches.open(MODEL_CACHE);
  return (await c.keys()).filter((k) => k.url.startsWith(prefix));
}

export async function modelCachedSize(prefix: string): Promise<number> {
  const c = await caches.open(MODEL_CACHE);
  let n = 0;
  for (const k of await keysWithPrefix(abs(prefix))) {
    const r = await c.match(k);
    n += Number(r?.headers.get('content-length') ?? 0);
  }
  return n;
}

export async function removeCached(prefix: string): Promise<number> {
  const c = await caches.open(MODEL_CACHE);
  const ks = await keysWithPrefix(abs(prefix));
  await Promise.all(ks.map((k) => c.delete(k)));
  changed();
  return ks.length;
}

export async function clearAllModelCaches(): Promise<void> {
  await caches.delete(MODEL_CACHE);
  changed();
}
