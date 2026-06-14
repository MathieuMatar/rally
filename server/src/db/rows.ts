import type { Station, StationCategory, Team } from '@rally/shared';

export interface TeamRow {
  id: string;
  name: string;
  color: string;
  phone: string;
  code: string;
  route_json: string;
  hints_remaining: number;
  score: number;
  status: string;
  last_seen: number | null;
}

export interface StationRow {
  id: string;
  name: string;
  category: StationCategory;
  lat: number;
  lng: number;
  clue: string;
  start_code: string;
  end_code: string;
  base_points: number;
}

export function stationRowToStation(row: StationRow): Station {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    clue: row.clue,
    startCode: row.start_code,
    endCode: row.end_code,
    basePoints: row.base_points,
  };
}

export function buildRoute(routeIds: Team['route'], stationsById: Map<string, Station>): Station[] {
  return routeIds.map((stationId) => {
    const station = stationsById.get(stationId);
    if (!station) {
      throw new Error(`Route references unknown station: ${stationId}`);
    }
    return station;
  });
}
