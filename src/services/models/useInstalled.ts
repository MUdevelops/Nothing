import { useCallback, useEffect, useState } from 'react';
import { CATALOG } from './catalog';
import { handModelPresent, isHfInstalled, MODELS_CHANGED } from './store';

export function useInstalled() {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [hand, setHand] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const entries = await Promise.all(CATALOG.map(async (m) => [m.id, await isHfInstalled(m.id)] as const));
    setMap(Object.fromEntries(entries));
    setHand(await handModelPresent());
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
    const h = () => void refresh();
    window.addEventListener(MODELS_CHANGED, h);
    return () => window.removeEventListener(MODELS_CHANGED, h);
  }, [refresh]);

  return { installed: map, hand, checking, refresh };
}
