import { memo, Suspense, useRef, type PointerEvent as RPE } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { useDesktop, type Win } from '../../app/AppProvider';
import { APP_MAP } from '../../app/windowRegistry';
import { cn } from '../../lib/format';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { VisibleCtx } from './visibility';

const variants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 24 },
  open: { opacity: 1, scale: 1, y: 0, display: 'flex', transition: { duration: 0.18 } },
  min: { opacity: 0, scale: 0.9, y: 60, transitionEnd: { display: 'none' }, transition: { duration: 0.16 } },
};
const MIN_W = 340, MIN_H = 260;

export const WindowFrame = memo(function WindowFrame({ win, active }: { win: Win; active: boolean }) {
  const d = useDesktop();
  const app = APP_MAP[win.app];
  const ref = useRef<HTMLDivElement>(null);
  const Icon = app.icon;

  const startDrag = (e: RPE) => {
    d.focus(win.id);
    if (win.max || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const el = ref.current; const parent = el?.parentElement;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = win.x, oy = win.y;
    const move = (ev: PointerEvent) => {
      el.style.left = `${Math.min(Math.max(ox + ev.clientX - sx, 120 - win.w), pr.width - 80)}px`;
      el.style.top = `${Math.min(Math.max(oy + ev.clientY - sy, 0), pr.height - 40)}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      d.setRect(win.id, parseFloat(el.style.left), parseFloat(el.style.top), win.w, win.h);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  const startResize = (dir: 'e' | 's' | 'se') => (e: RPE) => {
    if (win.max || e.button !== 0) return;
    e.stopPropagation(); e.preventDefault(); d.focus(win.id);
    const el = ref.current;
    if (!el) return;
    const sx = e.clientX, sy = e.clientY, ow = win.w, oh = win.h;
    const move = (ev: PointerEvent) => {
      if (dir !== 's') el.style.width = `${Math.max(MIN_W, ow + ev.clientX - sx)}px`;
      if (dir !== 'e') el.style.height = `${Math.max(MIN_H, oh + ev.clientY - sy)}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      d.setRect(win.id, win.x, win.y, parseFloat(el.style.width), parseFloat(el.style.height));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  const style = win.max
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - 78px)', zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  return (
    <motion.section
      ref={ref} role="dialog" aria-label={app.name} variants={variants} initial="hidden" animate={win.min ? 'min' : 'open'} exit="hidden"
      onPointerDownCapture={() => !active && d.focus(win.id)}
      className={cn('mobile-window absolute flex-col overflow-hidden rounded-xl border bg-panel shadow-2xl', active ? 'border-accent/40' : 'border-line')}
      style={style}>
      <header className="flex h-10 shrink-0 cursor-grab select-none items-center gap-2 border-b border-line bg-surface px-3 active:cursor-grabbing"
        onPointerDown={startDrag} onDoubleClick={() => d.toggleMax(win.id)}>
        <Icon size={14} className={active ? 'text-accent' : 'text-muted'} />
        <span className="flex-1 truncate text-xs font-medium">{app.name}</span>
        <button aria-label="Minimize" onClick={() => d.minimize(win.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted hover:bg-fg/10 hover:text-fg"><Minus size={13} /></button>
        <button aria-label={win.max ? 'Restore' : 'Maximize'} onClick={() => d.toggleMax(win.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted hover:bg-fg/10 hover:text-fg">{win.max ? <Minimize2 size={12} /> : <Maximize2 size={12} />}</button>
        <button aria-label="Close" onClick={() => d.close(win.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted hover:bg-red-500/20 hover:text-red-400"><X size={13} /></button>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ErrorBoundary>
          <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted">Loading {app.name}…</div>}>
            <VisibleCtx.Provider value={!win.min}><app.component /></VisibleCtx.Provider>
          </Suspense>
        </ErrorBoundary>
      </div>
      {!win.max && (<>
        <div onPointerDown={startResize('e')} className="absolute right-0 top-10 h-[calc(100%-52px)] w-1.5 cursor-ew-resize" />
        <div onPointerDown={startResize('s')} className="absolute bottom-0 left-0 h-1.5 w-[calc(100%-16px)] cursor-ns-resize" />
        <div onPointerDown={startResize('se')} className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize" />
      </>)}
    </motion.section>
  );
});
