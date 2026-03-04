import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../src/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Market = 'home' | 'away' | 'over25' | 'btts';

interface Strategy {
  id: string;
  name: string;
  market: Market;
  min_odd: number;
  max_odd: number;
  date_start: string;
  date_end: string;
  stake: number;
  active: boolean;
  created_at: string;
}

interface BacktestResult {
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
  roi: number;
  profit: number;
  avg_odd: number;
  first_date: string | null;
  last_date: string | null;
}

const MARKET_LABELS: Record<Market, string> = {
  home:   'Match Odds — Casa',
  away:   'Match Odds — Visitante',
  over25: 'Over 2.5 Gols',
  btts:   'Ambas Marcam (Sim)',
};

const STORAGE_KEY = 'odd_cientifica_strategies';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadStrategies(): Strategy[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStrategies(list: Strategy[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Mini chart (profit curve placeholder) ───────────────────────────────────

const MiniChart: React.FC<{ positive: boolean }> = ({ positive }) => (
  <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
    {positive ? (
      <path d="M0,50 L40,42 L80,30 L120,15 L160,10 L200,5" fill="none" stroke="#24ffbd" strokeWidth="2" strokeLinecap="round" />
    ) : (
      <path d="M0,10 L40,20 L80,25 L120,38 L160,45 L200,55" fill="none" stroke="#ff4747" strokeWidth="2" strokeLinecap="round" />
    )}
  </svg>
);

// ─── Modal de Criação / Edição ────────────────────────────────────────────────

const DEFAULT_FORM: Omit<Strategy, 'id' | 'active' | 'created_at'> = {
  name: '',
  market: 'home',
  min_odd: 1.20,
  max_odd: 2.00,
  date_start: '',
  date_end: '',
  stake: 100,
};

const StrategyModal: React.FC<{
  initial?: Strategy;
  onSave: (s: Strategy) => void;
  onClose: () => void;
}> = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState<Omit<Strategy, 'id' | 'active' | 'created_at'>>(
    initial
      ? { name: initial.name, market: initial.market, min_odd: initial.min_odd, max_odd: initial.max_odd, date_start: initial.date_start, date_end: initial.date_end, stake: initial.stake }
      : DEFAULT_FORM
  );
  const [preview, setPreview] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const set = (key: keyof typeof form, val: any) => setForm(f => ({ ...f, [key]: val }));

  const runPreview = async () => {
    setLoading(true);
    setPreviewError('');
    try {
      const result = await apiFetch<BacktestResult>('/backtest', {
        method: 'POST',
        body: JSON.stringify({
          market: form.market,
          min_odd: form.min_odd,
          max_odd: form.max_odd,
          date_start: form.date_start || undefined,
          date_end: form.date_end || undefined,
          stake: form.stake,
        }),
      });
      setPreview(result);
    } catch (e: any) {
      setPreviewError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const strat: Strategy = {
      id: initial?.id ?? uid(),
      active: initial?.active ?? true,
      created_at: initial?.created_at ?? new Date().toISOString(),
      ...form,
    };
    onSave(strat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111827] border border-border-subtle rounded-2xl w-full max-w-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-white font-bold text-lg">{initial ? 'Editar Estratégia' : 'Nova Estratégia'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Nome */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Nome da Estratégia</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: Favorito Casa Odd 1.5"
              className="w-full bg-background-dark border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-white focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Mercado */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Mercado</label>
            <select
              value={form.market}
              onChange={e => set('market', e.target.value as Market)}
              className="w-full bg-background-dark border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-white focus:ring-primary"
            >
              {(Object.entries(MARKET_LABELS) as [Market, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Faixa de Odds */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Odd Mínima</label>
              <input
                type="number" step="0.05" min="1.01"
                value={form.min_odd}
                onChange={e => set('min_odd', parseFloat(e.target.value))}
                className="w-full bg-background-dark border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Odd Máxima</label>
              <input
                type="number" step="0.05" min="1.01"
                value={form.max_odd}
                onChange={e => set('max_odd', parseFloat(e.target.value))}
                className="w-full bg-background-dark border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:ring-primary"
              />
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Data Início</label>
              <input
                type="date"
                value={form.date_start}
                onChange={e => set('date_start', e.target.value)}
                className="w-full bg-background-dark border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-white focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Data Fim</label>
              <input
                type="date"
                value={form.date_end}
                onChange={e => set('date_end', e.target.value)}
                className="w-full bg-background-dark border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-white focus:ring-primary"
              />
            </div>
          </div>

          {/* Stake */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Stake por Jogo (R$)</label>
            <input
              type="number" min="1"
              value={form.stake}
              onChange={e => set('stake', parseFloat(e.target.value))}
              className="w-full bg-background-dark border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:ring-primary"
            />
          </div>

          {/* Preview do backtest */}
          <div className="pt-1">
            <button
              onClick={runPreview}
              disabled={loading}
              className="w-full py-2.5 bg-surface border border-primary/40 text-primary text-sm font-bold rounded-lg hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">{loading ? 'hourglass_empty' : 'play_circle'}</span>
              {loading ? 'Calculando...' : 'Pré-visualizar Backtest'}
            </button>

            {previewError && (
              <p className="text-negative text-xs mt-2 text-center font-mono">{previewError}</p>
            )}

            {preview && !previewError && (
              <div className="mt-3 grid grid-cols-4 gap-2 bg-background-dark/60 rounded-xl p-4 border border-border-subtle">
                {[
                  { label: 'Jogos', val: preview.total.toString() },
                  { label: 'Win Rate', val: `${preview.win_rate.toFixed(1)}%`, color: preview.win_rate >= 50 ? 'text-primary' : 'text-negative' },
                  { label: 'ROI', val: `${preview.roi.toFixed(1)}%`, color: preview.roi >= 0 ? 'text-primary' : 'text-negative' },
                  { label: 'Lucro', val: `R$${preview.profit.toFixed(0)}`, color: preview.profit >= 0 ? 'text-primary' : 'text-negative' },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{s.label}</p>
                    <p className={`font-mono font-bold text-sm mt-0.5 ${s.color ?? 'text-white'}`}>{s.val}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-surface border border-border-subtle text-slate-300 text-sm font-bold rounded-lg hover:bg-white/5 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="flex-1 py-2.5 bg-primary text-background-dark text-sm font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {initial ? 'Salvar Alterações' : 'Criar Estratégia'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Strategy Card ─────────────────────────────────────────────────────────────

const StrategyCard: React.FC<{
  strategy: Strategy;
  onToggle: (id: string) => void;
  onEdit: (s: Strategy) => void;
  onDelete: (id: string) => void;
}> = ({ strategy, onToggle, onEdit, onDelete }) => {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runBacktest = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<BacktestResult>('/backtest', {
        method: 'POST',
        body: JSON.stringify({
          market: strategy.market,
          min_odd: strategy.min_odd,
          max_odd: strategy.max_odd,
          date_start: strategy.date_start || undefined,
          date_end: strategy.date_end || undefined,
          stake: strategy.stake,
        }),
      });
      setResult(r);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [strategy]);

  useEffect(() => { runBacktest(); }, [runBacktest]);

  const roiColor = !result ? 'text-slate-400' : result.roi >= 0 ? 'text-primary' : 'text-negative';
  const profitable = result ? result.roi >= 0 : true;

  return (
    <div className={`bg-surface border rounded-xl p-5 flex flex-col transition-all group hover:border-primary/50 ${strategy.active ? 'border-border-subtle' : 'border-border-subtle opacity-60'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-white group-hover:text-primary transition-colors truncate">{strategy.name}</h3>
          <span className="inline-block bg-primary/10 text-primary text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded mt-1">
            {MARKET_LABELS[strategy.market]}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onEdit(strategy)}
            className="p-1.5 hover:bg-background-dark rounded transition-colors text-slate-500 hover:text-white"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            onClick={() => onDelete(strategy.id)}
            className="p-1.5 hover:bg-background-dark rounded transition-colors text-slate-500 hover:text-negative"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>

      {/* Odd range badge */}
      <div className="flex gap-2 mb-3">
        <span className="text-[10px] font-mono bg-background-dark px-2 py-1 rounded text-slate-400 border border-border-subtle">
          Odd {strategy.min_odd.toFixed(2)} – {strategy.max_odd.toFixed(2)}
        </span>
        <span className="text-[10px] font-mono bg-background-dark px-2 py-1 rounded text-slate-400 border border-border-subtle">
          R$ {strategy.stake}/jogo
        </span>
      </div>

      {/* Mini chart */}
      <div className="h-12 w-full mb-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-600 animate-spin text-base">refresh</span>
          </div>
        ) : (
          <MiniChart positive={profitable} />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-1 mb-4">
        {[
          { label: 'Jogos',    val: result ? result.total.toString() : '—' },
          { label: 'Win%',     val: result ? `${result.win_rate.toFixed(0)}%` : '—',        color: result && result.win_rate >= 50 ? 'text-primary' : 'text-slate-300' },
          { label: 'ROI',      val: result ? `${result.roi.toFixed(1)}%` : '—',             color: roiColor },
          { label: 'Lucro',    val: result ? `${result.profit >= 0 ? '+' : ''}R$${result.profit.toFixed(0)}` : '—', color: roiColor },
        ].map((s, i) => (
          <div key={i} className="flex flex-col bg-background-dark/40 rounded-lg p-2 text-center">
            <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">{s.label}</span>
            <span className={`font-mono text-xs font-bold mt-0.5 ${s.color ?? 'text-white'}`}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* Dates */}
      {(strategy.date_start || strategy.date_end) && (
        <p className="text-[9px] text-slate-600 font-mono mb-3">
          {strategy.date_start || '—'} → {strategy.date_end || '—'}
        </p>
      )}

      {/* Footer toggle */}
      <div className="mt-auto pt-3 border-t border-border-subtle flex items-center justify-between">
        <button
          onClick={() => onToggle(strategy.id)}
          className="flex items-center gap-2 group/toggle"
        >
          <div className={`relative w-9 h-5 rounded-full transition-colors ${strategy.active ? 'bg-primary' : 'bg-slate-700'}`}>
            <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 shadow transition-transform ${strategy.active ? 'translate-x-full' : ''}`} />
          </div>
          <span className={`text-xs font-bold uppercase ${strategy.active ? 'text-primary' : 'text-slate-500'}`}>
            {strategy.active ? 'Ativa' : 'Pausada'}
          </span>
        </button>
        <button
          onClick={runBacktest}
          disabled={loading}
          className="text-slate-500 hover:text-primary transition-colors"
          title="Atualizar backtest"
        >
          <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Strategies: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>(loadStrategies);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Strategy | undefined>();
  const [search, setSearch] = useState('');
  const [filterMarket, setFilterMarket] = useState<'' | Market>('');

  const persist = (list: Strategy[]) => {
    setStrategies(list);
    saveStrategies(list);
  };

  const handleSave = (s: Strategy) => {
    const list = strategies.some(x => x.id === s.id)
      ? strategies.map(x => x.id === s.id ? s : x)
      : [...strategies, s];
    persist(list);
    setShowModal(false);
    setEditTarget(undefined);
  };

  const handleToggle = (id: string) =>
    persist(strategies.map(s => s.id === id ? { ...s, active: !s.active } : s));

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta estratégia?')) return;
    persist(strategies.filter(s => s.id !== id));
  };

  const handleEdit = (s: Strategy) => {
    setEditTarget(s);
    setShowModal(true);
  };

  const displayed = strategies.filter(s => {
    if (filterMarket && s.market !== filterMarket) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 border-l-4 border-primary pl-6 py-2">
          <h1 className="text-white text-4xl font-black leading-tight tracking-tight uppercase italic">Estratégias</h1>
          <p className="text-slate-400 text-base max-w-2xl font-display">
            Crie e monitore estratégias de aposta com backtest automático nos dados do MySQL.
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setShowModal(true); }}
          className="bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(36,255,189,0.2)] active:scale-95 whitespace-nowrap"
        >
          <span className="material-symbols-outlined">add</span>
          Nova Estratégia
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-background-dark border border-border-subtle rounded-lg pl-10 py-2 focus:ring-primary focus:border-primary text-sm text-white"
            placeholder="Buscar por nome..."
          />
        </div>
        <select
          value={filterMarket}
          onChange={e => setFilterMarket(e.target.value as '' | Market)}
          className="bg-background-dark border border-border-subtle rounded-lg px-4 py-2 text-sm text-white focus:ring-primary min-w-[160px]"
        >
          <option value="">Todos os Mercados</option>
          {(Object.entries(MARKET_LABELS) as [Market, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500 font-mono ml-auto">
          {displayed.length} estratégia{displayed.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayed.map(s => (
          <StrategyCard
            key={s.id}
            strategy={s}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}

        {/* Empty state */}
        {displayed.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined text-slate-700 text-6xl mb-4">auto_graph</span>
            <p className="text-slate-400 font-bold text-lg">Nenhuma estratégia ainda</p>
            <p className="text-slate-600 text-sm mt-1 mb-6">Crie sua primeira estratégia e veja o backtest automático.</p>
            <button
              onClick={() => { setEditTarget(undefined); setShowModal(true); }}
              className="bg-primary text-background-dark font-bold py-2.5 px-6 rounded-lg hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Criar Estratégia
            </button>
          </div>
        )}

        {/* Add card (only if already has strategies) */}
        {displayed.length > 0 && (
          <div
            onClick={() => { setEditTarget(undefined); setShowModal(true); }}
            className="border-2 border-dashed border-border-subtle rounded-xl p-5 flex flex-col items-center justify-center min-h-[280px] hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
          >
            <div className="size-12 bg-surface border border-border-subtle rounded-full flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary transition-all">
              <span className="material-symbols-outlined text-slate-400 group-hover:text-background-dark">add</span>
            </div>
            <p className="font-bold text-slate-400 group-hover:text-primary text-sm">Nova Estratégia</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <StrategyModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
        />
      )}
    </div>
  );
};

export default Strategies;