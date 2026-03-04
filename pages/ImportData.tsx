import React, { useState, useRef, useEffect } from 'react';
import { GameRecord } from '../types';
import { insertOrUpdateGame, updateGameResult, getGameCount, gameExists } from '../src/db/gameRepository';

interface ImportLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const ImportData: React.FC = () => {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [gameCount, setGameCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTypeRef = useRef<'games' | 'results'>('games');
  const logEndRef = useRef<HTMLDivElement>(null);

  // ─── Init DB & Count ──────────────────────────────────────────────────────
  const refreshCount = async () => {
    try {
      const count = await getGameCount();
      setGameCount(count);
      return count;
    } catch (e) {
      console.error('Erro ao ler contagem:', e);
      return 0;
    }
  };

  useEffect(() => {
    // Initial check
    refreshCount().then((count) => {
        setDbReady(true);
        addLog(`Sistema pronto. ${count} registros no banco MySQL.`, 'info');
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, message, type }, ...prev]);
  };

  const handleFileSelect = (type: 'games' | 'results') => {
    importTypeRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    addLog(`Lendo arquivo: ${file.name}...`, 'info');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        if (importTypeRef.current === 'games') {
          await processGamesFile(text);
        } else {
          await processResultsFile(text);
        }
      } catch (err: any) {
        addLog(`Erro durante processamento: ${err?.message ?? err}`, 'error');
      }
      setIsProcessing(false);
      await refreshCount();
    };
    reader.onerror = () => {
      addLog('Erro ao ler arquivo.', 'error');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };


