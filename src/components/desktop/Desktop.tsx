import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useDesktop, useNotes } from '../../app/AppProvider';
import { APPS } from '../../app/windowRegistry';
import { cn } from '../../lib/format';
import { Dock } from '../dock/Dock';
import { Launcher } from '../launcher/Launcher';
import { CommandPalette } from '../navigation/CommandPalette';
import { TopBar } from '../navigation/TopBar';
import { WindowFrame } from '../windows/WindowFrame';

export function Desktop() {
  const d = useDesktop(); const { toasts } = useNotes();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); d.setPalette(!d.palette); return; }
      if (e.key === 'Escape') { d.setLauncher(false); d.setPalette(false); return; }
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'l') { e.preventDefault(); d.setLauncher(!d.launcher); }
      else if (k === 'w' && d.activeId) { e.preventDefault(); d.close(d.activeId); }
      else if (k === 'm' && d.activeId) { e.preventDefault(); d.minimize(d.activeId); }
      else if (k === 'f' && d.activeId) { e.preventDefault(); d.toggleMax(d.activeId); }
      else if (/^[0-9]$/.test(k)) { const a = APPS[k === '0' ? 9 : Number(k) - 1]; if (a) { e.preventDefault(); d.open(a.id); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg text-fg">
      <div className="dotgrid absolute inset-0 opacity-60" aria-hidden />
      {d.wins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="pl-[0.6em] text-4xl font-extralight tracking-[0.6em] text-fg/80 sm:text-6xl">NOTHING</div>
            <p className="mt-4 text-xs text-muted">Everything happens here. Nothing leaves your device.</p>
            <p className="mt-6 text-[11px] text-muted"><kbd className="rounded border border-line px-1.5 font-mono">Ctrl</kbd> + <kbd className="rounded border border-line px-1.5 font-mono">K</kbd> command palette · <kbd className="rounded border border-line px-1.5 font-mono">Alt</kbd> + <kbd className="rounded border border-line px-1.5 font-mono">L</kbd> launcher</p>
          </div>
        </div>
      )}
      <TopBar />
      <main className="absolute inset-x-0 bottom-0 top-9">
        <AnimatePresence>{d.wins.map((w) => <WindowFrame key={w.id} win={w} active={w.id === d.activeId} />)}</AnimatePresence>
      </main>
      <Dock />
      <div className="pointer-events-none fixed right-3 top-12 z-[1300] flex w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn('rounded-lg border bg-panel/95 p-3 text-xs shadow-xl backdrop-blur', t.kind === 'error' ? 'border-red-500/50' : t.kind === 'warn' ? 'border-amber-500/50' : t.kind === 'ok' ? 'border-emerald-500/50' : 'border-line')}>
            <div className="font-medium">{t.title}</div>{t.body && <div className="mt-0.5 text-muted">{t.body}</div>}
          </div>))}
      </div>
      <AnimatePresence>{d.launcher && <Launcher key="l" />}{d.palette && <CommandPalette key="p" />}</AnimatePresence>
    </div>
  );
}
