import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, BarChart, Bar, Cell
} from 'recharts';
import { apiFetch } from '../src/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  kpis: {
    total_games: number;
    finished_games: number;
    scheduled_games: number;
    total_leagues: number;
    total_days: number;
  };
  market_stats: {
    home:   { total: number; wins: number; win_rate: number };
    away:   { total: number; wins: number; win_rate: number };
    over25: { total: number; wins: number; win_rate: number };
    btts:   { total: number; wins: number; win_rate: number };
    btts_no:{ total: number; wins: number; win_rate: number };
  };
  patterns: {
    over05_pct: number;
    over15_pct: number;
    over25_pct: number;
    over05ht_pct: number;
    home_win_pct: number;
    away_win_pct: number;
    draw_pct: number;
    avg_goals_ft: number;
    avg_goals_ht: number;
  };
  top_leagues: {
    league: string;
    country: string;
    total: number;
    home_win_rate: number;
    avg_goals: number;
  }[];
  daily_volume: { date: string; total: number; finished: number }[];
  odd_scatter:  { odd: number; win_rate: number; total: number }[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: string;
  sub: string;
  icon: string;
  highlight?: boolean;
  progress?: number;
}> = ({ title, value, sub, icon, highlight = false, progress }) => (
  <div className="bg-surface p-5 rounded-xl border border-border-subtle hover:border-primary/50 transition-all group">
    <div className="flex justify-between items-start mb-2">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</p>
      <span className={`material-symbols-outlined ${highlight ? 'text-primary' : 'text-slate-500'} text-sm`}>{icon}</span>
    </div>
    <p className={`${highlight ? 'text-primary' : 'text-white'} text-2xl font-mono font-bold leading-tight`}>{value}</p>
    {progress !== undefined && (
      <div className="w-full bg-slate-800 h-1 rounded-full mt-3">
        <div className="bg-primary h-1 rounded-full shadow-[0_0_8px_#24ffbd]" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    )}
    <p className="text-slate-500 text-[10px] font-mono mt-1 group-hover:text-primary/70 transition-colors">{sub}</p>
  </div>
);