  // ─── CSV Helpers ──────────────────────────────────────────────────────────
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuote) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuote = false; }
        } else { current += char; }
      } else {
        if (char === '"') { inQuote = true; }
        else if (char === ';') { values.push(current.trim()); current = ''; }
        else { current += char; }
      }
    }
    values.push(current.trim());
    return values.map(v => v.replace(/^"|"$/g, '').trim());
  };

  const cleanFloat = (val: any): number => {
    if (!val || typeof val !== 'string') return 0;
    return parseFloat(val.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
  };

  const splitStats = (val: string): [number, number] => {
    if (!val || typeof val !== 'string') return [0, 0];
    const parts = val.split('|');
    if (parts.length < 2) return [0, 0];
    return [cleanFloat(parts[0].replace('%', '')), cleanFloat(parts[1].replace('%', ''))];
  };

  const processHeaders = (line: string): string[] => {
    const rawHeaders = parseCSVLine(line);
    const counts: Record<string, number> = {};
    return rawHeaders.map(h => {
      let key = h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+\|\s+/g, '_|_').replace(/\s+/g, '_');
      if (['odds', 'casa_|_fora', 'global', 'result'].includes(key)) {
        if (counts[key] === undefined) { counts[key] = 0; }
        else { counts[key]++; key = `${key}_${counts[key]}`; }
      }
      return key;
    });
  };

  const processDateTime = (rawHour: string): { fullDate: string; timeOnly: string } => {
    if (!rawHour || !rawHour.includes(' ')) {
      return { fullDate: new Date().toISOString().split('T')[0], timeOnly: rawHour ?? '00:00' };
    }
    const [datePart, timePart] = rawHour.split(' ');
    const sep = datePart.includes('-') ? '-' : '/';
    const [day, month, year] = datePart.split(sep);
    if (!year || !month || !day) {
      return { fullDate: new Date().toISOString().split('T')[0], timeOnly: timePart };
    }
    return { fullDate: `${year}-${month}-${day}`, timeOnly: timePart };
  };

  // ─── Process: Jogos do Dia (Arquivo 1) ───────────────────────────────────
  const processGamesFile = async (csvText: string) => {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split('\n').filter(l => l.trim().length > 0);

    if (lines.length === 0) { addLog('Arquivo vazio.', 'error'); return; }

    const headers = processHeaders(lines[0]);
    const idx = (name: string) => headers.indexOf(name);

    if (idx('home_team') === -1 || idx('hour') === -1) {
      addLog(`Headers inválidos. Esperado 'Home Team' e 'Hour'. Encontrado: ${headers.slice(0, 5).join(', ')}...`, 'error');
      return;
    }

    let newCount = 0;
    let updateCount = 0;

    // Processar em chunks para não travar a UI (embora worker ajude, o loop JS ainda roda aqui)
    addLog(`Processando ${lines.length - 1} linhas...`, 'info');

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 5) continue;

      const getVal = (col: string) => { const ix = idx(col); return ix !== -1 ? row[ix] || '' : ''; };

      const home_team = getVal('home_team');
      const away_team = getVal('visitor_team');
      const rawHour = getVal('hour');
      if (!home_team || !rawHour) continue;

      const { fullDate: match_date, timeOnly: match_time } = processDateTime(rawHour);
      const id = `${home_team}_${away_team}_${match_date}`.replace(/\s+/g, '_').toLowerCase();

      const [eff_h, eff_a] = splitStats(getVal('casa_|_fora'));
      const [rank_h, rank_a] = splitStats(getVal('casa_|_fora_1'));
      const [win_h, win_a] = splitStats(getVal('casa_|_fora_2'));
      const [gs_h, gs_a] = splitStats(getVal('casa_|_fora_3'));
      const [gc_h, gc_a] = splitStats(getVal('casa_|_fora_4'));
      const [gc2_h, gc2_a] = splitStats(getVal('casa_|_fora_5'));
      const [gs2_h, gs2_a] = splitStats(getVal('casa_|_fora_6'));
      const [gs1_h, gs1_a] = splitStats(getVal('casa_|_fora_7'));

      // Usar status 'NS' por padrão
      const status = 'NS'; 
      // Se quiser verificar se já existe resultado, precisaria ler do banco. 
      // Mas para import de jogos novos, assumimos NS ou mantemos o que tem se fizermos Query antes.
      // Simplificação: Upsert vai sobrescrever valores. Se quisermos preservar status de jogos finalizados,
      // precisariamos fazer check antes.
      // O repositório faz INSERT OR REPLACE, então cuidado. 
      // Idealmente: `INSERT INTO ... ON CONFLICT(id) DO UPDATE SET ...` (SQLite suporta)
      // O `gameRepository` atual faz `INSERT OR REPLACE` total. 
      // Vou manter assim por enquanto, mas note que isso pode resetar status 'FT' se reimportar o mesmo jogo.

      const record: GameRecord = {
        id,
        league: getVal('league'),
        country: getVal('country'),
        home_team,
        away_team,
        match_date,
        match_time,
        status, 
        odd_home: cleanFloat(getVal('odds')),
        odd_away: cleanFloat(getVal('odds_1')),
        odd_draw: cleanFloat(getVal('odds_9')),
        odd_over05: cleanFloat(getVal('odds_2')),
        odd_over15: cleanFloat(getVal('odds_3')),
        odd_over25: cleanFloat(getVal('odds_6')),
        odd_under25: cleanFloat(getVal('odds_4')),
        odd_under35: cleanFloat(getVal('odds_5')),
        odd_under45: cleanFloat(getVal('odds_7')),
        odd_under15: cleanFloat(getVal('odds_8')),
        odd_over05_ht: cleanFloat(getVal('odds_10')),
        odd_btts_yes: cleanFloat(getVal('odds_11')),
        odd_btts_no: cleanFloat(getVal('odds_12')),
        efficiency_home: eff_h, efficiency_away: eff_a,
        rank_home: rank_h, rank_away: rank_a,
        wins_percent_home: win_h, wins_percent_away: win_a,
        avg_goals_scored_home: gs_h, avg_goals_scored_away: gs_a,
        avg_goals_conceded_home: gc_h, avg_goals_conceded_away: gc_a,
        avg_goals_conceded_2h_home: gc2_h, avg_goals_conceded_2h_away: gc2_a,
        avg_goals_scored_2h_home: gs2_h, avg_goals_scored_2h_away: gs2_a,
        avg_goals_scored_1h_home: gs1_h, avg_goals_scored_1h_away: gs1_a,
        global_goals_match: cleanFloat(getVal('global')),
        global_goals_league: cleanFloat(getVal('global_1')),
        home_score: null, away_score: null, home_score_ht: null, away_score_ht: null,
      };

      const exists = await gameExists(id);
      if (exists) updateCount++; else newCount++;

      await insertOrUpdateGame(record);
      
      // Update progress log every 200 items
      if (i % 200 === 0) setGameCount(await getGameCount());
    }

    const total = await getGameCount();
    setGameCount(total);
    addLog(`Concluído: ${newCount} novos jogos, ${updateCount} atualizados.`, 'success');
  };

  // ─── Process: Resultados (Arquivo 2) ─────────────────────────────────────
  const processResultsFile = async (csvText: string) => {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split('\n').filter(l => l.trim().length > 0);

    if (lines.length === 0) { addLog('Arquivo vazio.', 'error'); return; }

    const headers = processHeaders(lines[0]);
    const idx = (name: string) => headers.indexOf(name);

    let matchedCount = 0;
    let notFoundCount = 0;

    addLog(`Processando resultados em ${lines.length - 1} linhas...`, 'info');

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 3) continue;

      const getVal = (col: string) => { const ix = idx(col); return ix !== -1 ? row[ix] || '' : ''; };

      const home_team = getVal('home_team');
      const away_team = getVal('visitor_team');
      const rawHour = getVal('hour');
      if (!home_team || !rawHour) continue;

      const { fullDate: match_date } = processDateTime(rawHour);
      const id = `${home_team}_${away_team}_${match_date}`.replace(/\s+/g, '_').toLowerCase();

      // Try reading FT score
      let homeScore: number | null = null;
      let awayScore: number | null = null;

      const scoreH = getVal('result_home');
      const scoreA = getVal('result_visitor');

      if (scoreH !== '' && scoreA !== '') {
        homeScore = parseInt(scoreH);
        awayScore = parseInt(scoreA);
      } else {
        const resultFT = getVal('result');
        if (resultFT?.includes('-')) {
          const [h, a] = resultFT.split('-');
          homeScore = parseInt(h);
          awayScore = parseInt(a);
        }
      }

      if (homeScore === null || awayScore === null) continue;

      // HT Score (optional)
      const scoreHT_H = getVal('result_home_ht');
      const scoreHT_A = getVal('result_visitor_ht');
      const homeHT = scoreHT_H !== '' ? parseInt(scoreHT_H) : null;
      const awayHT = scoreHT_A !== '' ? parseInt(scoreHT_A) : null;

      const updated = await updateGameResult(id, homeScore, awayScore, homeHT, awayHT);
      if (updated) matchedCount++; else notFoundCount++;

      if (i % 200 === 0) await refreshCount(); // Ping to keep alive
    }

    await refreshCount();
    addLog(
      `Resultados processados: ${matchedCount} jogos atualizados, ${notFoundCount} não encontrados.`,
      matchedCount > 0 ? 'success' : 'warning'
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />

      <div className="flex flex-col gap-2 border-l-4 border-primary pl-6 py-2">
        <h1 className="text-white text-4xl font-black leading-tight tracking-tight uppercase italic">Importação de Dados</h1>
        <p className="text-slate-400 text-base max-w-2xl font-display">
          Gerenciamento do banco de dados MySQL. Importe jogos e atualize resultados via CSV.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Jogos do Dia */}
        <div
          onClick={() => !isProcessing && handleFileSelect('games')}
          className={`group relative flex flex-col bg-surface/40 border border-border-subtle rounded-xl p-6 transition-all hover:bg-surface/60 hover:border-primary/50 overflow-hidden ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <span className="material-symbols-outlined text-8xl text-primary">calendar_today</span>
          </div>
          <div className="z-10 flex flex-col h-full">
            <div className="size-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-2xl">calendar_today</span>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Jogos do Dia</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow">Importar CSV com odds e estatísticas pré-jogo.</p>
            <button className="w-full bg-primary hover:bg-primary/90 text-background-dark font-black py-3 rounded-lg transition-all uppercase text-sm flex items-center justify-center gap-2">
              <span>Selecionar CSV</span>
            </button>
          </div>
        </div>

        {/* Card 2: Resultados */}
        <div
          onClick={() => !isProcessing && handleFileSelect('results')}
          className={`group relative flex flex-col bg-surface/40 border border-border-subtle rounded-xl p-6 transition-all hover:bg-surface/60 hover:border-primary/50 overflow-hidden ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <span className="material-symbols-outlined text-8xl text-primary">fact_check</span>
          </div>
          <div className="z-10 flex flex-col h-full">
            <div className="size-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-2xl">fact_check</span>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Resultados</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow">Atualizar placares FT/HT de jogos existentes.</p>
            <button className="w-full bg-surface border border-primary text-primary hover:bg-primary hover:text-background-dark font-black py-3 rounded-lg transition-all uppercase text-sm flex items-center justify-center gap-2">
              <span>Selecionar CSV</span>
            </button>
          </div>
        </div>

        {/* Card 3: Status */}
          <div className="bg-surface/30 border-2 border-dashed border-border-subtle rounded-xl p-6 flex flex-col items-center justify-between text-center gap-4">
          <div>
            <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${dbReady ? 'bg-primary shadow-[0_0_8px_#24ffbd]' : 'bg-slate-600'}`} />
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{dbReady ? 'MySQL ONLINE' : 'Conectando...'}</p>
            <p className="text-4xl font-mono text-primary font-bold mt-2">{gameCount.toLocaleString()}</p>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Registros Totais</p>
          </div>
        </div>
      </div>

      {/* Console */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">terminal</span>
            <h2 className="text-white text-xl font-bold uppercase tracking-tighter italic">Console</h2>
          </div>
          {isProcessing && <span className="text-primary animate-pulse font-mono text-xs">PROCESSANDO...</span>}
        </div>

        <div className="bg-black/50 border border-border-subtle rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs flex flex-col-reverse">
          <div ref={logEndRef} />
          {logs.length === 0 && <p className="text-slate-600 italic">Aguardando operação...</p>}
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 flex gap-3 ${
              log.type === 'error' ? 'text-negative' :
              log.type === 'success' ? 'text-primary' :
              log.type === 'warning' ? 'text-orange-400' : 'text-slate-300'
            }`}>
              <span className="text-slate-600 shrink-0">[{log.time}]</span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImportData;