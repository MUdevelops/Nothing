import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Camera, Cpu, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { useDesktop, useNotes } from '../../app/AppProvider';
import { APP_MAP } from '../../app/windowRegistry';
import { cn } from '../../lib/format';
import { useAi } from '../../services/local-ai/client';
import { useTracker } from '../../services/vision/tracker';
import { Logo } from '../common/Logo';
import { Button, Tip } from '../common/ui';

export function TopBar() {
  const d = useDesktop(); const { notes, clear, dismiss } = useNotes();
  const tr = useTracker(false); const ai = useAi();
  const [now, setNow] = useState(new Date()); const [open, setOpen] = useState(false); const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const cam = tr.status === 'running';
  const active = d.activeId ? APP_MAP[d.wins.find((w) => w.id === d.activeId)!.app].name : 'Desktop';

  return (
    <header className="absolute inset-x-0 top-0 z-[900] flex h-9 items-center justify-between border-b border-line bg-panel/80 px-3 text-xs backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Logo size={16} /><span className="font-medium tracking-[0.25em]">NOTHING</span>
        <span className="hidden text-muted sm:inline">/ {active}</span>
      </div>
      <div className="flex items-center gap-3">
        <Tip label={cam ? 'Camera is live — processed on this device' : 'Camera is off'}>
          <span className={cn('flex items-center gap-1', cam ? 'text-red-400' : 'text-muted')}><Camera size={13} />{cam && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}</span>
        </Tip>
        <Tip label={`${ai.loaded.size} model(s) loaded in memory${ai.busy ? ' — inference running' : ''}`}>
          <span className={cn('flex items-center gap-1', ai.busy ? 'text-accent' : 'text-muted')}><Cpu size={13} />{ai.loaded.size}</span>
        </Tip>
        <Tip label={online ? 'Network available (NOTHING does not need it for inference)' : 'Offline'}>
          <span className="text-muted">{online ? <Wifi size={13} /> : <WifiOff size={13} />}</span>
        </Tip>
        <div className="relative">
          <button aria-label="Notifications" onClick={() => setOpen(!open)} className="relative grid min-h-9 min-w-9 place-items-center rounded text-muted hover:bg-fg/5 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><Bell size={14} />
            {notes.length > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />}</button>
          <AnimatePresence>{open && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="absolute right-0 top-7 w-72 rounded-lg border border-line bg-panel p-2 shadow-xl">
              <div className="mb-1 flex items-center justify-between px-1"><span className="font-medium">Notifications</span>
                <Button variant="ghost" onClick={clear} disabled={!notes.length}><Trash2 size={12} />Clear</Button></div>
              <ul className="max-h-72 space-y-1 overflow-auto">
                {notes.map((n) => (
                  <li key={n.id} className="group relative rounded border border-line bg-surface p-2">
                    <div className="pr-4 font-medium">{n.title}</div>{n.body && <div className="text-[11px] text-muted">{n.body}</div>}
                    <div className="mt-1 font-mono text-[10px] text-muted">{new Date(n.t).toLocaleTimeString()}</div>
                    <button aria-label="Dismiss" onClick={() => dismiss(n.id)} className="absolute right-1.5 top-1.5 text-muted hover:text-fg"><X size={12} /></button>
                  </li>))}
                {!notes.length && <li className="p-4 text-center text-muted">Nothing new. Fitting.</li>}
              </ul>
            </motion.div>)}</AnimatePresence>
        </div>
        <span className="hidden font-mono text-muted sm:inline">{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span className="font-mono">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </header>
  );
}
