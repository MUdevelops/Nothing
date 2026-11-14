import { useCallback, useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { Camera, CameraOff, Download, Eraser, FileUp, Redo2, Save, Trash2, Undo2 } from 'lucide-react';
import { Badge, Button, Panel, ProgressBar, Segmented, Slider, Stat, Toggle } from '../../components/common/ui';
import { useVisible } from '../../components/windows/visibility';
import { cn, downloadBlob, downloadText } from '../../lib/format';
import { GESTURE_LABEL } from '../../lib/gestures';
import { tracker, useTracker } from '../../services/vision/tracker';
import { HandModelSetup } from '../model-center/HandModelSetup';

const W = 1280, H = 720;
type Tool = 'pen' | 'marker' | 'neon' | 'spray' | 'eraser';
interface Stroke { tool: Tool; color: string; size: number; pts: [number, number][] }
const TOOLS: { id: Tool; label: string }[] = [{ id: 'pen', label: 'Pen' }, { id: 'marker', label: 'Marker' }, { id: 'neon', label: 'Neon' }, { id: 'spray', label: 'Spray' }, { id: 'eraser', label: 'Eraser' }];
const SWATCHES = ['#38E8DA', '#E5E7EB', '#F87171', '#FBBF24', '#A3E635', '#60A5FA', '#C084FC', '#F472B6'];
const BGS = { dark: '#0b0f15', light: '#f5f6f8', paper: '#fffdf5' } as const;

const rng = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };

function paint(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.size;
  if (s.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = s.size * 2.2; }
  if (s.tool === 'marker') { ctx.globalAlpha = 0.45; ctx.lineWidth = s.size * 1.8; }
  if (s.tool === 'neon') { ctx.shadowColor = s.color; ctx.shadowBlur = s.size * 2.5; }
  const p = s.pts;
  if (s.tool === 'spray') {
    p.forEach(([x, y], i) => { for (let k = 0; k < 6; k++) { const a = rng(i * 7 + k) * 6.283, r = rng(i * 13 + k + 1) * s.size * 1.6; ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.6, 1.6); } });
  } else if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0], p[0][1], ctx.lineWidth / 2, 0, 7); ctx.fill();
  } else if (p.length > 1) {
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]); ctx.stroke();
  }
  ctx.restore();
}