const PatternBar: React.FC<{ label: string; pct: number; positive?: boolean }> = ({
  label, pct, positive = true
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[11px] font-mono mb-1">
      <span className="text-slate-400 uppercase">{label}</span>
      <span className={`${positive ? 'text-primary' : 'text-slate-300'} font-bold`}>{pct.toFixed(1)}%</span>
    </div>
    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${positive && pct > 50 ? 'bg-primary shadow-[0_0_8px_#24ffbd]' : 'bg-slate-500'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardStats>('/stats/dashboard')
      .then(data => { setStats(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
        <p className="text-slate-400 text-sm font-mono animate-pulse">Carregando estatísticas do banco...</p>
      </div>
    </div>
  );

  if (error || !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <span className="material-symbols-outlined text-negative text-4xl">error</span>
        <p className="text-negative text-sm font-mono">{error || 'Erro ao carregar dados.'}</p>
        <p className="text-slate-500 text-xs">Verifique se o servidor Express está rodando (npm run server)</p>
      </div>
    </div>
  );

  const { kpis, market_stats, patterns, top_leagues, daily_volume, odd_scatter } = stats;
  const finishRate = kpis.total_games > 0 ? (kpis.finished_games / kpis.total_games) * 100 : 0;

  return (
    <div className="space-y-6">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total de Jogos"
          value={kpis.total_games.toLocaleString('pt-BR')}
          sub={`${kpis.total_days} dias na base`}
          icon="database"
        />
        <StatCard
          title="Finalizados"
          value={kpis.finished_games.toLocaleString('pt-BR')}
          sub={`${finishRate.toFixed(1)}% do total`}
          icon="check_circle"
          highlight
          progress={finishRate}
        />
        <StatCard
          title="Agendados"
          value={kpis.scheduled_games.toLocaleString('pt-BR')}
          sub="Status NS (Not Started)"
          icon="schedule"
        />
        <StatCard
          title="Ligas"
          value={kpis.total_leagues.toLocaleString('pt-BR')}
          sub="Competições distintas"
          icon="emoji_events"
        />
        <StatCard
          title="Média Gols FT"
          value={patterns.avg_goals_ft.toFixed(2)}
          sub={`HT: ${patterns.avg_goals_ht.toFixed(2)} gols/jogo`}
          icon="sports_soccer"
          highlight
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Volume Diário */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white text-lg font-bold">Volume de Jogos por Data</h3>
                <p className="text-slate-500 text-xs">Total importado por dia (até 30 datas)</p>
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily_volume} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#24ffbd" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#24ffbd" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFinished" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#666', fontSize: 9 }}
                    tickFormatter={v => v.slice(5)} // MM-DD
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#333', borderRadius: '8px', fontSize: 11 }}
                    labelStyle={{ color: '#888' }}
                    itemStyle={{ color: '#24ffbd' }}
                    formatter={(val: any, name: string) => [val, name === 'total' ? 'Total' : 'Finalizados']}
                  />
                  <Area type="monotone" dataKey="total"    stroke="#24ffbd" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                  <Area type="monotone" dataKey="finished" stroke="#6366f1" strokeWidth={1.5} fillOpacity={1} fill="url(#colorFinished)" strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Total</span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-3 h-0.5 bg-indigo-400 inline-block rounded" /> Finalizados</span>
            </div>
          </div>

          {/* Win Rate por Mercado */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <div className="mb-6">
              <h3 className="text-white text-lg font-bold">Win Rate por Mercado</h3>
              <p className="text-slate-500 text-xs">Percentual de acerto sobre jogos finalizados com resultado</p>
            </div>
            <div className="space-y-5">
              {[
                { label: 'Match Odds — Casa',       data: market_stats.home   },
                { label: 'Match Odds — Visitante',  data: market_stats.away   },
                { label: 'Over 2.5 Gols',           data: market_stats.over25 },
                { label: 'Ambas Marcam (Sim)',       data: market_stats.btts   },
                { label: 'Ambas Marcam (Não)',       data: market_stats.btts_no },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400 uppercase">{item.label}</span>
                    <span className="text-slate-500">{item.data.wins.toLocaleString()} / {item.data.total.toLocaleString()} jogos</span>
                    <span className={`font-bold ${item.data.win_rate >= 50 ? 'text-primary' : 'text-slate-300'}`}>
                      {item.data.win_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.data.win_rate >= 50 ? 'bg-primary shadow-[0_0_6px_#24ffbd]' : 'bg-slate-500'}`}
                      style={{ width: `${Math.min(item.data.win_rate, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scatter: Odd vs Win Rate */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <div className="mb-6">
              <h3 className="text-white text-lg font-bold">Odd vs. Taxa de Acerto (Casa)</h3>
              <p className="text-slate-500 text-xs">Win rate do mandante por faixa de odd (mín. 5 jogos)</p>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <XAxis type="number" dataKey="odd"      name="Odd"      tick={{ fill: '#666', fontSize: 10 }} domain={[1, 'auto']} label={{ value: 'Odd', position: 'insideBottom', offset: -2, fill: '#555', fontSize: 10 }} />
                  <YAxis type="number" dataKey="win_rate" name="Win Rate" tick={{ fill: '#666', fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <ZAxis type="number" dataKey="total" range={[40, 200]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#1a1a2e', borderColor: '#333', borderRadius: '8px', fontSize: 11 }}
                    formatter={(val: any, name: string) => [
                      name === 'Win Rate' ? `${val}%` : name === 'total' ? `${val} jogos` : val,
                      name === 'Win Rate' ? 'Win Rate' : name === 'total' ? 'Jogos' : 'Odd'
                    ]}
                  />
                  <Scatter
                    name="Odd Bucket"
                    data={odd_scatter}
                    fill="#24ffbd"
                    fillOpacity={0.8}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">

          {/* Padrões de Gols */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <h3 className="text-white text-lg font-bold mb-1">Padrões de Gols</h3>
            <p className="text-slate-500 text-xs mb-5">% sobre jogos finalizados</p>
            <div className="space-y-4">
              <PatternBar label="Over 0.5 HT"       pct={patterns.over05ht_pct} />
              <PatternBar label="Over 0.5 FT"       pct={patterns.over05_pct}   />
              <PatternBar label="Over 1.5 FT"       pct={patterns.over15_pct}   />
              <PatternBar label="Over 2.5 FT"       pct={patterns.over25_pct}   />
              <PatternBar label="Casa Vence"         pct={patterns.home_win_pct} />
              <PatternBar label="Visitante Vence"    pct={patterns.away_win_pct} positive={false} />
              <PatternBar label="Empate"             pct={patterns.draw_pct}     positive={false} />
            </div>
          </div>

          {/* Top Ligas */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6 flex flex-col">
            <h3 className="text-white text-lg font-bold mb-1">Top Ligas por Volume</h3>
            <p className="text-slate-500 text-xs mb-4">Jogos finalizados | Win% da casa</p>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {top_leagues.map((league, i) => (
                <div key={i} className="flex items-center gap-3 group cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-300 shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-200 truncate pr-2" title={league.league}>
                        {league.league}
                      </span>
                      <span className="text-[10px] font-mono text-primary shrink-0">{league.home_win_rate.toFixed(0)}% H</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-primary h-1 rounded-full" style={{ width: `${Math.min(league.home_win_rate, 100)}%` }} />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">{league.total}j</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;