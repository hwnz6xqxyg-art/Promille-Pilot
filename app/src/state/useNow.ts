/**
 * Tickende Uhr: liefert die aktuelle Zeit (epoch ms) und aktualisiert sich alle
 * `intervalMs`, damit Dashboard-Werte (currentBac, "fahrtüchtig ab") ohne
 * Nutzeraktion live weiterlaufen.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
