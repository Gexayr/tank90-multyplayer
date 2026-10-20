import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

export type GameMode = 'open-world' | 'missions';

export const GAME_MODES: GameMode[] = ['open-world', 'missions'];

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data/tank90.sqlite');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS scores (
    name       TEXT    NOT NULL,
    mode       TEXT    NOT NULL,
    score      INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (name, mode)
  );
  CREATE INDEX IF NOT EXISTS scores_mode_score ON scores (mode, score DESC);
`);

const addScoreStmt = db.prepare(`
  INSERT INTO scores (name, mode, score, updated_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (name, mode) DO UPDATE SET score = score + excluded.score, updated_at = excluded.updated_at
`);

const topScoresStmt = db.prepare(`
  SELECT name, score FROM scores WHERE mode = ? ORDER BY score DESC LIMIT ?
`);

/** Add points to a nickname's lifetime total for a mode */
export function addScore(name: string, mode: GameMode, points: number) {
  if (points <= 0) return;
  try {
    addScoreStmt.run(name, mode, points, Date.now());
  } catch (error) {
    console.error('Error saving score:', error);
  }
}

export function topScores(mode: GameMode, limit = 10): { name: string; score: number }[] {
  return topScoresStmt.all(mode, limit) as { name: string; score: number }[];
}

export function closeDb() {
  db.close();
}
