/**
 * analyze-odds.js
 * Analisa distribuição de odds no intervalo 1.29-1.39 para estratégia de juros compostos
 */
require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');

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
    // Desabilitar strict mode para compatibilidade
    multipleStatements: false,
  });

  // Desabilitar only_full_group_by
  await pool.execute("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");

  console.log('\n=== ANÁLISE DE ODDS: ESTRATÉGIA JUROS COMPOSTOS (1.29-1.39) ===\n');

  // 1. Total de jogos
  const [totalRow] = await query(pool, `
    SELECT COUNT(*) as total, SUM(status='FT') as finished FROM games
  `);
  console.log(`📦 Total de jogos: ${totalRow.total} | Finalizados: ${totalRow.finished}\n`);

  // 2. Definições
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
    { col: 'odd_btts_no',   label: 'BTTS Não',      win: 'NOT (home_score > 0 AND away_score > 0)' },
  ];

  console.log('--- FREQUÊNCIA E WIN RATE POR MERCADO (1.29 ≤ odd ≤ 1.39) ---\n');

  const summary = [];

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
    const globalWinRate = totalInRange > 0 ? (totalWins / totalInRange * 100).toFixed(1) : '0.0';

    summary.push({
      label, col, win,
      total_in_range: totalInRange,
      win_rate: globalWinRate,
      top_odds: rows.slice(0, 6).map(r => ({
        odd: parseFloat(Number(r.odd_val).toFixed(2)),
        count: Number(r.total),
        wins: Number(r.wins),
        win_rate: Number(r.total) > 0 ? (Number(r.wins) / Number(r.total) * 100).toFixed(1) : '0.0'
      }))
    });
  }

  // Ordenar por volume
  summary.sort((a, b) => b.total_in_range - a.total_in_range);

  for (const s of summary) {
    const barFull = Math.max(...s.top_odds.map(o => o.count));
    console.log(`📊 ${s.label.padEnd(12)} | ${String(s.total_in_range).padStart(6)} jogos no range | Win rate: ${s.win_rate}%`);
    for (const o of s.top_odds) {
      const barLen = barFull > 0 ? Math.round((o.count / barFull) * 15) : 0;
      const bar = '█'.repeat(barLen) + '░'.repeat(15 - barLen);
      const oddStr = o.odd.toFixed(2).padStart(5);
      console.log(`   ${oddStr} | ${bar} | ${String(o.count).padStart(5)}x | ${String(o.win_rate).padStart(5)}% ✓`);
    }
    console.log('');
  }

  // 3. Ranking geral: todas as odds 1.29-1.39 de todos os mercados
  console.log('\n--- TOP 20: ODDS MAIS FREQUENTES (todos os mercados juntos) ---\n');

  // Construir UNION com cada mercado
  const unions = oddCols.map(({ col, label, win }) =>
    `SELECT ROUND(${col}, 2) AS odd_val, '${label}' AS mercado,
     SUM(CASE WHEN ${win} THEN 1 ELSE 0 END) AS wins,
     COUNT(*) AS total
     FROM games
     WHERE status='FT' AND home_score IS NOT NULL AND ${col} >= 1.29 AND ${col} <= 1.39
     GROUP BY ROUND(${col}, 2)`
  );

  const unionSQL = `
    SELECT odd_val, mercado, SUM(wins) AS wins, SUM(total) AS total
    FROM (${unions.join(' UNION ALL ')}) t
    GROUP BY odd_val, mercado
    ORDER BY total DESC
    LIMIT 20
  `;

  const topRows = await query(pool, unionSQL);

  console.log('Rank | Odd   | Mercado          | Ocorrências | Win Rate');
  console.log('-----|-------|------------------|-------------|----------');
  topRows.forEach((r, i) => {
    const wr = Number(r.total) > 0 ? (Number(r.wins) / Number(r.total) * 100).toFixed(1) : '0.0';
    console.log(
      `  ${String(i + 1).padStart(2)} | ${Number(r.odd_val).toFixed(2)} | ${String(r.mercado).padEnd(16)} | ${String(r.total).padStart(11)} | ${wr}%`
    );
  });

  // 4. Análise matemática de juros compostos
  console.log('\n\n--- MATEMÁTICA DOS JUROS COMPOSTOS (duas entradas) ---\n');
  console.log('Para a estratégia: Banca × odd1 × odd2 = resultado final por ciclo\n');
  console.log('Avg  | Odd Composta | Lucro/Ciclo | Yield Necessária (2 entradas)');
  console.log('-----|-------------|-------------|-----------------------------');

  for (let avg = 1.29; avg <= 1.391; avg += 0.01) {
    const compound = avg * avg;
    const profit_pct = ((compound - 1) * 100).toFixed(2);
    // Probabilidade mínima necessária para ser lucrativo (1/avg)
    const minWinRate = (1 / avg * 100).toFixed(1);
    const minBothWin = (1 / compound * 100).toFixed(1);
    console.log(
      `${avg.toFixed(2)} | ${compound.toFixed(4).padStart(11)} | ${(profit_pct + '%').padStart(11)} | Win cada: >${minWinRate}% | Ambas verde: >${minBothWin}%`
    );
  }

  // 5. Melhores mercados para a estratégia (win_rate > breakeven)
  console.log('\n\n--- MERCADOS ACIMA DO BREAKEVEN (win_rate > 1/odd) ---\n');
  console.log('Mercado            | Odd média | Win Rate | Breakeven | Resultado');
  console.log('-------------------|-----------|----------|-----------|----------');

  for (const s of summary) {
    if (s.top_odds.length === 0) continue;
    // Calcular odd média e win rate ponderados
    let totalOddWeighted = 0, totalCount = 0, totalWins = 0;
    for (const o of s.top_odds) {
      totalOddWeighted += o.odd * o.count;
      totalCount += o.count;
      totalWins += o.wins;
    }
    const avgOdd = totalCount > 0 ? totalOddWeighted / totalCount : 0;
    const winRate = totalCount > 0 ? totalWins / totalCount * 100 : 0;
    const breakeven = avgOdd > 0 ? 1 / avgOdd * 100 : 100;
    const isGood = winRate > breakeven;
    const emoji = isGood ? '✅' : '❌';
    console.log(
      `${s.label.padEnd(18)} | ${avgOdd.toFixed(2).padStart(9)} | ${winRate.toFixed(1).padStart(8)}% | ${breakeven.toFixed(1).padStart(9)}% | ${emoji} ${isGood ? 'LUCRATIVO' : 'Não lucrativo'}`
    );
  }

  await pool.end();
  console.log('\n\n✅ Análise concluída!\n');
}

main().catch(err => {
  console.error('Erro fatal:', err.message || err);
  process.exit(1);
});
