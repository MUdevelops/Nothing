import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useDesktop } from '../../app/AppProvider';
import { APPS } from '../../app/windowRegistry';

export function Launcher() {
  const d = useDesktop();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const list = useMemo(() => APPS.filter((a) => (a.name + a.desc).toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <motion.div className="fixed inset-0 z-[1100] flex items-start justify-center bg-bg/80 px-4 pt-[12vh] backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => d.setLauncher(false)}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-auto pb-2" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex min-h-11 items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5">
          <Search size={16} className="text-muted" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applications"
            onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) d.open(list[0].id); }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted" aria-label="Search applications" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {list.map((a) => { const I = a.icon; return (
            <button key={a.id} onClick={() => d.open(a.id)} className="group flex min-h-32 flex-col items-start gap-2 rounded-xl border border-line bg-panel p-4 text-left transition hover:border-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <I size={22} className="text-accent" />
              <span className="text-sm font-medium">{a.name}</span>
              <span className="text-[11px] leading-snug text-muted">{a.desc}</span>
            </button>); })}
          {list.length === 0 && <p className="col-span-full text-center text-xs text-muted">No application matches “{q}”.</p>}
        </div>
      </div>
    </motion.div>
  );
}
