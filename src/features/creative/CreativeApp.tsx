import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Camera, CameraOff, Maximize, Mic, MicOff } from 'lucide-react';
import { useSettings } from '../../app/AppProvider';
import { Badge, Button, Panel, ProgressBar, Segmented, Select, Slider, Stat } from '../../components/common/ui';
import { useVisible } from '../../components/windows/visibility';
import { GESTURE_LABEL } from '../../lib/gestures';
import { tracker, useTracker } from '../../services/vision/tracker';
import { HandModelSetup } from '../model-center/HandModelSetup';

type Mode = 'wave' | 'galaxy' | 'fluid' | 'shapes';
const PRESET = { low: 4000, medium: 12000, high: 24000 } as const;
const COUNTS = [2000, 4000, 8000, 12000, 20000, 32000];
const FOV_H = 2 * 40 * Math.tan((60 * Math.PI) / 360); // visible height at z=0 with camera at z=40

function shapeTargets(n: number, kind: 0 | 1 | 2): Float32Array {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    if (kind === 0) { const k = (i + 0.5) / n, phi = Math.acos(1 - 2 * k), th = Math.PI * (1 + Math.sqrt(5)) * i; x = 14 * Math.cos(th) * Math.sin(phi); y = 14 * Math.sin(th) * Math.sin(phi); z = 14 * Math.cos(phi); }
    else if (kind === 1) { const u = (i / n) * 6.283 * 40, v = (i * 2.399) % 6.283; x = (12 + 5 * Math.cos(v)) * Math.cos(u); y = 5 * Math.sin(v); z = (12 + 5 * Math.cos(v)) * Math.sin(u); }
    else { const r = (s: number) => (Math.sin(i * s) * 43758.5453 % 1 + 1) % 1; x = (r(12.9) - 0.5) * 24; y = (r(78.2) - 0.5) * 24; z = (r(37.7) - 0.5) * 24; const f = Math.floor(r(5.1) * 3), sgn = r(9.3) > 0.5 ? 12 : -12; if (f === 0) x = sgn; else if (f === 1) y = sgn; else z = sgn; }
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
  }
  return a;
}

