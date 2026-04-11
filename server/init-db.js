/**
 * server/init-db.js
 * 
 * Script de inicialização — executar UMA VEZ para criar o banco e a tabela.
 * Uso: node server/init-db.js
 */

require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');

async function init() {
  console.log('🔧 Iniciando criação do banco de dados...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  // Cria o banco se não existir
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`✅ Banco '${process.env.DB_NAME}' criado (ou já existia).`);

  await connection.query(`USE \`${process.env.DB_NAME}\``);

  // Cria a tabela games
  await connection.query(`
    CREATE TABLE IF NOT EXISTS games (
      id VARCHAR(255) NOT NULL PRIMARY KEY,
      league VARCHAR(255),
      country VARCHAR(255),
      home_team VARCHAR(255),
      away_team VARCHAR(255),
      match_date VARCHAR(20),
      match_time VARCHAR(10),
      status VARCHAR(10) DEFAULT 'NS',
      odd_home FLOAT,
      odd_away FLOAT,
      odd_draw FLOAT,
      odd_over05 FLOAT,
      odd_over15 FLOAT,
      odd_over25 FLOAT,
      odd_under15 FLOAT,
      odd_under25 FLOAT,
      odd_under35 FLOAT,
      odd_under45 FLOAT,
      odd_over05_ht FLOAT,
      odd_btts_yes FLOAT,
      odd_btts_no FLOAT,
      odd_1x FLOAT,
      odd_x2 FLOAT,
      efficiency_home FLOAT,
      efficiency_away FLOAT,
      rank_home FLOAT,
      rank_away FLOAT,
      wins_percent_home FLOAT,
      wins_percent_away FLOAT,
      avg_goals_scored_home FLOAT,
      avg_goals_scored_away FLOAT,
      avg_goals_conceded_home FLOAT,
      avg_goals_conceded_away FLOAT,
      avg_goals_conceded_2h_home FLOAT,
      avg_goals_conceded_2h_away FLOAT,
      avg_goals_scored_2h_home FLOAT,
      avg_goals_scored_2h_away FLOAT,
      avg_goals_scored_1h_home FLOAT,
      avg_goals_scored_1h_away FLOAT,
      global_goals_match FLOAT,
      global_goals_league FLOAT,
      home_score INT DEFAULT NULL,
      away_score INT DEFAULT NULL,
      home_score_ht INT DEFAULT NULL,
      away_score_ht INT DEFAULT NULL,
      INDEX idx_match_date (match_date),
      INDEX idx_league (league),
      INDEX idx_home_team (home_team),
      INDEX idx_away_team (away_team)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('✅ Tabela `games` criada (ou já existia).');

  // Cria a tabela daily_picks
  await connection.query(`
    CREATE TABLE IF NOT EXISTS daily_picks (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      game_id       VARCHAR(255) NOT NULL,
      pick_date     VARCHAR(20)  NOT NULL,
      market        VARCHAR(50)  NOT NULL,
      odd_used      FLOAT        NOT NULL,
      created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
      resolved      TINYINT(1)   DEFAULT 0,
      result        TINYINT(1)   DEFAULT NULL,
      resolved_at   DATETIME     DEFAULT NULL,
      home_team     VARCHAR(255),
      away_team     VARCHAR(255),
      league        VARCHAR(255),
      country       VARCHAR(255),
      match_time    VARCHAR(10),
      INDEX idx_pick_date (pick_date),
      INDEX idx_game_id   (game_id),
      INDEX idx_resolved  (resolved)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Tabela `daily_picks` criada (ou já existia).');

  await connection.end();
  console.log('🎉 Banco de dados inicializado com sucesso!');
  console.log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`   Banco: ${process.env.DB_NAME}`);
}

init().catch(err => {
  console.error('❌ Erro ao inicializar banco:', err.message);
  process.exit(1);
});
