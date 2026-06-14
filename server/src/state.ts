import type Database from 'better-sqlite3';
import type { StateResponse } from '@rally/shared';

interface TeamRow {
  score: number;
  hints_remaining: number;
}

interface ClueOverrideRow {
  text: string;
}

interface BroadcastRow {
  message: string;
  at: number;
}

/** The authoritative {score, hintsRemaining, clueOverride?, broadcasts[]} a team device reconciles on. */
export function getTeamState(db: Database.Database, teamId: string): StateResponse {
  const team = db
    .prepare<[string], TeamRow>('SELECT score, hints_remaining FROM teams WHERE id = ?')
    .get(teamId);

  if (!team) {
    throw new Error(`Unknown team: ${teamId}`);
  }

  const override = db
    .prepare<[string], ClueOverrideRow>('SELECT text FROM clue_override WHERE team_id = ?')
    .get(teamId);

  const broadcasts = db
    .prepare<
      [string],
      BroadcastRow
    >("SELECT message, at FROM broadcasts WHERE target = ? OR target = 'all' ORDER BY at ASC")
    .all(teamId);

  return {
    score: team.score,
    hintsRemaining: team.hints_remaining,
    clueOverride: override?.text,
    broadcasts: broadcasts.map((b) => ({ message: b.message, at: b.at })),
  };
}
