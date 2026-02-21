import React, { useState, useEffect } from 'react';
import { GameRecord } from '../types';
import { initDB } from '../src/db/database';
import { getAllGames } from '../src/db/gameRepository';

const GameList: React.FC = () => {
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [filteredGames, setFilteredGames] = useState<GameRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        await initDB();
        const games = await getAllGames();
        setAllGames(games);
        if (games.length > 0) {
          // Sort desc by date to match logic
          const sorted = [...games].sort((a, b) => b.match_date.localeCompare(a.match_date));
          setSelectedDate(sorted[0].match_date);
        } else {
          setSelectedDate(new Date().toISOString().split('T')[0]);
        }
      } catch (e) {
        console.error('Failed to load DB', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedDate) {
        const filtered = allGames.filter(g => g.match_date === selectedDate);
        // Sort by time
        filtered.sort((a, b) => a.match_time.localeCompare(b.match_time));
        setFilteredGames(filtered);
    } else {
        setFilteredGames([]);
    }
  }, [selectedDate, allGames]);

  // Helper to format numbers
  const fmt = (val: number | null | undefined) => val !== null && val !== undefined ? val.toFixed(2) : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-surface p-6 rounded-xl border border-border-subtle shadow-lg">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Lista de Jogos</h2>
            <p className="text-slate-400 text-sm mt-1">Visualização completa da base de dados por dia.</p>
        </div>
        <div className="w-full md:w-auto">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Selecione a Data</label>
            <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-background-dark border border-border-subtle text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5"
            />
        </div>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-background-dark/50 text-xs uppercase text-slate-400 font-semibold">
                    <tr>
                        <th className="p-4 border-b border-border-subtle sticky left-0 bg-surface z-10 min-w-[100px]">Data/Hora</th>
                        <th className="p-4 border-b border-border-subtle sticky left-[100px] bg-surface z-10 min-w-[200px]">Partida</th>
                        <th className="p-4 border-b border-border-subtle min-w-[150px]">Liga</th>
                        <th className="p-4 border-b border-border-subtle text-center min-w-[80px]">Status</th>
                        <th className="p-4 border-b border-border-subtle text-center min-w-[80px]">Placar</th>
                        <th className="p-4 border-b border-border-subtle text-center min-w-[80px]">HT</th>
                        
                        {/* Odds Section */}
                        <th className="p-4 border-b border-border-subtle bg-primary/5 text-primary text-center border-l border-border-subtle">Home</th>
                        <th className="p-4 border-b border-border-subtle bg-primary/5 text-primary text-center">Draw</th>
                        <th className="p-4 border-b border-border-subtle bg-primary/5 text-primary text-center border-r border-border-subtle">Away</th>
                        
                        <th className="p-4 border-b border-border-subtle text-center">Ov 0.5 HT</th>
                        <th className="p-4 border-b border-border-subtle text-center">Ov 0.5</th>
                        <th className="p-4 border-b border-border-subtle text-center">Ov 1.5</th>
                        <th className="p-4 border-b border-border-subtle text-center">Ov 2.5</th>
                        <th className="p-4 border-b border-border-subtle text-center">Un 1.5</th>
                        <th className="p-4 border-b border-border-subtle text-center">Un 2.5</th>
                        <th className="p-4 border-b border-border-subtle text-center">Un 3.5</th>
                        <th className="p-4 border-b border-border-subtle text-center">Un 4.5</th>
                        <th className="p-4 border-b border-border-subtle text-center">BTTS Yes</th>
                        <th className="p-4 border-b border-border-subtle text-center">BTTS No</th>

                        {/* Stats Section */}
                        <th className="p-4 border-b border-border-subtle bg-slate-800/30 text-center border-l border-border-subtle">Eff H</th>
                        <th className="p-4 border-b border-border-subtle bg-slate-800/30 text-center">Eff A</th>
                        <th className="p-4 border-b border-border-subtle bg-slate-800/30 text-center">Rank H</th>
                        <th className="p-4 border-b border-border-subtle bg-slate-800/30 text-center border-r border-border-subtle">Rank A</th>

                        <th className="p-4 border-b border-border-subtle text-center">Win% H</th>
                        <th className="p-4 border-b border-border-subtle text-center">Win% A</th>

                        <th className="p-4 border-b border-border-subtle text-center">Avg G Sc H</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Sc A</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Conc H</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Conc A</th>
                        
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Sc 1H H</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Sc 1H A</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Sc 2H H</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Sc 2H A</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Conc 2H H</th>
                        <th className="p-4 border-b border-border-subtle text-center">Avg G Conc 2H A</th>

                        <th className="p-4 border-b border-border-subtle text-center border-l border-border-subtle">Global G Match</th>
                        <th className="p-4 border-b border-border-subtle text-center">Global G League</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-sm">
                    {filteredGames.length === 0 ? (
                        <tr>
                            <td colSpan={30} className="p-8 text-center text-slate-500">Nenhum jogo encontrado para esta data.</td>
                        </tr>
                    ) : (
                        filteredGames.map((game) => (
                            <tr key={game.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 sticky left-0 bg-surface z-10 border-r border-border-subtle font-mono text-xs text-slate-300">
                                    {game.match_time}
                                </td>
                                <td className="p-4 sticky left-[100px] bg-surface z-10 border-r border-border-subtle font-medium text-white">
                                    {game.home_team} <span className="text-slate-500 text-xs mx-1">vs</span> {game.away_team}
                                </td>
                                <td className="p-4 text-slate-400 text-xs">{game.country} - {game.league}</td>
                                <td className="p-4 text-center text-xs font-mono text-slate-500">{game.status}</td>
                                <td className="p-4 text-center font-bold text-white bg-background-dark/30">
                                    {game.home_score !== null ? `${game.home_score} - ${game.away_score}` : '-'}
                                </td>
                                <td className="p-4 text-center text-slate-500 text-xs">
                                    {game.home_score_ht !== null ? `${game.home_score_ht} - ${game.away_score_ht}` : '-'}
                                </td>

                                {/* Odds */}
                                <td className="p-4 text-center font-mono text-primary border-l border-border-subtle bg-primary/5">{fmt(game.odd_home)}</td>
                                <td className="p-4 text-center font-mono text-primary bg-primary/5">{fmt(game.odd_draw)}</td>
                                <td className="p-4 text-center font-mono text-primary border-r border-border-subtle bg-primary/5">{fmt(game.odd_away)}</td>
                                
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_over05_ht)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_over05)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_over15)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_over25)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_under15)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_under25)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_under35)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_under45)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_btts_yes)}</td>
                                <td className="p-4 text-center font-mono text-slate-300">{fmt(game.odd_btts_no)}</td>

                                {/* Stats */}
                                <td className="p-4 text-center font-mono text-slate-400 border-l border-border-subtle bg-slate-800/30">{fmt(game.efficiency_home)}</td>
                                <td className="p-4 text-center font-mono text-slate-400 bg-slate-800/30">{fmt(game.efficiency_away)}</td>
                                <td className="p-4 text-center font-mono text-slate-400 bg-slate-800/30">{game.rank_home}</td>
                                <td className="p-4 text-center font-mono text-slate-400 border-r border-border-subtle bg-slate-800/30">{game.rank_away}</td>

                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.wins_percent_home)}%</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.wins_percent_away)}%</td>

                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_home)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_away)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_home)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_away)}</td>

                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_1h_home)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_1h_away)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_2h_home)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_scored_2h_away)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_2h_home)}</td>
                                <td className="p-4 text-center font-mono text-slate-500">{fmt(game.avg_goals_conceded_2h_away)}</td>

                                <td className="p-4 text-center font-mono text-slate-400 border-l border-border-subtle">{fmt(game.global_goals_match)}</td>
                                <td className="p-4 text-center font-mono text-slate-400">{fmt(game.global_goals_league)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t border-border-subtle bg-background-dark/50 text-xs text-slate-500 flex justify-between">
            <span>Total de jogos: {filteredGames.length}</span>
            <span>Mostrando todas as colunas disponíveis.</span>
        </div>
      </div>
    </div>
  );
};

export default GameList;
