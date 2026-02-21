export interface GameRecord {
  id: string;
  league: string;
  country: string;
  home_team: string;
  away_team: string;
  match_date: string;
  match_time: string;
  status: string;
  
  // Odds
  odd_home: number;
  odd_away: number;
  odd_draw: number;
  odd_over05: number;
  odd_over15: number;
  odd_over25: number;
  odd_under25: number;
  odd_under35: number;
  odd_under45: number;
  odd_under15: number;
  odd_over05_ht: number;
  odd_btts_yes: number;
  odd_btts_no: number;

  // Stats
  efficiency_home: number;
  efficiency_away: number;
  rank_home: number;
  rank_away: number;
  wins_percent_home: number;
  wins_percent_away: number;
  avg_goals_scored_home: number;
  avg_goals_scored_away: number;
  avg_goals_conceded_home: number;
  avg_goals_conceded_away: number;
  avg_goals_conceded_2h_home: number;
  avg_goals_conceded_2h_away: number;
  avg_goals_scored_2h_home: number;
  avg_goals_scored_2h_away: number;
  avg_goals_scored_1h_home: number;
  avg_goals_scored_1h_away: number;

  // Global
  global_goals_match: number;
  global_goals_league: number;

  // Results
  home_score: number | null;
  away_score: number | null;
  home_score_ht: number | null;
  away_score_ht: number | null;
}