export const BASE: string = import.meta.env.BASE_URL;
/** Path relative to the app base, e.g. asset('models/x') -> '/models/x' */
export const asset = (p: string): string => BASE + p.replace(/^\/+/, '');
/** Absolute URL (used as Cache Storage key). */
export const abs = (p: string): string => new URL(asset(p), self.location.origin).href;
