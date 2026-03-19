import React from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GameRecord } from '../types';

interface Props {
  game: GameRecord | null;
  onClose: () => void;
}

// ── Cálculos de análise ──────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

/** Converte probabilidade em percentual visual 0-100 */
function prob(v: number): number { return clamp(Math.round(v * 100)); }

interface Analysis {
  xG_home: number;
  xG_away: number;
  xG_total: number;
  xG_ht: number;
  markets: { key: string; label: string; pct: number; oddRef?: number }[];
  topMarket: string;
}

function analyzeGame(g: GameRecord): Analysis {
  // Expected goals cruzados
  const xG_home  = (g.avg_goals_scored_home + g.avg_goals_conceded_away) / 2;
  const xG_away  = (g.avg_goals_scored_away + g.avg_goals_conceded_home) / 2;
  const xG_total = xG_home + xG_away;
  const xG_ht    = (g.avg_goals_scored_1h_home + g.avg_goals_scored_1h_away);

  // Eficiência relativa para calcular win%
  const effH = clamp(g.efficiency_home, 0, 100);
  const effA = clamp(g.efficiency_away, 0, 100);
  const effTotal = effH + effA || 1;

  // Win% bruto ajustado pela eficiência relativa
  const rawHome = g.wins_percent_home;
  const rawAway = g.wins_percent_away;
  const rawDraw = clamp(100 - rawHome - rawAway, 0, 100);

  // Peso de eficiência (±15%)
  const effBias = ((effH - effA) / effTotal) * 15;
  const homeWin = clamp(rawHome + effBias);
  const awayWin = clamp(rawAway - effBias);
  const drawPct  = clamp(Math.max(0, 100 - homeWin - awayWin));

  // Over 0.5 HT: probabilidade baseada em média de gols no 1H
  // Se avg 1H total > 1.0 → muito provável; mapeado em [50–98%]
  const over05ht = clamp(40 + xG_ht * 38);

  // Over 1.5: Poisson simplificado — P(gols >= 2) = 1 - P(0) - P(1)
  // P(k gols) ≈ e^(-λ) * λ^k / k!
  const over15 = prob(1 - Math.exp(-xG_total) * (1 + xG_total));

  // Over 2.5
  const over25 = prob(1 - Math.exp(-xG_total) * (1 + xG_total + xG_total ** 2 / 2));

  // Under 3.5 = 1 - P(gols >= 4)
  const lambda = xG_total;
  const p3 = Math.exp(-lambda) * (1 + lambda + lambda ** 2 / 2 + lambda ** 3 / 6);
  const under35 = prob(p3);

  // BTTS: P(home marca) × P(away marca) usando Poisson P(k=0) = e^-λ
  const pHomeMarca = 1 - Math.exp(-xG_home);
  const pAwayMarca = 1 - Math.exp(-xG_away);
  const btts = prob(pHomeMarca * pAwayMarca);

  const markets = [
    { key: 'home',     label: '🏠 Casa Vence',    pct: Math.round(homeWin), oddRef: g.odd_home     },
    { key: 'draw',     label: '🤝 Empate',         pct: Math.round(drawPct), oddRef: g.odd_draw     },
    { key: 'away',     label: '✈️ Visitante Vence', pct: Math.round(awayWin), oddRef: g.odd_away     },
    { key: 'over05ht', label: '⚡ Over 0.5 HT',    pct: Math.round(over05ht),oddRef: g.odd_over05_ht },
    { key: 'over15',   label: '⚽ Over 1.5 FT',    pct: over15,              oddRef: g.odd_over15   },
    { key: 'over25',   label: '🎯 Over 2.5 FT',    pct: over25,              oddRef: g.odd_over25   },
    { key: 'under35',  label: '🛡️ Under 3.5 FT',   pct: under35,             oddRef: g.odd_under35  },
    { key: 'btts',     label: '🔄 BTTS Sim',        pct: btts,                oddRef: g.odd_btts_yes },
  ];

  const topMarket = markets.reduce((best, m) => (m.pct > best.pct ? m : best), markets[0]).key;

  return { xG_home, xG_away, xG_total, xG_ht, markets, topMarket };
}

