import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useNotify, useSettings } from '../../app/AppProvider';
import { Badge, Button, Field, Panel, Segmented, Select, Stat, Toggle } from '../../components/common/ui';
import { cn } from '../../lib/format';
import { listDevices } from '../../services/camera/camera';

const ACCENTS = ['#38E8DA', '#60A5FA', '#A78BFA', '#F472B6', '#FBBF24', '#4ADE80'];
const VERSION = '1.0.0';

export default function SettingsApp() {
  const { settings, update, reset } = useSettings(); const notify = useNotify();
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]); const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const refresh = async () => { setCams(await listDevices('videoinput')); setMics(await listDevices('audioinput')); };
  useEffect(() => { void refresh(); }, []);
  const labelled = cams.some((c) => c.label) || mics.some((m) => m.label);
  const grant = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); s.getTracks().forEach((t) => t.stop()); await refresh(); }
    catch { notify('Permission needed', 'Allow camera and microphone to list device names.', 'warn'); }
  };

  return (
    <div className="h-full min-h-0 min-w-0 space-y-3 overflow-auto p-3">
      <Panel className="space-y-3 p-3"><div className="text-xs font-medium">Appearance</div>
        <Segmented value={settings.theme} onChange={(theme) => update({ theme })} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }]} />
        <div className="flex flex-wrap items-center gap-1">{ACCENTS.map((c) => <button key={c} aria-label={`Accent ${c}`} onClick={() => update({ accent: c })} className={cn('h-9 w-9 shrink-0 rounded-full border-2', settings.accent === c ? 'border-fg' : 'border-transparent')} style={{ background: c }} />)}
          <input type="color" aria-label="Custom accent" value={settings.accent} onChange={(e) => update({ accent: e.target.value })} className="h-9 w-10 shrink-0 cursor-pointer rounded border border-line bg-transparent" /></div></Panel>
      <Panel className="space-y-3 p-3"><div className="flex items-center justify-between text-xs font-medium"><span>Devices</span>{!labelled && <Button onClick={() => void grant()}>Grant access to show names</Button>}</div>
        <Field label="Camera"><Select value={settings.cameraId} onChange={(e) => update({ cameraId: e.target.value })}><option value="">System default</option>{cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}</Select></Field>
        <Field label="Microphone"><Select value={settings.micId} onChange={(e) => update({ micId: e.target.value })}><option value="">System default</option>{mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}</Select></Field>
        <p className="text-[11px] text-muted">A camera change applies the next time a camera window starts.</p></Panel>
      <Panel className="space-y-1 p-3"><div className="mb-1 text-xs font-medium">Performance</div>
        <Field label="Default particle quality (Creative Engine)"><Select value={settings.quality} onChange={(e) => update({ quality: e.target.value as 'low' | 'medium' | 'high' })}><option value="low">Low (weaker hardware)</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
        <Toggle label="Prefer WebGPU for local models" hint="Falls back to WASM automatically" checked={settings.preferGpu} onChange={(v) => update({ preferGpu: v })} />
        <Toggle label="Show FPS counters" checked={settings.showFps} onChange={(v) => update({ showFps: v })} /></Panel>
      <Panel className="space-y-1 p-3"><div className="mb-1 text-xs font-medium">Accessibility</div>
        <Toggle label="Reduce motion" checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
        <Toggle label="Larger text" checked={settings.largeText} onChange={(v) => update({ largeText: v })} />
        <Toggle label="High contrast borders" checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} /></Panel>
      <Panel className="space-y-2 p-3"><div className="text-xs font-medium">Reset</div>
        <Button variant="danger" onClick={() => { reset(); notify('Settings reset', 'Preferences are back to defaults.'); }}><RotateCcw size={13} />Reset all preferences</Button></Panel>
      <Panel className="p-3"><div className="mb-1 text-xs font-medium">About</div>
        <Stat label="Application" value="NOTHING" /><Stat label="Version" value={<Badge tone="accent">{VERSION}</Badge>} /><Stat label="By" value="MUdevelops" />
        <p className="mt-2 text-[11px] text-muted">INTELLIGENCE WITHOUT THE CLOUD. Everything happens here. Nothing leaves your device.</p>
        <Stat label="Shortcuts" value="Ctrl+K · Alt+L · Alt+1…0 · Alt+W/M/F" /></Panel>
    </div>
  );
}
