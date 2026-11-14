import { useEffect, useSyncExternalStore } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Category } from '@mediapipe/tasks-vision';
import { analyzeHand, type Gesture, type P } from '../../lib/gestures';
import { asset } from '../../lib/paths';
import { describeMediaError, openCamera, stopStream } from '../camera/camera';
import { getHandModelBuffer } from '../models/store';
import { loadSettings } from '../storage/settings';

export type TrackerStatus = 'idle' | 'needs-model' | 'loading' | 'running' | 'error';
export interface Hand { label: 'Left' | 'Right'; score: number; lm: P[]; fingers: number; pinch: number; gesture: Gesture }
export interface Frame { hands: Hand[]; t: number }

/**
 * Shared, reference-counted hand tracker. The camera and the MediaPipe landmarker are only alive while at least
 * one window has called acquire(); closing the last consumer releases the camera and the model.
 * Inference runs on the main thread (MediaPipe VIDEO mode, GPU delegate with CPU fallback).
 */
class Tracker {
  readonly video = document.createElement('video');
  status: TrackerStatus = 'idle';
  error = '';
  backend = '';
  fps = 0;
  frame: Frame = { hands: [], t: 0 };
  version = 0;
  private refs = 0;
  private gen = 0;
  private stream: MediaStream | null = null;
  private lm: HandLandmarker | null = null;
  private raf = 0;
  private lastT = -1;
  private count = 0;
  private fpsT = 0;
  private subs = new Set<() => void>();

  constructor() { this.video.muted = true; this.video.playsInline = true; }

  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.subs.forEach((f) => f()); }
  private set(s: TrackerStatus, err = '') { this.status = s; this.error = err; this.emit(); }

  acquire() { this.refs++; if (this.refs === 1) void this.start(); }
  release() { this.refs = Math.max(0, this.refs - 1); if (this.refs === 0) this.stop(); }
  retry() { if (this.refs > 0 && this.status !== 'running' && this.status !== 'loading') void this.start(); }

  private async start() {
    const my = ++this.gen;
    this.set('loading');
    try {
      const buf = await getHandModelBuffer();
      if (my !== this.gen) return;
      if (!buf) { this.set('needs-model'); return; }
      if (!this.lm) {
        const fs = await FilesetResolver.forVisionTasks(asset('wasm'));
        const opts = (delegate: 'GPU' | 'CPU') => ({
          baseOptions: { modelAssetBuffer: buf, delegate },
          runningMode: 'VIDEO' as const, numHands: 2,
          minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        });
        try { this.lm = await HandLandmarker.createFromOptions(fs, opts('GPU')); this.backend = 'GPU (WebGL)'; }
        catch { this.lm = await HandLandmarker.createFromOptions(fs, opts('CPU')); this.backend = 'CPU (WASM)'; }
      }
      if (my !== this.gen) { this.lm?.close(); this.lm = null; return; }
      const stream = await openCamera(loadSettings().cameraId);
      if (my !== this.gen) { stopStream(stream); return; }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      this.lastT = -1; this.count = 0; this.fpsT = performance.now();
      this.set('running');
      this.loop();
    } catch (e) {
      if (my !== this.gen) return;
      this.stopHardware();
      const msg = e instanceof DOMException ? describeMediaError(e) : e instanceof Error ? e.message : String(e);
      this.set('error', msg);
    }
  }

  private stopHardware() {
    cancelAnimationFrame(this.raf);
    stopStream(this.stream); this.stream = null;
    this.video.srcObject = null;
    this.lm?.close(); this.lm = null;
    this.frame = { hands: [], t: 0 }; this.fps = 0;
  }

  private stop() { this.gen++; this.stopHardware(); this.set('idle'); }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const v = this.video;
    if (!this.lm || v.readyState < 2 || v.currentTime === this.lastT) return;
    this.lastT = v.currentTime;
    const now = performance.now();
    const res = this.lm.detectForVideo(v, now);
    const r = res as unknown as { handedness?: Category[][]; handednesses?: Category[][] };
    const hd = r.handedness ?? r.handednesses ?? [];
    this.frame = {
      t: now,
      hands: res.landmarks.map((lm, i) => {
        const cat = hd[i]?.[0];
        // MediaPipe assumes a mirrored (selfie) input; we feed the raw camera image, so the label is swapped.
        const label: 'Left' | 'Right' = cat?.categoryName === 'Left' ? 'Right' : 'Left';
        return { label, score: cat?.score ?? 0, lm: lm as P[], ...pick(analyzeHand(lm as P[])) };
      }),
    };
    this.count++;
    if (now - this.fpsT >= 1000) { this.fps = (this.count * 1000) / (now - this.fpsT); this.count = 0; this.fpsT = now; this.emit(); }
  };
}

const pick = (h: ReturnType<typeof analyzeHand>) => ({ fingers: h.fingers, pinch: h.pinch, gesture: h.gesture });

export const tracker = new Tracker();

/** Subscribe to tracker status; when `active`, hold a camera reference for the lifetime of the component. */
export function useTracker(active: boolean): Tracker {
  useEffect(() => {
    if (!active) return;
    tracker.acquire();
    return () => tracker.release();
  }, [active]);
  useSyncExternalStore(tracker.subscribe, tracker.getVersion);
  return tracker;
}

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;
