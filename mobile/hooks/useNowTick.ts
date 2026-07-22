import { useEffect, useState } from 'react';

// Ticks once a second so countdown displays (the 7-minute start window, the
// 2-minute flash window) update live without a network refetch.
export function useNowTick(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
