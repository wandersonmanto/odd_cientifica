import React, { useEffect, useState, useCallback } from 'react';
import { GameRecord } from '../types';
import { getAllGames } from '../src/db/gameRepository';

interface SimulationResult extends GameRecord {
  resultWon: boolean | null;
  profit: number;
}

interface RangeFilter {
  min: string;
  max: string;
}

const emptyRange = (): RangeFilter => ({ min: '', max: '' });

const applyRange = (value: number | null | undefined, filter: RangeFilter): boolean => {
  if (value === null || value === undefined) {
    // If filter has any value set, a null field fails the filter
    if (filter.min !== '' || filter.max !== '') return false;
    return true;
  }
  if (filter.min !== '' && value < parseFloat(filter.min)) return false;
  if (filter.max !== '' && value > parseFloat(filter.max)) return false;
  return true;
};

const Simulator: React.FC = () => {
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [filteredGames, setFilteredGames] = useState<SimulationResult[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStatsColumns, setShowStatsColumns] = useState(false);

  // ─── Basic Filters ─────────────────────────────────────────────────────────
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

  // ─── Performance Filters ───────────────────────────────────────────────────
  const [rankHome, setRankHome] = useState<RangeFilter>(emptyRange());
  const [rankAway, setRankAway] = useState<RangeFilter>(emptyRange());
  const [winPctHome, setWinPctHome] = useState<RangeFilter>(emptyRange());
  const [winPctAway, setWinPctAway] = useState<RangeFilter>(emptyRange());
  const [avgScoredHome, setAvgScoredHome] = useState<RangeFilter>(emptyRange());
  const [avgScoredAway, setAvgScoredAway] = useState<RangeFilter>(emptyRange());
  const [avgConcededHome, setAvgConcededHome] = useState<RangeFilter>(emptyRange());
  const [avgConcededAway, setAvgConcededAway] = useState<RangeFilter>(emptyRange());
  const [efficiencyHome, setEfficiencyHome] = useState<RangeFilter>(emptyRange());
  const [efficiencyAway, setEfficiencyAway] = useState<RangeFilter>(emptyRange());
  const [globalGoalsMatch, setGlobalGoalsMatch] = useState<RangeFilter>(emptyRange());
  const [globalGoalsLeague, setGlobalGoalsLeague] = useState<RangeFilter>(emptyRange());
  const [maxRankDiff, setMaxRankDiff] = useState<string>('');

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({ totalGames: 0, winRate: 0, totalProfit: 0, roi: 0 });
  const [patterns, setPatterns] = useState({
    over05ht: { count: 0, percentage: 0 },
    over15ft: { count: 0, percentage: 0 },
    over25ft: { count: 0, percentage: 0 },
    btts: { count: 0, percentage: 0 },
    homeWin: { count: 0, percentage: 0 },
    awayWin: { count: 0, percentage: 0 },
  });

  const activeFilterCount = [
    rankHome, rankAway, winPctHome, winPctAway,
    avgScoredHome, avgScoredAway, avgConcededHome, avgConcededAway,
    efficiencyHome, efficiencyAway, globalGoalsMatch, globalGoalsLeague,
  ].filter(f => f.min !== '' || f.max !== '').length + (maxRankDiff !== '' ? 1 : 0);

  useEffect(() => {
    const load = async () => {
      try {
        const games = await getAllGames();
        setAllGames(games);
      } catch (e) {
        console.error('Falha ao carregar jogos da API:', e);
      }
    };
    load();
  }, []);

  const resetPerformanceFilters = useCallback(() => {
    setRankHome(emptyRange());
    setRankAway(emptyRange());
    setWinPctHome(emptyRange());
    setWinPctAway(emptyRange());
    setAvgScoredHome(emptyRange());
    setAvgScoredAway(emptyRange());
    setAvgConcededHome(emptyRange());
    setAvgConcededAway(emptyRange());
    setEfficiencyHome(emptyRange());
    setEfficiencyAway(emptyRange());
    setGlobalGoalsMatch(emptyRange());
    setGlobalGoalsLeague(emptyRange());
    setMaxRankDiff('');
  }, []);

  const runSimulation = () => {
    let profitTotal = 0;
    let wins = 0;
    let losses = 0;
    let p_over05ht = 0, p_over15ft = 0, p_over25ft = 0, p_btts = 0, p_homeWin = 0, p_awayWin = 0;
    const dailyCounts: Record<string, number> = {};

    const results: SimulationResult[] = allGames.filter(game => {
      // 1. Date Filter
      if (game.match_date < dateStart || game.match_date > dateEnd) return false;
      // 2. Time Filter
      if (game.match_time < timeStart || game.match_time > timeEnd) return false;
      // 3. Status Filter
      if (game.status !== 'FT' || game.home_score === null || game.away_score === null) return false;
      // 4. Odd Filter
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

      // ─── 6. Performance Filters ──────────────────────────────────────────
      if (!applyRange(game.rank_home, rankHome)) return false;
      if (!applyRange(game.rank_away, rankAway)) return false;
      if (!applyRange(game.wins_percent_home, winPctHome)) return false;
      if (!applyRange(game.wins_percent_away, winPctAway)) return false;
      if (!applyRange(game.avg_goals_scored_home, avgScoredHome)) return false;
      if (!applyRange(game.avg_goals_scored_away, avgScoredAway)) return false;
      if (!applyRange(game.avg_goals_conceded_home, avgConcededHome)) return false;
      if (!applyRange(game.avg_goals_conceded_away, avgConcededAway)) return false;
      if (!applyRange(game.efficiency_home, efficiencyHome)) return false;
      if (!applyRange(game.efficiency_away, efficiencyAway)) return false;
      if (!applyRange(game.global_goals_match, globalGoalsMatch)) return false;
      if (!applyRange(game.global_goals_league, globalGoalsLeague)) return false;
      // Rank difference filter
      if (maxRankDiff !== '') {
        const rh = game.rank_home ?? 0;
        const ra = game.rank_away ?? 0;
        if (Math.abs(rh - ra) > parseFloat(maxRankDiff)) return false;
      }

      return true;
    }).filter(game => {
      // 7. Daily Limit Filter
      if (dailyLimit !== '' && dailyLimit > 0) {
        const count = dailyCounts[game.match_date] || 0;
        if (count >= dailyLimit) return false;
        dailyCounts[game.match_date] = count + 1;
      }
      return true;
    }).map(game => {
      let won = false;
      let oddUsed = 0;
      if (market === 'match_odds_home') { oddUsed = game.odd_home; won = game.home_score! > game.away_score!; }
      else if (market === 'match_odds_away') { oddUsed = game.odd_away; won = game.away_score! > game.home_score!; }
      else if (market === 'over_25') { oddUsed = game.odd_over25; won = (game.home_score! + game.away_score!) > 2.5; }
      else if (market === 'btts_yes') { oddUsed = game.odd_btts_yes; won = game.home_score! > 0 && game.away_score! > 0; }

      const pnl = won ? stake * (oddUsed - 1) : -stake;
      if (won) wins++; else losses++;
      profitTotal += pnl;

      const home = game.home_score || 0, away = game.away_score || 0;
      const homeHT = game.home_score_ht || 0, awayHT = game.away_score_ht || 0;
      const totalGoals = home + away, totalGoalsHT = homeHT + awayHT;
      if (totalGoalsHT >= 1) p_over05ht++;
      if (totalGoals >= 2) p_over15ft++;
      if (totalGoals >= 3) p_over25ft++;
      if (home > 0 && away > 0) p_btts++;
      if (home > away) p_homeWin++;
      if (away > home) p_awayWin++;

      return { ...game, resultWon: won, profit: pnl };
    });

    const totalGames = wins + losses;
    setStats({
      totalGames,
      winRate: totalGames > 0 ? (wins / totalGames) * 100 : 0,
      totalProfit: profitTotal,
      roi: totalGames > 0 ? (profitTotal / (totalGames * stake)) * 100 : 0,
    });
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

  // ─── Range Input Helper ────────────────────────────────────────────────────
  const RangeInput = ({
    label, filter, setFilter, icon, unit = '', step = '0.1',
  }: {
    label: string;
    filter: RangeFilter;
    setFilter: (f: RangeFilter) => void;
    icon: string;
    unit?: string;
    step?: string;
  }) => {
    const hasValue = filter.min !== '' || filter.max !== '';
    return (
      <div className={`bg-background-dark rounded-lg p-3 border transition-colors ${hasValue ? 'border-primary/50 shadow-[0_0_8px_rgba(36,255,189,0.15)]' : 'border-border-subtle'}`}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="material-symbols-outlined text-slate-500 text-[14px]">{icon}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          {hasValue && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[9px] text-slate-400 uppercase">Min{unit && ` (${unit})`}</label>
            <input
              type="number"
              step={step}
              placeholder="—"
              value={filter.min}
              onChange={e => setFilter({ ...filter, min: e.target.value })}
              className="w-full bg-surface border border-border-subtle rounded text-xs text-white px-2 py-1.5 font-mono focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-700"
            />
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-slate-400 uppercase">Max{unit && ` (${unit})`}</label>
            <input
              type="number"
              step={step}
              placeholder="—"
              value={filter.max}
              onChange={e => setFilter({ ...filter, max: e.target.value })}
              className="w-full bg-surface border border-border-subtle rounded text-xs text-white px-2 py-1.5 font-mono focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-700"
            />
          </div>
        </div>
      </div>
    );
  };

  const fmt = (v: number | null | undefined, decimals = 2) =>
    v !== null && v !== undefined ? v.toFixed(decimals) : '-';

  return (
    <div className="space-y-6">
      {/* ── Control Panel ─────────────────────────────────────────────────── */}
      <section className="bg-surface rounded-xl border border-border-subtle p-6 shadow-xl space-y-5">
        {/* Basic Filters Row */}
        <div className="flex flex-col lg:flex-row items-end gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9 gap-4 flex-grow w-full">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data Início</label>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hora Início</label>
              <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data Fim</label>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hora Fim</label>
              <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mercado</label>
              <select value={market} onChange={e => setMarket(e.target.value)} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10 appearance-none">
                <option value="match_odds_home">Match Odds (Casa)</option>
                <option value="match_odds_away">Match Odds (Visitante)</option>
                <option value="over_25">Over 2.5 FT</option>
                <option value="btts_yes">Ambas Marcam (Sim)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Odd Mínima</label>
              <input type="number" step="0.01" value={minOdd} onChange={e => setMinOdd(parseFloat(e.target.value))} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10 font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Odd Máxima</label>
              <input type="number" step="0.01" value={maxOdd} onChange={e => setMaxOdd(parseFloat(e.target.value))} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10 font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Horários</label>
              <select value={hourParity} onChange={e => setHourParity(e.target.value)} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10 appearance-none">
                <option value="all">Todos</option>
                <option value="even">Pares</option>
                <option value="odd">Ímpares</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Limite Diário</label>
              <input type="number" min="1" placeholder="Sem limite" value={dailyLimit} onChange={e => setDailyLimit(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-background-dark border-border-subtle rounded-lg text-sm text-white focus:ring-primary focus:border-primary px-3 h-10 font-mono placeholder-slate-600" />
            </div>
          </div>
          <button onClick={runSimulation} className="w-full lg:w-auto min-w-[180px] h-10 bg-primary text-background-dark font-bold rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 px-6 shadow-[0_0_15px_rgba(36,255,189,0.3)] hover:shadow-[0_0_20px_rgba(36,255,189,0.5)] whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            SIMULAR
          </button>
        </div>

        {/* ── Advanced Performance Filters Toggle ─────────────────────────── */}
        <div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border transition-all ${
              showAdvanced
                ? 'bg-primary/10 border-primary/40 text-primary'
                : activeFilterCount > 0
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'border-border-subtle text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Filtros de Performance
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-background-dark text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
            <span className={`material-symbols-outlined text-[16px] ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>expand_more</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Filtros Avançados por Performance das Equipes</span>
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">Todos opcionais — deixe em branco para ignorar</span>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetPerformanceFilters}
                    className="text-[10px] text-slate-500 hover:text-negative flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Posição / Ranking */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">leaderboard</span>
                  Posição na Liga (Ranking)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <RangeInput label="Ranking Mandante" filter={rankHome} setFilter={setRankHome} icon="home" step="1" />
                  <RangeInput label="Ranking Visitante" filter={rankAway} setFilter={setRankAway} icon="flight" step="1" />
                  <div className={`bg-background-dark rounded-lg p-3 border transition-colors ${maxRankDiff !== '' ? 'border-primary/50 shadow-[0_0_8px_rgba(36,255,189,0.15)]' : 'border-border-subtle'}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="material-symbols-outlined text-slate-500 text-[14px]">swap_vert</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dif. Máxima de Ranking</span>
                      {maxRankDiff !== '' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase">Máx. |RankH - RankA|</label>
                      <input
                        type="number" step="1" placeholder="—" value={maxRankDiff}
                        onChange={e => setMaxRankDiff(e.target.value)}
                        className="w-full bg-surface border border-border-subtle rounded text-xs text-white px-2 py-1.5 font-mono focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Win % */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">emoji_events</span>
                  % de Vitórias (Win Rate)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RangeInput label="Win% Mandante" filter={winPctHome} setFilter={setWinPctHome} icon="home" unit="%" step="1" />
                  <RangeInput label="Win% Visitante" filter={winPctAway} setFilter={setWinPctAway} icon="flight" unit="%" step="1" />
                </div>
              </div>

              {/* Avg Goals Scored */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">sports_soccer</span>
                  Média de Gols Marcados
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RangeInput label="Gols Marcados (Mandante)" filter={avgScoredHome} setFilter={setAvgScoredHome} icon="home" />
                  <RangeInput label="Gols Marcados (Visitante)" filter={avgScoredAway} setFilter={setAvgScoredAway} icon="flight" />
                </div>
              </div>

              {/* Avg Goals Conceded */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">gpp_bad</span>
                  Média de Gols Sofridos
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RangeInput label="Gols Sofridos (Mandante)" filter={avgConcededHome} setFilter={setAvgConcededHome} icon="home" />
                  <RangeInput label="Gols Sofridos (Visitante)" filter={avgConcededAway} setFilter={setAvgConcededAway} icon="flight" />
                </div>
              </div>

              {/* Efficiency */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">bolt</span>
                  Eficiência
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RangeInput label="Eficiência Mandante" filter={efficiencyHome} setFilter={setEfficiencyHome} icon="home" />
                  <RangeInput label="Eficiência Visitante" filter={efficiencyAway} setFilter={setEfficiencyAway} icon="flight" />
                </div>
              </div>

              {/* Global Goals */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">public</span>
                  Médias Globais de Gols
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <RangeInput label="Média Global do Confronto" filter={globalGoalsMatch} setFilter={setGlobalGoalsMatch} icon="compare_arrows" />
                  <RangeInput label="Média Global da Liga" filter={globalGoalsLeague} setFilter={setGlobalGoalsLeague} icon="public" />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── KPI Stats Bar ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Jogos', val: stats.totalGames.toString(), icon: 'sports_soccer', color: 'text-white', sub: `${allGames.length} registros totais` },
          { label: 'Taxa de Acerto', val: `${stats.winRate.toFixed(1)}%`, icon: 'analytics', color: 'text-primary', sub: 'Win Rate Calculado' },
          { label: 'Lucro / Prejuízo', val: `R$ ${stats.totalProfit.toFixed(2)}`, icon: 'payments', color: stats.totalProfit >= 0 ? 'text-primary' : 'text-negative', sub: `Stake fixa de R$ ${stake}` },
          { label: 'ROI', val: `${stats.roi.toFixed(1)}%`, icon: 'trending_up', color: stats.roi >= 0 ? 'text-primary' : 'text-negative', sub: 'Retorno sobre Investimento' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface border border-border-subtle p-5 rounded-xl shadow-sm hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
              <span className={`material-symbols-outlined ${i === 0 ? 'text-slate-500' : 'text-primary'} text-[20px]`}>{stat.icon}</span>
            </div>
            <div className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.val}</div>
            <div className="mt-2 text-[10px] text-slate-500">{stat.sub}</div>
          </div>
        ))}
      </section>

      {/* ── Pattern Analysis Cards ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Over 0.5 HT', ...patterns.over05ht, icon: 'hourglass_top' },
          { label: 'Over 1.5 FT', ...patterns.over15ft, icon: 'looks_two' },
          { label: 'Over 2.5 FT', ...patterns.over25ft, icon: 'looks_3' },
          { label: 'Ambas Marcam', ...patterns.btts, icon: 'compare_arrows' },
          { label: 'Casa Vence', ...patterns.homeWin, icon: 'home' },
          { label: 'Visitante Vence', ...patterns.awayWin, icon: 'flight' },
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
                <div className={`h-1 rounded-full ${pat.percentage > 70 ? 'bg-primary shadow-[0_0_5px_#24ffbd]' : 'bg-slate-500'}`} style={{ width: `${Math.min(pat.percentage, 100)}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 font-mono text-right">{pat.count} jogos</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Data Table ────────────────────────────────────────────────────── */}
      <section className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-surface flex-wrap gap-3">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-primary">list_alt</span>
            Relatório Detalhado
            {filteredGames.length > 0 && (
              <span className="text-sm font-normal text-slate-400 ml-1">— {filteredGames.length} jogos</span>
            )}
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle Stats Columns */}
            <button
              onClick={() => setShowStatsColumns(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${showStatsColumns ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border-subtle text-slate-400 hover:text-slate-200'}`}
            >
              <span className="material-symbols-outlined text-[14px]">analytics</span>
              Stats
            </button>
            {/* Stake */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-bold">Stake:</span>
              <input type="number" value={stake} onChange={e => setStake(Number(e.target.value))} className="w-20 bg-background-dark border border-border-subtle rounded text-xs text-white px-2 py-1 text-right" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface text-slate-400 text-xs uppercase tracking-wider font-semibold shadow-sm">
                <th className="px-4 py-3 border-b border-border-subtle bg-surface">Data</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface">Liga</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface">Partida</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface">Placar</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface text-center">Odd Casa</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface text-center">Odd Fora</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface text-center">Dif.</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface text-center">Odd Usada</th>
                {showStatsColumns && (
                  <>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center border-l border-border-subtle">Rank H</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center">Rank A</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center">Win% H</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center">Win% A</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center">Sc H</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center">Sc A</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center">Cc H</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center border-r border-border-subtle">Cc A</th>
                    <th className="px-3 py-3 border-b border-border-subtle bg-primary/5 text-primary text-center">⚽ Glb</th>
                  </>
                )}
                <th className="px-4 py-3 border-b border-border-subtle bg-surface text-center">Resultado</th>
                <th className="px-4 py-3 border-b border-border-subtle bg-surface text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredGames.length === 0 ? (
                <tr>
                  <td colSpan={showStatsColumns ? 19 : 10} className="px-6 py-12 text-center text-slate-500 italic">
                    Nenhum jogo encontrado. Ajuste os filtros e clique em SIMULAR.
                  </td>
                </tr>
              ) : (
                filteredGames.map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-300 font-mono">
                      {row.match_date}<br />
                      <span className="text-slate-500">{row.match_time}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.country} — {row.league}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-white">
                        {row.home_team} <span className="text-slate-500 font-normal px-1">vs</span> {row.away_team}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-background-dark px-2 py-1 rounded border border-border-subtle text-white font-bold">
                        {row.home_score} – {row.away_score}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-2">HT: {row.home_score_ht}–{row.away_score_ht}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-center text-slate-300">{row.odd_home ? row.odd_home.toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-center text-slate-300">{row.odd_away ? row.odd_away.toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-center text-slate-500">{Math.abs((row.odd_home || 0) - (row.odd_away || 0)).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-sm font-medium text-primary text-center">
                      {(market === 'match_odds_home' ? row.odd_home :
                        market === 'match_odds_away' ? row.odd_away :
                        market === 'over_25' ? row.odd_over25 : row.odd_btts_yes)?.toFixed(2)}
                    </td>
                    {showStatsColumns && (
                      <>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 border-l border-border-subtle bg-primary/5">{row.rank_home ?? '-'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 bg-primary/5">{row.rank_away ?? '-'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 bg-primary/5">{fmt(row.wins_percent_home)}%</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 bg-primary/5">{fmt(row.wins_percent_away)}%</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 bg-primary/5">{fmt(row.avg_goals_scored_home)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 bg-primary/5">{fmt(row.avg_goals_scored_away)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 bg-primary/5">{fmt(row.avg_goals_conceded_home)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 border-r border-border-subtle bg-primary/5">{fmt(row.avg_goals_conceded_away)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-center text-slate-300 bg-primary/5">{fmt(row.global_goals_match)}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center size-7 rounded-full ${row.resultWon ? 'bg-primary/10 text-primary' : 'bg-negative/10 text-negative'}`}>
                        <span className="material-symbols-outlined text-[16px] font-bold">{row.resultWon ? 'check' : 'close'}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${row.profit >= 0 ? 'text-primary' : 'text-negative'}`}>
                      {row.profit >= 0 ? '+' : ''}R$ {row.profit.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-background-dark/30 border-t border-border-subtle flex items-center justify-between text-xs text-slate-400">
          <span>
            Mostrando <strong className="text-white">{filteredGames.length}</strong> de <strong className="text-white">{allGames.filter(g => g.status === 'FT').length}</strong> jogos finalizados
            {activeFilterCount > 0 && (
              <span className="ml-2 text-primary">· {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''} de performance ativo{activeFilterCount > 1 ? 's' : ''}</span>
            )}
          </span>
        </div>
      </section>
    </div>
  );
};

export default Simulator;