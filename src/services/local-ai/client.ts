import { useSyncExternalStore } from 'react';
import { loadSettings } from '../storage/settings';

export interface Progress { status: string; file?: string; progress?: number }
export interface RunResult { result: unknown; backend: string; ms: number }
interface Pending { resolve: (v: RunResult) => void; reject: (e: Error) => void; onProgress?: (p: Progress) => void; model: string }
export interface Diagnostic { t: number; model: string; message: string }

class AiClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private subs = new Set<() => void>();
  loaded = new Map<string, string>(); // "task|model" -> backend
  diagnostics: Diagnostic[] = [];
  busy = 0;
  version = 0;

  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.subs.forEach((f) => f()); }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('../../workers/ai.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { id: number; type: 'progress' | 'done' | 'error'; data?: Progress; result?: unknown; backend?: string; ms?: number; message?: string; key?: string };
      const p = this.pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') { p.onProgress?.(m.data as Progress); return; }
      this.pending.delete(m.id); this.busy--;
      if (m.type === 'done') {
        if (m.key) this.loaded.set(m.key, m.backend ?? '');
        p.resolve({ result: m.result, backend: m.backend ?? '', ms: m.ms ?? 0 });
      } else {
        const message = m.message ?? 'Unknown worker error';
        this.diagnostics = [{ t: Date.now(), model: p.model, message }, ...this.diagnostics].slice(0, 30);
        p.reject(new Error(message));
      }
      this.emit();
    };
    w.onerror = (e) => {
      const message = e.message || 'Worker crashed';
      this.diagnostics = [{ t: Date.now(), model: '(worker)', message }, ...this.diagnostics].slice(0, 30);
      this.pending.forEach((p) => p.reject(new Error(message)));
      this.pending.clear(); this.busy = 0; this.worker = null; this.emit();
    };
    this.worker = w;
    return w;
  }

  private send(type: 'load' | 'run', task: string, model: string, args: unknown[], onProgress?: (p: Progress) => void, transfer: Transferable[] = []): Promise<RunResult> {
    const w = this.ensure();
    const id = ++this.seq;
    this.busy++; this.emit();
    return new Promise<RunResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress, model });
      w.postMessage({ id, type, task, model, args, preferGpu: loadSettings().preferGpu }, transfer);
    });
  }

  load(task: string, model: string, onProgress?: (p: Progress) => void) { return this.send('load', task, model, [], onProgress); }
  run(task: string, model: string, args: unknown[], onProgress?: (p: Progress) => void, transfer: Transferable[] = []) {
    return this.send('run', task, model, args, onProgress, transfer);
  }

  /** Terminate the worker and free every loaded model. */
  unloadAll() {
    this.worker?.terminate(); this.worker = null;
    this.pending.forEach((p) => p.reject(new Error('Worker terminated')));
    this.pending.clear(); this.loaded.clear(); this.busy = 0; this.emit();
  }
}

export const ai = new AiClient();
export function useAi(): AiClient {
  useSyncExternalStore(ai.subscribe, ai.getVersion);
  return ai;
}
