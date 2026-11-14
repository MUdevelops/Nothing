import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { hexToRgbChannels } from '../lib/format';
import { clearSettings, DEFAULTS, loadSettings, saveSettings, type Settings } from '../services/storage/settings';
import { APP_MAP, type AppId } from './windowRegistry';

// ---------- settings ----------
interface SettingsApi { settings: Settings; update: (p: Partial<Settings>) => void; reset: () => void }
const SettingsCtx = createContext<SettingsApi>(null as unknown as SettingsApi);
export const useSettings = () => useContext(SettingsCtx);

// ---------- notifications ----------
export interface Notice { id: number; title: string; body?: string; kind: 'info' | 'ok' | 'warn' | 'error'; t: number }
interface NotifyApi { notify: (title: string, body?: string, kind?: Notice['kind']) => void }
const NotifyCtx = createContext<NotifyApi>({ notify: () => undefined });
const NotesCtx = createContext<{ notes: Notice[]; clear: () => void; dismiss: (id: number) => void; toasts: Notice[] }>({ notes: [], clear: () => undefined, dismiss: () => undefined, toasts: [] });
export const useNotify = () => useContext(NotifyCtx).notify;
export const useNotes = () => useContext(NotesCtx);

// ---------- windows ----------
export interface Win { id: string; app: AppId; x: number; y: number; w: number; h: number; z: number; min: boolean; max: boolean }
interface WState { wins: Win[]; z: number }
type Act =
  | { t: 'open'; app: AppId; vw: number; vh: number }
  | { t: 'close'; id: string } | { t: 'focus'; id: string } | { t: 'min'; id: string } | { t: 'max'; id: string }
  | { t: 'rect'; id: string; x: number; y: number; w: number; h: number } | { t: 'closeAll' };

function reducer(s: WState, a: Act): WState {
  switch (a.t) {
    case 'open': {
      const ex = s.wins.find((w) => w.app === a.app);
      const z = s.z + 1;
      if (ex) return { z, wins: s.wins.map((w) => (w.id === ex.id ? { ...w, min: false, z } : w)) };
      const def = APP_MAP[a.app];
      const n = s.wins.length % 6;
      const w = Math.min(def.w, a.vw - 24), h = Math.min(def.h, a.vh - 140);
      const mobile = a.vw < 768;
      const win: Win = { id: a.app, app: a.app, x: Math.max(8, Math.min(70 + n * 34, a.vw - w - 8)), y: 16 + n * 28, w, h, z, min: false, max: mobile };
      return { z, wins: [...s.wins, win] };
    }
    case 'close': return { ...s, wins: s.wins.filter((w) => w.id !== a.id) };
    case 'focus': return { z: s.z + 1, wins: s.wins.map((w) => (w.id === a.id ? { ...w, z: s.z + 1 } : w)) };
    case 'min': return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, min: true } : w)) };
    case 'max': return { z: s.z + 1, wins: s.wins.map((w) => (w.id === a.id ? { ...w, max: !w.max, z: s.z + 1 } : w)) };
    case 'rect': return { ...s, wins: s.wins.map((w) => (w.id === a.id ? { ...w, x: a.x, y: a.y, w: a.w, h: a.h } : w)) };
    case 'closeAll': return { ...s, wins: [] };
  }
}

interface DesktopApi {
  wins: Win[]; activeId: string | null;
  open: (app: AppId) => void; close: (id: string) => void; focus: (id: string) => void; minimize: (id: string) => void;
  toggleMax: (id: string) => void; setRect: (id: string, x: number, y: number, w: number, h: number) => void; closeAll: () => void;
  launcher: boolean; setLauncher: (v: boolean) => void; palette: boolean; setPalette: (v: boolean) => void;
}
const DesktopCtx = createContext<DesktopApi>(null as unknown as DesktopApi);
export const useDesktop = () => useContext(DesktopCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = useCallback((p: Partial<Settings>) => setSettings((s) => { const n = { ...s, ...p }; saveSettings(n); return n; }), []);
  const reset = useCallback(() => { clearSettings(); setSettings(DEFAULTS); }, []);

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = settings.theme;
    r.style.setProperty('--accent', hexToRgbChannels(settings.accent));
    r.classList.toggle('large-text', settings.largeText);
    r.classList.toggle('hc', settings.highContrast);
    r.classList.toggle('reduce-motion', settings.reduceMotion);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#080B10' : '#EEF1F5');
  }, [settings]);

  const [notes, setNotes] = useState<Notice[]>([]);
  const [toasts, setToasts] = useState<Notice[]>([]);
  const notify = useCallback((title: string, body?: string, kind: Notice['kind'] = 'info') => {
    const n: Notice = { id: Date.now() + Math.random(), title, body, kind, t: Date.now() };
    setNotes((l) => [n, ...l].slice(0, 50));
    setToasts((l) => [...l, n].slice(-3));
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== n.id)), 4000);
  }, []);
  const notifyApi = useMemo(() => ({ notify }), [notify]);
  const notesApi = useMemo(() => ({ notes, toasts, clear: () => { setNotes([]); setToasts([]); }, dismiss: (id: number) => setNotes((l) => l.filter((n) => n.id !== id)) }), [notes, toasts]);

  const [ws, dispatch] = useReducer(reducer, { wins: [], z: 10 });
  const [launcher, setLauncher] = useState(false);
  const [palette, setPalette] = useState(false);
  const activeId = useMemo(() => ws.wins.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0]?.id ?? null, [ws.wins]);
  const desk = useMemo<DesktopApi>(() => ({
    wins: ws.wins, activeId, launcher, setLauncher, palette, setPalette,
    open: (app) => { dispatch({ t: 'open', app, vw: window.innerWidth, vh: window.innerHeight }); setLauncher(false); setPalette(false); },
    close: (id) => dispatch({ t: 'close', id }), focus: (id) => dispatch({ t: 'focus', id }), minimize: (id) => dispatch({ t: 'min', id }),
    toggleMax: (id) => dispatch({ t: 'max', id }), setRect: (id, x, y, w, h) => dispatch({ t: 'rect', id, x, y, w, h }), closeAll: () => dispatch({ t: 'closeAll' }),
  }), [ws.wins, activeId, launcher, palette]);

  const sApi = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return (
    <SettingsCtx.Provider value={sApi}><NotifyCtx.Provider value={notifyApi}><NotesCtx.Provider value={notesApi}><DesktopCtx.Provider value={desk}>
      {children}
    </DesktopCtx.Provider></NotesCtx.Provider></NotifyCtx.Provider></SettingsCtx.Provider>
  );
}
