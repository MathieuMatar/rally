/**
 * QR payload format: "RALLY:<stationId>:<START|END>" (e.g. "RALLY:puzzle:START").
 */

export type QrKind = 'START' | 'END';

export interface ParsedQr {
  stationId: string;
  kind: QrKind;
}

const QR_PREFIX = 'RALLY';

export function buildCode(stationId: string, kind: QrKind): string {
  return `${QR_PREFIX}:${stationId}:${kind}`;
}

export function parseCode(text: string): ParsedQr | null {
  if (typeof text !== 'string') return null;

  const parts = text.split(':');
  if (parts.length !== 3) return null;

  const [prefix, stationId, kind] = parts;
  if (prefix !== QR_PREFIX) return null;
  if (!stationId) return null;
  if (kind !== 'START' && kind !== 'END') return null;

  return { stationId, kind };
}
