import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ShieldCheck } from 'lucide-react';
import { Badge, Button, Panel, ProgressBar, Stat, Toggle } from '../../components/common/ui';
import { useVisible } from '../../components/windows/visibility';
import { GESTURE_LABEL } from '../../lib/gestures';
import { HAND_CONNECTIONS, tracker, useTracker, type Hand } from '../../services/vision/tracker';
import { HandModelSetup } from '../model-center/HandModelSetup';

export default function VisionApp() {
  const [on, setOn] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [showLm, setShowLm] = useState(true);
  const tr = useTracker(on);
  const visible = useVisible();
  const vis = useRef(visible); vis.current = visible;
  const opts = useRef({ showVideo, showLm }); opts.current = { showVideo, showLm };
  const cv = useRef<HTMLCanvasElement>(null);
  const [hands, setHands] = useState<Hand[]>([]);

  useEffect(() => {
    const c = cv.current; const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!vis.current) return;
      const v = tracker.video;
      const W = v.videoWidth || 1280, H = v.videoHeight || 720;
      if (c.width !== W) { c.width = W; c.height = H; }
      ctx.fillStyle = '#080B10'; ctx.fillRect(0, 0, W, H);
      if (tracker.status !== 'running') return;
      if (opts.current.showVideo) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(v, -W, 0, W, H); ctx.restore(); }
      if (!opts.current.showLm) return;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(56,232,218,.9)'; ctx.fillStyle = '#E5E7EB';
      for (const h of tracker.frame.hands) {
        ctx.beginPath();
        for (const { start, end } of HAND_CONNECTIONS) { ctx.moveTo((1 - h.lm[start].x) * W, h.lm[start].y * H); ctx.lineTo((1 - h.lm[end].x) * W, h.lm[end].y * H); }
        ctx.stroke();
        for (const p of h.lm) { ctx.beginPath(); ctx.arc((1 - p.x) * W, p.y * H, 4, 0, 7); ctx.fill(); }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => { const t = setInterval(() => setHands(tracker.status === 'running' ? [...tracker.frame.hands] : []), 200); return () => clearInterval(t); }, []);

  const st = tr.status;
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3 xl:flex-row">
      <div className="relative flex min-h-[240px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-line bg-bg">
        <canvas ref={cv} className="max-h-full max-w-full" width={1280} height={720} aria-label="Camera preview with hand landmarks" />
        {st === 'running' && <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-bg/80 px-2 py-1 text-[11px]"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />CAMERA LIVE · processed on this device</div>}
        {st === 'idle' && (<div className="absolute inset-0 grid place-items-center text-center text-xs text-muted"><div><CameraOff className="mx-auto mb-2" />Camera is off.<br />Press “Start camera” to begin local hand tracking.</div></div>)}
        {st === 'loading' && <div className="absolute inset-0 grid place-items-center text-xs text-muted">Loading model and camera…</div>}
        {st === 'needs-model' && <div className="absolute inset-0 overflow-auto bg-panel"><HandModelSetup /></div>}
        {st === 'error' && <div className="absolute inset-0 grid place-items-center bg-panel p-6 text-center text-xs"><div><p className="mb-3 text-red-400">{tr.error}</p><Button onClick={() => tr.retry()}>Retry</Button></div></div>}
      </div>
      <div className="w-full shrink-0 space-y-3 overflow-auto xl:w-72">
        <Panel className="space-y-2 p-3">
          <Button variant={on ? 'danger' : 'primary'} className="w-full" onClick={() => setOn(!on)}>{on ? <><CameraOff size={14} />Stop camera</> : <><Camera size={14} />Start camera</>}</Button>
          <div className="flex items-start gap-1.5 text-[11px] text-muted"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" />Video never leaves this tab. Closing this window releases the camera.</div>
        </Panel>
        <Panel className="p-3">
          <Stat label="Status" value={<Badge tone={st === 'running' ? 'ok' : st === 'error' ? 'error' : 'neutral'}>{st}</Badge>} />
          <Stat label="Detections / s" value={st === 'running' ? tr.fps.toFixed(1) : '—'} />
          <Stat label="Backend" value={tr.backend || '—'} />
          <Stat label="Hands" value={hands.length} />
          <Toggle label="Show video" checked={showVideo} onChange={setShowVideo} />
          <Toggle label="Show landmarks" checked={showLm} onChange={setShowLm} />
        </Panel>
        {hands.map((h, i) => (
          <Panel key={i} className="p-3">
            <div className="mb-1 flex items-center justify-between text-xs font-medium"><span>{h.label} hand</span><Badge tone="accent">{GESTURE_LABEL[h.gesture]}</Badge></div>
            <Stat label="Fingers up" value={h.fingers} />
            <Stat label="Confidence" value={`${(h.score * 100).toFixed(0)}%`} />
            <ProgressBar value={h.score} />
            <Stat label="Pinch ratio" value={h.pinch.toFixed(2)} />
            <Stat label="Index tip" value={`${(1 - h.lm[8].x).toFixed(2)}, ${h.lm[8].y.toFixed(2)}`} />
          </Panel>))}
        {st === 'running' && hands.length === 0 && <p className="px-1 text-xs text-muted">No hand in view.</p>}
        <p className="px-1 text-[11px] leading-relaxed text-muted">Gestures are rule-based classifications computed from real MediaPipe landmarks. FPS is measured from completed detections.</p>
      </div>
    </div>
  );
}
