import type { Station } from '@rally/shared';
import { getDb } from './client';

/** Persists this team's full ordered route, replacing whatever was stored before. */
export function saveRoute(route: Station[]): void {
  const db = getDb();
  db.executeSync('DELETE FROM route');
  route.forEach((station, idx) => {
    db.executeSync(
      `INSERT INTO route
         (idx, station_id, station_name, category, lat, lng, clue, start_code, end_code, base_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idx,
        station.id,
        station.name,
        station.category,
        station.lat,
        station.lng,
        station.clue,
        station.startCode,
        station.endCode,
        station.basePoints,
      ],
    );
  });
}

export function loadRoute(): Station[] {
  const result = getDb().executeSync('SELECT * FROM route ORDER BY idx ASC');
  return result.rows.map((row) => ({
    id: String(row.station_id),
    name: String(row.station_name),
    category: row.category as Station['category'],
    lat: Number(row.lat),
    lng: Number(row.lng),
    clue: String(row.clue),
    startCode: String(row.start_code),
    endCode: String(row.end_code),
    basePoints: Number(row.base_points),
  }));
}

/** Persists every station (for the map), replacing whatever was stored before. */
export function saveStations(stations: Station[]): void {
  const db = getDb();
  db.executeSync('DELETE FROM stations');
  stations.forEach((station) => {
    db.executeSync('INSERT INTO stations (id, name, category, lat, lng) VALUES (?, ?, ?, ?, ?)', [
      station.id,
      station.name,
      station.category,
      station.lat,
      station.lng,
    ]);
  });
}

export interface MapStation {
  id: string;
  name: string;
  category: Station['category'];
  lat: number;
  lng: number;
}

export function loadStations(): MapStation[] {
  const result = getDb().executeSync('SELECT * FROM stations');
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    category: row.category as Station['category'],
    lat: Number(row.lat),
    lng: Number(row.lng),
  }));
}
