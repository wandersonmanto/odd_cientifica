import React, { useEffect, useState } from 'react';
import { GameRecord } from '../types';
import { initDB } from '../src/db/database';
import { getAllGames } from '../src/db/gameRepository';

interface SimulationResult extends GameRecord {
  resultWon: boolean | null; // null if not applicable or pending
  profit: number;
}

interface PatternStats {
  count: number;
  percentage: number;
}

const Simulator: React.FC = () => {
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [filteredGames, setFilteredGames] = useState<SimulationResult[]>([]);
  
  // Filters State
  const [dateStart, setDateStart] = useState('2026-02-01');
  const [dateEnd, setDateEnd] = useState('2026-02-02');
  const [timeStart, setTimeStart] = useState('00:00');
  const [timeEnd, setTimeEnd] = useState('23:59');
  const [market, setMarket] = useState('match_odds_home');
  const [minOdd, setMinOdd] = useState(1.50);
  const [maxOdd, setMaxOdd] = useState(3.50);
  const [stake, setStake] = useState(100);
  const [hourParity, setHourParity] = useState<string>('all');
  const [dailyLimit, setDailyLimit] = useState<number | ''>('');

  // Stats State
  const [stats, setStats] = useState({
    totalGames: 0,
    winRate: 0,
    totalProfit: 0,
    roi: 0
  });

  // Pattern Analysis State
  const [patterns, setPatterns] = useState({
    over05ht: { count: 0, percentage: 0 },
    over15ft: { count: 0, percentage: 0 },
    over25ft: { count: 0, percentage: 0 },
    btts: { count: 0, percentage: 0 },
    homeWin: { count: 0, percentage: 0 },
    awayWin: { count: 0, percentage: 0 },
  });

  // Load Data from SQLite
  useEffect(() => {
    const load = async () => {
      try {
        await initDB();
        const games = await getAllGames();
        setAllGames(games);
        // Opcional: setar datas baseado nos dados carregados, se quiser
      } catch (e) {
        console.error('Failed to load DB', e);
      }
    };
    load();
  }, []);

  const runSimulation = () => {
    let profitTotal = 0;
    let wins = 0;
    let losses = 0;

    // Pattern Counters
    let p_over05ht = 0;
    let p_over15ft = 0;
    let p_over25ft = 0;
    let p_btts = 0;
    let p_homeWin = 0;
    let p_awayWin = 0;

    // Daily Limit Counter
    const dailyCounts: Record<string, number> = {};

    const results: SimulationResult[] = allGames.filter(game => {
      // 1. Date Filter
      if (game.match_date < dateStart || game.match_date > dateEnd) return false;
      
      // 2. Time Filter
      if (game.match_time < timeStart || game.match_time > timeEnd) return false;

      // 3. Status Filter (Only finished games for backtest)
      if (game.status !== 'FT' || game.home_score === null || game.away_score === null) return false;

      // 4. Odd Filter logic depends on market
      let oddToCheck = 0;
      switch (market) {
        case 'match_odds_home': oddToCheck = game.odd_home; break;
        case 'match_odds_away': oddToCheck = game.odd_away; break;
        case 'over_25': oddToCheck = game.odd_over25; break;
        case 'btts_yes': oddToCheck = game.odd_btts_yes; break;
      }

      if (!oddToCheck || oddToCheck < minOdd || oddToCheck > maxOdd) return false;

      // 5. Hour Parity Filter
      if (hourParity !== 'all') {
        const hour = parseInt(game.match_time.split(':')[0], 10);
        if (hourParity === 'even' && hour % 2 !== 0) return false;
        if (hourParity === 'odd' && hour % 2 === 0) return false;
      }

      return true;
    }).filter(game => {
      // 6. Daily Limit Filter
      if (dailyLimit !== '' && dailyLimit > 0) {
        const count = dailyCounts[game.match_date] || 0;
        if (count >= dailyLimit) return false;
        dailyCounts[game.match_date] = count + 1;
      }
      return true;
    }).map(game => {
      // --- Financial Logic ---
      let won = false;
      let oddUsed = 0;

      if (market === 'match_odds_home') {
        oddUsed = game.odd_home;
        won = (game.home_score! > game.away_score!);
      } else if (market === 'match_odds_away') {
        oddUsed = game.odd_away;
        won = (game.away_score! > game.home_score!);
      } else if (market === 'over_25') {
        oddUsed = game.odd_over25;
        won = ((game.home_score! + game.away_score!) > 2.5);
      } else if (market === 'btts_yes') {
        oddUsed = game.odd_btts_yes;
        won = (game.home_score! > 0 && game.away_score! > 0);
      }

      const pnl = won ? (stake * (oddUsed - 1)) : -stake;
      
      if (won) wins++; else losses++;
      profitTotal += pnl;

      // --- Pattern Logic (Independent of Strategy) ---
      const home = game.home_score || 0;
      const away = game.away_score || 0;
      const homeHT = game.home_score_ht || 0;
      const awayHT = game.away_score_ht || 0;
      const totalGoals = home + away;
      const totalGoalsHT = homeHT + awayHT;

      if (totalGoalsHT >= 1) p_over05ht++;
      if (totalGoals >= 2) p_over15ft++;
      if (totalGoals >= 3) p_over25ft++;
      if (home > 0 && away > 0) p_btts++;
      if (home > away) p_homeWin++;
      if (away > home) p_awayWin++;

      return {
        ...game,
        resultWon: won,
        profit: pnl
      };
    });

    const totalGames = wins + losses;

    // Update Financial Stats
    setStats({
      totalGames,
      winRate: totalGames > 0 ? (wins / totalGames) * 100 : 0,
      totalProfit: profitTotal,
      roi: totalGames > 0 ? (profitTotal / (totalGames * stake)) * 100 : 0
    });

    // Update Pattern Stats
    setPatterns({
        over05ht: { count: p_over05ht, percentage: totalGames > 0 ? (p_over05ht / totalGames) * 100 : 0 },
        over15ft: { count: p_over15ft, percentage: totalGames > 0 ? (p_over15ft / totalGames) * 100 : 0 },
        over25ft: { count: p_over25ft, percentage: totalGames > 0 ? (p_over25ft / totalGames) * 100 : 0 },
        btts: { count: p_btts, percentage: totalGames > 0 ? (p_btts / totalGames) * 100 : 0 },
        homeWin: { count: p_homeWin, percentage: totalGames > 0 ? (p_homeWin / totalGames) * 100 : 0 },
        awayWin: { count: p_awayWin, percentage: totalGames > 0 ? (p_awayWin / totalGames) * 100 : 0 },
    });

    setFilteredGames(results);
  };

  return (
    <div className="space-y-8">
      {/* Control Panel */}
      <section className="bg-surface rounded-xl border border-border-subtle p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 flex-grow w-full">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Início</label>
              <input 
                type="date" 
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hora Início</label>
              <input 
                type="time" 
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Fim</label>
              <input 
                type="date" 
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hora Fim</label>
              <input 
                type="time" 
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mercado</label>
              <select 
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12 appearance-none"
              >
                <option value="match_odds_home">Match Odds (Casa)</option>
                <option value="match_odds_away">Match Odds (Visitante)</option>
                <option value="over_25">Over 2.5 FT</option>
                <option value="btts_yes">Ambas Marcam (Sim)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Odd Mínima</label>
              <input 
                type="number" step="0.01" 
                value={minOdd}
                onChange={(e) => setMinOdd(parseFloat(e.target.value))}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12 font-mono" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Odd Máxima</label>
              <input 
                type="number" step="0.01" 
                value={maxOdd}
                onChange={(e) => setMaxOdd(parseFloat(e.target.value))}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12 font-mono" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Horários</label>
              <select 
                value={hourParity}
                onChange={(e) => setHourParity(e.target.value)}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12 appearance-none"
              >
                <option value="all">Todos</option>
                <option value="even">Pares</option>
                <option value="odd">Ímpares</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Limite Diário</label>
              <input 
                type="number" 
                min="1"
                placeholder="Sem limite"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-4 h-12 font-mono placeholder-slate-600" 
              />
            </div>
          </div>
          <button 
            onClick={runSimulation}
            className="w-full lg:w-auto min-w-[200px] h-12 bg-primary text-background-dark font-bold rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 px-6 shadow-[0_0_15px_rgba(36,255,189,0.3)] hover:shadow-[0_0_20px_rgba(36,255,189,0.5)]"
          >
            <span className="material-symbols-outlined text-[20px]">play_arrow</span>
            SIMULAR BACKTEST
          </button>
        </div>
      </section>

      {/* KPI Stats Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total de Jogos", val: stats.totalGames.toString(), icon: "sports_soccer", color: "text-white", sub: "Filtrado da base local" },
          { label: "Taxa de Acerto", val: `${stats.winRate.toFixed(1)}%`, icon: "analytics", color: "text-primary", sub: "Win Rate Calculado" },
          { label: "Lucro / Prejuízo", val: `R$ ${stats.totalProfit.toFixed(2)}`, icon: "payments", color: stats.totalProfit >= 0 ? "text-primary" : "text-negative", sub: `Stake fixa de R$ ${stake}` },
          { label: "ROI", val: `${stats.roi.toFixed(1)}%`, icon: "trending_up", color: stats.roi >= 0 ? "text-primary" : "text-negative", sub: "Retorno sobre Investimento" }
        ].map((stat, i) => (
          <div key={i} className="bg-surface border border-border-subtle p-5 rounded-xl shadow-sm hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
              <span className={`material-symbols-outlined ${i === 0 ? 'text-slate-500' : 'text-primary'} text-[20px]`}>{stat.icon}</span>
            </div>
            <div className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.val}</div>
            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
               {stat.sub}
            </div>
          </div>
        ))}
      </section>

      {/* Pattern Analysis Cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Over 0.5 HT", ...patterns.over05ht, icon: "hourglass_top" },
          { label: "Over 1.5 FT", ...patterns.over15ft, icon: "looks_two" },
          { label: "Over 2.5 FT", ...patterns.over25ft, icon: "looks_3" },
          { label: "Ambas Marcam", ...patterns.btts, icon: "compare_arrows" },
          { label: "Casa Vence", ...patterns.homeWin, icon: "home" },
          { label: "Visitante Vence", ...patterns.awayWin, icon: "flight" },
        ].map((pat, i) => (
          <div key={i} className="bg-surface/50 border border-border-subtle p-4 rounded-xl flex flex-col justify-between hover:bg-surface hover:border-primary/30 transition-all">
             <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-slate-500 text-sm">{pat.icon}</span>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{pat.label}</span>
             </div>
             <div>
                <div className={`text-xl font-mono font-bold ${pat.percentage > 70 ? 'text-primary' : 'text-white'}`}>
                    {pat.percentage.toFixed(1)}%
                </div>
                <div className="w-full bg-slate-800 h-1 rounded-full mt-2 mb-1">
                     <div className={`h-1 rounded-full ${pat.percentage > 70 ? 'bg-primary shadow-[0_0_5px_#24ffbd]' : 'bg-slate-500'}`} style={{ width: `${pat.percentage}%` }}></div>
                </div>
                <p className="text-[10px] text-slate-500 font-mono text-right">{pat.count} jogos</p>
             </div>
          </div>
        ))}
      </section>

      {/* Data Table */}
      <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-surface">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-primary">list_alt</span>
            Relatório Detalhado
          </h3>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-bold">Stake:</span>
                <input 
                    type="number" 
                    value={stake} 
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="w-20 bg-background-dark border border-border-subtle rounded text-xs text-white px-2 py-1 text-right"
                />
             </div>
             <div className="flex gap-2">
                <button className="bg-background-dark border border-border-subtle p-2 rounded hover:bg-white/5 text-slate-400 transition-colors">
                <span className="material-symbols-outlined text-[20px]">download</span>
                </button>
             </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface text-slate-400 text-xs uppercase tracking-wider font-semibold shadow-sm">
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface">Data</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface">Liga</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface">Partida</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface">Placar</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface text-center" title="Odd do Mandante">Odd Casa</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface text-center" title="Odd do Visitante">Odd Fora</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface text-center" title="Diferença Absoluta">Dif. Odds</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface text-center" title="Odd selecionada no filtro">Odd Usada</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface text-center">Resultado</th>
                 <th className="px-6 py-4 border-b border-border-subtle bg-surface text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredGames.length === 0 ? (
                  <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500 italic">
                          Nenhum jogo encontrado para os filtros selecionados ou simulação ainda não executada.
                      </td>
                  </tr>
              ) : (
                filteredGames.map((row, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 text-xs text-slate-300 font-mono">
                        {row.match_date}<br/>
                        <span className="text-slate-500">{row.match_time}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                        {row.country} - {row.league}
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">{row.home_team} <span className="text-slate-500 font-normal px-1">vs</span> {row.away_team}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-background-dark px-2 py-1 rounded border border-border-subtle text-white font-bold">
                            {row.home_score} - {row.away_score}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-2">HT: {row.home_score_ht}-{row.away_score_ht}</span>
                    </td>
                    {/* New Columns */}
                    <td className="px-6 py-4 font-mono text-xs text-center text-slate-300">
                        {row.odd_home ? row.odd_home.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-center text-slate-300">
                        {row.odd_away ? row.odd_away.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-center text-slate-500">
                        {Math.abs((row.odd_home || 0) - (row.odd_away || 0)).toFixed(2)}
                    </td>

                    <td className="px-6 py-4 font-mono text-sm font-medium text-primary text-center">
                        {(market === 'match_odds_home' ? row.odd_home : 
                          market === 'match_odds_away' ? row.odd_away :
                          market === 'over_25' ? row.odd_over25 : row.odd_btts_yes)?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center size-8 rounded-full ${row.resultWon ? 'bg-primary/10 text-primary' : 'bg-negative/10 text-negative'}`}>
                        <span className="material-symbols-outlined text-[18px] font-bold">{row.resultWon ? 'check' : 'close'}</span>
                        </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-mono text-sm font-bold ${row.profit >= 0 ? 'text-primary' : 'text-negative'}`}>
                        {row.profit >= 0 ? '+' : ''} R$ {row.profit.toFixed(2)}
                    </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-background-dark/30 border-t border-border-subtle flex items-center justify-between text-xs text-slate-400">
          <span>Mostrando {filteredGames.length} de {allGames.length} registros totais</span>
        </div>
      </section>
    </div>
  );
};

export default Simulator;