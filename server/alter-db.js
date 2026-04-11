require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.query('ALTER TABLE games ADD COLUMN odd_1x FLOAT DEFAULT 0 AFTER odd_btts_no');
    console.log('odd_1x added');
  } catch(e) { console.log('odd_1x error/exists:', e.message); }

  try {
    await connection.query('ALTER TABLE games ADD COLUMN odd_x2 FLOAT DEFAULT 0 AFTER odd_1x');
    console.log('odd_x2 added');
  } catch(e) { console.log('odd_x2 error/exists:', e.message); }

  await connection.end();
}

run();