export default function AirCanvasApp() {
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(SWATCHES[0]);
  const [size, setSize] = useState(6);
  const [stab, setStab] = useState(0.5);
  const [bg, setBg] = useState<keyof typeof BGS>('dark');
  const [handsOn, setHandsOn] = useState(false);
  const [showCam, setShowCam] = useState(true);
  const [dual, setDual] = useState(false);
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const [confirm, setConfirm] = useState(false);
  const tr = useTracker(handsOn);
  const visible = useVisible(); const vis = useRef(visible); vis.current = visible;

  const cfg = useRef({ tool, color, size, stab, bg, showCam, dual }); cfg.current = { tool, color, size, stab, bg, showCam, dual };
  const disp = useRef<HTMLCanvasElement>(null);
  const store = useRef({
    paint: document.createElement('canvas'), tmp: document.createElement('canvas'),
    strokes: [] as Stroke[], redo: [] as Stroke[], active: new Map<string, Stroke>(),
    sm: new Map<string, [number, number]>(), drawing: new Set<string>(), cursors: [] as { x: number; y: number; down: boolean }[],
  });

  const sync = () => setCounts({ undo: store.current.strokes.length, redo: store.current.redo.length });
  const rebuild = useCallback(() => {
    const s = store.current; const ctx = s.paint.getContext('2d')!;
    ctx.clearRect(0, 0, W, H); s.strokes.forEach((st) => paint(ctx, st));
  }, []);
  const begin = (key: string, x: number, y: number) => {
    const c = cfg.current;
    store.current.active.set(key, { tool: c.tool, color: c.color, size: c.size, pts: [[x, y]] });
  };
  const extend = (key: string, x: number, y: number) => {
    const s = store.current.active.get(key); if (!s) return;
    const [lx, ly] = s.pts[s.pts.length - 1];
    const dist = Math.hypot(x - lx, y - ly);
    if (dist < 1.5) return;
    const step = Math.max(2, s.size / 2), n = Math.floor(dist / step); // coordinate interpolation
    for (let i = 1; i <= n; i++) s.pts.push([lx + ((x - lx) * i) / n, ly + ((y - ly) * i) / n]);
    if (n === 0) s.pts.push([x, y]);
  };
  const finish = (key: string) => {
    const st = store.current; const s = st.active.get(key); if (!s) return;
    st.active.delete(key); st.strokes.push(s); st.redo = [];
    paint(st.paint.getContext('2d')!, s); sync();
  };

  useEffect(() => {
    const st = store.current; st.paint.width = st.tmp.width = W; st.paint.height = st.tmp.height = H;
    const c = disp.current!; const ctx = c.getContext('2d')!; const tctx = st.tmp.getContext('2d')!;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!vis.current) return;
      const cf = cfg.current; st.cursors = [];
      if (tracker.status === 'running') {
        const hands = cf.dual ? tracker.frame.hands.slice(0, 2) : tracker.frame.hands.slice(0, 1);
        const seen = new Set<string>();
        for (const h of hands) {
          const key = h.label; seen.add(key);
          const tx = (1 - h.lm[8].x) * W, ty = h.lm[8].y * H;
          const prev = st.sm.get(key); const a = 1 - cf.stab * 0.92;
          const cur: [number, number] = prev ? [prev[0] + (tx - prev[0]) * a, prev[1] + (ty - prev[1]) * a] : [tx, ty];
          st.sm.set(key, cur);
          const was = st.drawing.has(key);
          if (!was && h.pinch < 0.28) { st.drawing.add(key); begin(key, cur[0], cur[1]); }
          else if (was && h.pinch > 0.42) { st.drawing.delete(key); finish(key); }
          else if (was) extend(key, cur[0], cur[1]);
          st.cursors.push({ x: cur[0], y: cur[1], down: st.drawing.has(key) });
        }
        for (const k of [...st.drawing]) if (!seen.has(k)) { st.drawing.delete(k); finish(k); } // hand left the frame
        for (const k of [...st.sm.keys()]) if (!seen.has(k)) st.sm.delete(k);
      }
      tctx.clearRect(0, 0, W, H); tctx.drawImage(st.paint, 0, 0);
      st.active.forEach((s) => paint(tctx, s));
      ctx.fillStyle = BGS[cf.bg]; ctx.fillRect(0, 0, W, H);
      if (cf.showCam && tracker.status === 'running') { ctx.save(); ctx.globalAlpha = 0.3; ctx.scale(-1, 1); ctx.drawImage(tracker.video, -W, 0, W, H); ctx.restore(); }
      ctx.drawImage(st.tmp, 0, 0);
      for (const cu of st.cursors) {
        ctx.beginPath(); ctx.arc(cu.x, cu.y, Math.max(8, cf.size), 0, 7);
        ctx.lineWidth = 2; ctx.strokeStyle = cf.tool === 'eraser' ? '#F87171' : cf.color; ctx.stroke();
        if (cu.down) { ctx.fillStyle = cf.tool === 'eraser' ? 'rgba(248,113,113,.3)' : cf.color + '55'; ctx.fill(); }
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  // mouse / touch / pen fallback
  const pt = (e: RPE) => { const r = disp.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const; };
  const down = (e: RPE) => { e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = pt(e); begin('ptr', x, y); };
  const move = (e: RPE) => { if (store.current.active.has('ptr')) { const [x, y] = pt(e); extend('ptr', x, y); } };
  const up = () => finish('ptr');

  const undo = () => { const s = store.current; const x = s.strokes.pop(); if (x) { s.redo.push(x); rebuild(); sync(); } };
  const redo = () => { const s = store.current; const x = s.redo.pop(); if (x) { s.strokes.push(x); rebuild(); sync(); } };
  const clear = () => {
    if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
    const s = store.current; s.strokes = []; s.redo = []; rebuild(); sync(); setConfirm(false);
  };
  const exportPng = (transparent = false) => {
    const o = document.createElement('canvas'); o.width = W; o.height = H; const x = o.getContext('2d')!;
    if (!transparent) { x.fillStyle = BGS[bg]; x.fillRect(0, 0, W, H); }
    x.drawImage(store.current.paint, 0, 0);
    o.toBlob((b) => b && downloadBlob(b, `air-canvas-${Date.now()}.png`), 'image/png');
  };
  const saveProject = () => downloadText(JSON.stringify({ app: 'NOTHING Air Canvas', v: 1, w: W, h: H, bg, strokes: store.current.strokes }), `air-canvas-${Date.now()}.nothing.json`, 'application/json');
  const loadProject = async (f?: File) => {
    if (!f) return;
    try {
      const d = JSON.parse(await f.text()) as { app?: string; strokes?: Stroke[]; bg?: keyof typeof BGS };
      if (d.app !== 'NOTHING Air Canvas' || !Array.isArray(d.strokes)) throw new Error('bad file');
      store.current.strokes = d.strokes; store.current.redo = []; if (d.bg && d.bg in BGS) setBg(d.bg); rebuild(); sync();
    } catch { window.alert('That file is not a NOTHING Air Canvas project.'); }
  };
  const fileIn = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const st = tr.status;
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3 xl:flex-row">
      <div className="relative flex min-h-[220px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-line bg-bg">
        <canvas ref={disp} width={W} height={H} className="max-h-full max-w-full cursor-crosshair touch-none" aria-label="Drawing canvas"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {handsOn && st === 'needs-model' && <div className="absolute inset-0 overflow-auto bg-panel"><HandModelSetup /></div>}
        {handsOn && st === 'error' && <div className="absolute inset-0 grid place-items-center bg-panel p-6 text-center text-xs"><div><p className="mb-3 text-red-400">{tr.error}</p><Button onClick={() => tr.retry()}>Retry</Button></div></div>}
        <div className="pointer-events-none absolute bottom-2 left-2 flex gap-1.5">
          {st === 'running' && <Badge tone="ok">hand tracking · {tr.fps.toFixed(0)} fps</Badge>}
          {st === 'loading' && <Badge>loading…</Badge>}
          <Badge>{handsOn ? 'pinch to draw' : 'mouse / touch'}</Badge>
        </div>
      </div>
      <div className="w-full shrink-0 space-y-3 overflow-auto xl:w-72">
        <Panel className="space-y-2 p-3">
          <Button variant={handsOn ? 'danger' : 'primary'} className="w-full" onClick={() => setHandsOn(!handsOn)}>{handsOn ? <><CameraOff size={14} />Stop hand tracking</> : <><Camera size={14} />Enable hand tracking</>}</Button>
          <Toggle label="Camera ghost" checked={showCam} onChange={setShowCam} />
          <Toggle label="Dual-hand drawing" hint="Both hands draw independently" checked={dual} onChange={setDual} />
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-medium">
            <span>Hand recognition</span>
            <Badge tone={st === 'running' ? 'ok' : st === 'error' ? 'error' : 'neutral'}>{st === 'running' ? 'camera live' : handsOn ? st : 'camera off'}</Badge>
          </div>
          <Stat label="Detection rate" value={st === 'running' ? `${tr.fps.toFixed(1)} fps` : '—'} />
          {st === 'running' && tr.frame.hands.map((h) => (
            <div key={h.label} className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium"><span>{h.label} hand</span><Badge tone="accent">{GESTURE_LABEL[h.gesture]}</Badge></div>
              <Stat label="Fingers up" value={h.fingers} />
              <Stat label="Confidence" value={`${(h.score * 100).toFixed(0)}%`} />
              <ProgressBar value={h.score} />
              <Stat label="Pinch ratio" value={h.pinch.toFixed(2)} />
            </div>
          ))}
          {st === 'running' && !tr.frame.hands.length && <p className="text-[11px] text-muted">No hand in view.</p>}
        </Panel>
        <Panel className="space-y-3 p-3">
          <div className="flex flex-wrap gap-1">{TOOLS.map((t) => <button key={t.id} onClick={() => setTool(t.id)} className={cn('flex min-h-9 items-center gap-1 rounded border px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', tool === t.id ? 'border-accent text-accent' : 'border-line text-muted hover:text-fg')}>{t.id === 'eraser' && <Eraser size={12} />}{t.label}</button>)}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {SWATCHES.map((c) => <button key={c} aria-label={`Color ${c}`} onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }} className={cn('h-9 w-9 shrink-0 rounded-full border-2', color === c ? 'border-fg' : 'border-transparent')} style={{ background: c }} />)}
            <input type="color" aria-label="Custom color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line bg-transparent" />
          </div>
          <Slider label="Brush size" value={size} min={2} max={40} onChange={setSize} />
          <Slider label="Stabilization" value={stab} min={0} max={0.95} step={0.05} onChange={setStab} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Segmented value={bg} onChange={setBg} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'paper', label: 'Paper' }]} />
        </Panel>
        <Panel className="grid grid-cols-2 gap-1.5 p-3">
          <Button onClick={undo} disabled={!counts.undo}><Undo2 size={13} />Undo</Button>
          <Button onClick={redo} disabled={!counts.redo}><Redo2 size={13} />Redo</Button>
          <Button variant="danger" className="col-span-2" onClick={clear} disabled={!counts.undo && !confirm}><Trash2 size={13} />{confirm ? 'Click again to confirm' : 'Clear canvas'}</Button>
          <Button onClick={() => exportPng()}><Download size={13} />PNG</Button>
          <Button onClick={() => exportPng(true)}>PNG (alpha)</Button>
          <Button onClick={saveProject} disabled={!counts.undo}><Save size={13} />Project</Button>
          <Button onClick={() => fileIn.current?.click()}><FileUp size={13} />Open</Button>
          <input ref={fileIn} type="file" accept=".json,application/json" hidden onChange={(e) => { void loadProject(e.target.files?.[0]); e.target.value = ''; }} />
        </Panel>
      </div>
    </div>
  );
}
