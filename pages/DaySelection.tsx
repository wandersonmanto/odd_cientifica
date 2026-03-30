import React, { useState, useEffect, useMemo } from 'react';
import { GameRecord } from '../types';
import { getAllGames } from '../src/db/gameRepository';
import GameAnalysisModal from '../components/GameAnalysisModal';

const API = 'http://localhost:3001';

const MARKET_OPTIONS = [
  { value: 'home',     label: 'Match Odds — Casa',    oddKey: 'odd_home' },
  { value: 'away',     label: 'Match Odds — Visitante', oddKey: 'odd_away' },
  { value: 'over05ht', label: 'Over 0.5 HT',          oddKey: 'odd_over05_ht' },
  { value: 'over15',   label: 'Over 1.5 FT',           oddKey: 'odd_over15' },
  { value: 'over25',   label: 'Over 2.5 FT',           oddKey: 'odd_over25' },
  { value: 'under35',  label: 'Under 3.5 FT',          oddKey: 'odd_under35' },
  { value: 'under45',  label: 'Under 4.5 FT',          oddKey: 'odd_under45' },
  { value: 'btts',     label: 'Ambas Marcam (Sim)',     oddKey: 'odd_btts_yes' },
  { value: 'btts_no',  label: 'Ambas Marcam (Não)',     oddKey: 'odd_btts_no' },
] as const;

type MarketValue = typeof MARKET_OPTIONS[number]['value'];

interface DailyPick {
  id: number;
  game_id: string;
  pick_date: string;
  market: MarketValue;
  odd_used: number;
  resolved: number;
  result: number | null;
  home_team: string;
  away_team: string;
  league: string;
  country: string;
  match_time: string;
  created_at: string;
  // Placar via JOIN com games
  home_score: number | null;
  away_score: number | null;
  home_score_ht: number | null;
  away_score_ht: number | null;
  game_status: string | null;
}

const marketLabel = (m: string) =>
  MARKET_OPTIONS.find(o => o.value === m)?.label ?? m;

const today = () => new Date().toISOString().split('T')[0];
const fmt2 = (v: any) => {
  if (v === null || v === undefined) return '-';
  const num = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(num) ? '-' : num.toFixed(2);
};

