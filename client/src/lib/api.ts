export type GameMode = 'open-world' | 'missions';

export interface ScoreRow {
  name: string;
  score: number;
}

export interface ServerStats {
  openWorldPlayers: number;
  missions: { rooms: number; players: number };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const fetchLeaderboard = (mode: GameMode) => getJson<ScoreRow[]>(`/api/leaderboard?mode=${mode}`);
export const fetchStats = () => getJson<ServerStats>('/api/stats');
