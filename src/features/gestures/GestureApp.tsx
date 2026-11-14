import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Crosshair } from 'lucide-react';
import { useDesktop, useNotify, useSettings } from '../../app/AppProvider';
import { Badge, Button, Panel, ProgressBar, Select, Slider, Stat } from '../../components/common/ui';
import { useVisible } from '../../components/windows/visibility';
import { ACTION_LABEL, GESTURE_LABEL, TRIGGER_LABEL, type Gesture, type GestureAction, type GestureTrigger } from '../../lib/gestures';
import { tracker, useTracker } from '../../services/vision/tracker';
import { HandModelSetup } from '../model-center/HandModelSetup';
import { cn } from '../../lib/format';

const PANELS = ['Alpha', 'Beta', 'Gamma'];
const TILES = ['A', 'B', 'C', 'D', 'E', 'F'];
interface Ev { id: number; t: number; text: string }

export default function GestureApp() {
  const { settings, update } = useSettings(); const notify = useNotify(); const desk = useDesktop();
  const [on, setOn] = useState(false);
  const tr = useTracker(on);
  const visible = useVisible(); const vis = useRef(visible); vis.current = visible;
  const [slide, setSlide] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [history, setHistory] = useState<Ev[]>([]);
  const [paused, setPaused] = useState(false);
  const [ring, setRing] = useState(0.5);
  const [calib, setCalib] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null); const ptr = useRef<HTMLDivElement>(null);

  const log = (text: string) => setHistory((h) => [{ id: Date.now() + Math.random(), t: Date.now(), text }, ...h].slice(0, 14));
  const perform = (a: GestureAction, why: string) => {
    log(`${why} → ${ACTION_LABEL[a]}`);
    switch (a) {
      case 'notify': notify('Gesture action', `${why} triggered a notification.`, 'ok'); break;
      case 'toggle_theme': update({ theme: settings.theme === 'dark' ? 'light' : 'dark' }); break;
      case 'open_launcher': desk.setLauncher(true); break;
      case 'next_slide': setSlide((s) => (s + 1) % PANELS.length); break;
      case 'prev_slide': setSlide((s) => (s + PANELS.length - 1) % PANELS.length); break;
      case 'reset_visual': setRing(0.5); break;
      default: break;
    }
  };

  // latest-value refs for the render loop
  const live = useRef({ settings, perform, hover, calib }); live.current = { settings, perform, hover, calib };
  const mouse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let raf = 0; let pos = { x: 0.5, y: 0.5 }; let prevG: Gesture = 'unknown'; let pausedNow = false; let hov: string | null = null;
    let lastSwipe = 0; let fistSince = 0; let fistFired = false; const trail: { t: number; x: number }[] = [];
    let cal: { until: number; minX: number; maxX: number; minY: number; maxY: number } | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!vis.current) return;
      const L = live.current; const now = performance.now(); const s = L.settings;
      const hands = tracker.status === 'running' ? tracker.frame.hands : [];
      const h = hands[0];
      if (h) {
        const nx = 1 - h.lm[8].x, ny = h.lm[8].y;
        if (L.calib !== null && !cal) cal = { until: now + 5000, minX: 1, maxX: 0, minY: 1, maxY: 0 };
        if (cal) {
          cal.minX = Math.min(cal.minX, nx); cal.maxX = Math.max(cal.maxX, nx); cal.minY = Math.min(cal.minY, ny); cal.maxY = Math.max(cal.maxY, ny);
          setCalib(Math.max(0, Math.ceil((cal.until - now) / 1000)));
          if (now > cal.until) {
            if (cal.maxX - cal.minX > 0.15 && cal.maxY - cal.minY > 0.1) { update({ calibration: { minX: cal.minX, maxX: cal.maxX, minY: cal.minY, maxY: cal.maxY } }); notify('Calibration saved', 'Pointer range updated from your hand movement.', 'ok'); }
            else notify('Calibration too small', 'Move your index finger to all four corners of your comfortable range.', 'warn');
            cal = null; setCalib(null);
          }
        }
        const c = s.calibration;
        const ux = (nx - c.minX) / Math.max(0.05, c.maxX - c.minX), uy = (ny - c.minY) / Math.max(0.05, c.maxY - c.minY);
        const tx = Math.min(1, Math.max(0, 0.5 + (ux - 0.5) * s.sensitivity)), ty = Math.min(1, Math.max(0, 0.5 + (uy - 0.5) * s.sensitivity));
        pos = { x: pos.x + (tx - pos.x) * 0.35, y: pos.y + (ty - pos.y) * 0.35 };
        const g = h.gesture;
        const isPaused = g === 'open_palm';
        if (isPaused !== pausedNow) { pausedNow = isPaused; setPaused(isPaused); }
        if (!isPaused) {
          if (g === 'pinch' && prevG !== 'pinch' && hov) { const id = hov; setSelected((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id])); L.perform('none', `Pinch select ${id}`); }
          if (g === 'fist') { if (!fistSince) fistSince = now; else if (!fistFired && now - fistSince > 350) { fistFired = true; L.perform(s.gestureMap.fist, 'Fist'); } }
          else { fistSince = 0; fistFired = false; }
          if (g === 'peace' && prevG !== 'peace') L.perform(s.gestureMap.peace, 'Two fingers');
        }
        // swipe: horizontal palm travel over ~350 ms (works in any state except pinch)
        const px = 1 - h.lm[9].x; trail.push({ t: now, x: px }); while (trail.length && now - trail[0].t > 350) trail.shift();
        if (g !== 'pinch' && now - lastSwipe > 900 && trail.length > 4) {
          const dx = px - trail[0].x;
          if (Math.abs(dx) > 0.3) { lastSwipe = now; trail.length = 0; const trig: GestureTrigger = dx > 0 ? 'swipe_right' : 'swipe_left'; L.perform(s.gestureMap[trig], TRIGGER_LABEL[trig]); }
        }
        prevG = g;
        if (hands.length === 2) { const a = hands[0].lm[8], b = hands[1].lm[8]; setRing((r) => r + (Math.min(1, Math.hypot(a.x - b.x, a.y - b.y) / 0.8) - r) * 0.2); }
      } else if (mouse.current) { pos = mouse.current; }
      // position pointer + hit-test tiles
      const el = stage.current, p = ptr.current;
      if (el && p && (h || mouse.current)) {
        const r = el.getBoundingClientRect(); p.style.transform = `translate(${pos.x * r.width}px, ${pos.y * r.height}px)`; p.style.opacity = pausedNow ? '0.3' : '1';
        const X = r.left + pos.x * r.width, Y = r.top + pos.y * r.height;
        let found: string | null = null;
        el.querySelectorAll<HTMLElement>('[data-tile]').forEach((t) => { const b = t.getBoundingClientRect(); if (X >= b.left && X <= b.right && Y >= b.top && Y <= b.bottom) found = t.dataset.tile ?? null; });
        if (found !== hov) { hov = found; setHover(found); }
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = tr.status;
  const startCal = () => { setCalib(5); notify('Calibration started', 'Show your hand and move your index finger around your comfortable range for 5 seconds.'); };
  const rows: GestureTrigger[] = ['fist', 'peace', 'swipe_left', 'swipe_right'];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3 xl:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div ref={stage} className="relative min-h-[260px] min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-bg"
          onMouseMove={(e) => { if (st === 'running') return; const r = e.currentTarget.getBoundingClientRect(); mouse.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }}
          onClick={() => { if (st !== 'running' && hover) setSelected((a) => (a.includes(hover) ? a.filter((x) => x !== hover) : [...a, hover])); }}>
          <div className="absolute left-3 top-3 flex items-center gap-2 text-xs"><Badge tone="accent">Panel {PANELS[slide]}</Badge>{paused && <Badge tone="warn">paused (open palm)</Badge>}</div>
          <div className="mx-auto grid h-full max-w-xl grid-cols-3 content-center gap-3 p-10">
            {TILES.map((t) => (
              <div key={t} data-tile={`${PANELS[slide][0]}${t}`} className={cn('grid aspect-video place-items-center rounded-lg border text-sm transition',
                selected.includes(`${PANELS[slide][0]}${t}`) ? 'border-accent bg-accent/20 text-accent' : hover === `${PANELS[slide][0]}${t}` ? 'border-accent/70 bg-fg/5' : 'border-line text-muted')}>{PANELS[slide][0]}{t}</div>))}
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-[11px] text-muted">
            <div className="mx-auto mb-1 rounded-full border border-accent/60 transition-all" style={{ width: 16 + ring * 120, height: 16 + ring * 120 }} />
            Two-hand spread: {(ring * 100).toFixed(0)}%
          </div>
          <div ref={ptr} className="pointer-events-none absolute left-0 top-0 opacity-0"><Crosshair size={26} className="-ml-[13px] -mt-[13px] text-accent" /></div>
          {on && st === 'needs-model' && <div className="absolute inset-0 overflow-auto bg-panel"><HandModelSetup /></div>}
          {on && st === 'error' && <div className="absolute inset-0 grid place-items-center bg-panel p-6 text-center text-xs"><div><p className="mb-3 text-red-400">{tr.error}</p><Button onClick={() => tr.retry()}>Retry</Button></div></div>}
          {!on && <div className="pointer-events-none absolute inset-x-0 bottom-12 text-center text-[11px] text-muted">Hand tracking is off — the mouse works as the pointer.</div>}
        </div>
        <p className="text-[11px] leading-relaxed text-muted">Point: move pointer · Pinch: select · Open palm: pause · Fist (hold): mapped action · Swipe: navigate · Two hands: spread control. Everything stays inside this app — no OS commands are ever executed.</p>
      </div>
      <div className="w-full shrink-0 space-y-3 overflow-auto xl:w-72">
        <Panel className="space-y-2 p-3">
          <Button variant={on ? 'danger' : 'primary'} className="w-full" onClick={() => setOn(!on)}>{on ? <><CameraOff size={14} />Disable gesture control</> : <><Camera size={14} />Enable gesture control</>}</Button>
          <Slider label="Pointer sensitivity" value={settings.sensitivity} min={0.6} max={2.5} step={0.1} onChange={(v) => update({ sensitivity: v })} fmt={(v) => `${v.toFixed(1)}×`} />
          <Button className="w-full" onClick={startCal} disabled={st !== 'running' || calib !== null}>{calib !== null ? `Calibrating… ${calib}s` : 'Calibrate pointer range'}</Button>
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-medium">
            <span>Live recognition</span>
            <Badge tone={st === 'running' ? 'ok' : st === 'error' ? 'error' : 'neutral'}>{st === 'running' ? 'camera live' : st}</Badge>
          </div>
          <Stat label="Detection rate" value={st === 'running' ? `${tr.fps.toFixed(1)} fps` : '—'} />
          {st === 'running' && tr.frame.hands.map((h) => (
            <div key={h.label} className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium">
                <span>{h.label} hand</span><Badge tone="accent">{GESTURE_LABEL[h.gesture]}</Badge>
              </div>
              <Stat label="Fingers up" value={h.fingers} />
              <Stat label="Confidence" value={`${(h.score * 100).toFixed(0)}%`} />
              <ProgressBar value={h.score} />
              <Stat label="Pinch ratio" value={h.pinch.toFixed(2)} />
            </div>
          ))}
          {st === 'running' && tr.frame.hands.length === 0 && <p className="text-[11px] text-muted">No hand in view.</p>}
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="text-xs font-medium">Gesture mappings</div>
          {rows.map((r) => (
            <label key={r} className="block text-[11px] text-muted">{TRIGGER_LABEL[r]}
              <Select value={settings.gestureMap[r]} onChange={(e) => update({ gestureMap: { ...settings.gestureMap, [r]: e.target.value as GestureAction } })} className="mt-0.5">
                {(Object.keys(ACTION_LABEL) as GestureAction[]).map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
              </Select></label>))}
        </Panel>
        <Panel className="p-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium"><span>Recognition history</span><button className="text-[11px] text-muted hover:text-fg" onClick={() => setHistory([])}>clear</button></div>
          <ul className="max-h-56 space-y-1 overflow-auto text-[11px]">
            {history.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-x-2 gap-y-1 rounded-md bg-surface px-2 py-1.5"><span className="min-w-0 break-words">{e.text}</span><span className="shrink-0 font-mono text-muted">{new Date(e.t).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}</span></li>)}
            {!history.length && <li className="text-muted">No gestures recognized yet. Current: {tr.status === 'running' && tr.frame.hands[0] ? GESTURE_LABEL[tr.frame.hands[0].gesture] : '—'}</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
