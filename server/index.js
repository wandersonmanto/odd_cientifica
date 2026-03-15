/**
 * server/index.js
 * Servidor Express — API REST para o Odd Científica
 * Porta padrão: 3001
 */

require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path  = require('path');
const { generateImages } = require('./image-generator');

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use('/generated', express.static(path.join(__dirname, 'generated')));

// ─── MySQL Connection Pool ─────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

// Teste de conexão ao iniciar
pool.getConnection()
  .then(conn => {
    console.log(`✅ MySQL conectado em ${process.env.DB_HOST}:${process.env.DB_PORT} (banco: ${process.env.DB_NAME})`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Falha ao conectar no MySQL:', err.message);
    console.error('   Verifique as credenciais em server/.env e se o MySQL está rodando.');
    process.exit(1);
  });

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ status: 'ok', database: process.env.DB_NAME });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ─── Contagem total de jogos ───────────────────────────────────────────────────
app.get('/api/games/count', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM games');
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Verificar se jogo existe ──────────────────────────────────────────────────
app.get('/api/games/:id/exists', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT 1 FROM games WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Listar todos os jogos ─────────────────────────────────────────────────────
app.get('/api/games', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM games ORDER BY match_date ASC, match_time ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Inserir ou atualizar jogo (upsert) ────────────────────────────────────────
app.post('/api/games/upsert', async (req, res) => {
  const g = req.body;
  if (!g || !g.id) {
    return res.status(400).json({ error: 'Payload inválido: campo "id" obrigatório.' });
  }

  try {
    await pool.execute(`
      INSERT INTO games (
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
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?
      )
      ON DUPLICATE KEY UPDATE
        league = VALUES(league),
        country = VALUES(country),
        home_team = VALUES(home_team),
        away_team = VALUES(away_team),
        match_date = VALUES(match_date),
        match_time = VALUES(match_time),
        odd_home = VALUES(odd_home),
        odd_away = VALUES(odd_away),
        odd_draw = VALUES(odd_draw),
        odd_over05 = VALUES(odd_over05),
        odd_over15 = VALUES(odd_over15),
        odd_over25 = VALUES(odd_over25),
        odd_under15 = VALUES(odd_under15),
        odd_under25 = VALUES(odd_under25),
        odd_under35 = VALUES(odd_under35),
        odd_under45 = VALUES(odd_under45),
        odd_over05_ht = VALUES(odd_over05_ht),
        odd_btts_yes = VALUES(odd_btts_yes),
        odd_btts_no = VALUES(odd_btts_no),
        efficiency_home = VALUES(efficiency_home),
        efficiency_away = VALUES(efficiency_away),
        rank_home = VALUES(rank_home),
        rank_away = VALUES(rank_away),
        wins_percent_home = VALUES(wins_percent_home),
        wins_percent_away = VALUES(wins_percent_away),
        avg_goals_scored_home = VALUES(avg_goals_scored_home),
        avg_goals_scored_away = VALUES(avg_goals_scored_away),
        avg_goals_conceded_home = VALUES(avg_goals_conceded_home),
        avg_goals_conceded_away = VALUES(avg_goals_conceded_away),
        avg_goals_conceded_2h_home = VALUES(avg_goals_conceded_2h_home),
        avg_goals_conceded_2h_away = VALUES(avg_goals_conceded_2h_away),
        avg_goals_scored_2h_home = VALUES(avg_goals_scored_2h_home),
        avg_goals_scored_2h_away = VALUES(avg_goals_scored_2h_away),
        avg_goals_scored_1h_home = VALUES(avg_goals_scored_1h_home),
        avg_goals_scored_1h_away = VALUES(avg_goals_scored_1h_away),
        global_goals_match = VALUES(global_goals_match),
        global_goals_league = VALUES(global_goals_league)
    `, [
      g.id, g.league, g.country, g.home_team, g.away_team, g.match_date, g.match_time, g.status ?? 'NS',
      g.odd_home, g.odd_away, g.odd_draw,
      g.odd_over05, g.odd_over15, g.odd_over25,
      g.odd_under15, g.odd_under25, g.odd_under35, g.odd_under45,
      g.odd_over05_ht, g.odd_btts_yes, g.odd_btts_no,
      g.efficiency_home, g.efficiency_away,
      g.rank_home, g.rank_away,
      g.wins_percent_home, g.wins_percent_away,
      g.avg_goals_scored_home, g.avg_goals_scored_away,
      g.avg_goals_conceded_home, g.avg_goals_conceded_away,
      g.avg_goals_conceded_2h_home, g.avg_goals_conceded_2h_away,
      g.avg_goals_scored_2h_home, g.avg_goals_scored_2h_away,
      g.avg_goals_scored_1h_home, g.avg_goals_scored_1h_away,
      g.global_goals_match, g.global_goals_league,
      g.home_score ?? null, g.away_score ?? null, g.home_score_ht ?? null, g.away_score_ht ?? null,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('[upsert] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Atualizar resultado de um jogo ───────────────────────────────────────────
app.put('/api/games/:id/result', async (req, res) => {
  const { home_score, away_score, home_score_ht, away_score_ht } = req.body;
  const { id } = req.params;

  if (home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: 'home_score e away_score são obrigatórios.' });
  }

  try {
    const [result] = await pool.execute(`
      UPDATE games
      SET home_score = ?, away_score = ?,
          home_score_ht = ?, away_score_ht = ?,
          status = 'FT'
      WHERE id = ?
    `, [home_score, away_score, home_score_ht ?? null, away_score_ht ?? null, id]);

    // ── Auto-resolver picks pendentes para este jogo ─────────────────────────
    try {
      const [pendingPicks] = await pool.execute(
        'SELECT id, market FROM daily_picks WHERE game_id = ? AND resolved = 0',
        [id]
      );

      const hs = Number(home_score);
      const as_ = Number(away_score);
      const hsHT = Number(home_score_ht ?? 0);
      const asHT = Number(away_score_ht ?? 0);

      const marketResult = (market) => {
        switch (market) {
          case 'home':     return hs > as_;
          case 'away':     return as_ > hs;
          case 'over05ht': return (hsHT + asHT) > 0;
          case 'over15':   return (hs + as_) > 1;
          case 'over25':   return (hs + as_) > 2;
          case 'under35':  return (hs + as_) < 4;
          case 'under45':  return (hs + as_) < 5;
          case 'btts':     return hs > 0 && as_ > 0;
          default:         return null;
        }
      };

      for (const pick of pendingPicks) {
        const won = marketResult(pick.market);
        if (won !== null) {
          await pool.execute(
            'UPDATE daily_picks SET resolved = 1, result = ?, resolved_at = NOW() WHERE id = ?',
            [won ? 1 : 0, pick.id]
          );
        }
      }

      if (pendingPicks.length > 0) {
        console.log(`[picks] ${pendingPicks.length} pick(s) resolvido(s) para game ${id}`);
      }
    } catch (pickErr) {
      console.warn('[picks] Erro ao resolver picks:', pickErr.message);
      // Não propaga o erro — o resultado do jogo já foi atualizado
    }

    res.json({ success: true, updated: result.affectedRows > 0 });
  } catch (err) {
    console.error('[result] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Picks do Dia ──────────────────────────────────────────────────────────────

// Listar picks de uma data (ou todos se sem ?date=)
app.get('/api/picks', async (req, res) => {
  try {
    const { date } = req.query;
    const params = [];
    let where = '';
    if (date) { where = 'WHERE dp.pick_date = ?'; params.push(date); }

    const [rows] = await pool.execute(
      `SELECT
         dp.*,
         g.home_score,
         g.away_score,
         g.home_score_ht,
         g.away_score_ht,
         g.status AS game_status
       FROM daily_picks dp
       LEFT JOIN games g ON g.id = dp.game_id
       ${where}
       ORDER BY dp.match_time ASC, dp.created_at ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[picks GET] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Salvar pick(s) — aceita array
app.post('/api/picks', async (req, res) => {
  const picks = Array.isArray(req.body) ? req.body : [req.body];
  if (!picks.length) return res.status(400).json({ error: 'Payload vazio.' });

  try {
    const inserted = [];
    for (const p of picks) {
      if (!p.game_id || !p.market || !p.odd_used || !p.pick_date) {
        return res.status(400).json({ error: 'Campos obrigatórios: game_id, market, odd_used, pick_date' });
      }

      // Evita duplicata: mesmo jogo + mesmo mercado
      const [existing] = await pool.execute(
        'SELECT id FROM daily_picks WHERE game_id = ? AND market = ?',
        [p.game_id, p.market]
      );
      if (existing.length > 0) {
        inserted.push({ skipped: true, game_id: p.game_id, market: p.market });
        continue;
      }

      const [result] = await pool.execute(`
        INSERT INTO daily_picks
          (game_id, pick_date, market, odd_used, home_team, away_team, league, country, match_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.game_id, p.pick_date, p.market, p.odd_used,
        p.home_team ?? null, p.away_team ?? null,
        p.league ?? null, p.country ?? null, p.match_time ?? null,
      ]);
      inserted.push({ id: result.insertId, game_id: p.game_id, market: p.market });
    }
    res.json({ success: true, inserted });
  } catch (err) {
    console.error('[picks POST] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Remover pick
app.delete('/api/picks/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM daily_picks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[picks DELETE] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Estatísticas agregadas de picks
app.get('/api/picks/stats', async (req, res) => {
  try {
    const [[row]] = await pool.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(resolved = 1) AS resolved_count,
        SUM(resolved = 0) AS pending_count,
        SUM(result = 1) AS wins,
        SUM(result = 0) AS losses,
        AVG(odd_used) AS avg_odd
      FROM daily_picks
    `);

    const total     = Number(row.resolved_count) || 0;
    const wins      = Number(row.wins) || 0;
    const losses    = Number(row.losses) || 0;
    const avgOdd    = parseFloat(Number(row.avg_odd || 0).toFixed(2));
    const winRate   = total > 0 ? parseFloat(((wins / total) * 100).toFixed(2)) : 0;
    const profit    = wins * (avgOdd - 1) * 100 - losses * 100;
    const roi       = total > 0 ? parseFloat((profit / (total * 100) * 100).toFixed(2)) : 0;

    res.json({
      total: Number(row.total),
      resolved: total,
      pending: Number(row.pending_count) || 0,
      wins,
      losses,
      win_rate: winRate,
      avg_odd: avgOdd,
      profit: parseFloat(profit.toFixed(2)),
      roi,
    });
  } catch (err) {
    console.error('[picks/stats] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Estatísticas para o Dashboard ────────────────────────────────────────────
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    // 1. KPIs gerais
    const [[kpiRow]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_games,
        SUM(status = 'FT') AS finished_games,
        SUM(status = 'NS') AS scheduled_games,
        COUNT(DISTINCT league) AS total_leagues,
        COUNT(DISTINCT match_date) AS total_days
      FROM games
    `);

    // 2. Win rates por mercado (apenas jogos FT com placar)
    const [[marketRow]] = await pool.execute(`
      SELECT
        COUNT(*) AS ft_total,

        -- Match Odds Home
        SUM(CASE WHEN odd_home > 0 THEN 1 ELSE 0 END) AS home_market_total,
        SUM(CASE WHEN odd_home > 0 AND home_score > away_score THEN 1 ELSE 0 END) AS home_wins,

        -- Match Odds Away
        SUM(CASE WHEN odd_away > 0 THEN 1 ELSE 0 END) AS away_market_total,
        SUM(CASE WHEN odd_away > 0 AND away_score > home_score THEN 1 ELSE 0 END) AS away_wins,

        -- Over 2.5
        SUM(CASE WHEN odd_over25 > 0 THEN 1 ELSE 0 END) AS over25_market_total,
        SUM(CASE WHEN odd_over25 > 0 AND (home_score + away_score) > 2 THEN 1 ELSE 0 END) AS over25_wins,

        -- BTTS Yes
        SUM(CASE WHEN odd_btts_yes > 0 THEN 1 ELSE 0 END) AS btts_market_total,
        SUM(CASE WHEN odd_btts_yes > 0 AND home_score > 0 AND away_score > 0 THEN 1 ELSE 0 END) AS btts_wins,

        -- Padrões de gols
        SUM(CASE WHEN (home_score + away_score) >= 1 THEN 1 ELSE 0 END) AS over05_count,
        SUM(CASE WHEN (home_score + away_score) >= 2 THEN 1 ELSE 0 END) AS over15_count,
        SUM(CASE WHEN (home_score + away_score) >= 3 THEN 1 ELSE 0 END) AS over25_count,
        SUM(CASE WHEN (home_score_ht + away_score_ht) >= 1 THEN 1 ELSE 0 END) AS over05ht_count,
        SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) AS home_win_count,
        SUM(CASE WHEN away_score > home_score THEN 1 ELSE 0 END) AS away_win_count,
        SUM(CASE WHEN home_score = away_score THEN 1 ELSE 0 END) AS draw_count,

        -- Média de gols
        AVG(home_score + away_score) AS avg_goals_ft,
        AVG(home_score_ht + away_score_ht) AS avg_goals_ht
      FROM games
      WHERE status = 'FT' AND home_score IS NOT NULL AND away_score IS NOT NULL
    `);

    // 3. Top 10 ligas por volume de jogos finalizados + win rate da casa
    const [topLeagues] = await pool.execute(`
      SELECT
        league,
        country,
        COUNT(*) AS total,
        SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) AS home_wins,
        AVG(home_score + away_score) AS avg_goals
      FROM games
      WHERE status = 'FT' AND home_score IS NOT NULL
      GROUP BY league, country
      ORDER BY total DESC
      LIMIT 10
    `);

    // 4. Evolução diária — jogos por data (últimos 30 dias com dados)
    const [dailyVolume] = await pool.execute(`
      SELECT
        match_date AS date,
        COUNT(*) AS total,
        SUM(status = 'FT') AS finished
      FROM games
      GROUP BY match_date
      ORDER BY match_date ASC
      LIMIT 30
    `);

    // 5. Scatter: odd_home média vs win rate por faixa de odd
    const [oddBuckets] = await pool.execute(`
      SELECT
        ROUND(odd_home, 0) AS odd_bucket,
        AVG(odd_home) AS avg_odd,
        COUNT(*) AS total,
        SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) AS wins
      FROM games
      WHERE status = 'FT' AND home_score IS NOT NULL AND odd_home > 0 AND odd_home <= 8
      GROUP BY odd_bucket
      HAVING total >= 5
      ORDER BY odd_bucket ASC
    `);

    // Monta resposta
    const ft = Number(marketRow.ft_total) || 1; // evitar div/0

    res.json({
      kpis: {
        total_games: Number(kpiRow.total_games),
        finished_games: Number(kpiRow.finished_games),
        scheduled_games: Number(kpiRow.scheduled_games),
        total_leagues: Number(kpiRow.total_leagues),
        total_days: Number(kpiRow.total_days),
      },
      market_stats: {
        home: {
          total: Number(marketRow.home_market_total),
          wins: Number(marketRow.home_wins),
          win_rate: marketRow.home_market_total > 0
            ? (Number(marketRow.home_wins) / Number(marketRow.home_market_total)) * 100 : 0,
        },
        away: {
          total: Number(marketRow.away_market_total),
          wins: Number(marketRow.away_wins),
          win_rate: marketRow.away_market_total > 0
            ? (Number(marketRow.away_wins) / Number(marketRow.away_market_total)) * 100 : 0,
        },
        over25: {
          total: Number(marketRow.over25_market_total),
          wins: Number(marketRow.over25_wins),
          win_rate: marketRow.over25_market_total > 0
            ? (Number(marketRow.over25_wins) / Number(marketRow.over25_market_total)) * 100 : 0,
        },
        btts: {
          total: Number(marketRow.btts_market_total),
          wins: Number(marketRow.btts_wins),
          win_rate: marketRow.btts_market_total > 0
            ? (Number(marketRow.btts_wins) / Number(marketRow.btts_market_total)) * 100 : 0,
        },
      },
      patterns: {
        over05_pct: (Number(marketRow.over05_count) / ft) * 100,
        over15_pct: (Number(marketRow.over15_count) / ft) * 100,
        over25_pct: (Number(marketRow.over25_count) / ft) * 100,
        over05ht_pct: (Number(marketRow.over05ht_count) / ft) * 100,
        home_win_pct: (Number(marketRow.home_win_count) / ft) * 100,
        away_win_pct: (Number(marketRow.away_win_count) / ft) * 100,
        draw_pct: (Number(marketRow.draw_count) / ft) * 100,
        avg_goals_ft: parseFloat(Number(marketRow.avg_goals_ft).toFixed(2)),
        avg_goals_ht: parseFloat(Number(marketRow.avg_goals_ht).toFixed(2)),
      },
      top_leagues: topLeagues.map(l => ({
        league: l.league,
        country: l.country,
        total: Number(l.total),
        home_win_rate: l.total > 0 ? (Number(l.home_wins) / Number(l.total)) * 100 : 0,
        avg_goals: parseFloat(Number(l.avg_goals).toFixed(2)),
      })),
      daily_volume: dailyVolume.map(d => ({
        date: d.date,
        total: Number(d.total),
        finished: Number(d.finished),
      })),
      odd_scatter: oddBuckets.map(b => ({
        odd: parseFloat(Number(b.avg_odd).toFixed(2)),
        win_rate: b.total > 0 ? parseFloat(((Number(b.wins) / Number(b.total)) * 100).toFixed(1)) : 0,
        total: Number(b.total),
      })),
    });
  } catch (err) {
    console.error('[dashboard stats] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─── Backtest de Estratégia ────────────────────────────────────────────────────
app.post('/api/backtest', async (req, res) => {
  const {
    market,
    min_odd,
    max_odd,
    date_start,
    date_end,
    time_start,
    time_end,
    stake = 100,
    // Performance filters
    rank_home_min, rank_home_max,
    rank_away_min, rank_away_max,
    wins_pct_home_min, wins_pct_home_max,
    wins_pct_away_min, wins_pct_away_max,
    avg_scored_home_min, avg_scored_home_max,
    avg_scored_away_min, avg_scored_away_max,
    avg_conceded_home_min, avg_conceded_home_max,
    avg_conceded_away_min, avg_conceded_away_max,
    efficiency_home_min, efficiency_home_max,
    efficiency_away_min, efficiency_away_max,
    global_goals_match_min, global_goals_match_max,
    global_goals_league_min, global_goals_league_max,
    max_rank_diff,
  } = req.body;

  // Monta coluna de odd e condição de vitória por mercado
  const marketMap = {
    home:     { odd_col: 'odd_home',      win_cond: 'home_score > away_score' },
    away:     { odd_col: 'odd_away',      win_cond: 'away_score > home_score' },
    over05ht: { odd_col: 'odd_over05_ht', win_cond: '(home_score_ht + away_score_ht) > 0' },
    over15:   { odd_col: 'odd_over15',    win_cond: '(home_score + away_score) > 1' },
    over25:   { odd_col: 'odd_over25',    win_cond: '(home_score + away_score) > 2' },
    under35:  { odd_col: 'odd_under35',   win_cond: '(home_score + away_score) < 4' },
    under45:  { odd_col: 'odd_under45',   win_cond: '(home_score + away_score) < 5' },
    btts:     { odd_col: 'odd_btts_yes',  win_cond: 'home_score > 0 AND away_score > 0' },
  };

  const m = marketMap[market];
  if (!m) return res.status(400).json({ error: `Mercado inválido: "${market}". Use: ${Object.keys(marketMap).join(', ')}` });

  try {
    const params = [];
    let filters = '';

    // Date / time / odd filters
    if (date_start)  { filters += ' AND match_date >= ?'; params.push(date_start); }
    if (date_end)    { filters += ' AND match_date <= ?'; params.push(date_end); }
    if (time_start)  { filters += ' AND match_time >= ?'; params.push(time_start); }
    if (time_end)    { filters += ' AND match_time <= ?'; params.push(time_end); }
    if (min_odd != null) { filters += ` AND ${m.odd_col} >= ?`; params.push(parseFloat(min_odd)); }
    if (max_odd != null) { filters += ` AND ${m.odd_col} <= ?`; params.push(parseFloat(max_odd)); }

    // Performance filters helper
    const addRange = (col, minVal, maxVal) => {
      if (minVal != null) { filters += ` AND ${col} >= ?`; params.push(parseFloat(minVal)); }
      if (maxVal != null) { filters += ` AND ${col} <= ?`; params.push(parseFloat(maxVal)); }
    };

    addRange('rank_home',              rank_home_min,          rank_home_max);
    addRange('rank_away',              rank_away_min,          rank_away_max);
    addRange('wins_percent_home',      wins_pct_home_min,      wins_pct_home_max);
    addRange('wins_percent_away',      wins_pct_away_min,      wins_pct_away_max);
    addRange('avg_goals_scored_home',  avg_scored_home_min,    avg_scored_home_max);
    addRange('avg_goals_scored_away',  avg_scored_away_min,    avg_scored_away_max);
    addRange('avg_goals_conceded_home',avg_conceded_home_min,  avg_conceded_home_max);
    addRange('avg_goals_conceded_away',avg_conceded_away_min,  avg_conceded_away_max);
    addRange('efficiency_home',        efficiency_home_min,    efficiency_home_max);
    addRange('efficiency_away',        efficiency_away_min,    efficiency_away_max);
    addRange('global_goals_match',     global_goals_match_min, global_goals_match_max);
    addRange('global_goals_league',    global_goals_league_min,global_goals_league_max);

    // Rank difference filter (calculated)
    if (max_rank_diff != null) {
      filters += ' AND ABS(rank_home - rank_away) <= ?';
      params.push(parseFloat(max_rank_diff));
    }

    const sql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN ${m.win_cond} THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN NOT (${m.win_cond}) THEN 1 ELSE 0 END) AS losses,
        AVG(${m.odd_col}) AS avg_odd,
        MIN(match_date) AS first_date,
        MAX(match_date) AS last_date
      FROM games
      WHERE status = 'FT'
        AND home_score IS NOT NULL
        AND ${m.odd_col} > 0
        ${filters}
    `;

    const [[row]] = await pool.execute(sql, params);

    const total  = Number(row.total);
    const wins   = Number(row.wins);
    const losses = Number(row.losses);
    const avgOdd = parseFloat(Number(row.avg_odd).toFixed(2));

    const grossWin  = wins   * stake * (avgOdd - 1);
    const grossLoss = losses * stake;
    const profit    = grossWin - grossLoss;
    const roi       = total > 0 ? (profit / (total * stake)) * 100 : 0;
    const winRate   = total > 0 ? (wins / total) * 100 : 0;

    res.json({
      total,
      wins,
      losses,
      win_rate: parseFloat(winRate.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      avg_odd: avgOdd,
      first_date: row.first_date,
      last_date: row.last_date,
    });
  } catch (err) {
    console.error('[backtest] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});



// ─── Análise de Odds para Estratégia de Juros Compostos ──────────────────────
app.get('/api/stats/compound-odds', async (req, res) => {
  const minOdd = parseFloat(req.query.min_odd || '1.29');
  const maxOdd = parseFloat(req.query.max_odd || '1.39');

  const oddCols = [
    { col: 'odd_home',      label: 'Casa (1X2)',   win: 'home_score > away_score' },
    { col: 'odd_away',      label: 'Fora (1X2)',   win: 'away_score > home_score' },
    { col: 'odd_draw',      label: 'Empate (1X2)', win: 'home_score = away_score' },
    { col: 'odd_over05',    label: 'Over 0.5',     win: '(home_score + away_score) > 0' },
    { col: 'odd_over15',    label: 'Over 1.5',     win: '(home_score + away_score) > 1' },
    { col: 'odd_over25',    label: 'Over 2.5',     win: '(home_score + away_score) > 2' },
    { col: 'odd_under15',   label: 'Under 1.5',    win: '(home_score + away_score) < 2' },
    { col: 'odd_under25',   label: 'Under 2.5',    win: '(home_score + away_score) < 3' },
    { col: 'odd_under35',   label: 'Under 3.5',    win: '(home_score + away_score) < 4' },
    { col: 'odd_under45',   label: 'Under 4.5',    win: '(home_score + away_score) < 5' },
    { col: 'odd_over05_ht', label: 'Over 0.5 HT',  win: '(home_score_ht + away_score_ht) > 0' },
    { col: 'odd_btts_yes',  label: 'BTTS Sim',     win: 'home_score > 0 AND away_score > 0' },
    { col: 'odd_btts_no',   label: 'BTTS Nao',     win: 'NOT (home_score > 0 AND away_score > 0)' },
  ];

  try {
    await pool.execute("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");

    const [[totRow]] = await pool.execute(
      "SELECT COUNT(*) AS total, SUM(status='FT') AS finished FROM games"
    );

    const markets = [];

    for (const { col, label, win } of oddCols) {
      const [rows] = await pool.execute(`
        SELECT
          ROUND(${col}, 2) AS odd_val,
          COUNT(*) AS total,
          SUM(CASE WHEN ${win} THEN 1 ELSE 0 END) AS wins
        FROM games
        WHERE status = 'FT'
          AND home_score IS NOT NULL
          AND ${col} >= ? AND ${col} <= ?
        GROUP BY ROUND(${col}, 2)
        ORDER BY total DESC
        LIMIT 15
      `, [minOdd, maxOdd]);

      if (rows.length === 0) continue;

      const totalInRange = rows.reduce((s, r) => s + Number(r.total), 0);
      const totalWins    = rows.reduce((s, r) => s + Number(r.wins), 0);
      const globalWinRate = totalInRange > 0 ? parseFloat((totalWins / totalInRange * 100).toFixed(2)) : 0;

      let wSum = 0;
      rows.forEach(r => { wSum += Number(r.odd_val) * Number(r.total); });
      const avgOdd  = totalInRange > 0 ? parseFloat((wSum / totalInRange).toFixed(3)) : 0;
      const breakeven = avgOdd > 0 ? parseFloat((1 / avgOdd * 100).toFixed(2)) : 100;

      markets.push({
        label,
        col,
        total_in_range: totalInRange,
        avg_odd: avgOdd,
        win_rate: globalWinRate,
        breakeven,
        is_lucrativo: globalWinRate > breakeven,
        odds_distribution: rows.map(r => ({
          odd: parseFloat(Number(r.odd_val).toFixed(2)),
          count: Number(r.total),
          wins: Number(r.wins),
          win_rate: Number(r.total) > 0 ? parseFloat((Number(r.wins) / Number(r.total) * 100).toFixed(2)) : 0,
        })),
      });
    }

    markets.sort((a, b) => b.total_in_range - a.total_in_range);

    // Top odds globais (união de todos os mercados)
    const unions = oddCols.map(({ col, label, win }) =>
      `SELECT ROUND(${col}, 2) AS odd_val, '${label.replace(/'/g, "''")}' AS mercado,
       SUM(CASE WHEN ${win} THEN 1 ELSE 0 END) AS wins,
       COUNT(*) AS total
       FROM games
       WHERE status='FT' AND home_score IS NOT NULL AND ${col} >= ${minOdd} AND ${col} <= ${maxOdd}
       GROUP BY ROUND(${col}, 2)`
    );
    const [topRows] = await pool.execute(`
      SELECT odd_val, mercado, SUM(wins) AS wins, SUM(total) AS total
      FROM (${unions.join(' UNION ALL ')}) t
      GROUP BY odd_val, mercado
      ORDER BY total DESC
      LIMIT 25
    `);

    const top_odds_global = topRows.map(r => ({
      odd: parseFloat(Number(r.odd_val).toFixed(2)),
      mercado: r.mercado,
      total: Number(r.total),
      wins: Number(r.wins),
      win_rate: Number(r.total) > 0 ? parseFloat((Number(r.wins) / Number(r.total) * 100).toFixed(2)) : 0,
    }));

    // Matemática dos juros compostos
    const compound_math = [];
    const step = 0.01;
    for (let avg = minOdd; avg <= maxOdd + 0.001; avg += step) {
      const a = parseFloat(avg.toFixed(2));
      const compound = parseFloat((a * a).toFixed(4));
      compound_math.push({
        avg_odd: a,
        compound_odd: compound,
        profit_pct: parseFloat(((compound - 1) * 100).toFixed(2)),
        min_win_rate_single: parseFloat((1 / a * 100).toFixed(2)),
        min_win_rate_both: parseFloat((1 / compound * 100).toFixed(2)),
      });
    }

    res.json({
      total_games: Number(totRow.total),
      finished_games: Number(totRow.finished),
      range: { min: minOdd, max: maxOdd },
      markets,
      top_odds_global,
      compound_math,
    });
  } catch (err) {
    console.error('[compound-odds] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─── Geração de Imagens para Redes Sociais ────────────────────────────────────

/**
 * POST /api/generate-images
 * Body: { date: "2026-03-15", types: ["feed","story","resultado","reel"], logo_url?: string }
 * Response: { files: [{ type, filename, url }] }
 */
app.post('/api/generate-images', async (req, res) => {
  const { date, types, logo_url = '' } = req.body;

  if (!date) return res.status(400).json({ error: 'Campo "date" obrigatório.' });

  try {
    // Busca picks do dia com placar via JOIN (mesmo endpoint GET /api/picks)
    const [picks] = await pool.execute(
      `SELECT
         dp.*,
         g.home_score, g.away_score,
         g.home_score_ht, g.away_score_ht,
         g.status AS game_status
       FROM daily_picks dp
       LEFT JOIN games g ON g.id = dp.game_id
       WHERE dp.pick_date = ?
       ORDER BY dp.match_time ASC`,
      [date]
    );

    if (picks.length === 0) {
      return res.status(404).json({ error: `Nenhum pick encontrado para ${date}.` });
    }

    const selectedTypes = Array.isArray(types) && types.length > 0
      ? types
      : ['feed', 'story', 'resultado', 'reel'];

    const files = await generateImages({
      date,
      picks,
      types: selectedTypes,
      logoUrl: logo_url,
    });

    res.json({ success: true, date, files });
  } catch (err) {
    console.error('[generate-images] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`   Endpoints disponíveis:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/games`);
  console.log(`   GET  /api/games/count`);
  console.log(`   GET  /api/games/:id/exists`);
  console.log(`   POST /api/games/upsert`);
  console.log(`   PUT  /api/games/:id/result`);
});
