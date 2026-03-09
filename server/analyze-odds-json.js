/**
 * analyze-odds-json.js
 * Gera resultado em JSON para análise de odds 1.29-1.39
 */
require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function query(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  await pool.execute("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");

  const result = {};

  // 1. Total de jogos
  const [totalRow] = await query(pool, `SELECT COUNT(*) as total, SUM(status='FT') as finished FROM games`);
  result.total_games = Number(totalRow.total);
  result.finished_games = Number(totalRow.finished);

  // 2. Análise por mercado
  const oddCols = [
    { col: 'odd_home',      label: 'Casa (1X2)',     win: 'home_score > away_score' },
    { col: 'odd_away',      label: 'Fora (1X2)',     win: 'away_score > home_score' },
    { col: 'odd_draw',      label: 'Empate (1X2)',   win: 'home_score = away_score' },
    { col: 'odd_over05',    label: 'Over 0.5',       win: '(home_score + away_score) > 0' },
    { col: 'odd_over15',    label: 'Over 1.5',       win: '(home_score + away_score) > 1' },
    { col: 'odd_over25',    label: 'Over 2.5',       win: '(home_score + away_score) > 2' },
    { col: 'odd_under15',   label: 'Under 1.5',     win: '(home_score + away_score) < 2' },
    { col: 'odd_under25',   label: 'Under 2.5',     win: '(home_score + away_score) < 3' },
    { col: 'odd_under35',   label: 'Under 3.5',     win: '(home_score + away_score) < 4' },
    { col: 'odd_under45',   label: 'Under 4.5',     win: '(home_score + away_score) < 5' },
    { col: 'odd_over05_ht', label: 'Over 0.5 HT',   win: '(home_score_ht + away_score_ht) > 0' },
    { col: 'odd_btts_yes',  label: 'BTTS Sim',      win: 'home_score > 0 AND away_score > 0' },
    { col: 'odd_btts_no',   label: 'BTTS Nao',      win: 'NOT (home_score > 0 AND away_score > 0)' },
  ];

  result.markets = [];

  for (const { col, label, win } of oddCols) {
    const rows = await query(pool, `
      SELECT
        ROUND(${col}, 2) AS odd_val,
        COUNT(*) AS total,
        SUM(CASE WHEN ${win} THEN 1 ELSE 0 END) AS wins
      FROM games
      WHERE status = 'FT'
        AND home_score IS NOT NULL
        AND ${col} >= 1.29 AND ${col} <= 1.39
      GROUP BY ROUND(${col}, 2)
      ORDER BY total DESC
      LIMIT 15
    `);

    if (rows.length === 0) continue;

    const totalInRange = rows.reduce((s, r) => s + Number(r.total), 0);
    const totalWins    = rows.reduce((s, r) => s + Number(r.wins), 0);
    const globalWinRate = totalInRange > 0 ? parseFloat((totalWins / totalInRange * 100).toFixed(2)) : 0;
    
    // Calcular odd media ponderada
    let wSum = 0;
    rows.forEach(r => { wSum += Number(r.odd_val) * Number(r.total); });
    const avgOdd = totalInRange > 0 ? parseFloat((wSum / totalInRange).toFixed(3)) : 0;
    const breakeven = avgOdd > 0 ? parseFloat((1 / avgOdd * 100).toFixed(2)) : 100;
    const isLucrativo = globalWinRate > breakeven;

    result.markets.push({
      label,
      col,
      total_in_range: totalInRange,
      avg_odd: avgOdd,
      win_rate: globalWinRate,
      breakeven,
      is_lucrativo: isLucrativo,
      odds_distribution: rows.map(r => ({
        odd: parseFloat(Number(r.odd_val).toFixed(2)),
        count: Number(r.total),
        wins: Number(r.wins),
        win_rate: Number(r.total) > 0 ? parseFloat((Number(r.wins) / Number(r.total) * 100).toFixed(2)) : 0
      }))
    });
  }

  result.markets.sort((a, b) => b.total_in_range - a.total_in_range);

  // 3. Top odds globais
  const unions = oddCols.map(({ col, label, win }) =>
    `SELECT ROUND(${col}, 2) AS odd_val, '${label.replace(/'/g, "\\'")}' AS mercado,
     SUM(CASE WHEN ${win} THEN 1 ELSE 0 END) AS wins,
     COUNT(*) AS total
     FROM games
     WHERE status='FT' AND home_score IS NOT NULL AND ${col} >= 1.29 AND ${col} <= 1.39
     GROUP BY ROUND(${col}, 2)`
  );

  const topRows = await query(pool, `
    SELECT odd_val, mercado, SUM(wins) AS wins, SUM(total) AS total
    FROM (${unions.join(' UNION ALL ')}) t
    GROUP BY odd_val, mercado
    ORDER BY total DESC
    LIMIT 25
  `);

  result.top_odds_global = topRows.map(r => ({
    odd: parseFloat(Number(r.odd_val).toFixed(2)),
    mercado: r.mercado,
    total: Number(r.total),
    wins: Number(r.wins),
    win_rate: Number(r.total) > 0 ? parseFloat((Number(r.wins) / Number(r.total) * 100).toFixed(2)) : 0
  }));

  // 4. Matematica dos juros compostos
  result.compound_math = [];
  for (let avg = 1.29; avg <= 1.391; avg += 0.01) {
    const compound = avg * avg;
    result.compound_math.push({
      avg_odd: parseFloat(avg.toFixed(2)),
      compound_odd: parseFloat(compound.toFixed(4)),
      profit_pct: parseFloat(((compound - 1) * 100).toFixed(2)),
      min_win_rate_single: parseFloat((1 / avg * 100).toFixed(2)),
      min_win_rate_both: parseFloat((1 / compound * 100).toFixed(2))
    });
  }

  // Salvar como JSON
  const outPath = path.join(__dirname, 'odds-analysis.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('JSON salvo em: ' + outPath);

  await pool.end();
}

main().catch(err => {
  console.error('Erro:', err.message || err);
  process.exit(1);
});
