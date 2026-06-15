import { useEffect, useState } from 'react';
import type { Station } from '@rally/shared';
import { fetchStations } from './api';

/** Loads `/admin/stations` once — station definitions are static for the event. */
export function useStations(token: string): Station[] {
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    fetchStations(token)
      .then(setStations)
      .catch(() => {
        // Team detail still works without station names; falls back to ids.
      });
  }, [token]);

  return stations;
}
