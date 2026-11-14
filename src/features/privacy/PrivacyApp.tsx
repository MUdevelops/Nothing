import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useNotify, useSettings } from '../../app/AppProvider';
import { Badge, Button, Panel, Stat } from '../../components/common/ui';
import { downloadText } from '../../lib/format';
import { useAi } from '../../services/local-ai/client';
import { clearAllModelCaches } from '../../services/models/store';
import { SETTINGS_KEY } from '../../services/storage/settings';
import { useTracker } from '../../services/vision/tracker';

type Perm = PermissionState | 'unsupported';
const tone = (p: Perm) => (p === 'granted' ? 'ok' : p === 'denied' ? 'error' : 'neutral') as 'ok' | 'error' | 'neutral';

async function query(name: string): Promise<Perm> {
  try { return (await navigator.permissions.query({ name: name as PermissionName })).state; } catch { return 'unsupported'; }
}

export default function PrivacyApp() {
  const notify = useNotify(); const { reset } = useSettings();
  const tr = useTracker(false); const ai = useAi();
  const [cam, setCam] = useState<Perm>('prompt'); const [mic, setMic] = useState<Perm>('prompt');
  const [online, setOnline] = useState(navigator.onLine);
  const [external, setExternal] = useState<string[]>([]);

  const scan = useCallback(() => {
    const own = location.origin;
    const hosts = new Set<string>();
    for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) { try { const u = new URL(e.name); if (u.origin !== own && u.protocol.startsWith('http')) hosts.add(u.origin); } catch { /* ignore */ } }
    setExternal([...hosts]);
  }, []);

  useEffect(() => {
    void query('camera').then(setCam); void query('microphone').then(setMic); scan();
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const t = setInterval(() => { void query('camera').then(setCam); void query('microphone').then(setMic); scan(); }, 3000);
    return () => { clearInterval(t); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [scan]);

  const exportPrefs = () => downloadText(localStorage.getItem(SETTINGS_KEY) ?? '{}', 'nothing-preferences.json', 'application/json');

  return (
    <div className="h-full min-h-0 min-w-0 space-y-3 overflow-auto p-3">
      <Panel className="p-3 text-xs leading-relaxed text-muted">
        <div className="mb-1 text-sm font-medium text-fg">What “local” means here</div>
        Inference runs in your browser (WebGL / WebGPU / WASM) on model files you supplied. There is no NOTHING server, no database, no account, no analytics and no AI API. Optional network requests exist only where you press a button (for example downloading the hand model weights) — they are listed below if they happened this session.
      </Panel>
      <div className="grid gap-3 md:grid-cols-2">
        <Panel className="p-3"><div className="mb-1 text-xs font-medium">Permissions</div>
          <Stat label="Camera" value={<Badge tone={tone(cam)}>{cam}</Badge>} /><Stat label="Microphone" value={<Badge tone={tone(mic)}>{mic}</Badge>} />
          <Stat label="Camera in use now" value={<Badge tone={tr.status === 'running' ? 'error' : 'neutral'}>{tr.status === 'running' ? 'yes — local hand tracking' : 'no'}</Badge>} />
          <p className="mt-1 text-[11px] text-muted">Permission state is read from the browser; change it in your browser’s site settings.</p></Panel>
        <Panel className="p-3"><div className="mb-1 text-xs font-medium">Inference</div>
          <Stat label="Vision engine" value={tr.backend || 'idle'} /><Stat label="Hand tracker" value={tr.status} />
          <Stat label="Text/audio/image engine" value={ai.loaded.size ? [...new Set(ai.loaded.values())].join(', ') : 'idle'} />
          <Stat label="Processing" value={ai.busy ? 'inference running' : 'idle'} /></Panel>
      </div>
      <Panel className="p-3"><div className="mb-1 text-xs font-medium">Models loaded locally ({ai.loaded.size})</div>
        {ai.loaded.size ? <ul className="space-y-0.5 font-mono text-[11px]">{[...ai.loaded].map(([k, b]) => <li key={k}>{k.split('|')[1]} <span className="text-muted">({k.split('|')[0]}, {b})</span></li>)}</ul> : <p className="text-[11px] text-muted">No Transformers.js model is loaded in memory.</p>}</Panel>
      <Panel className="p-3"><div className="mb-1 flex items-center justify-between text-xs font-medium"><span>Network</span><Badge tone={online ? 'neutral' : 'ok'}>{online ? 'online' : 'offline'}</Badge></div>
        <p className="mb-1 text-[11px] text-muted">Cross-origin resources requested by this page this session (from the browser’s resource timing log):</p>
        {external.length ? <ul className="space-y-1 font-mono text-[11px] text-amber-300">{external.map((h) => <li key={h} className="break-all">{h}</li>)}</ul> : <p className="text-[11px] text-emerald-400">None observed.</p>}
        <p className="mt-1 text-[11px] text-muted">Note: this log cannot show requests made by browser extensions or the browser itself, and fetches that bypass resource timing may not appear.</p></Panel>
      <Panel className="space-y-2 p-3"><div className="text-xs font-medium">Data controls</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportPrefs}><Download size={13} />Export preferences</Button>
          <Button variant="danger" onClick={() => { reset(); notify('Preferences cleared', 'Settings were reset to defaults.'); }}><Trash2 size={13} />Clear stored preferences</Button>
          <Button variant="danger" onClick={() => void clearAllModelCaches().then(() => notify('Model cache cleared', 'Imported and cached model files were deleted.'))}><Trash2 size={13} />Clear cached model assets</Button>
        </div>
        <p className="text-[11px] text-muted">Stored data: preferences in localStorage, model files in Cache Storage. No IndexedDB, no cookies. Recordings, drawings and images exist only in memory until you export them.</p></Panel>
    </div>
  );
}
