import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, FolderUp, RefreshCw, Trash2, Zap } from 'lucide-react';
import { useNotify } from '../../app/AppProvider';
import { Badge, Button, Panel, ProgressBar, Stat } from '../../components/common/ui';
import { bytes } from '../../lib/format';
import { ai, useAi } from '../../services/local-ai/client';
import { CATALOG, REQUIRED_FILES, type ModelEntry } from '../../services/models/catalog';
import { downloadHandModel, getHandModelBuffer, HAND_PATH, hfBase, importHandModel, importHfFolder, modelCachedSize, removeCached } from '../../services/models/store';
import { useInstalled } from '../../services/models/useInstalled';

export default function ModelCenterApp() {
  const notify = useNotify(); const a = useAi();
  const { installed, hand, checking, refresh } = useInstalled();
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null); const [prog, setProg] = useState(0);
  const [err, setErr] = useState('');
  const [testRes, setTestRes] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<ModelEntry | null>(null);
  const folderIn = useRef<HTMLInputElement>(null); const handIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const s: Record<string, number> = { hand: await modelCachedSize(HAND_PATH) };
      for (const m of CATALOG) s[m.id] = await modelCachedSize(hfBase(m.id));
      setSizes(s);
    })();
  }, [installed, hand]);

  const gpu = 'gpu' in navigator;
  const wrap = async (key: string, f: () => Promise<void>) => { setBusy(key); setErr(''); try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } setBusy(null); };

  const testHand = () => wrap('hand-test', async () => {
    const t0 = performance.now(); const b = await getHandModelBuffer(); if (!b) throw new Error('Hand model not found.');
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision'); const { asset } = await import('../../lib/paths');
    const fs = await FilesetResolver.forVisionTasks(asset('wasm')); const lm = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetBuffer: b }, runningMode: 'IMAGE', numHands: 1 }); lm.close();
    setTestRes((r) => ({ ...r, hand: `OK — loaded in ${(performance.now() - t0).toFixed(0)} ms` }));
  });
  const testHf = (m: ModelEntry) => wrap(m.id, async () => {
    try { const r = await ai.load(m.task, m.id, (p) => p.progress != null && setProg(p.progress / 100)); setTestRes((x) => ({ ...x, [m.id]: `OK — loaded on ${r.backend} in ${r.ms.toFixed(0)} ms` })); }
    catch (e) { setTestRes((x) => ({ ...x, [m.id]: `FAILED — ${e instanceof Error ? e.message : String(e)}` })); }
  });

  return (
    <div className="h-full min-h-0 min-w-0 space-y-3 overflow-auto p-3">
      <input ref={folderIn} type="file" hidden multiple {...({ webkitdirectory: '' } as Record<string, string>)}
        onChange={(e) => { const files = Array.from(e.target.files ?? []); const m = target; e.target.value = ''; if (m && files.length) void wrap(m.id, async () => { const n = await importHfFolder(m.id, files); notify('Model imported', `${n} files stored for ${m.label}.`, 'ok'); }); }} />
      <input ref={handIn} type="file" accept=".task" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void wrap('hand', async () => { await importHandModel(f); notify('Hand model imported', undefined, 'ok'); }); }} />

      <div className="grid gap-3 md:grid-cols-3">
        <Panel className="p-3"><div className="mb-1 text-xs font-medium">Inference backends</div>
          <Stat label="WebGPU" value={<Badge tone={gpu ? 'ok' : 'neutral'}>{gpu ? 'available' : 'not available'}</Badge>} />
          <Stat label="WASM" value={<Badge tone={typeof WebAssembly !== 'undefined' ? 'ok' : 'error'}>{typeof WebAssembly !== 'undefined' ? 'available' : 'missing'}</Badge>} />
          <Stat label="Threads / isolated" value={`${navigator.hardwareConcurrency ?? '?'} / ${crossOriginIsolated ? 'yes' : 'no'}`} /></Panel>
        <Panel className="p-3"><div className="mb-1 text-xs font-medium">Runtime</div>
          <Stat label="Loaded in memory" value={a.loaded.size} /><Stat label="Worker busy" value={a.busy ? 'yes' : 'no'} />
          <Button className="mt-2 w-full" variant="outline" disabled={!a.loaded.size} onClick={() => { ai.unloadAll(); notify('Models unloaded', 'Worker terminated and memory released.'); }}>Unload all models</Button></Panel>
        <Panel className="p-3 text-[11px] leading-relaxed text-muted"><div className="mb-1 text-xs font-medium text-fg">Where model files go</div>
          Static: <span className="break-all font-mono text-fg">{'public/models/hf/<org>/<model>/'}</span>. Or import a model folder here — it is kept in Cache Storage and served by the service worker (production build). Nothing is ever downloaded silently.</Panel>
      </div>

      {err && <p className="rounded border border-red-500/40 bg-red-500/10 p-2 font-mono text-[11px] text-red-300">{err}</p>}

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs font-medium"><span>Installed models</span><Button variant="ghost" onClick={() => void refresh()}><RefreshCw size={12} className={checking ? 'animate-spin' : ''} />Rescan</Button></div>
        <ul className="divide-y divide-line">
          <li className="space-y-1.5 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium">MediaPipe Hand Landmarker</span> <Badge>Vision</Badge></div>
              <Badge tone={hand ? 'ok' : 'warn'}>{hand ? 'installed' : hand === null ? 'checking' : 'missing'}</Badge></div>
            <div className="break-all text-[11px] text-muted">{HAND_PATH} · cached size {bytes(sizes.hand)}</div>
            <div className="flex flex-wrap gap-1.5">
              <Button onClick={() => handIn.current?.click()} disabled={!!busy}><FileUp size={12} />Import</Button>
              <Button onClick={() => void wrap('hand', async () => { setProg(0); await downloadHandModel(setProg); notify('Hand model downloaded', 'Official static weights stored locally.', 'ok'); })} disabled={!!busy}><Download size={12} />Download (explicit)</Button>
              <Button onClick={() => void testHand()} disabled={!hand || !!busy}><Zap size={12} />Test</Button>
              <Button variant="danger" onClick={() => void removeCached(HAND_PATH).then(() => notify('Cached hand model removed'))} disabled={!sizes.hand}><Trash2 size={12} />Remove cached</Button>
            </div>
            {busy === 'hand' && <ProgressBar value={prog} />}{testRes.hand && <p className="font-mono text-[11px] text-muted">{testRes.hand}</p>}
          </li>
          {CATALOG.map((m) => (
            <li key={m.id} className="space-y-1.5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium">{m.label}</span> <Badge>{m.category}</Badge> <Badge>{m.task}</Badge></div>
                <Badge tone={installed[m.id] ? 'ok' : 'warn'}>{installed[m.id] ? 'installed' : 'not installed'}</Badge></div>
              <div className="break-words text-[11px] text-muted"><span className="break-all font-mono">{m.id}</span> · {m.note} · cached size {bytes(sizes[m.id])}{installed[m.id] && !sizes[m.id] ? ' (served from public/)' : ''}{a.loaded.has(`${m.task}|${m.id}`) ? ` · loaded (${a.loaded.get(`${m.task}|${m.id}`)})` : ''}</div>
              <div className="flex flex-wrap gap-1.5">
                <Button onClick={() => { setTarget(m); folderIn.current?.click(); }} disabled={!!busy}><FolderUp size={12} />Import folder</Button>
                <Button onClick={() => void testHf(m)} disabled={!installed[m.id] || !!busy}><Zap size={12} />{busy === m.id ? 'Loading…' : 'Test load'}</Button>
                <Button variant="danger" onClick={() => void removeCached(hfBase(m.id)).then(() => notify('Cached model removed', m.label))} disabled={!sizes[m.id]}><Trash2 size={12} />Remove cached</Button>
              </div>
              {busy === m.id && <ProgressBar value={prog} />}{testRes[m.id] && <p className={`font-mono text-[11px] ${testRes[m.id].startsWith('FAILED') ? 'text-red-300' : 'text-muted'}`}>{testRes[m.id]}</p>}
            </li>))}
        </ul>
      </Panel>

      <Panel className="p-3 text-[11px] text-muted"><div className="mb-1 text-xs font-medium text-fg">Required files (Hugging Face repo layout)</div><ul className="list-disc space-y-0.5 pl-4">{REQUIRED_FILES.map((f) => <li key={f}>{f}</li>)}</ul>
        <p className="mt-2">Files placed in <span className="font-mono">public/</span> cannot be removed from the app; delete them from disk.</p></Panel>

      <Panel className="p-3"><div className="mb-1 text-xs font-medium">Error diagnostics</div>
        {a.diagnostics.length ? <ul className="space-y-1 font-mono text-[11px] text-red-300">{a.diagnostics.map((d) => <li key={d.t}>[{new Date(d.t).toLocaleTimeString()}] {d.model}: {d.message}</li>)}</ul> : <p className="text-[11px] text-muted">No inference errors this session.</p>}</Panel>
    </div>
  );
}
