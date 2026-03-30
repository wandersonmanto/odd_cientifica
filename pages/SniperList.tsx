import React, { useState, useEffect } from 'react';
import { getAllGames } from '../src/db/gameRepository';
import { GameRecord } from '../types';
import GameAnalysisModal from '../components/GameAnalysisModal';

const API = 'http://localhost:3001';

const MARKET_OPTIONS = [
  { value: 'home',     label: 'Match Odds — Casa' },
  { value: 'away',     label: 'Match Odds — Visitante' },
  { value: 'over05ht', label: 'Over 0.5 HT' },
  { value: 'over15',   label: 'Over 1.5 FT' },
  { value: 'over25',   label: 'Over 2.5 FT' },
  { value: 'under35',  label: 'Under 3.5 FT' },
  { value: 'under45',  label: 'Under 4.5 FT' },
  { value: 'btts',     label: 'Ambas Marcam (Sim)' },
  { value: 'btts_no',  label: 'Ambas Marcam (Não)' },
] as const;

type MarketValue = typeof MARKET_OPTIONS[number]['value'];



interface SniperPick {
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

const SniperList: React.FC = () => {
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [pickDate, setPickDate] = useState(today());

  const [savedPicks, setSavedPicks] = useState<SniperPick[]>([]);
  const [stats, setStats] = useState<{
    total: number; resolved: number; pending: number;
    wins: number; losses: number; win_rate: number;
    avg_odd: number; profit: number; roi: number;
  } | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [genLoading, setGenLoading] = useState(false);
  const [genFiles, setGenFiles] = useState<{ type: string; page: number; pageTotal: number; filename: string; url: string }[]>([]);
  const [genError, setGenError] = useState<string | null>(null);

  const [analysisGame, setAnalysisGame] = useState<GameRecord | null>(null);

  useEffect(() => {
    getAllGames().then(setAllGames).catch(console.error);
  }, []);



  useEffect(() => {
    fetchSavedPicks();
    fetchStats();
  }, [pickDate]);

  const fetchSavedPicks = async () => {
    try {
      const res = await fetch(`${API}/api/sniper-picks?date=${pickDate}`);
      if (res.ok) setSavedPicks(await res.json());
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/api/sniper-picks/stats`);
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };



  const handleDelete = async (id: number) => {
    try {
      await fetch(`${API}/api/sniper-picks/${id}`, { method: 'DELETE' });
      setSavedPicks(prev => prev.filter(p => p.id !== id));
      fetchStats();
    } catch {
      showToast('Erro ao remover pick.', false);
    }
  };

  const handleCopyClipboard = () => {
    const lines = [`🎯 Sniper List — ${pickDate}`, ''];
    todayPicks.forEach(p => {
      const status = p.resolved ? (p.result ? ' ✅' : ' ❌') : '';
      lines.push(`• ${p.match_time} | ${p.home_team} vs ${p.away_team} | ${marketLabel(p.market)} | Odd: ${fmt2(p.odd_used)}${status}`);
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('📋 Copiado para o clipboard!'));
  };

  const todayPicks = savedPicks.filter(p => p.pick_date === pickDate);

  return (
    <div className="space-y-6">
      <GameAnalysisModal game={analysisGame} onClose={() => setAnalysisGame(null)} />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-semibold shadow-xl transition-all ${
          toast.ok
            ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
            : 'bg-red-500/20 border border-red-500/50 text-red-400'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-5 rounded-xl border border-orange-500/20 shadow-lg shadow-orange-500/5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Sniper List
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Picks de favoritos dominantes. Vá para <strong className="text-orange-400">Lista de Jogos → Favorito Dominante</strong> para selecionar e enviar jogos.
          </p>
        </div>

        {stats && stats.resolved > 0 && (
          <div className="flex items-center gap-6 bg-background-dark border border-orange-500/20 rounded-lg px-4 py-2">
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Resolvidos</p>
              <p className="text-sm font-bold text-white font-mono">{stats.resolved}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Win Rate</p>
              <p className={`text-sm font-bold font-mono ${stats.win_rate >= 50 ? 'text-orange-400' : 'text-red-400'}`}>
                {stats.win_rate.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">ROI</p>
              <p className={`text-sm font-bold font-mono ${stats.roi >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Pendentes</p>
              <p className="text-sm font-bold text-amber-400 font-mono">{stats.pending}</p>
            </div>
          </div>
        )}
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-4 bg-surface border border-orange-500/15 rounded-xl p-4 shadow">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Data</label>
          <input type="date" value={pickDate} onChange={e => setPickDate(e.target.value)}
            className="bg-background-dark border border-border-subtle rounded-lg text-xs text-white focus:ring-orange-500 focus:border-orange-500 px-3 h-9" />
        </div>
      </div>



      {/* ── Picks Salvos ── */}
      <div className="bg-surface border border-orange-500/20 rounded-xl overflow-hidden shadow-xl shadow-orange-500/5">
        <div className="p-4 border-b border-orange-500/15 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Sniper Picks Salvos — {pickDate}
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
          <p className="p-8 text-center text-slate-500 text-sm">
            Nenhum sniper pick salvo para {pickDate}.<br />
            <span className="text-slate-600 text-xs">Ative o Favorito Dominante na Lista de Jogos e selecione os picks para enviar.</span>
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-background-dark/50 text-[10px] uppercase text-slate-400 tracking-wide">
                  <tr>
                    <th className="px-3 py-2 border-b border-border-subtle">Hora</th>
                    <th className="px-3 py-2 border-b border-border-subtle">Partida</th>
                    <th className="px-3 py-2 border-b border-border-subtle">Liga</th>
                    <th className="px-3 py-2 border-b border-border-subtle text-center">Mercado</th>
                    <th className="px-3 py-2 border-b border-border-subtle text-center text-orange-400">Odd</th>
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
                      <td className="px-3 py-2 font-medium text-white cursor-pointer hover:text-orange-400 transition-colors"
                        onClick={() => {
                          const found = allGames.find(g => g.id === p.game_id);
                          if (found) setAnalysisGame(found);
                        }}>
                        {p.home_team} <span className="text-slate-500">v</span> {p.away_team}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-[150px] truncate">{p.country} — {p.league}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {marketLabel(p.market)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-orange-400">{fmt2(p.odd_used)}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-400">
                        {p.home_score_ht !== null && p.away_score_ht !== null
                          ? `${p.home_score_ht}–${p.away_score_ht}`
                          : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold">
                        {p.home_score !== null && p.away_score !== null ? (
                          <span className={p.result === 1 ? 'text-orange-400' : p.result === 0 ? 'text-red-400' : 'text-white'}>
                            {p.home_score}–{p.away_score}
                          </span>
                        ) : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.resolved ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.result ? 'bg-orange-500/15 text-orange-400' : 'bg-red-500/15 text-red-400'}`}>
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
                          className="text-slate-600 hover:text-red-400 transition-colors">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                  <span className="text-slate-500">Acertos: <strong className="text-orange-400">{wins}</strong></span>
                  <span className="text-slate-500">Erros: <strong className="text-red-400">{losses}</strong></span>
                  <span className="text-slate-500">Win Rate: <strong className={winRate >= 50 ? 'text-orange-400' : 'text-red-400'}>{winRate.toFixed(1)}%</strong></span>
                  <span className="text-slate-500">P&L (R$100): <strong className={profit >= 0 ? 'text-orange-400' : 'text-red-400'}>{profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)}</strong></span>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ── Gerar Posts ── */}
      {todayPicks.length > 0 && (
        <div className="bg-surface border border-orange-500/20 rounded-xl shadow-xl shadow-orange-500/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-orange-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">🎯 Gerar Posts para Redes Sociais</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Imagens PNG laranja — Feed, Story, Resultado e Reel — {pickDate}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'sniper-feed',      label: '📋 Feed',      dim: '1080×1350' },
                { key: 'sniper-story',     label: '📱 Story',     dim: '1080×1920' },
                { key: 'sniper-resultado', label: '🏆 Resultado', dim: '1080×1350' },
                { key: 'sniper-reel',      label: '🎬 Reel',      dim: '1080×1920' },
              ].map(({ key, label, dim }) => {
                const file = genFiles.find(f => f.type === key);
                return (
                  <button
                    key={key}
                    onClick={async () => {
                      setGenLoading(true);
                      setGenError(null);
                      try {
                        const res = await fetch(`${API}/api/sniper/generate-images`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ date: pickDate, types: [key] }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
                        setGenFiles(prev => [...prev.filter(f => f.type !== key), ...data.files]);
                      } catch (e: any) {
                        setGenError(e.message);
                      } finally {
                        setGenLoading(false);
                      }
                    }}
                    disabled={genLoading}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border ${
                      file
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-background-dark border-border-subtle text-slate-300 hover:border-orange-500/30 hover:text-orange-400'
                    }`}
                  >
                    {label}
                    <span className="text-[9px] text-slate-600 font-normal">{dim}</span>
                    {file && <span className="text-[9px] text-orange-400">✓</span>}
                  </button>
                );
              })}
              {genLoading && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 px-2">
                  <span className="animate-spin inline-block w-3 h-3 border border-orange-500/50 border-t-orange-400 rounded-full"></span>
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
              'sniper-feed': 'Feed Instagram',
              'sniper-story': 'Story',
              'sniper-resultado': 'Resultado',
              'sniper-reel': 'Capa de Reel',
            };
            const types = Array.from(new Set<string>(genFiles.map(f => f.type)));
            return (
              <div className="p-5 space-y-5">
                {types.map(t => {
                  const files = genFiles.filter(f => f.type === t);
                  const isVertical = t === 'sniper-story' || t === 'sniper-reel';
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
                              <a href={imgUrl} target="_blank" rel="noreferrer"
                                className="block rounded-xl overflow-hidden border border-border-subtle hover:border-orange-500/40 transition-all group">
                                <img src={imgUrl} alt={`${t} p${f.page}`}
                                  className="w-full object-cover group-hover:opacity-90 transition-opacity"
                                  style={{ aspectRatio: isVertical ? '9/16' : '4/5' }} />
                              </a>
                              <a href={imgUrl} download={f.filename}
                                className="w-full text-center text-[10px] font-bold text-orange-400 bg-orange-500/5 border border-orange-500/20 rounded-lg py-1.5 hover:bg-orange-500/10 transition-colors">
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

export default SniperList;
