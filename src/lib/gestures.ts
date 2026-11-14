export type Gesture = 'point' | 'pinch' | 'open_palm' | 'fist' | 'peace' | 'unknown';
export type GestureTrigger = 'fist' | 'peace' | 'swipe_left' | 'swipe_right';
export type GestureAction = 'none' | 'notify' | 'toggle_theme' | 'open_launcher' | 'next_slide' | 'prev_slide' | 'reset_visual';
export interface P { x: number; y: number; z: number }

export const GESTURE_LABEL: Record<Gesture, string> = {
  point: 'Point', pinch: 'Pinch', open_palm: 'Open palm', fist: 'Fist', peace: 'Two fingers', unknown: 'Unclassified',
};
export const TRIGGER_LABEL: Record<GestureTrigger, string> = {
  fist: 'Fist', peace: 'Two fingers (peace)', swipe_left: 'Swipe left', swipe_right: 'Swipe right',
};
export const ACTION_LABEL: Record<GestureAction, string> = {
  none: 'Do nothing', notify: 'Show a notification', toggle_theme: 'Toggle dark/light theme', open_launcher: 'Open app launcher',
  next_slide: 'Next panel', prev_slide: 'Previous panel', reset_visual: 'Reset visual parameter',
};

const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

export interface HandInfo { fingers: number; pinch: number; gesture: Gesture; extended: boolean[] }

/**
 * Geometric (rotation-tolerant) heuristics on the 21 MediaPipe landmarks.
 * This is rule-based classification on top of real landmark inference — it is not a trained gesture model.
 */
export function analyzeHand(lm: P[]): HandInfo {
  const size = d(lm[0], lm[9]) || 1e-6;
  const ext = [[8, 6], [12, 10], [16, 14], [20, 18]].map(([t, p]) => d(lm[t], lm[0]) > d(lm[p], lm[0]) * 1.1);
  const thumb = d(lm[4], lm[17]) > d(lm[3], lm[17]) * 1.05;
  const extended = [thumb, ...ext];
  const others = ext.filter(Boolean).length;
  const pinch = d(lm[4], lm[8]) / size;
  let gesture: Gesture = 'unknown';
  if (pinch < 0.28 && !(others === 0 && pinch > 0.14)) gesture = 'pinch';
  else if (others === 0) gesture = 'fist';
  else if (others === 4) gesture = 'open_palm';
  else if (ext[0] && others === 1) gesture = 'point';
  else if (ext[0] && ext[1] && others === 2) gesture = 'peace';
  return { fingers: extended.filter(Boolean).length, pinch, gesture, extended };
}
