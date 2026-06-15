import { getDb } from './client';
import type { CaptureKind } from '../core/captureStorage';

export interface CaptureRecord {
  id: string;
  stationId: string;
  type: CaptureKind;
  localPath: string;
  createdAt: number;
}

export function recordCapture(id: string, stationId: string, type: CaptureKind, localPath: string, createdAt: number): void {
  getDb().executeSync('INSERT INTO captures (id, station_id, type, local_path, created_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    stationId,
    type,
    localPath,
    createdAt,
  ]);
}

export function listCapturesByStation(stationId: string): CaptureRecord[] {
  const result = getDb().executeSync(
    'SELECT id, station_id, type, local_path, created_at FROM captures WHERE station_id = ? ORDER BY created_at ASC',
    [stationId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    stationId: String(row.station_id),
    type: row.type === 'video' ? 'video' : 'photo',
    localPath: String(row.local_path),
    createdAt: Number(row.created_at),
  }));
}

export function deleteCapture(id: string): void {
  getDb().executeSync('DELETE FROM captures WHERE id = ?', [id]);
}
