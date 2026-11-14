import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, ScanSearch, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Field, Panel, ProgressBar, Segmented, Select, Slider } from '../../components/common/ui';
import { cn, downloadBlob, downloadText } from '../../lib/format';
import { ai, type Progress } from '../../services/local-ai/client';
import { byTask } from '../../services/models/catalog';
import { useInstalled } from '../../services/models/useInstalled';
import { ModelRequired } from '../model-center/ModelRequired';

interface Cls { label: string; score: number }
interface Det { label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }
const MAX_BYTES = 15 * 1024 * 1024;

export default function ImageApp() {
  const { installed } = useInstalled();
  const [mode, setMode] = useState<'classify' | 'detect'>('classify');
  const models = byTask(mode === 'classify' ? 'image-classification' : 'object-detection');
  const [mi, setMi] = useState(0); const model = models[Math.min(mi, models.length - 1)];
  const [bmp, setBmp] = useState<ImageBitmap | null>(null); const [name, setName] = useState('');
  const [maxDim, setMaxDim] = useState(1024); const [thr, setThr] = useState(0.6);
  const [drag, setDrag] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [prog, setProg] = useState<Progress | null>(null);
  const [cls, setCls] = useState<Cls[]>([]); const [dets, setDets] = useState<Det[]>([]); const [ms, setMs] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null); const fileIn = useRef<HTMLInputElement>(null);

  const load = useCallback(async (f?: File) => {
    if (!f) return;
    setErr('');
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/.test(f.type)) { setErr('Unsupported file type. Use PNG, JPEG, WebP, GIF or BMP.'); return; }
    if (f.size > MAX_BYTES) { setErr('Image is larger than 15 MB.'); return; }
    try { const b = await createImageBitmap(f); setBmp((old) => { old?.close(); return b; }); setName(f.name); setCls([]); setDets([]); }
    catch { setErr('This image could not be decoded.'); }
  }, []);

  useEffect(() => () => bmp?.close(), [bmp]);

  // draw preview + overlays
  useEffect(() => {
    const c = cv.current; if (!c) return; const g = c.getContext('2d')!;
    if (!bmp) { g.clearRect(0, 0, c.width, c.height); return; }
    c.width = bmp.width; c.height = bmp.height; g.drawImage(bmp, 0, 0);
    const lw = Math.max(2, bmp.width / 300); g.lineWidth = lw; g.font = `${Math.max(12, bmp.width / 50)}px ui-sans-serif, system-ui`;
    for (const d of dets) {
      const { xmin, ymin, xmax, ymax } = d.box; g.strokeStyle = '#38E8DA'; g.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);
      const t = `${d.label} ${(d.score * 100).toFixed(0)}%`; const w = g.measureText(t).width + 8, h = parseInt(g.font) + 6;
      g.fillStyle = '#38E8DA'; g.fillRect(xmin, Math.max(0, ymin - h), w, h); g.fillStyle = '#080B10'; g.fillText(t, xmin + 4, Math.max(h - 6, ymin - 6));
    }
  }, [bmp, dets]);

  const toBlob = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const o = document.createElement('canvas'); o.width = w; o.height = h; draw(o.getContext('2d')!);
    return new Promise<Blob>((res, rej) => o.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));
  };

  const resized = async (): Promise<{ blob: Blob; sx: number; sy: number }> => {
    const s = Math.min(1, maxDim / Math.max(bmp!.width, bmp!.height)); const w = Math.round(bmp!.width * s), h = Math.round(bmp!.height * s);
    return { blob: await toBlob(w, h, (g) => g.drawImage(bmp!, 0, 0, w, h)), sx: bmp!.width / w, sy: bmp!.height / h };
  };

  const cleanup = async () => { // re-encode (drops EXIF/metadata) + auto-levels
    if (!bmp) return;
    const o = document.createElement('canvas'); o.width = bmp.width; o.height = bmp.height; const g = o.getContext('2d')!; g.drawImage(bmp, 0, 0);
    const img = g.getImageData(0, 0, o.width, o.height); const d = img.data; let lo = 255, hi = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; if (l < lo) lo = l; if (l > hi) hi = l; }
    if (hi - lo > 8) { const k = 255 / (hi - lo); for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.max(0, (d[i + c] - lo) * k)); g.putImageData(img, 0, 0); }
    const b = await createImageBitmap(o); setBmp((old) => { old?.close(); return b; }); setCls([]); setDets([]);
  };

  const run = async () => {
    if (!bmp || busy) return;
    setBusy(true); setErr(''); setProg(null);
    let url = '';
    try {
      const { blob, sx, sy } = await resized(); url = URL.createObjectURL(blob);
      if (mode === 'classify') {
        const r = await ai.run('image-classification', model.id, [url, { top_k: 5 }], setProg); setCls(r.result as Cls[]); setDets([]); setMs(r.ms);
      } else {
        const r = await ai.run('object-detection', model.id, [url, { threshold: thr, percentage: false }], setProg);
        setDets((r.result as Det[]).map((d) => ({ ...d, box: { xmin: d.box.xmin * sx, ymin: d.box.ymin * sy, xmax: d.box.xmax * sx, ymax: d.box.ymax * sy } }))); setCls([]); setMs(r.ms);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    if (url) URL.revokeObjectURL(url);
    setBusy(false); setProg(null);
  };

  const ready = installed[model.id];
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3 xl:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className={cn('relative flex min-h-[220px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-bg', drag ? 'border-accent' : 'border-line')}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void load(e.dataTransfer.files[0]); }}>
          <canvas ref={cv} className={cn('max-h-full max-w-full', !bmp && 'hidden')} aria-label="Image preview" />
          {!bmp && (<div className="text-center text-xs text-muted"><ImagePlus className="mx-auto mb-2" />Drop an image here<br />or <button className="text-accent underline" onClick={() => fileIn.current?.click()}>choose a file</button><br /><span className="text-[11px]">PNG · JPEG · WebP · GIF · BMP, up to 15 MB. Never uploaded.</span></div>)}
          <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" hidden onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {err && <p className="rounded border border-red-500/40 bg-red-500/10 p-2 font-mono text-[11px] text-red-300">{err}</p>}
        {busy && prog && <div className="space-y-1"><span className="font-mono text-[11px] text-muted">{prog.status} {prog.file?.split('/').pop()}</span>{prog.progress != null && <ProgressBar value={prog.progress / 100} />}</div>}
      </div>
      <div className="w-full shrink-0 space-y-3 overflow-auto xl:w-80">
        <Panel className="space-y-3 p-3">
          <Segmented value={mode} onChange={(m) => { setMode(m); setMi(0); setCls([]); setDets([]); }} options={[{ id: 'classify', label: 'Classify' }, { id: 'detect', label: 'Detect objects' }]} />
          <Field label="Model"><Select value={mi} onChange={(e) => setMi(Number(e.target.value))}>{models.map((m, i) => <option key={m.id} value={i}>{m.label}{installed[m.id] ? ' ✓' : ' (not installed)'}</option>)}</Select></Field>
          <Slider label="Resize before inference (max side)" value={maxDim} min={256} max={2048} step={128} onChange={setMaxDim} fmt={(v) => `${v}px`} />
          {mode === 'detect' && <Slider label="Confidence threshold" value={thr} min={0.1} max={0.95} step={0.05} onChange={setThr} fmt={(v) => `${Math.round(v * 100)}%`} />}
          {ready ? <Button variant="primary" className="w-full" onClick={() => void run()} disabled={!bmp || busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}{busy ? 'Running locally…' : 'Analyze locally'}</Button>
            : <p className="text-[11px] text-amber-400">Model not installed — see below.</p>}
          <div className="grid grid-cols-2 gap-1.5">
            <Button onClick={() => void cleanup()} disabled={!bmp}><Sparkles size={13} />Clean up</Button>
            <Button onClick={() => { setBmp(null); setCls([]); setDets([]); }} disabled={!bmp}><Trash2 size={13} />Clear</Button>
            <Button disabled={!bmp} onClick={() => cv.current?.toBlob((b) => b && downloadBlob(b, `annotated-${name || 'image'}.png`))}><Download size={13} />PNG</Button>
            <Button disabled={!cls.length && !dets.length} onClick={() => downloadText(JSON.stringify({ file: name, model: model.id, ms, classification: cls, detections: dets }, null, 2), 'image-results.json', 'application/json')}>JSON</Button>
          </div>
          <p className="text-[11px] text-muted">“Clean up” re-encodes the pixels (dropping metadata such as EXIF) and stretches contrast.</p>
        </Panel>
        {!ready && <Panel className="overflow-auto"><ModelRequired model={model} /></Panel>}
        {(cls.length > 0 || dets.length > 0) && (
          <Panel className="space-y-1.5 p-3">
            <div className="flex items-center justify-between text-xs font-medium"><span>Results</span><Badge>{ms.toFixed(0)} ms</Badge></div>
            {cls.map((c) => (<div key={c.label} className="text-xs"><div className="flex justify-between"><span className="truncate pr-2">{c.label}</span><span className="font-mono text-muted">{(c.score * 100).toFixed(1)}%</span></div><ProgressBar value={c.score} /></div>))}
            {dets.map((d, i) => <div key={i} className="flex justify-between text-xs"><span>{d.label}</span><span className="font-mono text-muted">{(d.score * 100).toFixed(1)}%</span></div>)}
            {mode === 'detect' && !dets.length && <p className="text-[11px] text-muted">Nothing above the threshold.</p>}
          </Panel>)}
      </div>
    </div>
  );
}
