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

    if (sortConfig.direction && sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] as any;
        const bVal = b[sortConfig.key] as any;

        // Push nulls/undefined to the end regardless of sort direction, or handle as 0
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
       // Default sort by time
       result.sort((a, b) => a.match_time.localeCompare(b.match_time));
    }

    return result;
  }, [filteredGames, hideUnplayed, hideNoHome, hideNoOv15, hideNoUn35, sortConfig]);

  // Handle Pagination
  const totalPages = Math.ceil(processedGames.length / gamesPerPage) || 1;
  const paginatedGames = processedGames.slice(
    (currentPage - 1) * gamesPerPage,
    currentPage * gamesPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [hideUnplayed, hideNoHome, hideNoOv15, hideNoUn35, sortConfig]);

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
        <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
            <div className="flex flex-col gap-2 bg-background-dark border border-border-subtle rounded-lg p-3 w-full md:w-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ocultar sem:</span>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input 
                            type="checkbox" 
                            checked={hideUnplayed}
                            onChange={(e) => setHideUnplayed(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Placar</span>
                    </label>
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input 
                            type="checkbox" 
                            checked={hideNoHome}
                            onChange={(e) => setHideNoHome(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Home</span>
                    </label>
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input 
                            type="checkbox" 
                            checked={hideNoOv15}
                            onChange={(e) => setHideNoOv15(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Ov 1.5</span>
                    </label>
                    <label className="flex items-center cursor-pointer gap-1.5">
                        <input 
                            type="checkbox" 
                            checked={hideNoUn35}
                            onChange={(e) => setHideNoUn35(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Un 3.5</span>
                    </label>
                </div>
            </div>
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
                        <th className="px-2 py-2 border-b border-border-subtle sticky left-0 bg-surface z-10 min-w-[60px] max-w-[80px]">Hora</th>
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
                        
                        <th className="px-1 py-2 border-b border-border-subtle text-center">0.5 HT</th>
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
                        <th className="px-1 py-2 border-b border-border-subtle text-center">Un 4.5</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">BTTS Y</th>
                        <th className="px-1 py-2 border-b border-border-subtle text-center">BTTS N</th>

                        {/* Stats Section */}
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center border-l border-border-subtle">Eff H</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center">Eff A</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center">Rnk H</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-slate-800/30 text-center border-r border-border-subtle">Rnk A</th>

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
                                <td className="px-2 py-1.5 sticky left-0 bg-surface z-10 border-r border-border-subtle font-mono text-slate-400">
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

                                {/* Odds */}
                                <td className="px-1 py-1.5 text-center font-mono text-primary border-l border-border-subtle bg-primary/5">{fmt(game.odd_home)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-primary bg-primary/5">{fmt(game.odd_draw)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-primary border-r border-border-subtle bg-primary/5">{fmt(game.odd_away)}</td>
                                
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_over05_ht)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_over05)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_over15)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_over25)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_under15)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_under25)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_under35)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_under45)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_btts_yes)}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-300">{fmt(game.odd_btts_no)}</td>

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
