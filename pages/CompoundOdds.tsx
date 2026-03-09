import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../src/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OddDistribution {
  odd: number;
  count: number;
  wins: number;
  win_rate: number;
}

interface MarketStat {
  label: string;
  col: string;
  total_in_range: number;
  avg_odd: number;
  win_rate: number;
  breakeven: number;
  is_lucrativo: boolean;
  odds_distribution: OddDistribution[];
}

interface TopOdd {
  odd: number;
  mercado: string;
  total: number;
  wins: number;
  win_rate: number;
}

interface CompoundMath {
  avg_odd: number;
  compound_odd: number;
  profit_pct: number;
  min_win_rate_single: number;
  min_win_rate_both: number;
}

interface CompoundOddsData {
  total_games: number;
  finished_games: number;
  range: { min: number; max: number };
  markets: MarketStat[];
  top_odds_global: TopOdd[];
  compound_math: CompoundMath[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtOdd  = (v: number) => v.toFixed(2);
const fmtPct  = (v: number) => `${v.toFixed(1)}%`;
const fmtNum  = (v: number) => v.toLocaleString('pt-BR');

function getRateColor(rate: number, breakeven: number): string {
  const diff = rate - breakeven;
  if (diff > 5)  return 'text-emerald-400';
  if (diff > 0)  return 'text-primary';
  if (diff > -3) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Mini Bar Chart ─────────────────────────────────────────────────────────

const OddBar: React.FC<{ d: OddDistribution; max: number; breakeven: number }> = ({ d, max, breakeven }) => {
  const barPct = max > 0 ? (d.count / max) * 100 : 0;
  const isGreen = d.win_rate > breakeven;
  const color = isGreen ? '#24ffbd' : d.win_rate > breakeven - 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2 group hover:bg-white/5 px-2 py-1 rounded-lg transition-colors">
      <span className="font-mono text-[11px] text-white w-10 shrink-0">{fmtOdd(d.odd)}</span>
      <div className="flex-1 relative h-5 bg-white/5 rounded overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded transition-all duration-700"
          style={{ width: `${barPct}%`, backgroundColor: color + '33', borderRight: `2px solid ${color}` }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color }}>
          {fmtPct(d.win_rate)}
        </span>
      </div>
      <span className="font-mono text-[10px] text-slate-500 w-12 text-right shrink-0">{fmtNum(d.count)}×</span>
    </div>
  );
};

// ─── Market Card ─────────────────────────────────────────────────────────────

const MarketCard: React.FC<{ market: MarketStat; selected: boolean; onClick: () => void }> = ({ market, selected, onClick }) => {
  const diffPct = market.win_rate - market.breakeven;
  const rateColor = getRateColor(market.win_rate, market.breakeven);
  const maxCount = market.odds_distribution[0]?.count ?? 1;

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border transition-all cursor-pointer overflow-hidden
        ${selected
          ? 'border-primary bg-primary/5 shadow-[0_0_20px_rgba(36,255,189,0.1)]'
          : 'border-border-subtle bg-surface hover:border-primary/40 hover:bg-white/3'
        }`}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold text-white text-sm leading-tight">{market.label}</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{market.col}</p>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${
            market.is_lucrativo
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}>
            {market.is_lucrativo ? '✓ Lucrativo' : '✗ Negativo'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-white/5 rounded-lg p-2">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Jogos</div>
            <div className="font-mono font-bold text-white text-sm mt-0.5">{fmtNum(market.total_in_range)}</div>
          </div>
          <div className="text-center bg-white/5 rounded-lg p-2">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Win Rate</div>
            <div className={`font-mono font-bold text-sm mt-0.5 ${rateColor}`}>{fmtPct(market.win_rate)}</div>
          </div>
          <div className="text-center bg-white/5 rounded-lg p-2">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Odd Média</div>
            <div className="font-mono font-bold text-white text-sm mt-0.5">{fmtOdd(market.avg_odd)}</div>
          </div>
        </div>

        {/* Breakeven indicator */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${diffPct >= 0 ? 'bg-primary' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, (market.win_rate / 100) * 100))}%` }}
            />
          </div>
          <span className={`text-[9px] font-mono font-bold ${diffPct >= 0 ? 'text-primary' : 'text-red-400'}`}>
            {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
          </span>
        </div>
        <p className="text-[8px] text-slate-600 mt-0.5">Breakeven: {fmtPct(market.breakeven)}</p>
      </div>

      {/* Odds Distribution */}
      {selected && (
        <div className="border-t border-border-subtle px-2 py-2 space-y-0.5 bg-black/20">
          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider px-2 mb-1.5">
            Distribuição de Odds
          </p>
          {market.odds_distribution.map((d, i) => (
            <OddBar key={i} d={d} max={maxCount} breakeven={market.breakeven} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Compound Calculator ─────────────────────────────────────────────────────

const CompoundCalculator: React.FC<{
  markets: MarketStat[];
  compoundMath: CompoundMath[];
}> = ({ markets, compoundMath }) => {
  const [banca, setBanca] = useState(1000);
  const [ciclos, setCiclos] = useState(30);
  const [market1, setMarket1] = useState('');
  const [market2, setMarket2] = useState('');
  const [targetAvg, setTargetAvg] = useState(1.34);

  const m1 = markets.find(m => m.col === market1);
  const m2 = markets.find(m => m.col === market2);

  const mathRow = compoundMath.find(c => Math.abs(c.avg_odd - targetAvg) < 0.005) ?? compoundMath[Math.floor(compoundMath.length / 2)];

  // Simular evolução da banca com juros compostos
  const simulation = useMemo(() => {
    const rows: { ciclo: number; banca: number; lucro: number }[] = [];
    let b = banca;
    const compound = mathRow.compound_odd;
    for (let i = 1; i <= ciclos; i++) {
      b = b * compound;
      rows.push({ ciclo: i, banca: parseFloat(b.toFixed(2)), lucro: parseFloat((b - banca).toFixed(2)) });
    }
    return rows;
  }, [banca, ciclos, mathRow]);

  const finalBanca = simulation[simulation.length - 1]?.banca ?? banca;
  const totalReturn = ((finalBanca / banca - 1) * 100).toFixed(1);

  // Para visualização do gráfico
  const maxBanca = finalBanca;
  const chartPoints = simulation.map((r, i) => {
    const x = (i / (simulation.length - 1)) * 100;
    const y = 100 - ((r.banca - banca) / (maxBanca - banca + 0.01)) * 80;
    return `${x},${y}`;
  });
  const chartPath = `M${chartPoints.join(' L')}`;

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
          <span className="material-symbols-outlined text-primary text-xl">calculate</span>
        </div>
        <div>
          <h2 className="font-bold text-white text-lg">Calculadora de Juros Compostos</h2>
          <p className="text-slate-500 text-xs">Simule a evolução da banca com duas entradas compostas</p>
        </div>
      </div>

      {/* Configuração */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Banca Inicial (R$)
          </label>
          <input
            type="number" min="10" step="100" value={banca}
            onChange={e => setBanca(parseFloat(e.target.value) || 1000)}
            className="w-full bg-background-dark border border-border-subtle rounded-lg px-3 py-2 text-sm text-white font-mono focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Ciclos (dias)
          </label>
          <input
            type="number" min="1" max="365" step="1" value={ciclos}
            onChange={e => setCiclos(Math.min(365, Math.max(1, parseInt(e.target.value) || 30)))}
            className="w-full bg-background-dark border border-border-subtle rounded-lg px-3 py-2 text-sm text-white font-mono focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Odd Média Alvo
          </label>
          <input
            type="number" min="1.20" max="2.00" step="0.01" value={targetAvg}
            onChange={e => setTargetAvg(parseFloat(e.target.value) || 1.34)}
            className="w-full bg-background-dark border border-border-subtle rounded-lg px-3 py-2 text-sm text-white font-mono focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Odd Composta
          </label>
          <div className="w-full bg-background-dark border border-primary/30 rounded-lg px-3 py-2 text-sm font-mono text-primary font-bold">
            {mathRow.compound_odd.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Seleção de mercados */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Entrada 1 (Mercado)
          </label>
          <select
            value={market1}
            onChange={e => setMarket1(e.target.value)}
            className="w-full bg-background-dark border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary"
          >
            <option value="">— Selecione —</option>
            {markets.map(m => (
              <option key={m.col} value={m.col}>
                {m.label} ({fmtPct(m.win_rate)} win)
              </option>
            ))}
          </select>
          {m1 && (
            <div className={`mt-1.5 text-[10px] font-mono ${m1.is_lucrativo ? 'text-emerald-400' : 'text-red-400'}`}>
              Win: {fmtPct(m1.win_rate)} | Break: {fmtPct(m1.breakeven)} | {m1.total_in_range} jogos
            </div>
          )}
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Entrada 2 (Mercado)
          </label>
          <select
            value={market2}
            onChange={e => setMarket2(e.target.value)}
            className="w-full bg-background-dark border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary"
          >
            <option value="">— Selecione —</option>
            {markets.map(m => (
              <option key={m.col} value={m.col}>
                {m.label} ({fmtPct(m.win_rate)} win)
              </option>
            ))}
          </select>
          {m2 && (
            <div className={`mt-1.5 text-[10px] font-mono ${m2.is_lucrativo ? 'text-emerald-400' : 'text-red-400'}`}>
              Win: {fmtPct(m2.win_rate)} | Break: {fmtPct(m2.breakeven)} | {m2.total_in_range} jogos
            </div>
          )}
        </div>
      </div>

      {/* Probabilidade conjunta */}
      {m1 && m2 && (
        <div className="bg-background-dark/60 rounded-xl p-4 border border-border-subtle grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Win Individual M1</p>
            <p className={`font-mono font-bold text-lg mt-1 ${m1.is_lucrativo ? 'text-primary' : 'text-red-400'}`}>{fmtPct(m1.win_rate)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Win Individual M2</p>
            <p className={`font-mono font-bold text-lg mt-1 ${m2.is_lucrativo ? 'text-primary' : 'text-red-400'}`}>{fmtPct(m2.win_rate)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Ambas Green (teórico)</p>
            <p className="font-mono font-bold text-lg mt-1 text-amber-400">
              {fmtPct(m1.win_rate / 100 * m2.win_rate / 100 * 100)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Break Even Dupla</p>
            <p className="font-mono font-bold text-lg mt-1 text-slate-400">{fmtPct(mathRow.min_win_rate_both)}</p>
          </div>
        </div>
      )}

      {/* Gráfico de evolução */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Evolução da Banca</p>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-slate-500 font-mono">Inicial: R$ {banca.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] font-mono text-primary font-bold">Final: R$ {finalBanca.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
            <span className={`text-[10px] font-mono font-bold ${parseFloat(totalReturn) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              +{totalReturn}%
            </span>
          </div>
        </div>

        <div className="relative w-full h-40 bg-background-dark rounded-xl border border-border-subtle overflow-hidden">
          {/* Grid lines */}
          {[25, 50, 75].map(y => (
            <div key={y} className="absolute w-full border-t border-white/5" style={{ top: `${y}%` }} />
          ))}
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Area */}
            <defs>
              <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#24ffbd" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#24ffbd" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${chartPath} L100,100 L0,100 Z`}
              fill="url(#chartGrad)"
            />
            <path d={chartPath} fill="none" stroke="#24ffbd" strokeWidth="0.8" />
          </svg>
          <div className="absolute bottom-2 left-3 text-[9px] font-mono text-slate-600">0</div>
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-slate-600">{ciclos} ciclos</div>
        </div>
      </div>

      {/* Tabela de progresso */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left text-[9px] text-slate-500 uppercase font-bold tracking-wider py-2 px-2">Ciclo</th>
              <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-2 px-2">Banca</th>
              <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-2 px-2">Lucro Acum.</th>
              <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-2 px-2">Retorno</th>
            </tr>
          </thead>
          <tbody>
            {simulation.filter((_, i) => i === 0 || (i + 1) % Math.max(1, Math.floor(ciclos / 10)) === 0 || i === simulation.length - 1).map((r) => (
              <tr key={r.ciclo} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="py-1.5 px-2 font-mono text-slate-400">{r.ciclo}</td>
                <td className="py-1.5 px-2 font-mono text-white text-right font-bold">
                  R$ {r.banca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-2 font-mono text-primary text-right">
                  +R$ {r.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-1.5 px-2 font-mono text-emerald-400 text-right">
                  +{((r.banca / banca - 1) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const CompoundOdds: React.FC = () => {
  const [data, setData] = useState<CompoundOddsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minOdd, setMinOdd] = useState(1.29);
  const [maxOdd, setMaxOdd] = useState(1.39);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'markets' | 'ranking' | 'calculator'>('markets');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<CompoundOddsData>(
        `/stats/compound-odds?min_odd=${minOdd}&max_odd=${maxOdd}`
      );
      setData(result);
      if (!selectedMarket && result.markets.length > 0) {
        setSelectedMarket(result.markets[0].col);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [minOdd, maxOdd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const topMarkets = data?.markets.filter(m => m.is_lucrativo).sort((a, b) => b.win_rate - a.win_rate) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 border-l-4 border-primary pl-6 py-2">
          <h1 className="text-white text-4xl font-black leading-tight tracking-tight uppercase italic">
            Juros Compostos
          </h1>
          <p className="text-slate-400 text-base max-w-2xl font-display">
            Análise de odds entre {minOdd.toFixed(2)} e {maxOdd.toFixed(2)} para estratégia de dupla entrada com juros compostos.
          </p>
        </div>

        {/* Controles de range */}
        <div className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-4">
          <div>
            <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Odd Mín</label>
            <input
              type="number" step="0.01" min="1.01" max="2.00" value={minOdd}
              onChange={e => setMinOdd(parseFloat(e.target.value) || 1.29)}
              className="w-20 bg-background-dark border border-border-subtle rounded px-2 py-1.5 text-sm text-white font-mono focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="text-slate-600 mt-4">—</div>
          <div>
            <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Odd Máx</label>
            <input
              type="number" step="0.01" min="1.01" max="2.00" value={maxOdd}
              onChange={e => setMaxOdd(parseFloat(e.target.value) || 1.39)}
              className="w-20 bg-background-dark border border-border-subtle rounded px-2 py-1.5 text-sm text-white font-mono focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="mt-4 bg-primary hover:brightness-110 disabled:opacity-50 text-background-dark font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 text-sm transition-all active:scale-95"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'refresh' : 'search'}
            </span>
            Analisar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-400">error</span>
          <p className="text-red-400 text-sm font-mono">{error}</p>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
            <p className="text-slate-500 text-sm">Consultando banco de dados...</p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: 'database', label: 'Total de Jogos', val: fmtNum(data.total_games), sub: `${fmtNum(data.finished_games)} finalizados` },
              { icon: 'show_chart', label: 'Mercados no Range', val: data.markets.length.toString(), sub: `${topMarkets.length} lucrativos` },
              { icon: 'trending_up', label: 'Maior Win Rate', val: data.markets[0] ? fmtPct(Math.max(...data.markets.map(m => m.win_rate))) : '—', sub: data.markets.find(m => m.win_rate === Math.max(...data.markets.map(x => x.win_rate)))?.label ?? '' },
              { icon: 'calculate', label: 'Melhor Odd Composta', val: data.compound_math.find(c => Math.abs(c.avg_odd - 1.34) < 0.005)?.compound_odd.toFixed(4) ?? '—', sub: 'para odd média 1.34' },
            ].map((kpi, i) => (
              <div key={i} className="bg-surface border border-border-subtle rounded-xl p-4 flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">{kpi.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{kpi.label}</p>
                  <p className="font-mono font-bold text-white text-xl mt-0.5">{kpi.val}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 truncate">{kpi.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-surface border border-border-subtle rounded-xl p-1 w-fit">
            {[
              { id: 'markets' as const, label: 'Mercados', icon: 'bar_chart' },
              { id: 'ranking' as const, label: 'Top Odds', icon: 'leaderboard' },
              { id: 'calculator' as const, label: 'Calculadora', icon: 'calculate' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-background-dark shadow-[0_0_12px_rgba(36,255,189,0.2)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: Mercados */}
          {activeTab === 'markets' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-slate-500 text-xs">Clique em um mercado para ver a distribuição de odds. Verde = win rate acima do breakeven.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.markets.map(m => (
                  <MarketCard
                    key={m.col}
                    market={m}
                    selected={selectedMarket === m.col}
                    onClick={() => setSelectedMarket(selectedMarket === m.col ? null : m.col)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB: Ranking de Odds */}
          {activeTab === 'ranking' && (
            <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
              <div className="p-5 border-b border-border-subtle flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">leaderboard</span>
                <div>
                  <h2 className="font-bold text-white">Top 25 Odds Mais Frequentes</h2>
                  <p className="text-slate-500 text-xs">Todos os mercados combinados, ordenados por ocorrência</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle bg-background-dark/30">
                      <th className="text-left text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">#</th>
                      <th className="text-left text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Odd</th>
                      <th className="text-left text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Mercado</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Ocorrências</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Vitórias</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Win Rate</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Frequência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_odds_global.map((t, i) => {
                      const maxTotal = data.top_odds_global[0]?.total ?? 1;
                      const barPct = (t.total / maxTotal) * 100;
                      // Find breakeven from market
                      const mkt = data.markets.find(m => m.label === t.mercado);
                      const isGreen = mkt ? t.win_rate > mkt.breakeven : t.win_rate > 74;

                      return (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] text-slate-500">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-white text-sm">{fmtOdd(t.odd)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] text-slate-300 bg-white/5 px-2 py-0.5 rounded font-medium">{t.mercado}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono text-white font-bold">{fmtNum(t.total)}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-mono text-slate-400">{fmtNum(t.wins)}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono font-bold text-sm ${isGreen ? 'text-primary' : 'text-red-400'}`}>
                              {fmtPct(t.win_rate)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/70 transition-all"
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: Calculadora */}
          {activeTab === 'calculator' && (
            <CompoundCalculator markets={data.markets} compoundMath={data.compound_math} />
          )}

          {/* Tabela de Matemática dos Juros Compostos (sempre visível) */}
          {activeTab !== 'calculator' && (
            <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
              <div className="p-5 border-b border-border-subtle flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-400">functions</span>
                <div>
                  <h2 className="font-bold text-white">Matemática dos Juros Compostos</h2>
                  <p className="text-slate-500 text-xs">
                    Retorno e breakeven para cada nível de odd média no range
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle bg-background-dark/30">
                      <th className="text-left text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Odd Média</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Odd Composta</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Lucro/Ciclo</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Win Break (1 entrada)</th>
                      <th className="text-right text-[9px] text-slate-500 uppercase font-bold tracking-wider py-3 px-4">Win Break (2 entradas)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.compound_math.map((c, i) => (
                      <tr
                        key={i}
                        className={`border-b border-white/5 hover:bg-white/3 transition-colors ${
                          Math.abs(c.avg_odd - 1.34) < 0.005 ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                        }`}
                      >
                        <td className="py-2 px-4 font-mono font-bold text-white">{fmtOdd(c.avg_odd)}</td>
                        <td className="py-2 px-4 font-mono text-primary text-right font-bold">{c.compound_odd.toFixed(4)}</td>
                        <td className="py-2 px-4 font-mono text-emerald-400 text-right font-bold">+{c.profit_pct.toFixed(2)}%</td>
                        <td className="py-2 px-4 font-mono text-amber-400 text-right">&gt;{fmtPct(c.min_win_rate_single)}</td>
                        <td className="py-2 px-4 font-mono text-red-400 text-right">&gt;{fmtPct(c.min_win_rate_both)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CompoundOdds;
