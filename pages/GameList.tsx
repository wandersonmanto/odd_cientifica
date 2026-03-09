import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { GameRecord } from '../types';
import { getAllGames } from '../src/db/gameRepository';

const GameList: React.FC = () => {
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [filteredGames, setFilteredGames] = useState<GameRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Filters State
  const [hideUnplayed, setHideUnplayed] = useState(false);
  const [hideNoHome, setHideNoHome] = useState(false);
  const [hideNoOv15, setHideNoOv15] = useState(false);
  const [hideNoUn35, setHideNoUn35] = useState(false);
  const [oddMin, setOddMin] = useState('');
  const [oddMax, setOddMax] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');

  // All odd columns to check for range filter
  const ODD_COLS: (keyof GameRecord)[] = [
    'odd_home', 'odd_away', 'odd_draw',
    'odd_over05', 'odd_over15', 'odd_over25',
    'odd_under15', 'odd_under25', 'odd_under35', 'odd_under45',
    'odd_over05_ht', 'odd_btts_yes', 'odd_btts_no',
  ];
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const gamesPerPage = 50;

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof GameRecord | '', direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    const load = async () => {
      try {
        const games = await getAllGames();
        setAllGames(games);
        if (games.length > 0) {
          const sorted = [...games].sort((a, b) => b.match_date.localeCompare(a.match_date));
          setSelectedDate(sorted[0].match_date);
        } else {
          setSelectedDate(new Date().toISOString().split('T')[0]);
        }
      } catch (e) {
        console.error('Falha ao carregar jogos da API:', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedDate) {
        const filtered = allGames.filter(g => g.match_date === selectedDate);
        setFilteredGames(filtered);
    } else {
        setFilteredGames([]);
    }
    setCurrentPage(1); // Reset page on date change
  }, [selectedDate, allGames]);

  // Helper: check if a game has at least one odd within [min, max]
  const gameMatchesOddRange = (g: GameRecord, min: number, max: number) =>
    ODD_COLS.some(col => {
      const v = g[col] as number | null;
      return v !== null && v > 0 && v >= min && v <= max;
    });

  // Helper: check if a specific odd value is within the active range
  const isOddHighlighted = (v: number | null | undefined): boolean => {
    if (!oddMin && !oddMax) return false;
    if (v === null || v === undefined || v <= 0) return false;
    const mn = oddMin !== '' ? parseFloat(oddMin) : -Infinity;
    const mx = oddMax !== '' ? parseFloat(oddMax) : Infinity;
    return v >= mn && v <= mx;
  };

  // Helper: check if match_time is within the active time range
  const isTimeHighlighted = (t: string): boolean => {
    if (!timeFrom && !timeTo) return false;
    const from = timeFrom || '00:00';
    const to   = timeTo   || '23:59';
    return t >= from && t <= to;
  };

  // Handle Sorting and Filtering
  const processedGames = useMemo(() => {
    let result = [...filteredGames];

    if (hideUnplayed) {
      result = result.filter(g => g.home_score !== null);
    }
    if (hideNoHome) {
      result = result.filter(g => g.odd_home !== null && g.odd_home > 0);
    }
    if (hideNoOv15) {
      result = result.filter(g => g.odd_over15 !== null && g.odd_over15 > 0);
    }
    if (hideNoUn35) {
      result = result.filter(g => g.odd_under35 !== null && g.odd_under35 > 0);
    }

    // Odd range filter: keep games with at least one odd in [min, max]
    const hasRange = oddMin !== '' || oddMax !== '';
    if (hasRange) {
      const mn = oddMin !== '' ? parseFloat(oddMin) : -Infinity;
      const mx = oddMax !== '' ? parseFloat(oddMax) : Infinity;
      if (!isNaN(mn) && !isNaN(mx)) {
        result = result.filter(g => gameMatchesOddRange(g, mn, mx));
      }
    }

    // Time range filter
    const hasTimeRange = timeFrom !== '' || timeTo !== '';
    if (hasTimeRange) {
      const from = timeFrom || '00:00';
      const to   = timeTo   || '23:59';
      result = result.filter(g => g.match_time >= from && g.match_time <= to);
    }

    if (sortConfig.direction && sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] as any;
        const bVal = b[sortConfig.key] as any;

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
       result.sort((a, b) => a.match_time.localeCompare(b.match_time));
    }

    return result;
  }, [filteredGames, hideUnplayed, hideNoHome, hideNoOv15, hideNoUn35, oddMin, oddMax, timeFrom, timeTo, sortConfig]);

  // Handle Pagination
  const totalPages = Math.ceil(processedGames.length / gamesPerPage) || 1;
  const paginatedGames = processedGames.slice(
    (currentPage - 1) * gamesPerPage,
    currentPage * gamesPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [hideUnplayed, hideNoHome, hideNoOv15, hideNoUn35, oddMin, oddMax, timeFrom, timeTo, sortConfig]);

  const handleSort = (key: keyof GameRecord) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key: direction ? key : '', direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key || !sortConfig.direction) return <ArrowUpDown className="w-3 h-3 ml-1 inline text-slate-500" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 inline text-primary" /> : <ArrowDown className="w-3 h-3 ml-1 inline text-primary" />;
  };

  // Helper to format numbers
  const fmt = (val: number | null | undefined) => val !== null && val !== undefined ? val.toFixed(2) : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-surface p-4 rounded-xl border border-border-subtle shadow-lg">
        <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Lista de Jogos</h2>
            <p className="text-slate-400 text-xs mt-1">Visualização completa da base de dados por dia.</p>
        </div>
        <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto flex-wrap">
            {/* Checkbox filters */}
            <div className="flex flex-col gap-2 bg-background-dark border border-border-subtle rounded-lg p-3 w-full md:w-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ocultar sem:</span>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input type="checkbox" checked={hideUnplayed} onChange={(e) => setHideUnplayed(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary" />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Placar</span>
                    </label>
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input type="checkbox" checked={hideNoHome} onChange={(e) => setHideNoHome(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary" />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Home</span>
                    </label>
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input type="checkbox" checked={hideNoOv15} onChange={(e) => setHideNoOv15(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary" />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Ov 1.5</span>
                    </label>
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input type="checkbox" checked={hideNoUn35} onChange={(e) => setHideNoUn35(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary" />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Un 3.5</span>
                    </label>
                </div>
            </div>

            {/* Odd Range Filter */}
            <div className={`flex flex-col gap-2 rounded-lg p-3 border transition-colors w-full md:w-auto ${
              oddMin !== '' || oddMax !== ''
                ? 'bg-primary/5 border-primary/40'
                : 'bg-background-dark border-border-subtle'
            }`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtrar por Odd</span>
                  {(oddMin !== '' || oddMax !== '') && (
                    <button
                      onClick={() => { setOddMin(''); setOddMax(''); }}
                      className="ml-auto text-[9px] text-primary hover:text-white font-bold uppercase tracking-wider transition-colors"
                    >
                      ✕ Limpar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <label className="text-[9px] text-slate-600 uppercase block mb-0.5">Mín</label>
                    <input
                      type="number" step="0.01" min="1.01" placeholder="1.29"
                      value={oddMin}
                      onChange={e => setOddMin(e.target.value)}
                      className="w-20 bg-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-700"
                    />
                  </div>
                  <span className="text-slate-600 mt-4 text-sm">—</span>
                  <div>
                    <label className="text-[9px] text-slate-600 uppercase block mb-0.5">Máx</label>
                    <input
                      type="number" step="0.01" min="1.01" placeholder="1.39"
                      value={oddMax}
                      onChange={e => setOddMax(e.target.value)}
                      className="w-20 bg-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-700"
                    />
                  </div>
                </div>
            </div>

            {/* Time Range Filter */}
            <div className={`flex flex-col gap-2 rounded-lg p-3 border transition-colors w-full md:w-auto ${
              timeFrom !== '' || timeTo !== ''
                ? 'bg-cyan-500/5 border-cyan-500/40'
                : 'bg-background-dark border-border-subtle'
            }`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filtrar por Hora</span>
                  {(timeFrom !== '' || timeTo !== '') && (
                    <button
                      onClick={() => { setTimeFrom(''); setTimeTo(''); }}
                      className="ml-auto text-[9px] text-cyan-400 hover:text-white font-bold uppercase tracking-wider transition-colors"
                    >
                      ✕ Limpar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <label className="text-[9px] text-slate-600 uppercase block mb-0.5">De</label>
                    <input
                      type="time"
                      value={timeFrom}
                      onChange={e => setTimeFrom(e.target.value)}
                      className="w-24 bg-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 placeholder-slate-700"
                    />
                  </div>
                  <span className="text-slate-600 mt-4 text-sm">—</span>
                  <div>
                    <label className="text-[9px] text-slate-600 uppercase block mb-0.5">Até</label>
                    <input
                      type="time"
                      value={timeTo}
                      onChange={e => setTimeTo(e.target.value)}
                      className="w-24 bg-surface border border-border-subtle rounded px-2 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 placeholder-slate-700"
                    />
                  </div>
                </div>
            </div>

            {/* Date picker */}
            <div className="w-full md:w-auto">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Data</label>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-background-dark border border-border-subtle text-white text-xs rounded-lg focus:ring-primary focus:border-primary block w-full px-2.5 py-2 h-[38px]"
                />
            </div>
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-background-dark/50 text-[10px] uppercase text-slate-400 font-semibold tracking-wide">
                    <tr>
                        <th className="px-2 py-2 border-b border-border-subtle sticky left-0 bg-surface z-10 min-w-[60px] max-w-[80px] cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('match_time')}>Hora {getSortIcon('match_time')}</th>
                        <th className="px-2 py-2 border-b border-border-subtle sticky left-[60px] bg-surface z-10 min-w-[200px]">Partida</th>
                        <th className="px-2 py-2 border-b border-border-subtle min-w-[120px]">Liga</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Status</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">FT</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">HT</th>
                        
                        {/* Odds Section */}
                        <th 
                           className="px-1 py-2 border-b border-border-subtle bg-primary/5 text-primary text-center border-l border-border-subtle cursor-pointer hover:bg-primary/10 transition-colors"
                           onClick={() => handleSort('odd_home')}
                        >
                           Home {getSortIcon('odd_home')}
                        </th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-primary/5 text-primary text-center">Draw</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-primary/5 text-primary text-center border-r border-border-subtle">Away</th>
                        
                        <th className="px-1 py-2 border-b border-border-subtle text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('odd_over05_ht')}>0.5 HT {getSortIcon('odd_over05_ht')}</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Ov 0.5</th>
                        <th 
                           className="px-1 py-2 border-b border-border-subtle text-center cursor-pointer hover:bg-white/5 transition-colors"
                           onClick={() => handleSort('odd_over15')}
                        >
                           Ov 1.5 {getSortIcon('odd_over15')}
                        </th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Ov 2.5</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Un 1.5</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Un 2.5</th>
                        <th 
                           className="px-1 py-2 border-b border-border-subtle text-center cursor-pointer hover:bg-white/5 transition-colors"
                           onClick={() => handleSort('odd_under35')}
                        >
                           Un 3.5 {getSortIcon('odd_under35')}
                        </th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('odd_under45')}>Un 4.5 {getSortIcon('odd_under45')}</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">BTTS Y</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('odd_btts_no')}>BTTS N {getSortIcon('odd_btts_no')}</th>

                        {/* Stats Section */}
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center border-l border-border-subtle cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('efficiency_home')}>Eff H {getSortIcon('efficiency_home')}</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('efficiency_away')}>Eff A {getSortIcon('efficiency_away')}</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('rank_home')}>Rnk H {getSortIcon('rank_home')}</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center border-r border-border-subtle cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('rank_away')}>Rnk A {getSortIcon('rank_away')}</th>

                        <th className="px-1 py-2 border-b border-border-subtle text-center">Win% H</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Win% A</th>

                        <th className="px-1 py-2 border-b border-border-subtle text-center">Avg Sc H</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Avg Sc A</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Avg Cc H</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Avg Cc A</th>
                        
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Sc 1H H</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Sc 1H A</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Sc 2H H</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Sc 2H A</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Cc 2H H</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Cc 2H A</th>

                        <th className="px-1 py-2 border-b border-border-subtle text-center border-l border-border-subtle">Glb Mat</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Glb Lea</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-[11px]">
                    {paginatedGames.length === 0 ? (
                        <tr>
                            <td colSpan={30} className="p-8 text-center text-slate-500">Nenhum jogo encontrado para estes filtros.</td>
                        </tr>
                    ) : (
                        paginatedGames.map((game) => (
                            <tr key={game.id} className="hover:bg-white/5 transition-colors">
                                <td className={`px-2 py-1.5 sticky left-0 bg-surface z-10 border-r border-border-subtle font-mono ${
                                    isTimeHighlighted(game.match_time)
                                      ? 'text-cyan-300 font-bold'
                                      : 'text-slate-400'
                                  }`}>
                                    {game.match_time}
                                </td>
                                <td className="px-2 py-1.5 sticky left-[60px] bg-surface z-10 border-r border-border-subtle font-medium text-white truncate max-w-[250px]" title={`${game.home_team} vs ${game.away_team}`}>
                                    {game.home_team} <span className="text-slate-500 mx-0.5">v</span> {game.away_team}
                                </td>
                                <td className="px-2 py-1.5 text-slate-400 truncate max-w-[120px]" title={`${game.country} - ${game.league}`}>{game.country} - {game.league}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{game.status}</td>
                                <td className="px-1 py-1.5 text-center font-bold text-white bg-background-dark/30">
                                    {game.home_score !== null ? `${game.home_score}-${game.away_score}` : '-'}
                                </td>
                                <td className="px-1 py-1.5 text-center text-slate-500">
                                    {game.home_score_ht !== null ? `${game.home_score_ht}-${game.away_score_ht}` : '-'}
                                </td>

                                {/* Odds — highlighted when within filter range */}
                                <td className={`px-1 py-1.5 text-center font-mono border-l border-border-subtle bg-primary/5 ${isOddHighlighted(game.odd_home) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-primary'}`}>{fmt(game.odd_home)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono bg-primary/5 ${isOddHighlighted(game.odd_draw) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-primary'}`}>{fmt(game.odd_draw)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono border-r border-border-subtle bg-primary/5 ${isOddHighlighted(game.odd_away) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-primary'}`}>{fmt(game.odd_away)}</td>

                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_over05_ht) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_over05_ht)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_over05) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_over05)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_over15) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_over15)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_over25) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_over25)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_under15) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_under15)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_under25) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_under25)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_under35) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_under35)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_under45) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_under45)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_btts_yes) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_btts_yes)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_btts_no) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_btts_no)}</td>

                                {/* Stats */}
                                <td className="px-1 py-1.5 text-center font-mono text-slate-400 border-l border-border-subtle bg-slate-800/30">{fmt(game.efficiency_home)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-400 bg-slate-800/30">{fmt(game.efficiency_away)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-400 bg-slate-800/30">{game.rank_home}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-400 border-r border-border-subtle bg-slate-800/30">{game.rank_away}</td>

                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.wins_percent_home)}%</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.wins_percent_away)}%</td>

                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_home)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_away)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_home)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_away)}</td>

                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_1h_home)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_1h_away)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_2h_home)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_2h_away)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_2h_home)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_2h_away)}</td>

                                <td className="px-1 py-1.5 text-center font-mono text-slate-400 border-l border-border-subtle">{fmt(game.global_goals_match)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-400">{fmt(game.global_goals_league)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t border-border-subtle bg-background-dark/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs text-slate-500">Total de jogos listados: {processedGames.length}</span>
            
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded bg-surface border border-border-subtle text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs text-slate-400 font-medium px-2">
                   Página {currentPage} de {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded bg-surface border border-border-subtle text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default GameList;
