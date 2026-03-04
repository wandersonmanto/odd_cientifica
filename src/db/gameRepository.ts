import { GameRecord } from '../../types';
import { apiFetch } from '../api/client';

// ─── Write Operations ──────────────────────────────────────────────────────────

/**
 * Insere ou atualiza um registro de jogo via API MySQL.
 */
export async function insertOrUpdateGame(record: GameRecord): Promise<void> {
  await apiFetch('/games/upsert', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

/**
 * Atualiza somente o resultado de um jogo existente.
 * Define status = 'FT' automaticamente.
 */
export async function updateGameResult(
  id: string,
  homeScore: number,
  awayScore: number,
  homeScoreHT: number | null = null,
  awayScoreHT: number | null = null
): Promise<boolean> {
  const data = await apiFetch<{ success: boolean; updated: boolean }>(
    `/games/${encodeURIComponent(id)}/result`,
    {
      method: 'PUT',
      body: JSON.stringify({
        home_score: homeScore,
        away_score: awayScore,
        home_score_ht: homeScoreHT,
        away_score_ht: awayScoreHT,
      }),
    }
  );
  return data.updated;
}

// ─── Read Operations ───────────────────────────────────────────────────────────

/**
 * Retorna todos os jogos do banco de dados.
 */
export async function getAllGames(): Promise<GameRecord[]> {
  return apiFetch<GameRecord[]>('/games');
}

/**
 * Retorna a contagem total de jogos.
 */
export async function getGameCount(): Promise<number> {
  const data = await apiFetch<{ count: number }>('/games/count');
  return Number(data.count);
}

/**
 * Verifica se um jogo com o id fornecido existe.
 */
export async function gameExists(id: string): Promise<boolean> {
  const data = await apiFetch<{ exists: boolean }>(
    `/games/${encodeURIComponent(id)}/exists`
  );
  return data.exists;
}
