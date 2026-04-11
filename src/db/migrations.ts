import { Database } from 'sql.js';

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      league TEXT,
      country TEXT,
      home_team TEXT,
      away_team TEXT,
      match_date TEXT,
      match_time TEXT,
      status TEXT DEFAULT 'NS',

      -- Odds
      odd_home REAL DEFAULT 0,
      odd_away REAL DEFAULT 0,
      odd_draw REAL DEFAULT 0,
      odd_over05 REAL DEFAULT 0,
      odd_over15 REAL DEFAULT 0,
      odd_over25 REAL DEFAULT 0,
      odd_under15 REAL DEFAULT 0,
      odd_under25 REAL DEFAULT 0,
      odd_under35 REAL DEFAULT 0,
      odd_under45 REAL DEFAULT 0,
      odd_over05_ht REAL DEFAULT 0,
      odd_btts_yes REAL DEFAULT 0,
      odd_btts_no REAL DEFAULT 0,
      odd_1x REAL DEFAULT 0,
      odd_x2 REAL DEFAULT 0,

      -- Stats
      efficiency_home REAL DEFAULT 0,
      efficiency_away REAL DEFAULT 0,
      rank_home REAL DEFAULT 0,
      rank_away REAL DEFAULT 0,
      wins_percent_home REAL DEFAULT 0,
      wins_percent_away REAL DEFAULT 0,
      avg_goals_scored_home REAL DEFAULT 0,
      avg_goals_scored_away REAL DEFAULT 0,
      avg_goals_conceded_home REAL DEFAULT 0,
      avg_goals_conceded_away REAL DEFAULT 0,
      avg_goals_conceded_2h_home REAL DEFAULT 0,
      avg_goals_conceded_2h_away REAL DEFAULT 0,
      avg_goals_scored_2h_home REAL DEFAULT 0,
      avg_goals_scored_2h_away REAL DEFAULT 0,
      avg_goals_scored_1h_home REAL DEFAULT 0,
      avg_goals_scored_1h_away REAL DEFAULT 0,
      global_goals_match REAL DEFAULT 0,
      global_goals_league REAL DEFAULT 0,

      -- Results (nullable until match finishes)
      home_score INTEGER,
      away_score INTEGER,
      home_score_ht INTEGER,
      away_score_ht INTEGER
    );
  `);
}
