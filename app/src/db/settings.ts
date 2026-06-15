import { getDb } from './client';

/**
 * Keys stored in the `settings` key-value table (BUILD_INSTRUCTIONS §2.3):
 * team identity/token, cached event config, and cached score/hints so the
 * app can cold-start with zero network.
 */
export type SettingsKey =
  | 'team_id'
  | 'team_name'
  | 'color'
  | 'token'
  | 'server_url'
  | 'event_name'
  | 'town'
  | 'event_start_iso'
  | 'duration_min'
  | 'hq_phone'
  | 'emergency_phone'
  | 'help_hints_per_team'
  | 'qr_payload_format'
  | 'hints_remaining'
  | 'score'
  | 'role';

export function getSetting(key: SettingsKey): string | null {
  const result = getDb().executeSync('SELECT value FROM settings WHERE key = ?', [key]);
  const row = result.rows[0];
  return row ? String(row.value) : null;
}

export function setSetting(key: SettingsKey, value: string): void {
  getDb().executeSync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export function setSettings(values: Partial<Record<SettingsKey, string>>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      setSetting(key as SettingsKey, value);
    }
  }
}

/** True once a team has logged in and the route/settings have been persisted. */
export function hasLoggedInTeam(): boolean {
  return getSetting('team_id') !== null;
}

export function clearSettings(): void {
  getDb().executeSync('DELETE FROM settings');
}
