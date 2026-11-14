import type { GestureAction, GestureTrigger } from '../../lib/gestures';

export interface Settings {
  theme: 'dark' | 'light';
  accent: string;
  cameraId: string;
  micId: string;
  quality: 'low' | 'medium' | 'high';
  preferGpu: boolean;
  showFps: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  highContrast: boolean;
  sensitivity: number;
  calibration: { minX: number; maxX: number; minY: number; maxY: number };
  gestureMap: Record<GestureTrigger, GestureAction>;
}

export const DEFAULTS: Settings = {
  theme: 'dark', accent: '#38E8DA', cameraId: '', micId: '', quality: 'medium', preferGpu: true, showFps: true,
  reduceMotion: false, largeText: false, highContrast: false, sensitivity: 1.4,
  calibration: { minX: 0.15, maxX: 0.85, minY: 0.15, maxY: 0.85 },
  gestureMap: { fist: 'notify', peace: 'toggle_theme', swipe_left: 'next_slide', swipe_right: 'prev_slide' },
};

export const SETTINGS_KEY = 'nothing.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...p, calibration: { ...DEFAULTS.calibration, ...p.calibration }, gestureMap: { ...DEFAULTS.gestureMap, ...p.gestureMap } };
  } catch { return DEFAULTS; }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export function clearSettings(): void {
  try { localStorage.removeItem(SETTINGS_KEY); } catch { /* ignore */ }
}