// ── Sub-components ───────────────────────────────────────────────────────────────

function Thermometer({ pct, isTop }: { pct: number; isTop: boolean }) {
  // Gradiente: vermelho→amarelo→verde baseado no %
  const hue = Math.round(pct * 1.2); // 0→0 (red), 100→120 (green)
  const bg  = `hsl(${hue}, 72%, 44%)`;
  const glow = isTop ? `0 0 8px hsl(${hue}, 72%, 44%)` : 'none';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: bg, boxShadow: glow }}
        />
      </div>
      <span
        className="text-xs font-bold tabular-nums w-9 text-right"
        style={{ color: pct >= 55 ? bg : '#6b8499' }}
      >
        {pct}%
      </span>
    </div>
  );
}

function StatBar({ labelLeft, labelRight, valLeft, valRight, higherIsBetter = true }: {
  labelLeft: string; labelRight: string;
  valLeft: number;   valRight: number;
  higherIsBetter?: boolean;
}) {
  const total = (valLeft + valRight) || 1;
  const pctLeft = Math.round((valLeft / total) * 100);
  const homeWins = higherIsBetter ? valLeft > valRight : valLeft < valRight;
  const awayWins = higherIsBetter ? valRight > valLeft : valRight < valLeft;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-semibold">
        <span className={homeWins ? 'text-primary' : 'text-slate-400'}>{valLeft.toFixed(2)}</span>
        <span className="text-slate-600 text-[9px] font-normal uppercase tracking-wider">{labelLeft} vs {labelRight}</span>
        <span className={awayWins ? 'text-rose-400' : 'text-slate-400'}>{valRight.toFixed(2)}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5">
        <div className="h-full rounded-l-full bg-primary/60 transition-all" style={{ width: `${pctLeft}%` }} />
        <div className="h-full rounded-r-full bg-rose-400/60 transition-all" style={{ width: `${100 - pctLeft}%` }} />
      </div>
    </div>
  );
}

