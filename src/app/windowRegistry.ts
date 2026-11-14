import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { BrainCircuit, Brush, Boxes, Hand, Image as ImageIcon, MousePointer2, Mic, Orbit, Settings as Cog, ShieldCheck, type LucideIcon } from 'lucide-react';

export type AppId = 'vision' | 'canvas' | 'gestures' | 'creative' | 'brain' | 'voice' | 'image' | 'models' | 'privacy' | 'settings';
export interface AppDef { id: AppId; name: string; desc: string; icon: LucideIcon; w: number; h: number; component: LazyExoticComponent<ComponentType> }

export const APPS: AppDef[] = [
  { id: 'vision', name: 'Vision', desc: 'Real-time hand tracking', icon: Hand, w: 900, h: 600, component: lazy(() => import('../features/vision/VisionApp')) },
  { id: 'canvas', name: 'Air Canvas', desc: 'Draw with your index finger', icon: Brush, w: 980, h: 640, component: lazy(() => import('../features/air-canvas/AirCanvasApp')) },
  { id: 'gestures', name: 'Gestures', desc: 'Gesture-based interaction', icon: MousePointer2, w: 960, h: 620, component: lazy(() => import('../features/gestures/GestureApp')) },
  { id: 'creative', name: 'Creative Engine', desc: '3D particles driven by your hands', icon: Orbit, w: 960, h: 620, component: lazy(() => import('../features/creative/CreativeApp')) },
  { id: 'brain', name: 'Local Brain', desc: 'On-device text intelligence', icon: BrainCircuit, w: 900, h: 640, component: lazy(() => import('../features/brain/BrainApp')) },
  { id: 'voice', name: 'Voice', desc: 'Record, transcribe, speak', icon: Mic, w: 860, h: 620, component: lazy(() => import('../features/voice/VoiceApp')) },
  { id: 'image', name: 'Image Intelligence', desc: 'Classify and detect locally', icon: ImageIcon, w: 940, h: 640, component: lazy(() => import('../features/image-intelligence/ImageApp')) },
  { id: 'models', name: 'Model Center', desc: 'Manage local model files', icon: Boxes, w: 920, h: 620, component: lazy(() => import('../features/model-center/ModelCenterApp')) },
  { id: 'privacy', name: 'Privacy Center', desc: 'Permissions and network transparency', icon: ShieldCheck, w: 820, h: 620, component: lazy(() => import('../features/privacy/PrivacyApp')) },
  { id: 'settings', name: 'Settings', desc: 'Appearance, devices, performance', icon: Cog, w: 760, h: 600, component: lazy(() => import('../features/settings/SettingsApp')) },
];
export const APP_MAP = Object.fromEntries(APPS.map((a) => [a.id, a])) as Record<AppId, AppDef>;
