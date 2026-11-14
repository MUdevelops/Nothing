export async function openCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API is not available (needs HTTPS or localhost).');
  const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
  if (deviceId) video.deviceId = { exact: deviceId };
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (e) {
    if (deviceId) return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    throw e;
  }
}

export const stopStream = (s: MediaStream | null): void => s?.getTracks().forEach((t) => t.stop());

export async function listDevices(kind: 'videoinput' | 'audioinput'): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === kind);
}

export function describeMediaError(e: unknown): string {
  const n = e instanceof DOMException ? e.name : '';
  if (n === 'NotAllowedError') return 'Permission denied. Allow access in your browser’s site settings, then retry.';
  if (n === 'NotFoundError') return 'No matching device was found.';
  if (n === 'NotReadableError') return 'The device is in use by another application.';
  return e instanceof Error ? e.message : String(e);
}