export default function CreativeApp() {
  const { settings } = useSettings();
  const visible = useVisible(); const vis = useRef(visible); vis.current = visible;
  const [mode, setMode] = useState<Mode>('galaxy');
  const [count, setCount] = useState<number>(PRESET[settings.quality]);
  const [speed, setSpeed] = useState(1); const [intensity, setIntensity] = useState(1); const [shape, setShape] = useState(0);
  const [handsOn, setHandsOn] = useState(false); const [audioOn, setAudioOn] = useState(false); const [audioErr, setAudioErr] = useState('');
  const [fps, setFps] = useState(0);
  const tr = useTracker(handsOn);
  const P = useRef({ mode, speed, intensity, shape }); P.current = { mode, speed, intensity, shape };
  const root = useRef<HTMLDivElement>(null); const host = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0, down: false, inside: false });
  const level = useRef(0);

  // audio reactivity (microphone only, analysed locally, never recorded or sent)
  useEffect(() => {
    if (!audioOn) { level.current = 0; return; }
    let stream: MediaStream | null = null; let ctx: AudioContext | null = null; let raf = 0; let dead = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: settings.micId ? { deviceId: { exact: settings.micId } } : true });
        if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
        ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 256; ctx.createMediaStreamSource(stream).connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        const loop = () => { raf = requestAnimationFrame(loop); an.getByteFrequencyData(data); let s = 0; for (const v of data) s += v; level.current = s / data.length / 160; };
        loop(); setAudioErr('');
      } catch (e) { setAudioErr(e instanceof Error ? e.message : String(e)); setAudioOn(false); }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); void ctx?.close(); level.current = 0; };
  }, [audioOn, settings.micId]);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.quality === 'high' ? 2 : 1));
    renderer.setClearColor(0x080b10, 1);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 300); cam.position.z = 40;

    const N = count;
    const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), base = new Float32Array(N * 3), R = new Float32Array(N), Hh = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      R[i] = Math.sqrt(Math.random()); Hh[i] = Math.random();
      const u = Math.random() * 2 - 1, th = Math.random() * 6.283, rr = Math.cbrt(Math.random()) * 18;
      base[i * 3] = rr * Math.sqrt(1 - u * u) * Math.cos(th); base[i * 3 + 1] = rr * u; base[i * 3 + 2] = rr * Math.sqrt(1 - u * u) * Math.sin(th);
      pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = (Math.random() - 0.5) * 50; pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const shapes = [shapeTargets(N, 0), shapeTargets(N, 1), shapeTargets(N, 2)];
    const geo = new THREE.BufferGeometry(); const attr = new THREE.BufferAttribute(pos, 3); attr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('position', attr);
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(settings.accent), size: 0.2, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
    const pts = new THREE.Points(geo, mat); scene.add(pts);

    const resize = () => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    const side = Math.ceil(Math.sqrt(N));
    let raf = 0, last = performance.now(), t = 0, frames = 0, fpsT = last;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!vis.current) { last = now; return; }
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const p = P.current; t += dt * p.speed;
      const A = p.intensity * (1 + level.current * 2);
      const aspect = cam.aspect;
      // interactors in world space (z = 0 plane): [x, y, sign(+attract / -repel), strength]
      const act: [number, number, number, number][] = [];
      if (tracker.status === 'running') for (const h of tracker.frame.hands) {
        act.push([(0.5 - h.lm[8].x) * FOV_H * aspect, (0.5 - h.lm[8].y) * FOV_H, h.gesture === 'open_palm' ? -1 : 1, h.gesture === 'pinch' || h.gesture === 'fist' ? 1.6 : 1]);
      }
      const m = mouse.current;
      if (m.inside) act.push([m.x * FOV_H * aspect * 0.5, m.y * FOV_H * 0.5, m.down ? 1 : -1, m.down ? 1.4 : 0.6]);
      const damp = Math.exp(-3.2 * dt), shapeT = shapes[p.shape % 3];
      for (let i = 0, j = 0; i < N; i++, j += 3) {
        let tx = 0, ty = 0, tz = 0;
        switch (p.mode) {
          case 'wave': tx = ((i % side) / side - 0.5) * 70; tz = (Math.floor(i / side) / side - 0.5) * 70; ty = Math.sin(tx * 0.25 + t * 1.5) * Math.cos(tz * 0.25 + t) * 6 * A; break;
          case 'galaxy': { const r = R[i] * 30, ang = R[i] * 7 + (i % 3) * 2.094 + (t * 0.25) / (0.4 + R[i]); tx = Math.cos(ang) * r; tz = Math.sin(ang) * r * 0.9; ty = (Hh[i] - 0.5) * 5 * (1 - R[i]) * A; break; }
          case 'fluid': tx = base[j] + Math.sin(base[j + 1] * 0.35 + t) * 4 * A; ty = base[j + 1] + Math.sin(base[j + 2] * 0.35 + t * 1.2) * 4 * A; tz = base[j + 2] + Math.sin(base[j] * 0.35 + t * 0.8) * 4 * A; break;
          default: { const b = 1 + Math.sin(t * 2 + R[i] * 3) * 0.04 * A; tx = shapeT[j] * b; ty = shapeT[j + 1] * b; tz = shapeT[j + 2] * b; }
        }
        let vx = vel[j] + (tx - pos[j]) * 6 * dt, vy = vel[j + 1] + (ty - pos[j + 1]) * 6 * dt, vz = vel[j + 2] + (tz - pos[j + 2]) * 6 * dt;
        for (const [ix, iy, sg, st] of act) {
          const dx = ix - pos[j], dy = iy - pos[j + 1], dz = -pos[j + 2], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 144 && d2 > 0.01) { const d = Math.sqrt(d2), f = ((1 - d / 12) * 140 * st * sg * dt) / d; vx += dx * f; vy += dy * f; vz += dz * f; }
        }
        vx *= damp; vy *= damp; vz *= damp;
        vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz;
        pos[j] += vx * dt; pos[j + 1] += vy * dt; pos[j + 2] += vz * dt;
      }
      attr.needsUpdate = true;
      mat.size = 0.2 * (1 + level.current * 0.8);
      if (p.mode === 'shapes') pts.rotation.y += dt * 0.3 * p.speed; else pts.rotation.y *= 0.95;
      renderer.render(scene, cam);
      frames++; if (now - fpsT >= 1000) { setFps(Math.round((frames * 1000) / (now - fpsT))); frames = 0; fpsT = now; }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.remove(pts); geo.dispose(); mat.dispose(); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, settings.accent]);

  const onMove = (e: React.PointerEvent) => { const r = e.currentTarget.getBoundingClientRect(); mouse.current.x = (e.clientX - r.left) / r.width - 0.5; mouse.current.y = 0.5 - (e.clientY - r.top) / r.height; mouse.current.inside = true; };

  return (
    <div ref={root} className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto bg-panel p-3 xl:flex-row">
      <div ref={host} className="relative min-h-[240px] min-w-0 flex-1 overflow-hidden rounded-xl border border-line"
        onPointerMove={onMove} onPointerDown={() => { mouse.current.down = true; }} onPointerUp={() => { mouse.current.down = false; }} onPointerLeave={() => { mouse.current.inside = false; mouse.current.down = false; }}>
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex gap-1.5">
          {settings.showFps && <Badge>{fps} fps</Badge>}
          {handsOn && <Badge tone={tr.status === 'running' ? 'ok' : tr.status === 'error' ? 'error' : 'neutral'}>{tr.status === 'running' ? `camera live · ${tr.frame.hands.length} hands` : tr.status}</Badge>}
          <Badge>{handsOn ? 'open palm repels · pinch attracts' : 'mouse: hover repels · hold attracts'}</Badge>
        </div>
        {handsOn && tr.status === 'needs-model' && <div className="absolute inset-0 z-20 overflow-auto bg-panel"><HandModelSetup /></div>}
        {handsOn && tr.status === 'error' && <div className="absolute inset-0 z-20 grid place-items-center bg-panel p-6 text-center text-xs"><div><p className="mb-3 text-red-400">{tr.error}</p><Button onClick={() => tr.retry()}>Retry</Button></div></div>}
      </div>
      <div className="w-full shrink-0 space-y-3 overflow-auto xl:w-72">
        <Panel className="space-y-3 p-3">
          <Segmented value={mode} onChange={setMode} options={[{ id: 'galaxy', label: 'Galaxy' }, { id: 'wave', label: 'Waves' }, { id: 'fluid', label: 'Fluid' }, { id: 'shapes', label: 'Shapes' }]} />
          {mode === 'shapes' && <Segmented value={String(shape) as '0' | '1' | '2'} onChange={(v) => setShape(Number(v))} options={[{ id: '0', label: 'Sphere' }, { id: '1', label: 'Torus' }, { id: '2', label: 'Cube' }]} />}
          <Slider label="Speed" value={speed} min={0.1} max={3} step={0.1} onChange={setSpeed} fmt={(v) => `${v.toFixed(1)}×`} />
          <Slider label="Intensity" value={intensity} min={0.2} max={3} step={0.1} onChange={setIntensity} fmt={(v) => `${v.toFixed(1)}×`} />
          <label className="block text-xs"><span className="mb-1 block text-muted">Particles</span>
            <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>{COUNTS.map((c) => <option key={c} value={c}>{c.toLocaleString()}{c <= 4000 ? ' (low-end)' : ''}</option>)}</Select></label>
        </Panel>
        <Panel className="space-y-2 p-3">
          <Button variant={handsOn ? 'danger' : 'primary'} className="w-full" onClick={() => setHandsOn(!handsOn)}>{handsOn ? <><CameraOff size={14} />Stop hand input</> : <><Camera size={14} />Use hand tracking</>}</Button>
          <Button className="w-full" onClick={() => setAudioOn(!audioOn)}>{audioOn ? <><MicOff size={14} />Stop audio reactivity</> : <><Mic size={14} />Audio reactivity</>}</Button>
          {audioErr && <p className="text-[11px] text-red-400">{audioErr}</p>}
          <Button className="w-full" onClick={() => void root.current?.requestFullscreen()}><Maximize size={14} />Full screen</Button>
          <p className="text-[11px] leading-relaxed text-muted">Particles are simulated on the CPU. Lower the particle count on weaker hardware. Microphone audio is only analysed for loudness and never stored.</p>
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-medium">
            <span>Hand recognition</span>
            <Badge tone={handsOn && tr.status === 'running' ? 'ok' : tr.status === 'error' ? 'error' : 'neutral'}>{handsOn && tr.status === 'running' ? 'camera live' : handsOn ? tr.status : 'camera off'}</Badge>
          </div>
          <Stat label="Detection rate" value={handsOn && tr.status === 'running' ? `${tr.fps.toFixed(1)} fps` : '—'} />
          {handsOn && tr.status === 'running' && tr.frame.hands.map((h) => (
            <div key={h.label} className="rounded-lg border border-line bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium"><span>{h.label} hand</span><Badge tone="accent">{GESTURE_LABEL[h.gesture]}</Badge></div>
              <Stat label="Fingers up" value={h.fingers} />
              <Stat label="Confidence" value={`${(h.score * 100).toFixed(0)}%`} />
              <ProgressBar value={h.score} />
              <Stat label="Pinch ratio" value={h.pinch.toFixed(2)} />
            </div>
          ))}
          {handsOn && tr.status === 'running' && !tr.frame.hands.length && <p className="text-[11px] text-muted">No hand in view.</p>}
        </Panel>
      </div>
    </div>
  );
}
