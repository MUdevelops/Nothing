import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { useDesktop, useNotes, useNotify, useSettings } from '../../app/AppProvider';
import { APPS } from '../../app/windowRegistry';

interface Cmd { id: string; label: string; hint?: string; run: () => void }

export function CommandPalette() {
  const d = useDesktop(); const { settings, update } = useSettings(); const notes = useNotes(); const notify = useNotify();
  const [q, setQ] = useState(''); const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const cmds = useMemo<Cmd[]>(() => [
    ...APPS.map((a, n) => ({ id: a.id, label: `Open ${a.name}`, hint: n < 9 ? `Alt+${n + 1}` : n === 9 ? 'Alt+0' : undefined, run: () => d.open(a.id) })),
    { id: 'theme', label: `Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`, run: () => { update({ theme: settings.theme === 'dark' ? 'light' : 'dark' }); d.setPalette(false); } },
    { id: 'fs', label: 'Toggle fullscreen', run: () => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()); d.setPalette(false); } },
    { id: 'launcher', label: 'Open launcher', hint: 'Alt+L', run: () => { d.setPalette(false); d.setLauncher(true); } },
    { id: 'closeall', label: 'Close all windows', run: () => { d.closeAll(); d.setPalette(false); notify('All windows closed', 'Cameras and microphones used by those windows were released.'); } },
    { id: 'clearn', label: 'Clear notifications', run: () => { notes.clear(); d.setPalette(false); } },
  ], [d, settings.theme, update, notes, notify]);

  const list = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <motion.div className="fixed inset-0 z-[1200] flex items-start justify-center bg-bg/70 px-4 pt-[14vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => d.setPalette(false)}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-hidden rounded-xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex min-h-11 items-center gap-2 border-b border-line px-3 py-2.5">
          <Terminal size={15} className="text-accent" />
          <input ref={ref} value={q} aria-label="Command" placeholder="Type a command…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(v + 1, list.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
              if (e.key === 'Enter') list[i]?.run();
            }} />
        </div>
        <ul className="max-h-72 overflow-auto py-1" role="listbox">
          {list.map((c, n) => (
            <li key={c.id} role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={c.run}
              className={`flex min-h-9 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs ${n === i ? 'bg-accent/15 text-fg' : 'text-muted'}`}>
              <span>{c.label}</span>{c.hint && <kbd className="rounded border border-line px-1.5 font-mono text-[10px]">{c.hint}</kbd>}
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted">No matching command.</li>}
        </ul>
      </div>
    </motion.div>
  );
}