function StatCell({ label, value, sub, highlight }: {
  label: string; value: string | number; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={`text-center p-2 rounded-lg border ${highlight ? 'bg-primary/8 border-primary/20' : 'bg-white/3 border-white/5'}`}>
      <div className={`text-base font-bold ${highlight ? 'text-primary' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
      <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────────

const GameAnalysisModal: React.FC<Props> = ({ game, onClose }) => {
  if (!game) return null;
  const a = analyzeGame(game);
  const hasScore = game.home_score !== null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,14,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative bg-surface border border-border-subtle rounded-2xl shadow-2xl w-full overflow-hidden"
        style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between p-5 border-b border-border-subtle bg-background-dark/50">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              {game.country} — {game.league}
            </div>
            <h2 className="text-lg font-black text-white leading-tight">
              {game.home_team} <span className="text-slate-600 font-normal">vs</span> {game.away_team}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-mono">{game.match_time}</span>
              {hasScore && (
                <span className="text-sm font-black text-white bg-white/5 border border-white/10 rounded px-2 py-0.5">
                  {game.home_score}–{game.away_score}
                  {game.home_score_ht !== null && (
                    <span className="text-[10px] text-slate-500 ml-1">(HT {game.home_score_ht}–{game.away_score_ht})</span>
                  )}
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${game.status === 'FT' ? 'bg-slate-700/50 text-slate-400' : 'bg-primary/10 text-primary'}`}>
                {game.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body: 2 colunas ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border-subtle">

          {/* ── Coluna esquerda: Stats dos times ── */}
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estatísticas dos Times</span>
            </div>

            {/* xG */}
            <div className="bg-white/3 border border-white/5 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected Goals (xG)</span>
                <span className="text-[10px] text-slate-600">Total: <strong className="text-slate-300">{a.xG_total.toFixed(2)}</strong></span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-black text-primary">{a.xG_home.toFixed(2)}</div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">Casa</div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-px h-8 bg-white/10" />
                </div>
                <div>
                  <div className="text-xl font-black text-rose-400">{a.xG_away.toFixed(2)}</div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">Visitante</div>
                </div>
              </div>
            </div>

            {/* Grade de stats individuais */}
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Eficiência" value={`${game.efficiency_home.toFixed(0)}%`} highlight={game.efficiency_home > game.efficiency_away} />
              <StatCell label="Rank" value={`#${game.rank_home}`} highlight={game.rank_home < game.rank_away} />
              <StatCell label="Win %" value={`${game.wins_percent_home.toFixed(0)}%`} highlight={game.wins_percent_home > game.wins_percent_away} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Eficiência" value={`${game.efficiency_away.toFixed(0)}%`} highlight={game.efficiency_away > game.efficiency_home} />
              <StatCell label="Rank" value={`#${game.rank_away}`} highlight={game.rank_away < game.rank_home} />
              <StatCell label="Win %" value={`${game.wins_percent_away.toFixed(0)}%`} highlight={game.wins_percent_away > game.wins_percent_home} />
            </div>

            <div className="text-[9px] text-slate-700 -mt-2 text-center">↑ Casa &nbsp;|&nbsp; ↓ Visitante</div>

            {/* Barras comparativas */}
            <div className="space-y-3">
              <StatBar labelLeft="Marcados Casa" labelRight="Marcados Visita" valLeft={game.avg_goals_scored_home} valRight={game.avg_goals_scored_away} />
              <StatBar labelLeft="Sofridos Casa"  labelRight="Sofridos Visita"  valLeft={game.avg_goals_conceded_home} valRight={game.avg_goals_conceded_away} higherIsBetter={false} />
              <StatBar labelLeft="1H Marcados H" labelRight="1H Marcados A" valLeft={game.avg_goals_scored_1h_home} valRight={game.avg_goals_scored_1h_away} />
              <StatBar labelLeft="2H Marcados H" labelRight="2H Marcados A" valLeft={game.avg_goals_scored_2h_home} valRight={game.avg_goals_scored_2h_away} />
            </div>

            {/* Global da liga */}
            <div className="flex gap-3 pt-1">
              <div className="flex-1 bg-white/3 border border-white/5 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-slate-300">{game.global_goals_match.toFixed(2)}</div>
                <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">Média gols/jogo (liga)</div>
              </div>
              <div className="flex-1 bg-white/3 border border-white/5 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-slate-300">{a.xG_ht.toFixed(2)}</div>
                <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">xG 1º tempo combinado</div>
              </div>
            </div>
          </div>

          {/* ── Coluna direita: Termômetros ── */}
          <div className="p-5 space-y-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Termômetro de Probabilidades
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed -mt-2">
              Estimativa baseada em expected goals (Poisson) e estatísticas históricas dos times.
            </p>

            <div className="space-y-3">
              {a.markets.map((m) => {
                const isTop = m.key === a.topMarket;
                return (
                  <div
                    key={m.key}
                    className={`rounded-xl p-3 border transition-all ${
                      isTop
                        ? 'bg-primary/5 border-primary/25'
                        : 'bg-white/2 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${isTop ? 'text-white' : 'text-slate-400'}`}>
                        {m.label}
                        {isTop && (
                          <span className="ml-2 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                            Mais provável
                          </span>
                        )}
                      </span>
                      {m.oddRef && m.oddRef > 0 && (
                        <span className="text-[10px] text-slate-600 font-mono">odd {m.oddRef.toFixed(2)}</span>
                      )}
                    </div>
                    <Thermometer pct={m.pct} isTop={isTop} />
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border-subtle">
              <p className="text-[9px] text-slate-700 leading-relaxed">
                ⚠️ Probabilidades calculadas com base em expected goals (método de Poisson) e win rate histórico. 
                Não garantem resultado. Use como apoio à decisão.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameAnalysisModal;
