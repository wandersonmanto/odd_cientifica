import { GameRecord } from '../../types';
import { exec, query } from './database';

const SELECT_ALL_COLS = `*`;

// ─── Type helpers ─────────────────────────────────────────────────────────────

/**
 * Maps a sql.js result row (array of values) to a GameRecord.
 * Column order must match the SELECT statement in each query.
 */
function rowToGameRecord(row: any[]): GameRecord {
  return {
    id: row[0] as string,
    league: row[1] as string,
    country: row[2] as string,
    home_team: row[3] as string,
    away_team: row[4] as string,
    match_date: row[5] as string,
    match_time: row[6] as string,
    status: row[7] as string,
    odd_home: row[8] as number,
    odd_away: row[9] as number,
    odd_draw: row[10] as number,
    odd_over05: row[11] as number,
    odd_over15: row[12] as number,
    odd_over25: row[13] as number,
    odd_under15: row[14] as number,
    odd_under25: row[15] as number,
    odd_under35: row[16] as number,
    odd_under45: row[17] as number,
    odd_over05_ht: row[18] as number,
    odd_btts_yes: row[19] as number,
    odd_btts_no: row[20] as number,
    efficiency_home: row[21] as number,
    efficiency_away: row[22] as number,
    rank_home: row[23] as number,
    rank_away: row[24] as number,
    wins_percent_home: row[25] as number,
    wins_percent_away: row[26] as number,
    avg_goals_scored_home: row[27] as number,
    avg_goals_scored_away: row[28] as number,
    avg_goals_conceded_home: row[29] as number,
    avg_goals_conceded_away: row[30] as number,
    avg_goals_conceded_2h_home: row[31] as number,
    avg_goals_conceded_2h_away: row[32] as number,
    avg_goals_scored_2h_home: row[33] as number,
    avg_goals_scored_2h_away: row[34] as number,
    avg_goals_scored_1h_home: row[35] as number,
    avg_goals_scored_1h_away: row[36] as number,
    global_goals_match: row[37] as number,
    global_goals_league: row[38] as number,
    home_score: row[39] as number | null,
    away_score: row[40] as number | null,
    home_score_ht: row[41] as number | null,
    away_score_ht: row[42] as number | null,
  };
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

// ─── Write Operations ─────────────────────────────────────────────────────────

/**
 * Insert or replace a game record.
 * Uses atomic async execution via worker.
 */
export async function insertOrUpdateGame(record: GameRecord): Promise<void> {
  const {
    id, league, country, home_team, away_team, match_date, match_time, status,
    odd_home, odd_away, odd_draw,
    odd_over05, odd_over15, odd_over25,
    odd_under15, odd_under25, odd_under35, odd_under45,
    odd_over05_ht, odd_btts_yes, odd_btts_no,
    efficiency_home, efficiency_away,
    rank_home, rank_away,
    wins_percent_home, wins_percent_away,
    avg_goals_scored_home, avg_goals_scored_away,
    avg_goals_conceded_home, avg_goals_conceded_away,
    avg_goals_conceded_2h_home, avg_goals_conceded_2h_away,
    avg_goals_scored_2h_home, avg_goals_scored_2h_away,
    avg_goals_scored_1h_home, avg_goals_scored_1h_away,
    global_goals_match, global_goals_league,
    home_score, away_score, home_score_ht, away_score_ht
  } = record;

  await exec(
    `INSERT OR REPLACE INTO games (
      id, league, country, home_team, away_team, match_date, match_time, status,
      odd_home, odd_away, odd_draw,
      odd_over05, odd_over15, odd_over25,
      odd_under15, odd_under25, odd_under35, odd_under45,
      odd_over05_ht, odd_btts_yes, odd_btts_no,
      efficiency_home, efficiency_away,
      rank_home, rank_away,
      wins_percent_home, wins_percent_away,
      avg_goals_scored_home, avg_goals_scored_away,
      avg_goals_conceded_home, avg_goals_conceded_away,
      avg_goals_conceded_2h_home, avg_goals_conceded_2h_away,
      avg_goals_scored_2h_home, avg_goals_scored_2h_away,
      avg_goals_scored_1h_home, avg_goals_scored_1h_away,
      global_goals_match, global_goals_league,
      home_score, away_score, home_score_ht, away_score_ht
    ) VALUES (
      $id, $league, $country, $home, $away, $date, $time, $status,
      $oH, $oA, $oD, $oO05, $oO15, $oO25, $oU15, $oU25, $oU35, $oU45, $oO05ht, $oBTTSy, $oBTTSn,
      $effH, $effA, $rankH, $rankA, $winH, $winA,
      $avgScH, $avgScA, $avgCoH, $avgCoA,
      $avgCo2H, $avgCo2A, $avgSc2H, $avgSc2A, $avgSc1H, $avgSc1A,
      $globM, $globL,
      $resH, $resA, $resHT, $resAT
    );`,
    {
      $id: id, $league: league, $country: country, $home: home_team, $away: away_team,
      $date: match_date, $time: match_time, $status: status ?? 'NS',
      $oH: odd_home, $oA: odd_away, $oD: odd_draw,
      $oO05: odd_over05, $oO15: odd_over15, $oO25: odd_over25,
      $oU15: odd_under15, $oU25: odd_under25, $oU35: odd_under35, $oU45: odd_under45,
      $oO05ht: odd_over05_ht, $oBTTSy: odd_btts_yes, $oBTTSn: odd_btts_no,
      $effH: efficiency_home, $effA: efficiency_away,
      $rankH: rank_home, $rankA: rank_away,
      $winH: wins_percent_home, $winA: wins_percent_away,
      $avgScH: avg_goals_scored_home, $avgScA: avg_goals_scored_away,
      $avgCoH: avg_goals_conceded_home, $avgCoA: avg_goals_conceded_away,
      $avgCo2H: avg_goals_conceded_2h_home, $avgCo2A: avg_goals_conceded_2h_away,
      $avgSc2H: avg_goals_scored_2h_home, $avgSc2A: avg_goals_scored_2h_away,
      $avgSc1H: avg_goals_scored_1h_home, $avgSc1A: avg_goals_scored_1h_away,
      $globM: global_goals_match, $globL: global_goals_league,
      $resH: home_score, $resA: away_score, $resHT: home_score_ht, $resAT: away_score_ht
    }
  );
}

/**
 * Update only the result fields for an existing game.
 * Sets status = 'FT' automatically.
 */
export async function updateGameResult(
  id: string,
  homeScore: number,
  awayScore: number,
  homeScoreHT: number | null = null,
  awayScoreHT: number | null = null
): Promise<boolean> {
  // Update result and status to 'FT' (Full Time)
  await exec(
    `UPDATE games 
     SET home_score = $h, away_score = $a, 
         home_score_ht = $hht, away_score_ht = $aht,
         status = 'FT'
     WHERE id = $id`,
    {
      $id: id,
      $h: homeScore,
      $a: awayScore,
      $hht: homeScoreHT,
      $aht: awayScoreHT
    }
  );
  return true;
}

// ─── Read Operations ──────────────────────────────────────────────────────────

/**
 * Returns ALL games from the database.
 */
export async function getAllGames(): Promise<GameRecord[]> {
  const rows = await query(`SELECT ${SELECT_ALL_COLS} FROM games ORDER BY match_date, match_time`);
  return rows.map((row: any) => ({
    id: row.id,
    league: row.league,
    country: row.country,
    home_team: row.home_team,
    away_team: row.away_team,
    match_date: row.match_date,
    match_time: row.match_time,
    status: row.status,
    odd_home: row.odd_home,
    odd_away: row.odd_away,
    odd_draw: row.odd_draw,
    odd_over05: row.odd_over05,
    odd_over15: row.odd_over15,
    odd_over25: row.odd_over25,
    odd_under15: row.odd_under15,
    odd_under25: row.odd_under25,
    odd_under35: row.odd_under35,
    odd_under45: row.odd_under45,
    odd_over05_ht: row.odd_over05_ht,
    odd_btts_yes: row.odd_btts_yes,
    odd_btts_no: row.odd_btts_no,
    efficiency_home: row.efficiency_home,
    efficiency_away: row.efficiency_away,
    rank_home: row.rank_home,
    rank_away: row.rank_away,
    wins_percent_home: row.wins_percent_home,
    wins_percent_away: row.wins_percent_away,
    avg_goals_scored_home: row.avg_goals_scored_home,
    avg_goals_scored_away: row.avg_goals_scored_away,
    avg_goals_conceded_home: row.avg_goals_conceded_home,
    avg_goals_conceded_away: row.avg_goals_conceded_away,
    avg_goals_conceded_2h_home: row.avg_goals_conceded_2h_home,
    avg_goals_conceded_2h_away: row.avg_goals_conceded_2h_away,
    avg_goals_scored_2h_home: row.avg_goals_scored_2h_home,
    avg_goals_scored_2h_away: row.avg_goals_scored_2h_away,
    avg_goals_scored_1h_home: row.avg_goals_scored_1h_home,
    avg_goals_scored_1h_away: row.avg_goals_scored_1h_away,
    global_goals_match: row.global_goals_match,
    global_goals_league: row.global_goals_league,
    home_score: row.home_score,
    away_score: row.away_score,
    home_score_ht: row.home_score_ht,
    away_score_ht: row.away_score_ht,
  }));
}

/**
 * Returns the total number of games in the database.
 */
export async function getGameCount(): Promise<number> {
  const rows = await query(`SELECT COUNT(*) as count FROM games`);
  if (rows && rows.length > 0) {
      return (rows[0] as any).count;
  }
  return 0;
}

/**
 * Check if a game with a given id exists.
 */
export async function gameExists(id: string): Promise<boolean> {
  const rows = await query(`SELECT 1 FROM games WHERE id = $id LIMIT 1`, { $id: id });
  return rows.length > 0;
}
