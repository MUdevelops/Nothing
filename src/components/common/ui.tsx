import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/format';

type BV = 'primary' | 'outline' | 'ghost' | 'danger';
export function Button({ variant = 'outline', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BV }) {
  const v: Record<BV, string> = {
    primary: 'bg-accent text-[#080B10] font-medium hover:brightness-110',
    outline: 'border border-line text-fg hover:bg-fg/5',
    ghost: 'text-muted hover:text-fg hover:bg-fg/5',
    danger: 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
  };
  return (
    <button type="button" {...p}
      className={cn('inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', v[variant], className)} />
  );
}

export const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn('min-w-0 rounded-xl border border-line bg-panel shadow-sm transition-colors duration-150', className)}>{children}</div>
);

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'error' | 'accent'; children: ReactNode }) {
  const t = { neutral: 'border-line text-muted', ok: 'border-emerald-500/40 text-emerald-400', warn: 'border-amber-500/40 text-amber-400', error: 'border-red-500/40 text-red-400', accent: 'border-accent/40 text-accent' }[tone];
  return <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide', t)}>{children}</span>;
}

export function Slider({ label, value, min, max, step = 1, onChange, fmt }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 flex justify-between text-muted"><span>{label}</span><span className="font-mono text-fg">{fmt ? fmt(value) : value}</span></span>
      <input type="range" className="h-6 w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs">
      <span><span className="text-fg">{label}</span>{hint && <span className="block text-[11px] text-muted">{hint}</span>}</span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className={cn('relative h-6 w-11 shrink-0 rounded-full border border-line transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent', checked ? 'bg-accent' : 'bg-surface')}>
        <span className={cn('absolute top-1 h-3.5 w-3.5 rounded-full transition-all', checked ? 'left-[23px] bg-[#080B10]' : 'left-1 bg-muted')} />
      </span>
    </label>
  );
}

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn('min-h-9 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', className)} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-1">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} type="button" onClick={() => onChange(o.id)}
          className={cn('min-h-9 shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent', value === o.id ? 'bg-accent text-[#080B10]' : 'text-muted hover:bg-fg/5 hover:text-fg')}>{o.label}</button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-line text-muted">{icon}</div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="max-w-md space-y-3 text-xs leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-1.5 w-full overflow-hidden rounded bg-surface" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
  </div>
);

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-[1500] mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-[11px] text-fg opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100">{label}</span>
    </span>
  );
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block min-w-0 text-xs"><span className="mb-1 block text-muted">{label}</span>{children}</label>
);

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between py-1 text-xs"><span className="text-muted">{label}</span><span className="font-mono text-fg">{value}</span></div>
);