const DaySelection: React.FC = () => {
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [pickDate, setPickDate] = useState(today());
  const [market, setMarket] = useState<MarketValue>('over15');
  const [oddMin, setOddMin] = useState('');
  const [oddMax, setOddMax] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');

  const [candidates, setCandidates] = useState<GameRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generated, setGenerated] = useState(false);

  const [savedPicks, setSavedPicks] = useState<DailyPick[]>([]);
  const [stats, setStats] = useState<{ total: number; resolved: number; pending: number; wins: number; losses: number; win_rate: number; avg_odd: number; profit: number; roi: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Image generation state
  const [genLoading, setGenLoading] = useState(false);
  const [genFiles, setGenFiles] = useState<{ type: string; page: number; pageTotal: number; filename: string; url: string }[]>([]);
  const [genError, setGenError] = useState<string | null>(null);

  // Modal de análise de partida
  const [analysisGame, setAnalysisGame] = useState<GameRecord | null>(null);

  // Load games from local SQLite OPFS
  useEffect(() => {
    getAllGames().then(setAllGames).catch(console.error);
  }, []);

  // Load saved picks + stats on mount and when date changes
  useEffect(() => {
    fetchSavedPicks();
    fetchStats();
  }, [pickDate]);

  const fetchSavedPicks = async () => {
    try {
      const res = await fetch(`${API}/api/picks?date=${pickDate}`);
      if (res.ok) setSavedPicks(await res.json());
    } catch { /* server offline */ }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/api/picks/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* server offline */ }
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Compute candidates from local game list
  const filteredGames = useMemo(() => {
    const marketObj = MARKET_OPTIONS.find(o => o.value === market)!;
    const oddKey = marketObj.oddKey as keyof GameRecord;

    return allGames.filter(g => {
      if (g.match_date !== pickDate) return false;
      const oddVal = g[oddKey] as number;
      if (!oddVal || oddVal <= 0) return false;
      if (oddMin !== '' && oddVal < parseFloat(oddMin)) return false;
      if (oddMax !== '' && oddVal > parseFloat(oddMax)) return false;
      if (timeFrom !== '' && g.match_time < timeFrom) return false;
      if (timeTo !== '' && g.match_time > timeTo) return false;
      return true;
    }).sort((a, b) => a.match_time.localeCompare(b.match_time));
  }, [allGames, pickDate, market, oddMin, oddMax, timeFrom, timeTo]);

  const handleGenerate = () => {
    setCandidates(filteredGames);
    setSelected(new Set(filteredGames.map(g => g.id)));
    setGenerated(true);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map(g => g.id)));
    }
  };

  const handleSave = async () => {
    const marketObj = MARKET_OPTIONS.find(o => o.value === market)!;
    const oddKey = marketObj.oddKey as keyof GameRecord;
    const toSave = candidates
      .filter(g => selected.has(g.id))
      .map(g => ({
        game_id: g.id,
        pick_date: pickDate,
        market,
        odd_used: g[oddKey] as number,
        home_team: g.home_team,
        away_team: g.away_team,
        league: g.league,
        country: g.country,
        match_time: g.match_time,
      }));

    if (!toSave.length) return showToast('Nenhum pick selecionado.', false);
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      const data = await res.json();
      const saved = data.inserted?.filter((i: any) => !i.skipped).length ?? 0;
      const skipped = data.inserted?.filter((i: any) => i.skipped).length ?? 0;
      showToast(`✅ ${saved} pick(s) salvos${skipped > 0 ? ` | ${skipped} já existia(m)` : ''}.`);
      fetchSavedPicks();
    } catch {
      showToast('❌ Erro ao conectar ao servidor.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${API}/api/picks/${id}`, { method: 'DELETE' });
      setSavedPicks(prev => prev.filter(p => p.id !== id));
      fetchStats();
    } catch {
      showToast('Erro ao remover pick.', false);
    }
  };

  const handleCopyClipboard = () => {
    const lines = [`⚽ Picks do dia — ${pickDate}`, `📌 Mercado: ${marketLabel(market)}`, ''];
    savedPicks
      .filter(p => p.pick_date === pickDate)
      .forEach(p => {
        const status = p.resolved ? (p.result ? ' ✅' : ' ❌') : '';
        lines.push(`• ${p.match_time} | ${p.home_team} vs ${p.away_team} | Odd: ${fmt2(p.odd_used)}${status}`);
      });
    navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('📋 Copiado para o clipboard!'));
  };

  const todayPicks = savedPicks.filter(p => p.pick_date === pickDate);

  return (
    <div className="space-y-6">
      <GameAnalysisModal game={analysisGame} onClose={() => setAnalysisGame(null)} />
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-semibold shadow-xl transition-all ${toast.ok ? 'bg-primary/20 border border-primary/50 text-primary' : 'bg-red-500/20 border border-red-500/50 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-5 rounded-xl border border-border-subtle shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">stars</span>
            Seleção do Dia
          </h2>
          <p className="text-slate-400 text-xs mt-1">Gere picks a partir dos jogos importados e salve no banco para acompanhamento automático de resultados.</p>
        </div>

        {/* Stats bar */}
        {stats && stats.resolved > 0 && (
          <div className="flex items-center gap-6 bg-background-dark border border-border-subtle rounded-lg px-4 py-2">
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Resolvidos</p>
              <p className="text-sm font-bold text-white font-mono">{stats.resolved}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Win Rate</p>
              <p className={`text-sm font-bold font-mono ${stats.win_rate >= 50 ? 'text-primary' : 'text-red-400'}`}>{stats.win_rate.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">ROI</p>
              <p className={`text-sm font-bold font-mono ${stats.roi >= 0 ? 'text-primary' : 'text-red-400'}`}>{stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Pendentes</p>
              <p className="text-sm font-bold text-amber-400 font-mono">{stats.pending}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-lg space-y-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Configurar Filtro</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data</label>
            <input type="date" value={pickDate} onChange={e => setPickDate(e.target.value)}
              className="w-full bg-background-dark border border-border-subtle rounded-lg text-xs text-white focus:ring-primary focus:border-primary px-3 h-10" />
          </div>
          {/* Market */}
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mercado</label>
            <select value={market} onChange={e => setMarket(e.target.value as MarketValue)}
              className="w-full bg-background-dark border border-border-subtle rounded-lg text-xs text-white focus:ring-primary focus:border-primary px-3 h-10 appearance-none">
              {MARKET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Odd Min */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Odd Mín</label>
            <input type="number" step="0.01" placeholder="1.30" value={oddMin} onChange={e => setOddMin(e.target.value)}
              className="w-full bg-background-dark border border-border-subtle rounded-lg text-xs text-white font-mono focus:ring-primary focus:border-primary px-3 h-10" />
          </div>
          {/* Odd Max */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Odd Máx</label>
            <input type="number" step="0.01" placeholder="2.00" value={oddMax} onChange={e => setOddMax(e.target.value)}
              className="w-full bg-background-dark border border-border-subtle rounded-lg text-xs text-white font-mono focus:ring-primary focus:border-primary px-3 h-10" />
          </div>
          {/* Time From */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hora De / Até</label>
            <div className="flex gap-1">
              <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)}
                className="w-full bg-background-dark border border-border-subtle rounded-lg text-xs text-white focus:ring-primary focus:border-primary px-2 h-10" />
              <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)}
                className="w-full bg-background-dark border border-border-subtle rounded-lg text-xs text-white focus:ring-primary focus:border-primary px-2 h-10" />
            </div>
          </div>
        </div>
        <button onClick={handleGenerate}
          className="mt-2 h-10 bg-primary text-background-dark font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-2 px-6 shadow-[0_0_15px_rgba(36,255,189,0.3)] hover:shadow-[0_0_20px_rgba(36,255,189,0.5)]">
          <span className="material-symbols-outlined text-[18px]">filter_list</span>
          Gerar Picks
        </button>
      </div>

      {/* Candidates Table */}
      {generated && (
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">list_alt</span>
              Candidatos — {candidates.length} jogo{candidates.length !== 1 ? 's' : ''}
              <span className="text-xs font-normal text-slate-400">({selected.size} selecionados)</span>
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={toggleAll} className="text-xs text-slate-400 hover:text-white border border-border-subtle rounded px-3 py-1.5 transition-colors">
                {selected.size === candidates.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              <button onClick={handleSave} disabled={saving || selected.size === 0}
                className="flex items-center gap-1.5 bg-primary/10 border border-primary/40 text-primary text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-[16px]">save</span>
                {saving ? 'Salvando…' : 'Salvar Selecionados'}
              </button>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="p-8 text-center text-slate-500">Nenhum jogo encontrado com esses filtros para {pickDate}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-background-dark/50 text-[10px] uppercase text-slate-400 tracking-wide">
                  <tr>
                    <th className="px-3 py-2 border-b border-border-subtle w-8">
                      <input type="checkbox" checked={selected.size === candidates.length && candidates.length > 0}
                        onChange={toggleAll} className="w-3.5 h-3.5 rounded" />
                    </th>
                    <th className="px-3 py-2 border-b border-border-subtle">Hora</th>
                    <th className="px-3 py-2 border-b border-border-subtle">Partida</th>
                    <th className="px-3 py-2 border-b border-border-subtle">Liga</th>
                    <th className="px-3 py-2 border-b border-border-subtle text-center text-primary">Odd</th>
                    <th className="px-3 py-2 border-b border-border-subtle text-center">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {candidates.map(g => {
                    const mObj = MARKET_OPTIONS.find(o => o.value === market)!;
                    const oddVal = g[mObj.oddKey as keyof GameRecord] as number;
                    const savedPick = todayPicks.find(p => p.game_id === g.id && p.market === market);
                    const isSelected = selected.has(g.id);
                    return (
                      <tr key={g.id} className={`hover:bg-white/5 transition-colors cursor-pointer ${isSelected ? 'bg-primary/3' : ''}`} onClick={() => toggleSelect(g.id)}>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(g.id)} className="w-3.5 h-3.5 rounded" />
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">{g.match_time}</td>
                        <td className="px-3 py-2 font-medium text-white">{g.home_team} <span className="text-slate-500">v</span> {g.away_team}</td>
                        <td className="px-3 py-2 text-slate-400 max-w-[150px] truncate">{g.country} — {g.league}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-primary">{fmt2(oddVal)}</td>
                        <td className="px-3 py-2 text-center">
                          {savedPick ? (
                            savedPick.resolved
                              ? <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${savedPick.result ? 'bg-primary/15 text-primary' : 'bg-red-500/15 text-red-400'}`}>
                                  <span className="material-symbols-outlined text-[12px]">{savedPick.result ? 'check' : 'close'}</span>
                                  {savedPick.result ? 'Ganhou' : 'Perdeu'}
                                </span>
                              : <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full">Salvo</span>
                          ) : (
                            <span className="text-[10px] text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Saved Picks for this date */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-[20px]">bookmark</span>
            Picks Salvos — {pickDate}
            {todayPicks.length > 0 && <span className="text-xs font-normal text-slate-400">({todayPicks.length} pick{todayPicks.length !== 1 ? 's' : ''})</span>}
          </h3>
          {todayPicks.length > 0 && (
            <button onClick={handleCopyClipboard}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-border-subtle rounded-lg px-3 py-1.5 transition-colors">
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              Copiar para WhatsApp
            </button>
          )}
        </div>

        {todayPicks.length === 0 ? (
          <p className="p-8 text-center text-slate-500 text-sm">Nenhum pick salvo para {pickDate}. Gere e salve picks usando os filtros acima.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-background-dark/50 text-[10px] uppercase text-slate-400 tracking-wide">
                <tr>
                  <th className="px-3 py-2 border-b border-border-subtle">Hora</th>
                  <th className="px-3 py-2 border-b border-border-subtle">Partida</th>
                  <th className="px-3 py-2 border-b border-border-subtle">Liga</th>
                  <th className="px-3 py-2 border-b border-border-subtle text-center">Mercado</th>
                  <th className="px-3 py-2 border-b border-border-subtle text-center text-primary">Odd</th>
                  <th className="px-3 py-2 border-b border-border-subtle text-center text-slate-400">HT</th>
                  <th className="px-3 py-2 border-b border-border-subtle text-center text-slate-400">FT</th>
                  <th className="px-3 py-2 border-b border-border-subtle text-center">Resultado</th>
                  <th className="px-3 py-2 border-b border-border-subtle text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {todayPicks.map(p => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-3 py-2 font-mono text-slate-400">{p.match_time}</td>
                    <td
                      className="px-3 py-2 font-medium text-white cursor-pointer hover:text-primary hover:underline transition-colors"
                      title="Clique para analisar a partida"
                      onClick={() => {
                        const found = allGames.find(g => g.id === p.game_id);
                        if (found) setAnalysisGame(found);
                      }}
                    >
                      {p.home_team} <span className="text-slate-500">v</span> {p.away_team}
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-[150px] truncate">{p.country} — {p.league}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold">
                        {marketLabel(p.market)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-primary">{fmt2(p.odd_used)}</td>
                    {/* Placar HT */}
                    <td className="px-3 py-2 text-center font-mono text-slate-400">
                      {p.home_score_ht !== null && p.away_score_ht !== null
                        ? `${p.home_score_ht}–${p.away_score_ht}`
                        : <span className="text-slate-700">—</span>}
                    </td>
                    {/* Placar FT */}
                    <td className="px-3 py-2 text-center font-mono font-bold">
                      {p.home_score !== null && p.away_score !== null ? (
                        <span className={p.result === 1 ? 'text-primary' : p.result === 0 ? 'text-red-400' : 'text-white'}>
                          {p.home_score}–{p.away_score}
                        </span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {p.resolved ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.result ? 'bg-primary/15 text-primary' : 'bg-red-500/15 text-red-400'}`}>
                          <span className="material-symbols-outlined text-[12px]">{p.result ? 'check' : 'close'}</span>
                          {p.result ? 'Ganhou' : 'Perdeu'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center w-fit mx-auto">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleDelete(p.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors" title="Remover pick">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary row */}
        {todayPicks.filter(p => p.resolved).length > 0 && (() => {
          const resolved = todayPicks.filter(p => p.resolved);
          const wins = resolved.filter(p => p.result).length;
          const losses = resolved.length - wins;
          const avgOdd = resolved.reduce((s, p) => s + Number(p.odd_used), 0) / resolved.length;
          const profit = wins * (avgOdd - 1) * 100 - losses * 100;
          const winRate = (wins / resolved.length) * 100;
          return (
            <div className="px-4 py-3 bg-background-dark/50 border-t border-border-subtle flex flex-wrap items-center gap-6 text-xs">
              <span className="text-slate-500">Resolvidos: <strong className="text-white">{resolved.length}</strong></span>
              <span className="text-slate-500">Acertos: <strong className="text-primary">{wins}</strong></span>
              <span className="text-slate-500">Erros: <strong className="text-red-400">{losses}</strong></span>
              <span className="text-slate-500">Win Rate: <strong className={winRate >= 50 ? 'text-primary' : 'text-red-400'}>{winRate.toFixed(1)}%</strong></span>
              <span className="text-slate-500">P&L (R$100): <strong className={profit >= 0 ? 'text-primary' : 'text-red-400'}>{profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)}</strong></span>
            </div>
          );
        })()}
      </div>

      {/* ── Gerar Posts ─────────────────────────────────────────── */}
      {todayPicks.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-xl shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">📸 Gerar Posts para Redes Sociais</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Cria imagens PNG prontas para Feed, Story, Resultado e Capa de Reel — {pickDate}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'feed',      label: '📋 Feed',     dim: '1080×1350' },
                { key: 'story',     label: '📱 Story',    dim: '1080×1920' },
                { key: 'resultado', label: '🏆 Resultado', dim: '1080×1350' },
                { key: 'reel',      label: '🎬 Reel Capa', dim: '1080×1920' },
              ].map(({ key, label, dim }) => {
                const file = genFiles.find(f => f.type === key);
                return (
                  <button
                    key={key}
                    onClick={async () => {
                      setGenLoading(true);
                      setGenError(null);
                      try {
                        const res = await fetch(`${API}/api/generate-images`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ date: pickDate, types: [key] }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
                        setGenFiles(prev => [
                          ...prev.filter(f => f.type !== key),
                          ...data.files,
                        ]);
                      } catch (e: any) {
                        setGenError(e.message);
                      } finally {
                        setGenLoading(false);
                      }
                    }}
                    disabled={genLoading}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border ${
                      file
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-background-dark border-border-subtle text-slate-300 hover:border-primary/30 hover:text-primary'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[9px] text-slate-600 font-normal">{dim}</span>
                    {file && <span className="text-[9px] text-primary">✓</span>}
                  </button>
                );
              })}
              {genLoading && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 px-2">
                  <span className="animate-spin inline-block w-3 h-3 border border-primary/50 border-t-primary rounded-full"></span>
                  Renderizando…
                </div>
              )}
            </div>
          </div>

          {genError && (
            <div className="px-5 py-3 text-xs text-red-400 bg-red-500/5 border-b border-red-500/20">
              ❌ {genError}
            </div>
          )}

          {genFiles.length > 0 && (() => {
            const typeLabels: Record<string, string> = {
              feed: 'Feed Instagram',
              story: 'Story',
              resultado: 'Resultado',
              reel: 'Capa de Reel',
            };
            // Agrupa por tipo mantendo ordem de geração
            const types = Array.from(new Set<string>(genFiles.map(f => f.type)));
            return (
              <div className="p-5 space-y-5">
                {types.map(t => {
                  const files = genFiles.filter(f => f.type === t);
                  const isVertical = t === 'story' || t === 'reel';
                  return (
                    <div key={t}>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                        {typeLabels[t] || t}
                        {files[0]?.pageTotal > 1 && (
                          <span className="ml-2 text-slate-600 normal-case font-normal">{files.length} parte{files.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <div className={`grid gap-3 ${isVertical ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
                        {files.map(f => {
                          const imgUrl = `${API}${f.url}?t=${Date.now()}`;
                          return (
                            <div key={f.filename} className="flex flex-col gap-1.5">
                              {f.pageTotal > 1 && (
                                <div className="text-[9px] text-slate-600 font-semibold">Parte {f.page}/{f.pageTotal}</div>
                              )}
                              <a
                                href={imgUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-xl overflow-hidden border border-border-subtle hover:border-primary/40 transition-all group"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`${t} p${f.page}`}
                                  className="w-full object-cover group-hover:opacity-90 transition-opacity"
                                  style={{ aspectRatio: isVertical ? '9/16' : '4/5' }}
                                />
                              </a>
                              <a
                                href={imgUrl}
                                download={f.filename}
                                className="w-full text-center text-[10px] font-bold text-primary bg-primary/5 border border-primary/20 rounded-lg py-1.5 hover:bg-primary/10 transition-colors"
                              >
                                ⬇ Download PNG
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
};

export default DaySelection;
