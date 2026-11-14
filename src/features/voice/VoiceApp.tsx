import { useEffect, useRef, useState } from 'react';
import { AudioLines, Download, Loader2, Mic, Square, Trash2, Volume2 } from 'lucide-react';
import { Badge, Button, Field, Panel, ProgressBar, Segmented, Select } from '../../components/common/ui';
import { useVisible } from '../../components/windows/visibility';
import { describeMediaError } from '../../services/camera/camera';
import { useSettings } from '../../app/AppProvider';
import { downloadText } from '../../lib/format';
import { ai, type Progress } from '../../services/local-ai/client';
import { byTask } from '../../services/models/catalog';
import { useInstalled } from '../../services/models/useInstalled';
import { ModelRequired } from '../model-center/ModelRequired';

interface Item { id: number; kind: 'speech' | 'sound'; text: string; model: string; ms: number; t: number }

async function decode(blob: Blob): Promise<Float32Array> {
  const ac = new AudioContext({ sampleRate: 16000 });
  try { return (await ac.decodeAudioData(await blob.arrayBuffer())).getChannelData(0).slice(); } finally { void ac.close(); }
}

export default function VoiceApp() {
  const { settings } = useSettings();
  const visible = useVisible(); const vis = useRef(visible); vis.current = visible;
  const { installed } = useInstalled();
  const [mode, setMode] = useState<'speech' | 'sound'>('speech');
  const models = byTask(mode === 'speech' ? 'automatic-speech-recognition' : 'audio-classification');
  const [modelIdx, setModelIdx] = useState(0);
  const model = models[Math.min(modelIdx, models.length - 1)];
  const [rec, setRec] = useState(false); const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null); const [url, setUrl] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [prog, setProg] = useState<Progress | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]); const [voiceName, setVoiceName] = useState(''); const [speakText, setSpeakText] = useState('');
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ rec: MediaRecorder; stream: MediaStream; ctx: AudioContext; raf: number; timer: number } | null>(null);

  const teardown = () => {
    const l = live.current; if (!l) return;
    cancelAnimationFrame(l.raf); clearInterval(l.timer);
    if (l.rec.state !== 'inactive') l.rec.stop();
    l.stream.getTracks().forEach((t) => t.stop()); void l.ctx.close(); live.current = null;
  };
  useEffect(() => () => { teardown(); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    const s = window.speechSynthesis; if (!s) return;
    const load = () => { const v = s.getVoices().filter((x) => x.localService); setVoices(v); setVoiceName((n) => n || v[0]?.name || ''); };
    load(); s.addEventListener('voiceschanged', load); return () => s.removeEventListener('voiceschanged', load);
  }, []);

  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: settings.micId ? { deviceId: { exact: settings.micId } } : true });
      const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
      const chunks: Blob[] = []; const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => { const b = new Blob(chunks, { type: mr.mimeType }); setBlob(b); setUrl(URL.createObjectURL(b)); };
      mr.start(); setSecs(0); setBlob(null); setUrl('');
      const data = new Uint8Array(an.fftSize); const c = cv.current;
      const draw = () => {
        if (!live.current) return; live.current.raf = requestAnimationFrame(draw);
        if (!vis.current || !c) return; const g = c.getContext('2d')!; an.getByteTimeDomainData(data);
        g.clearRect(0, 0, c.width, c.height); g.strokeStyle = '#38E8DA'; g.lineWidth = 2; g.beginPath();
        data.forEach((v, i) => { const x = (i / data.length) * c.width, y = (v / 255) * c.height; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      };
      live.current = { rec: mr, stream, ctx, raf: 0, timer: window.setInterval(() => setSecs((s) => s + 1), 1000) };
      draw(); setRec(true);
    } catch (e) { setErr(describeMediaError(e)); }
  };
  const stop = () => { teardown(); setRec(false); };

  const run = async () => {
    if (!blob || busy) return;
    setBusy(true); setErr(''); setProg(null);
    try {
      const audio = await decode(blob);
      const task = mode === 'speech' ? 'automatic-speech-recognition' : 'audio-classification';
      const r = await ai.run(task, model.id, mode === 'speech' ? [audio, { chunk_length_s: 30 }] : [audio, { top_k: 5 }], setProg, [audio.buffer]);
      const text = mode === 'speech' ? String((r.result as { text?: string }).text ?? '').trim()
        : (r.result as { label: string; score: number }[]).map((x) => `${x.label} ${(x.score * 100).toFixed(1)}%`).join(', ');
      setItems((l) => [{ id: Date.now(), kind: mode, text: text || '(no speech detected)', model: model.id, ms: r.ms, t: Date.now() }, ...l]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false); setProg(null);
  };

  const speak = (text: string) => {
    const s = window.speechSynthesis; if (!s || !text.trim()) return; s.cancel();
    const u = new SpeechSynthesisUtterance(text); const v = voices.find((x) => x.name === voiceName); if (v) u.voice = v; s.speak(u);
  };

  const ready = installed[model.id];
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3 xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Panel className="space-y-3 p-3">
          <div className="flex items-center justify-between"><Segmented value={mode} onChange={(m) => { setMode(m); setModelIdx(0); }} options={[{ id: 'speech', label: 'Transcribe' }, { id: 'sound', label: 'Classify sound' }]} />
            {rec ? <Badge tone="error">● recording {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</Badge> : <Badge>mic idle</Badge>}</div>
          <canvas ref={cv} width={600} height={90} className="h-[90px] w-full rounded-md border border-line bg-bg" aria-label="Microphone waveform" />
          <div className="flex flex-wrap items-center gap-2">
            {!rec ? <Button variant="primary" onClick={() => void start()}><Mic size={13} />Record</Button> : <Button variant="danger" onClick={stop}><Square size={13} />Stop</Button>}
            {url && <audio controls src={url} className="h-8 flex-1" />}
          </div>
          <p className="text-[11px] text-muted">Audio is recorded in memory only and never uploaded. The microphone is released when you stop or close this window.</p>
        </Panel>
        {blob && (ready ? (
          <Panel className="space-y-2 p-3">
            <Button variant="primary" onClick={() => void run()} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <AudioLines size={13} />}{busy ? 'Running locally…' : mode === 'speech' ? 'Transcribe locally' : 'Classify locally'}</Button>
            {busy && prog && <div className="space-y-1"><span className="font-mono text-[11px] text-muted">{prog.status} {prog.file?.split('/').pop()}</span>{prog.progress != null && <ProgressBar value={prog.progress / 100} />}</div>}
          </Panel>) : <Panel className="overflow-auto"><ModelRequired model={model} /></Panel>)}
        {!blob && !ready && <p className="px-1 text-[11px] text-muted">No local {mode === 'speech' ? 'transcription' : 'audio classification'} model is installed yet — recording works, but transcription stays unavailable until you import <span className="font-mono">{model.id}</span> (see Model Center). Browser speech recognition is deliberately not used because it can send audio to remote servers.</p>}
        {err && <p className="rounded border border-red-500/40 bg-red-500/10 p-2 font-mono text-[11px] text-red-300">{err}</p>}
      </div>
      <div className="flex w-full shrink-0 flex-col gap-3 xl:w-72">
        <Panel className="space-y-2 p-3"><Field label="Model"><Select value={modelIdx} onChange={(e) => setModelIdx(Number(e.target.value))}>{models.map((m, i) => <option key={m.id} value={i}>{m.label}{installed[m.id] ? ' ✓' : ' (not installed)'}</option>)}</Select></Field></Panel>
        <Panel className="flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium"><span>History ({items.length})</span>
            <span className="flex gap-1"><Button variant="ghost" disabled={!items.length} onClick={() => downloadText(items.map((i) => `[${new Date(i.t).toLocaleString()}] (${i.kind}) ${i.text}`).join('\n'), 'transcriptions.txt')}><Download size={12} />TXT</Button>
              <Button variant="ghost" disabled={!items.length} onClick={() => downloadText(JSON.stringify(items, null, 2), 'transcriptions.json', 'application/json')}>JSON</Button>
              <Button variant="ghost" disabled={!items.length} aria-label="Clear" onClick={() => setItems([])}><Trash2 size={12} /></Button></span></div>
          <ul className="max-h-60 min-h-0 flex-1 space-y-2 overflow-auto">
            {items.map((i) => (<li key={i.id} className="rounded border border-line bg-surface p-2 text-xs"><div className="mb-1 font-mono text-[10px] text-muted">{i.kind} · {i.ms.toFixed(0)} ms</div>{i.text}
              <button onClick={() => { setSpeakText(i.text); speak(i.text); }} className="ml-2 inline-flex text-muted hover:text-accent" aria-label="Read aloud"><Volume2 size={12} /></button></li>))}
            {!items.length && <li className="text-[11px] text-muted">Results from the local model appear here.</li>}
          </ul>
        </Panel>
        <Panel className="space-y-2 p-3">
          <div className="text-xs font-medium">Text to speech</div>
          {voices.length ? (<>
            <Select value={voiceName} onChange={(e) => setVoiceName(e.target.value)} aria-label="Voice">{voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</Select>
            <textarea value={speakText} onChange={(e) => setSpeakText(e.target.value)} placeholder="Text to speak…" className="h-16 w-full resize-none rounded-md border border-line bg-surface p-2 text-xs outline-none focus:border-accent" />
            <div className="flex gap-2"><Button onClick={() => speak(speakText)}><Volume2 size={12} />Speak</Button><Button variant="ghost" onClick={() => window.speechSynthesis.cancel()}>Stop</Button></div>
          </>) : <p className="text-[11px] text-muted">No on-device system voices were reported by this browser. Remote (network) voices are intentionally not offered.</p>}
        </Panel>
      </div>
    </div>
  );
}
