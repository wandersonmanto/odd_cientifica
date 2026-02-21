import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let db: any = null;

const log = (msg: string, type: 'info' | 'error' = 'info') => {
  postMessage({ type: 'log', payload: { msg, type } });
};

const init = async () => {
  try {
    log('Inicializando SQLite Worker...');
    
    // Diagnóstico: Listar arquivos no OPFS
    try {
        const root = await navigator.storage.getDirectory();
        // @ts-ignore - iterator handling
        for await (const [name, handle] of root.entries()) {
            if (handle.kind === 'file') {
                 const file = await handle.getFile();
                 log(`Arquivo encontrado no OPFS: ${name} (${file.size} bytes)`);
            }
        }
    } catch (e: any) {
        log(`Erro ao listar OPFS: ${e.message}`, 'error');
    }

    const sqlite3 = await sqlite3InitModule({
      print: console.log,
      printErr: console.error,
    });

    // @ts-ignore
    if (sqlite3.opfs) {
      db = new sqlite3.oo1.OpfsDb('/odd_cientifica.db');
      log('Banco de dados OPFS aberto com sucesso.');
    } else {
      db = new sqlite3.oo1.DB('/odd_cientifica_memory.db', 'ct');
      log('OPFS não disponível via sqlite3.opfs. Usando fallback em memória (sem persistência).', 'error');
    }

    // Run migrations table creation
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        league TEXT, country TEXT,
        home_team TEXT, away_team TEXT,
        match_date TEXT, match_time TEXT,
        status TEXT DEFAULT 'NS',
        odd_home REAL, odd_away REAL, odd_draw REAL,
        odd_over05 REAL, odd_over15 REAL, odd_over25 REAL,
        odd_under15 REAL, odd_under25 REAL, odd_under35 REAL, odd_under45 REAL,
        odd_over05_ht REAL, odd_btts_yes REAL, odd_btts_no REAL,
        efficiency_home REAL, efficiency_away REAL,
        rank_home REAL, rank_away REAL,
        wins_percent_home REAL, wins_percent_away REAL,
        avg_goals_scored_home REAL, avg_goals_scored_away REAL,
        avg_goals_conceded_home REAL, avg_goals_conceded_away REAL,
        avg_goals_conceded_2h_home REAL, avg_goals_conceded_2h_away REAL,
        avg_goals_scored_2h_home REAL, avg_goals_scored_2h_away REAL,
        avg_goals_scored_1h_home REAL, avg_goals_scored_1h_away REAL,
        global_goals_match REAL, global_goals_league REAL,
        home_score INTEGER, away_score INTEGER,
        home_score_ht INTEGER, away_score_ht INTEGER
      );

      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_games_date ON games(match_date);
      CREATE INDEX IF NOT EXISTS idx_games_league ON games(league);
      CREATE INDEX IF NOT EXISTS idx_games_home ON games(home_team);
      CREATE INDEX IF NOT EXISTS idx_games_away ON games(away_team);
    `);
    
    postMessage({ type: 'ready' });

  } catch (err: any) {
    log(`Erro fatal no worker: ${err.message}`, 'error');
  }
};

onmessage = async (e) => {
  const { type, id, sql, params, fileData } = e.data;

  if (!db && type !== 'init' && type !== 'import') {
    await init();
  }

  try {
    switch (type) {
      case 'exec':
        db.exec({ sql, bind: params });
        postMessage({ type: 'result', id, success: true });
        break;

      case 'query':
        const result: any[] = [];
        db.exec({
          sql,
          bind: params,
          rowMode: 'object',
          callback: (row: any) => result.push(row),
        });
        postMessage({ type: 'result', id, success: true, payload: result });
        break;

      case 'export':
        try {
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle('odd_cientifica.db');
            const file = await fileHandle.getFile();
            const arrayBuffer = await file.arrayBuffer();
            postMessage({ type: 'exportResult', id, success: true, payload: new Uint8Array(arrayBuffer) });
        } catch (e: any) {
             postMessage({ type: 'result', id, success: false, error: 'Falha ao exportar: ' + e.message });
        }
        break;
        
      case 'import':
          try {
             if (db) {
                 db.close();
                 db = null;
             }
             
             const root = await navigator.storage.getDirectory();
             const fileHandle = await root.getFileHandle('odd_cientifica.db', { create: true });
             const writable = await (fileHandle as any).createWritable();
             await writable.write(fileData);
             await writable.close();
             
             await init(); // Reabre o banco
             postMessage({ type: 'importResult', id, success: true });
          } catch(e: any) {
              // Tenta reabrir o banco antigo se falhar
              if (!db) await init();
              postMessage({ type: 'result', id, success: false, error: 'Falha ao importar: ' + e.message });
          }
          break;
    }
  } catch (err: any) {
    postMessage({ type: 'result', id, success: false, error: err.message });
  }
};

init();
