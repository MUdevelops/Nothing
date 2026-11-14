import { LayoutGrid } from 'lucide-react';
import { useDesktop } from '../../app/AppProvider';
import { APPS } from '../../app/windowRegistry';
import { cn } from '../../lib/format';
import { Tip } from '../common/ui';

export function Dock() {
  const d = useDesktop();
  return (
    <nav aria-label="Dock" className="fixed bottom-2 left-1/2 z-[1000] flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-panel/90 px-2 py-1.5 shadow-xl backdrop-blur sm:overflow-visible">
      <Tip label="Launcher (Alt+L)">
        <button aria-label="Open launcher" onClick={() => d.setLauncher(!d.launcher)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg"><LayoutGrid size={18} /></button>
      </Tip>
      <span className="mx-1 h-6 w-px bg-line" />
      {APPS.map((a) => {
        const w = d.wins.find((x) => x.app === a.id);
        const Icon = a.icon;
        return (
          <Tip key={a.id} label={a.name}>
            <button aria-label={a.name}
              onClick={() => (w && !w.min && d.activeId === w.id ? d.minimize(w.id) : d.open(a.id))}
              className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-lg transition hover:-translate-y-0.5 hover:bg-fg/10', w && !w.min ? 'text-accent' : 'text-fg')}>
              <Icon size={19} />
              {w && <span className={cn('absolute bottom-0.5 h-1 w-1 rounded-full', w.min ? 'bg-muted' : 'bg-accent')} />}
            </button>
          </Tip>
        );
      })}
    </nav>
  );
}
