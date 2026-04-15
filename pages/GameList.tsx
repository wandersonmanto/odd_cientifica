import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Bookmark, BookmarkCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GameRecord } from '../types';
import { getAllGames } from '../src/db/gameRepository';
import GameAnalysisModal from '../components/GameAnalysisModal';

const API = 'http://localhost:3001';

const MARKET_OPTIONS = [
  { value: 'home',     label: 'Match Odds — Casa',      oddKey: 'odd_home',      short: 'Casa'   },
  { value: 'away',     label: 'Match Odds — Visitante', oddKey: 'odd_away',      short: 'Fora'   },
  { value: 'dc_1x',    label: 'Dupla Chance — 1X',      oddKey: 'odd_1x',        short: '1X'     },
  { value: 'dc_x2',    label: 'Dupla Chance — X2',      oddKey: 'odd_x2',        short: 'X2'     },
  { value: 'over05ht', label: 'Over 0.5 HT',            oddKey: 'odd_over05_ht', short: '0.5 HT' },
  { value: 'over15',   label: 'Over 1.5 FT',            oddKey: 'odd_over15',    short: 'Ov 1.5' },
  { value: 'over25',   label: 'Over 2.5 FT',            oddKey: 'odd_over25',    short: 'Ov 2.5' },
  { value: 'under25',  label: 'Under 2.5 FT',           oddKey: 'odd_under25',   short: 'Un 2.5' },
  { value: 'under35',  label: 'Under 3.5 FT',           oddKey: 'odd_under35',   short: 'Un 3.5' },
  { value: 'under45',  label: 'Under 4.5 FT',           oddKey: 'odd_under45',   short: 'Un 4.5' },
  { value: 'btts',     label: 'Ambas Marcam (Sim)',      oddKey: 'odd_btts_yes',  short: 'BTTS S' },
  { value: 'btts_no',  label: 'Ambas Marcam (Não)',      oddKey: 'odd_btts_no',   short: 'BTTS N' },
] as const;

type MarketValue = typeof MARKET_OPTIONS[number]['value'];

interface BestMarket {
  market: string;
  oddKey: string;
  short: string;
  ev: number;
  prob: number;      // probabilidade estimada pelo modelo Poisson (0-1)
  xg_home: number;  // gols esperados casa
  xg_away: number;  // gols esperados fora
}

// ─── Modelo de Poisson para previsão de resultados ────────────────────────────

/** PMF de Poisson: P(X = k | λ) */
function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda;
  for (let i = 1; i <= k; i++) logP += Math.log(lambda / i);
  return Math.exp(logP);
}

interface GameProbabilities {
  home: number; away: number;
  dc_1x: number; dc_x2: number;
  over05ht: number; over15: number; over25: number;
  under25: number; under35: number; under45: number;
  btts: number; btts_no: number;
}

/**
 * Calcula probabilidades de mercado via distribuição de Poisson,
 * usando os stats específicos da partida (gols, eficiência, ranking, médias da liga).
 */
function computeGameProbabilities(game: GameRecord): { probs: GameProbabilities; xgHome: number; xgAway: number } | null {
  const leagueAvgGoals = game.global_goals_league || game.global_goals_match || 2.5;
  const perTeam = leagueAvgGoals / 2 || 1.25;

  // Exige que TODOS os 4 stats de gols sejam presentes e > 0.
  // Qualquer zero ou nulo → dado ausente → descarta o jogo do cálculo.
  const scoredH   = game.avg_goals_scored_home;
  const concededH = game.avg_goals_conceded_home;
  const scoredA   = game.avg_goals_scored_away;
  const concededA = game.avg_goals_conceded_away;

  if (!scoredH || !concededH || !scoredA || !concededA) return null;

  // Força de ataque/defesa relativa à média da liga
  const atkH = scoredH   / perTeam;
  const defH = concededH / perTeam;
  const atkA = scoredA   / perTeam;
  const defA = concededA / perTeam;

  // λ = ataque × defesa adversária × média_liga × fator_vantagem_casa
  const HOME_ADV = 1.12;
  let xgHome = Math.max(0.15, atkH * defA * perTeam * HOME_ADV);
  let xgAway = Math.max(0.15, atkA * defH * perTeam);

  // Ajuste por eficiência — apenas quando disponível e ambos os times têm dado
  const effH = game.efficiency_home;
  const effA = game.efficiency_away;
  if (effH != null && effH > 0 && effA != null && effA > 0) {
    // Normaliza: 50 = neutro → fator 1.0; limita entre 0.7 e 1.4
    const fH = Math.max(0.7, Math.min(1.4, 0.5 + effH / 100));
    const fA = Math.max(0.7, Math.min(1.4, 0.5 + effA / 100));
    xgHome = Math.max(0.15, xgHome * fH);
    xgAway = Math.max(0.15, xgAway * fA);
  }

  // Matriz de probabilidades conjunta P(home=i, away=j)
  const MAX = 10;
  const pH: number[] = [], pA: number[] = [];
  for (let k = 0; k <= MAX; k++) {
    pH.push(poissonPMF(k, xgHome));
    pA.push(poissonPMF(k, xgAway));
  }

  let pHome = 0, pAway = 0, pOver15 = 0, pOver25 = 0;
  let pUnder25 = 0, pUnder35 = 0, pUnder45 = 0, pBtts = 0;

  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = pH[i] * pA[j];
      const tot = i + j;
      if (i > j) pHome    += p;
      if (j > i) pAway    += p;
      if (tot > 1.5) pOver15  += p;
      if (tot > 2.5) pOver25  += p;
      if (tot < 2.5) pUnder25 += p;
      if (tot < 3.5) pUnder35 += p;
      if (tot < 4.5) pUnder45 += p;
      if (i > 0 && j > 0) pBtts += p;
    }
  }

  // Over 0.5 HT: ~45% dos gols no 1º tempo
  const pOver05HT = 1 - poissonPMF(0, xgHome * 0.45) * poissonPMF(0, xgAway * 0.45);

  return {
    probs: {
      home: pHome, away: pAway,
      dc_1x: 1 - pAway, dc_x2: 1 - pHome,
      over05ht: pOver05HT, over15: pOver15, over25: pOver25,
      under25: pUnder25, under35: pUnder35, under45: pUnder45,
      btts: pBtts, btts_no: 1 - pBtts,
    },
    xgHome,
    xgAway,
  };
}

/**
 * Threshold mínimo de probabilidade por tipo de mercado.
 * Resultados (home/away) exigem mais certeza que gols/btts porque são menos
 * frequentes e a variância é maior. Impede que long-shots com EV inflado
 * por dados esparsos sejam selecionados.
 */
const MIN_PROB: Record<string, number> = {
  home:     0.50,   // vitória casa  → min 50%
  away:     0.50,   // vitória fora  → min 50%
  dc_1x:    0.65,   // dupla 1X      → min 65%
  dc_x2:    0.65,   // dupla X2      → min 65%
  over05ht: 0.65,   // gol no HT     → min 65%
  over15:   0.60,   // over 1.5      → min 60%
  over25:   0.45,   // over 2.5      → min 45%
  under25:  0.45,   // under 2.5     → min 45%
  under35:  0.55,   // under 3.5     → min 55%
  under45:  0.65,   // under 4.5     → min 65%
  btts:     0.45,   // ambas marcam  → min 45%
  btts_no:  0.45,   // não ambas     → min 45%
};

/**
 * Para cada mercado disponível, calcula EV = P_modelo × odd − 1 e retorna o melhor,
 * respeitando threshold de probabilidade mínima por mercado.
 */
function getBestMarket(game: GameRecord): BestMarket | null {
  const result = computeGameProbabilities(game);
  if (!result) return null;
  const { probs, xgHome, xgAway } = result;

  let best: BestMarket | null = null;
  let bestEV = 0;

  for (const market of MARKET_OPTIONS) {
    const odd = game[market.oddKey as keyof GameRecord] as number;
    if (!odd || odd <= 0) continue;

    // Validação cruzada com o mercado: para resultados (home/away), a odd máxima
    // é 4.5 (implied prob ≥ 22%). Se o mercado já precificou o time como grande
    // azarão, nossos dados raramente são confiáveis o suficiente para contradizer.
    if ((market.value === 'home' || market.value === 'away') && odd > 4.5) continue;

    const prob = probs[market.value as keyof GameProbabilities] ?? 0;

    // Descarta mercados abaixo do threshold — evita long-shots com EV inflado
    const minProb = MIN_PROB[market.value] ?? 0.45;
    if (prob < minProb) continue;

    const ev = prob * odd - 1;
    if (ev > bestEV) {
      bestEV = ev;
      best = { market: market.value, oddKey: market.oddKey, short: market.short, ev, prob, xg_home: xgHome, xg_away: xgAway };
    }
  }
  return best;
}

interface SavedPickKey {
  game_id: string;
  market: MarketValue;
}

interface PickPopoverState {
  gameId: string;
  market: MarketValue;
  saving: boolean;
}

const GameList: React.FC = () => {
  const navigate = useNavigate();
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
  const [filterLowWin, setFilterLowWin] = useState(false); // filtro Favorito Dominante

  // All odd columns to check for range filter
  const ODD_COLS: (keyof GameRecord)[] = [
    'odd_home', 'odd_away', 'odd_draw', 'odd_1x', 'odd_x2',
    'odd_over05', 'odd_over15', 'odd_over25',
    'odd_under15', 'odd_under25', 'odd_under35', 'odd_under45',
    'odd_over05_ht', 'odd_btts_yes', 'odd_btts_no',
  ];

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const gamesPerPage = 50;

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof GameRecord | '', direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  // Pick saving state
  const [savedPickKeys, setSavedPickKeys] = useState<SavedPickKey[]>([]);
  const [popover, setPopover] = useState<PickPopoverState | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Market Insights — toggle coluna EV%
  const [showEvColumn, setShowEvColumn] = useState(false);

  // Top picks — ocultar/exibir painel
  const [showTopPicks, setShowTopPicks] = useState(true);

  // Top 5 odds baixas (1.25–1.34) — ocultar/exibir painel
  const [showTopLowOdds, setShowTopLowOdds] = useState(true);

  // Top 5 Favorito Dominante — ocultar/exibir painel
  const [showTopDominant, setShowTopDominant] = useState(true);

  // Top 5 Under 2.5 — ocultar/exibir painel
  const [showTopUnder25, setShowTopUnder25] = useState(true);

  // Top 5 Dupla Chance — ocultar/exibir painel
  const [showTopDoubleChance, setShowTopDoubleChance] = useState(true);

  // Top 5 BTTS Científico — ocultar/exibir painel
  const [showTopBTTS, setShowTopBTTS] = useState(true);

  // Seleção Científica do Dia — ocultar/exibir painel
  const [showSelecao, setShowSelecao] = useState(true);

  // Top 3 Juros Compostos — ocultar/exibir painel
  const [showJurosCompostos, setShowJurosCompostos] = useState(true);

  // Top 3 do dia — navegação e highlight
  const [highlightedGameId, setHighlightedGameId] = useState<string | null>(null);

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
      fetchSavedPicksForDate(selectedDate);
    } else {
      setFilteredGames([]);
    }
    setCurrentPage(1);
  }, [selectedDate, allGames]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    if (popover) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  const fetchSavedPicksForDate = async (date: string) => {
    try {
      const res = await fetch(`${API}/api/picks?date=${date}`);
      if (res.ok) {
        const picks = await res.json();
        setSavedPickKeys(picks.map((p: any) => ({ game_id: p.game_id, market: p.market })));
      }
    } catch { /* server offline */ }
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const isPickSaved = (gameId: string, market?: MarketValue): boolean => {
    if (market) return savedPickKeys.some(p => p.game_id === gameId && p.market === market);
    return savedPickKeys.some(p => p.game_id === gameId);
  };

  const openPopover = (gameId: string) => {
    // If already open for same game, close it
    if (popover?.gameId === gameId) {
      setPopover(null);
      return;
    }
    // Default market: first one with a valid odd
    const game = allGames.find(g => g.id === gameId);
    let defaultMarket: MarketValue = 'over15';
    if (game) {
      const first = MARKET_OPTIONS.find(m => {
        const v = game[m.oddKey as keyof GameRecord] as number;
        return v && v > 0;
      });
      if (first) defaultMarket = first.value;
    }
    setPopover({ gameId, market: defaultMarket, saving: false });
  };

  const handleSavePick = async () => {
    if (!popover) return;
    const game = allGames.find(g => g.id === popover.gameId);
    if (!game) return;

    const marketObj = MARKET_OPTIONS.find(o => o.value === popover.market)!;
    const oddVal = game[marketObj.oddKey as keyof GameRecord] as number;

    if (!oddVal || oddVal <= 0) {
      showToast('⚠️ Odd não disponível para este mercado.', false);
      return;
    }

    setPopover(prev => prev ? { ...prev, saving: true } : null);

    // Se o filtro Favorito Dominante estiver ativo, salva na Sniper List
    const endpoint = filterLowWin ? `${API}/api/sniper-picks` : `${API}/api/picks`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          game_id: game.id,
          pick_date: selectedDate,
          market: popover.market,
          odd_used: oddVal,
          home_team: game.home_team,
          away_team: game.away_team,
          league: game.league,
          country: game.country,
          match_time: game.match_time,
        }]),
      });
      const data = await res.json();
      const skipped = data.inserted?.some((i: any) => i.skipped);
      if (skipped) {
        showToast('ℹ️ Pick já estava salvo.', true);
      } else if (filterLowWin) {
        showToast(`🎯 Pick salvo na Sniper List: ${game.home_team} vs ${game.away_team}`);
      } else {
        showToast(`✅ Pick salvo: ${game.home_team} vs ${game.away_team}`);
        setSavedPickKeys(prev => [...prev, { game_id: game.id, market: popover.market }]);
      }
    } catch {
      showToast('❌ Erro ao conectar ao servidor.', false);
    } finally {
      setPopover(null);
    }
  };

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

  // Helper: probabilidade de vença ajustada por eficiência (espelha lógica do GameAnalysisModal)
  const calcWinProbs = (g: GameRecord) => {
    const clamp = (v: number, mn = 0, mx = 100) => Math.min(mx, Math.max(mn, v));
    const effH = clamp(g.efficiency_home, 0, 100);
    const effA = clamp(g.efficiency_away, 0, 100);
    const effTotal = effH + effA || 1;
    const effBias = ((effH - effA) / effTotal) * 15;
    return {
      homeWin: clamp(g.wins_percent_home + effBias),
      awayWin: clamp(g.wins_percent_away - effBias),
    };
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

    // Filtro Favorito Dominante: um lado ≤15% + favorito >50% + mercado confirma (odd do favorito < odd do azarão)
    if (filterLowWin) {
      result = result.filter(g => {
        const { homeWin, awayWin } = calcWinProbs(g);
        const oneSideLow  = homeWin <= 15 || awayWin <= 15;
        const favoriteDom = Math.max(homeWin, awayWin) > 50;
        // O time com maior win% deve ter odd menor (mercado e modelo concordam)
        const homeIsFav = homeWin >= awayWin;
        const oddOk = homeIsFav
          ? (g.odd_home > 0 && g.odd_away > 0 && g.odd_home < g.odd_away)
          : (g.odd_home > 0 && g.odd_away > 0 && g.odd_away < g.odd_home);
        return oneSideLow && favoriteDom && oddOk;
      });
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
  }, [filteredGames, hideUnplayed, hideNoHome, hideNoOv15, hideNoUn35, oddMin, oddMax, timeFrom, timeTo, sortConfig, filterLowWin]);

  // Handle Pagination
  const totalPages = Math.ceil(processedGames.length / gamesPerPage) || 1;
  const paginatedGames = processedGames.slice(
    (currentPage - 1) * gamesPerPage,
    currentPage * gamesPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [hideUnplayed, hideNoHome, hideNoOv15, hideNoUn35, oddMin, oddMax, timeFrom, timeTo, sortConfig, filterLowWin]);

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

  const savedCount = savedPickKeys.filter(p =>
    paginatedGames.some(g => g.id === p.game_id)
  ).length;

  // Mapa game.id → BestMarket para os jogos da página atual
  const bestMarketMap = useMemo(() => {
    const map = new Map<string, BestMarket>();
    for (const game of paginatedGames) {
      const best = getBestMarket(game);
      if (best) map.set(game.id, best);
    }
    return map;
  }, [paginatedGames]);

  // Top 5 do Dia — score composto (EV×0.6 + prob×0.4), odd > 1.30, máximo 2 por mercado.
  // Score composto evita que EV inflado por prob baixa domine a lista.
  // Limite por mercado garante diversidade de oportunidades.
  const top3 = useMemo(() => {
    const candidates: { game: GameRecord; best: BestMarket; odd: number; score: number }[] = [];
    for (const game of filteredGames) {
      const best = getBestMarket(game);
      if (!best) continue;
      const oddVal = game[best.oddKey as keyof GameRecord] as number;
      if (!oddVal || oddVal <= 1.30) continue;
      const score = best.ev * 0.6 + best.prob * 0.4;
      candidates.push({ game, best, odd: oddVal, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    // Seleciona top 5 com no máximo 2 jogos do mesmo mercado
    const marketCount: Record<string, number> = {};
    const result: typeof candidates = [];
    for (const c of candidates) {
      const mkt = c.best.market;
      if ((marketCount[mkt] ?? 0) >= 2) continue;
      marketCount[mkt] = (marketCount[mkt] ?? 0) + 1;
      result.push(c);
      if (result.length === 5) break;
    }
    return result;
  }, [filteredGames]);

  // Top 5 Alta Confiança — odds 1.25–1.34 COM prob Poisson ≥ 70%.
  // Exige prob alta porque o nome promete "alta confiança": odd baixa + prob baixa = aposta perdedora.
  // Ordenado por probabilidade (não EV), pois o critério principal é certeza do modelo.
  const topLowOdds = useMemo(() => {
    const candidates: { game: GameRecord; best: BestMarket; odd: number }[] = [];
    for (const game of filteredGames) {
      const best = getBestMarket(game);
      if (!best) continue;
      const oddVal = game[best.oddKey as keyof GameRecord] as number;
      if (!oddVal || oddVal < 1.25 || oddVal > 1.34) continue;
      if (best.prob < 0.70) continue; // exige confiança real do modelo ≥ 70%
      candidates.push({ game, best, odd: oddVal });
    }
    return candidates.sort((a, b) => b.best.prob - a.best.prob).slice(0, 5);
  }, [filteredGames]);

  // Top 5 Favorito Dominante — threshold elevado para 60% (antes 50%) e filtro de odd do favorito.
  // Exige também validação Poisson (prob ≥ 55%) para alinhar critério empírico com o modelo.
  // Odd do favorito entre 1.30–2.20 garante que só aparecem jogos com valor possível.
  const topDominant = useMemo(() => {
    const candidates: { game: GameRecord; best: BestMarket; odd: number }[] = [];
    for (const game of filteredGames) {
      const { homeWin, awayWin } = calcWinProbs(game);
      const oneSideLow  = homeWin <= 15 || awayWin <= 15;
      const favoriteDom = Math.max(homeWin, awayWin) > 60; // elevado de 50% → 60%
      const homeIsFav = homeWin >= awayWin;
      const oddOk = homeIsFav
        ? (game.odd_home > 0 && game.odd_away > 0 && game.odd_home < game.odd_away)
        : (game.odd_home > 0 && game.odd_away > 0 && game.odd_away < game.odd_home);

      if (!(oneSideLow && favoriteDom && oddOk)) continue;

      // Filtro de odd do favorito: valor prático entre 1.30 e 2.20
      const favOdd = homeIsFav ? game.odd_home : game.odd_away;
      if (!favOdd || favOdd < 1.30 || favOdd > 2.20) continue;

      const best = getBestMarket(game);
      if (!best) continue;

      // Validação cruzada com Poisson: prob do favorito via modelo deve ser ≥ 55%
      const result = computeGameProbabilities(game);
      if (result) {
        const poissonFavProb = homeIsFav ? result.probs.home : result.probs.away;
        if (poissonFavProb < 0.55) continue;
      }

      const oddVal = game[best.oddKey as keyof GameRecord] as number;
      candidates.push({ game, best, odd: oddVal });
    }
    return candidates.sort((a, b) => b.best.ev - a.best.ev).slice(0, 5);
  }, [filteredGames]);

  // Top 5 Under 2.5 — EV positivo obrigatório, liga de baixa pontuação preferida.
  // Ordenado por EV (não prob pura) para garantir valor e não apenas certeza do modelo.
  // Filtro global_goals_league < 2.6 remove ligas de alto volume de gols onde under 2.5 é improvável.
  const topUnder25 = useMemo(() => {
    const candidates: { game: GameRecord; best: BestMarket; odd: number }[] = [];
    for (const game of filteredGames) {
      const oddVal = game.odd_under25 as number;
      if (!oddVal || oddVal <= 0) continue;

      // Preferir ligas com média de gols baixa (mais propícias a under 2.5)
      const leagueAvg = game.global_goals_league || game.global_goals_match || 0;
      if (leagueAvg > 2.6 && leagueAvg !== 0) continue;

      const result = computeGameProbabilities(game);
      if (!result) continue;

      const prob = result.probs.under25;
      const ev = prob * oddVal - 1;

      // Exige EV positivo — descarta jogos onde odd não compensa a probabilidade
      if (ev <= 0) continue;

      const customBest: BestMarket = {
        market: 'under25',
        oddKey: 'odd_under25',
        short: 'Un 2.5',
        ev,
        prob,
        xg_home: result.xgHome,
        xg_away: result.xgAway
      };

      candidates.push({ game, best: customBest, odd: oddVal });
    }
    return candidates.sort((a, b) => b.best.ev - a.best.ev).slice(0, 5);
  }, [filteredGames]);

  // Top 5 Dupla Chance (1X e X2) — prob ≥ 70%, odd ≥ 1.15, EV positivo, ordenado por EV.
  // Removida regra estrita "ambas devem existir" — basta uma opção válida por jogo.
  // Filtro de odd mínima (1.15) garante que haja valor real possível após margem do bookie.
  const topDoubleChance = useMemo(() => {
    const candidates: { game: GameRecord; best: BestMarket; odd: number }[] = [];
    for (const game of filteredGames) {
      const odd1x = game.odd_1x as number;
      const oddx2 = game.odd_x2 as number;

      const result = computeGameProbabilities(game);
      if (!result) continue;

      // Adiciona 1X se odd válida ≥ 1.15 + prob ≥ 70% + EV positivo
      if (odd1x && odd1x >= 1.15) {
        const prob1x = result.probs.dc_1x;
        const ev1x = prob1x * odd1x - 1;
        if (prob1x >= 0.70 && ev1x > 0) {
          candidates.push({
            game, odd: odd1x,
            best: { market: 'dc_1x', oddKey: 'odd_1x', short: '1X', ev: ev1x, prob: prob1x, xg_home: result.xgHome, xg_away: result.xgAway }
          });
        }
      }

      // Adiciona X2 se odd válida ≥ 1.15 + prob ≥ 70% + EV positivo
      if (oddx2 && oddx2 >= 1.15) {
        const probx2 = result.probs.dc_x2;
        const evx2 = probx2 * oddx2 - 1;
        if (probx2 >= 0.70 && evx2 > 0) {
          candidates.push({
            game, odd: oddx2,
            best: { market: 'dc_x2', oddKey: 'odd_x2', short: 'X2', ev: evx2, prob: probx2, xg_home: result.xgHome, xg_away: result.xgAway }
          });
        }
      }
    }

    // Agrupa pelo jogo pegando a melhor opção de Dupla Chance (maior EV)
    const bestPerGame = new Map<string, typeof candidates[0]>();
    for (const c of candidates) {
      const existing = bestPerGame.get(c.game.id);
      if (!existing || c.best.ev > existing.best.ev) {
        bestPerGame.set(c.game.id, c);
      }
    }

    return Array.from(bestPerGame.values())
      .sort((a, b) => b.best.ev - a.best.ev)
      .slice(0, 5);
  }, [filteredGames]);

  // Top 5 BTTS Científico — ambos os times com perfil ofensivo confirmado pelo banco de dados.
  // Critérios: médias de gols ≥ limiar + prob Poisson BTTS ≥ 55% + EV positivo.
  // Nota: não há floor de odd — o cálculo de EV (prob × odd > 1) já garante valor natural.
  // Impor odd mínima junto com prob mínima cria contradição matemática (EV sempre negativo).
  // BTTS é menos eficiente que match odds, tornando este mercado propício a edges reais.
  const topBTTS = useMemo(() => {
    const candidates: { game: GameRecord; best: BestMarket; odd: number }[] = [];
    for (const game of filteredGames) {
      const oddVal = game.odd_btts_yes as number;
      if (!oddVal || oddVal <= 0) continue;

      // Exige perfil ofensivo e defensivo aberto nos dois lados
      const agsH = game.avg_goals_scored_home ?? 0;
      const agsA = game.avg_goals_scored_away ?? 0;
      const agcH = game.avg_goals_conceded_home ?? 0;
      const agcA = game.avg_goals_conceded_away ?? 0;
      if (agsH < 1.2 || agsA < 1.0 || agcH < 0.8 || agcA < 0.8) continue;

      const result = computeGameProbabilities(game);
      if (!result) continue;

      const prob = result.probs.btts;
      if (prob < 0.55) continue;

      const ev = prob * oddVal - 1;
      if (ev <= 0) continue; // EV natural positivo: prob × odd > 1

      candidates.push({
        game, odd: oddVal,
        best: {
          market: 'btts', oddKey: 'odd_btts_yes', short: 'BTTS',
          ev, prob, xg_home: result.xgHome, xg_away: result.xgAway
        }
      });
    }
    return candidates.sort((a, b) => b.best.ev - a.best.ev).slice(0, 5);
  }, [filteredGames]);

  // ─── Seleção Científica do Dia ────────────────────────────────────────────────
  // Coleta candidatos de todas as 6 categorias, desuplica por jogo e aplica
  // bônus de confirmação: jogo validado por múltiplas categorias recebe score maior.
  // Score unificado = EV×0.6 + prob×0.4 + (n_categorias - 1) × 0.05
  const selecaoCientifica = useMemo(() => {
    type Entry = { game: GameRecord; best: BestMarket; odd: number; categories: string[]; baseScore: number };
    const gameMap = new Map<string, Entry>();

    const addCandidate = (game: GameRecord, best: BestMarket, odd: number, category: string) => {
      const baseScore = best.ev * 0.6 + best.prob * 0.4;
      const existing = gameMap.get(game.id);
      if (!existing) {
        gameMap.set(game.id, { game, best, odd, categories: [category], baseScore });
      } else {
        if (!existing.categories.includes(category)) existing.categories.push(category);
        // Mantém o melhor mercado encontrado entre as categorias
        if (baseScore > existing.baseScore) {
          existing.best = best; existing.odd = odd; existing.baseScore = baseScore;
        }
      }
    };

    // Categoria 1 — Top do Dia (odd > 1.30)
    for (const game of filteredGames) {
      const best = getBestMarket(game);
      if (!best) continue;
      const oddVal = game[best.oddKey as keyof GameRecord] as number;
      if (!oddVal || oddVal <= 1.30) continue;
      addCandidate(game, best, oddVal, 'Dia');
    }

    // Categoria 2 — Alta Confiança (1.25–1.34, prob ≥ 70%)
    for (const game of filteredGames) {
      const best = getBestMarket(game);
      if (!best) continue;
      const oddVal = game[best.oddKey as keyof GameRecord] as number;
      if (!oddVal || oddVal < 1.25 || oddVal > 1.34 || best.prob < 0.70) continue;
      addCandidate(game, best, oddVal, 'Alta Conf.');
    }

    // Categoria 3 — Favorito Dominante (wins% > 60%, Poisson ≥ 55%, odd 1.30–2.20)
    for (const game of filteredGames) {
      const { homeWin, awayWin } = calcWinProbs(game);
      if (!(homeWin <= 15 || awayWin <= 15) || Math.max(homeWin, awayWin) <= 60) continue;
      const homeIsFav = homeWin >= awayWin;
      const oddOk = homeIsFav
        ? (game.odd_home > 0 && game.odd_away > 0 && game.odd_home < game.odd_away)
        : (game.odd_home > 0 && game.odd_away > 0 && game.odd_away < game.odd_home);
      if (!oddOk) continue;
      const favOdd = homeIsFav ? game.odd_home : game.odd_away;
      if (!favOdd || favOdd < 1.30 || favOdd > 2.20) continue;
      const best = getBestMarket(game);
      if (!best) continue;
      const result = computeGameProbabilities(game);
      if (result) {
        const poissonFavProb = homeIsFav ? result.probs.home : result.probs.away;
        if (poissonFavProb < 0.55) continue;
      }
      const oddVal = game[best.oddKey as keyof GameRecord] as number;
      addCandidate(game, best, oddVal, 'Fav. Dom.');
    }

    // Categoria 4 — Under 2.5 (EV > 0, liga baixa pontuação)
    for (const game of filteredGames) {
      const oddVal = game.odd_under25 as number;
      if (!oddVal || oddVal <= 0) continue;
      const leagueAvg = game.global_goals_league || game.global_goals_match || 0;
      if (leagueAvg > 2.6 && leagueAvg !== 0) continue;
      const result = computeGameProbabilities(game);
      if (!result) continue;
      const prob = result.probs.under25;
      const ev = prob * oddVal - 1;
      if (ev <= 0) continue;
      addCandidate(game, { market: 'under25', oddKey: 'odd_under25', short: 'Un 2.5', ev, prob, xg_home: result.xgHome, xg_away: result.xgAway }, oddVal, 'Under 2.5');
    }

    // Categoria 5 — Dupla Chance (odd ≥ 1.15, prob ≥ 70%, EV > 0)
    for (const game of filteredGames) {
      const result = computeGameProbabilities(game);
      if (!result) continue;
      const odd1x = game.odd_1x as number;
      const oddx2 = game.odd_x2 as number;
      let bestDC: { best: BestMarket; odd: number } | null = null;
      if (odd1x && odd1x >= 1.15) {
        const p = result.probs.dc_1x; const ev = p * odd1x - 1;
        if (p >= 0.70 && ev > 0 && (!bestDC || ev > bestDC.best.ev))
          bestDC = { best: { market: 'dc_1x', oddKey: 'odd_1x', short: '1X', ev, prob: p, xg_home: result.xgHome, xg_away: result.xgAway }, odd: odd1x };
      }
      if (oddx2 && oddx2 >= 1.15) {
        const p = result.probs.dc_x2; const ev = p * oddx2 - 1;
        if (p >= 0.70 && ev > 0 && (!bestDC || ev > bestDC.best.ev))
          bestDC = { best: { market: 'dc_x2', oddKey: 'odd_x2', short: 'X2', ev, prob: p, xg_home: result.xgHome, xg_away: result.xgAway }, odd: oddx2 };
      }
      if (bestDC) addCandidate(game, bestDC.best, bestDC.odd, 'Dupla Ch.');
    }

    // Categoria 6 — BTTS (perfil ofensivo + prob ≥ 55% + EV > 0)
    for (const game of filteredGames) {
      const oddVal = game.odd_btts_yes as number;
      if (!oddVal || oddVal <= 0) continue;
      if ((game.avg_goals_scored_home ?? 0) < 1.2 || (game.avg_goals_scored_away ?? 0) < 1.0) continue;
      if ((game.avg_goals_conceded_home ?? 0) < 0.8 || (game.avg_goals_conceded_away ?? 0) < 0.8) continue;
      const result = computeGameProbabilities(game);
      if (!result) continue;
      const prob = result.probs.btts;
      if (prob < 0.55) continue;
      const ev = prob * oddVal - 1;
      if (ev <= 0) continue;
      addCandidate(game, { market: 'btts', oddKey: 'odd_btts_yes', short: 'BTTS', ev, prob, xg_home: result.xgHome, xg_away: result.xgAway }, oddVal, 'BTTS');
    }

    // Score final com bônus de confirmação por categoria extra
    return Array.from(gameMap.values())
      .map(e => ({ ...e, finalScore: e.baseScore + (e.categories.length - 1) * 0.05 }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 6);
  }, [filteredGames]);

  // ─── Top 3 Juros Compostos ────────────────────────────────────────────────────
  // Seleciona os 3 jogos com MAIOR probabilidade Poisson cuja odd (qualquer mercado)
  // esteja entre 1.30 e 1.36, acima do breakeven mínimo (~72%).
  // Ordenado por probabilidade decrescente: máxima certeza primeiro.
  // A simulação de retorno usa as odds reais de cada jogo selecionado.
  const topJurosCompostos = useMemo(() => {
    const candidates: { game: GameRecord; best: BestMarket; odd: number }[] = [];

    for (const game of filteredGames) {
      const result = computeGameProbabilities(game);
      if (!result) continue;

      let bestInRange: BestMarket | null = null;
      let bestOdd = 0;

      // Verifica TODOS os mercados — não apenas o de maior EV
      for (const market of MARKET_OPTIONS) {
        const odd = game[market.oddKey as keyof GameRecord] as number;
        if (!odd || odd < 1.30 || odd > 1.36) continue;

        const prob = result.probs[market.value as keyof GameProbabilities] ?? 0;
        // Breakeven para odd 1.30 = 76.9%; exigimos ≥ 72% como piso mínimo
        if (prob < 0.72) continue;

        // Entre opções no range, seleciona a de maior probabilidade
        if (!bestInRange || prob > bestInRange.prob) {
          bestInRange = {
            market: market.value, oddKey: market.oddKey, short: market.short,
            ev: prob * odd - 1, prob, xg_home: result.xgHome, xg_away: result.xgAway,
          };
          bestOdd = odd;
        }
      }

      if (bestInRange) candidates.push({ game, best: bestInRange, odd: bestOdd });
    }

    return candidates.sort((a, b) => b.best.prob - a.best.prob).slice(0, 3);
  }, [filteredGames]);

  // Navega para a linha do jogo na tabela (troca de página se necessário + scroll)
  const navigateToGame = (gameId: string) => {
    const idx = processedGames.findIndex(g => g.id === gameId);
    if (idx >= 0) {
      setCurrentPage(Math.floor(idx / gamesPerPage) + 1);
    }
    setHighlightedGameId(gameId);
    setTimeout(() => {
      document.getElementById(`game-row-${gameId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  // Retorna a classe CSS correta para uma célula de odd:
  // viola → melhor mercado histórico, âmbar → filtro de range, padrão → sem destaque.
  const getOddClass = (gameId: string, oddKey: string, oddVal: number | null | undefined, defaultClass: string): string => {
    const best = bestMarketMap.get(gameId);
    if (best?.oddKey === oddKey) {
      return 'text-violet-300 font-bold bg-violet-500/15 ring-1 ring-inset ring-violet-500/40';
    }
    if (isOddHighlighted(oddVal as number)) {
      return 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40';
    }
    return defaultClass;
  };

  const getBestMarketTooltip = (gameId: string, oddKey: string): string | undefined => {
    const best = bestMarketMap.get(gameId);
    if (!best || best.oddKey !== oddKey) return undefined;
    return `Melhor mercado (modelo Poisson)\nProb. estimada: ${(best.prob * 100).toFixed(1)}%\nEV: +${(best.ev * 100).toFixed(1)}% edge\nxG Casa: ${best.xg_home.toFixed(2)} | xG Fora: ${best.xg_away.toFixed(2)}`;
  };

  // Modal de análise
  const [analysisGame, setAnalysisGame] = useState<GameRecord | null>(null);

  return (
    <div className="space-y-6">
      <GameAnalysisModal game={analysisGame} onClose={() => setAnalysisGame(null)} />
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-semibold shadow-xl transition-all ${toast.ok ? 'bg-primary/20 border border-primary/50 text-primary' : 'bg-red-500/20 border border-red-500/50 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-surface p-4 rounded-xl border border-border-subtle shadow-lg">
        <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Lista de Jogos</h2>
            <p className="text-slate-400 text-xs mt-1">Visualização completa da base de dados por dia.</p>
            {savedCount > 0 && (
              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                <BookmarkCheck className="w-3 h-3" />
                {savedCount} pick{savedCount !== 1 ? 's' : ''} salvo{savedCount !== 1 ? 's' : ''} visível{savedCount !== 1 ? 'is' : ''} nesta página
              </p>
            )}
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

            {/* Botão: Favorito Dominante */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Análise</span>
              <button
                onClick={() => setFilterLowWin(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                  filterLowWin
                    ? 'bg-orange-500/10 border-orange-500/50 text-orange-400 shadow-[0_0_10px_rgba(255,102,0,0.15)]'
                    : 'bg-background-dark border-border-subtle text-slate-400 hover:border-orange-500/30 hover:text-orange-400'
                }`}
                title="Mostra jogos onde a probabilidade de vença de um dos lados é ≤ 15% (favorito técnico dominante)"
              >
                <span>🎯 Favorito Dominante</span>
                <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-full ${
                  filterLowWin
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-white/5 text-slate-600'
                }`}>
                  {filterLowWin
                    ? `${processedGames.length} jogo${processedGames.length !== 1 ? 's' : ''}`
                    : '≤ 15%'
                  }
                </span>
              </button>
            </div>

            {/* Toggle EV% Column */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Edge</span>
              <button
                onClick={() => setShowEvColumn(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                  showEvColumn
                    ? 'bg-violet-500/10 border-violet-500/50 text-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                    : 'bg-background-dark border-border-subtle text-slate-400 hover:border-violet-500/30 hover:text-violet-300'
                }`}
                title="Mostra coluna EV% — edge histórico do melhor mercado por jogo"
              >
                <span>Edge EV%</span>
                {(
                  <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-full ${
                    showEvColumn ? 'bg-violet-500/20 text-violet-300' : 'bg-white/5 text-slate-600'
                  }`}>
                    {showEvColumn ? 'visível' : 'oculto'}
                  </span>
                )}
              </button>
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

      {/* ─── Seleção Científica do Dia ─────────────────────────────────────────── */}
      {selecaoCientifica.length > 0 && (
        <div className="bg-surface border border-amber-400/30 rounded-xl shadow-xl overflow-hidden">
          {/* Borda superior dourada */}
          <div className="h-0.5 bg-gradient-to-r from-amber-400/0 via-amber-400/80 to-amber-400/0" />
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-400/10">
            <span className="text-sm font-bold text-amber-300">⚡ Seleção Científica do Dia</span>
            <span className="text-[10px] text-slate-500">
              — {selecaoCientifica.length} melhores jogos únicos · score unificado · bônus por multi-categoria
            </span>
            <button
              onClick={() => setShowSelecao(v => !v)}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showSelecao ? 'Ocultar ▲' : 'Exibir ▼'}
            </button>
          </div>

          {showSelecao && (
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                {selecaoCientifica.map(({ game, best, odd, categories, finalScore }, i) => {
                  const isActive = highlightedGameId === game.id;
                  const medals = ['🥇', '🥈', '🥉', '4°', '5°', '6°'];
                  const isMulti = categories.length > 1;
                  // Cores por posição
                  const colors = [
                    { ring: 'ring-amber-400/60', bg: 'bg-amber-400/10', text: 'text-amber-300', hover: 'hover:border-amber-400/50 hover:bg-amber-400/5', active: 'bg-amber-400/15 border-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.2)]' },
                    { ring: 'ring-amber-300/40', bg: 'bg-amber-300/8',  text: 'text-amber-200', hover: 'hover:border-amber-300/40 hover:bg-amber-300/5', active: 'bg-amber-300/10 border-amber-300/50' },
                    { ring: 'ring-slate-400/30',  bg: 'bg-slate-400/8',  text: 'text-slate-300', hover: 'hover:border-slate-400/30 hover:bg-slate-400/5', active: 'bg-slate-400/10 border-slate-400/40' },
                    { ring: 'ring-slate-500/20',  bg: 'bg-slate-500/5',  text: 'text-slate-400', hover: 'hover:border-slate-500/20 hover:bg-slate-500/5', active: 'bg-slate-500/10 border-slate-500/30' },
                    { ring: 'ring-slate-500/20',  bg: 'bg-slate-500/5',  text: 'text-slate-400', hover: 'hover:border-slate-500/20 hover:bg-slate-500/5', active: 'bg-slate-500/10 border-slate-500/30' },
                    { ring: 'ring-slate-500/20',  bg: 'bg-slate-500/5',  text: 'text-slate-400', hover: 'hover:border-slate-500/20 hover:bg-slate-500/5', active: 'bg-slate-500/10 border-slate-500/30' },
                  ];
                  const c = colors[i] ?? colors[5];
                  return (
                    <button
                      key={game.id}
                      onClick={() => navigateToGame(game.id)}
                      className={`text-left p-3 rounded-xl border transition-all group ${
                        isActive ? c.active : `bg-background-dark border-border-subtle ${c.hover}`
                      }`}
                    >
                      {/* Header: posição + score */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm">{medals[i]}</span>
                        <span className={`text-[10px] font-bold font-mono ${c.bg} ${c.text} px-1.5 py-0.5 rounded-full`}>
                          +{(best.ev * 100).toFixed(1)}% EV
                        </span>
                      </div>

                      {/* Badges de categoria */}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {categories.map(cat => (
                          <span
                            key={cat}
                            className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                              isMulti
                                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                                : 'bg-white/5 text-slate-500 border border-white/10'
                            }`}
                          >
                            {cat}
                          </span>
                        ))}
                        {isMulti && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-400/20 text-amber-400 border border-amber-400/40">
                            ×{categories.length}
                          </span>
                        )}
                      </div>

                      {/* Times */}
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mb-1.5">{game.country} — {game.league}</p>

                      {/* Mercado + odd + prob */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.ring}`}>
                          {best.short}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-white">@{odd.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-400">{(best.prob * 100).toFixed(0)}%</span>
                      </div>

                      {/* xG */}
                      <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                        <span>xG</span>
                        <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                        <span>—</span>
                        <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                      </div>

                      <div className={`mt-1.5 text-[9px] font-medium transition-colors ${
                        isActive ? c.text : `text-slate-600 group-hover:${c.text}`
                      }`}>
                        {isActive ? '→ localizado na lista' : 'clique para localizar'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Top 3 Juros Compostos ─────────────────────────────────────────────── */}
      {topJurosCompostos.length > 0 && (() => {
        // Simulação de retorno composto usando as odds reais de cada jogo
        const STAKE_INICIAL = 100;
        const etapas = topJurosCompostos.reduce<{ stake: number; retorno: number }[]>((acc, { odd }, i) => {
          const stake = i === 0 ? STAKE_INICIAL : acc[i - 1].retorno;
          acc.push({ stake, retorno: parseFloat((stake * odd).toFixed(2)) });
          return acc;
        }, []);
        const lucroTotal = etapas.length > 0 ? etapas[etapas.length - 1].retorno - STAKE_INICIAL : 0;
        const probCombinada = topJurosCompostos.reduce((p, { best }) => p * best.prob, 1);

        return (
          <div className="bg-surface border border-green-500/25 rounded-xl shadow-xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-green-500/0 via-green-400/60 to-green-500/0" />
            <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/10">
              <span className="text-sm font-bold text-green-300">💰 Top 3 Juros Compostos</span>
              <span className="text-[10px] text-slate-500">
                — odds 1.30–1.36 · maior probabilidade · 3 entradas sequenciais
              </span>
              <button
                onClick={() => setShowJurosCompostos(v => !v)}
                className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                {showJurosCompostos ? 'Ocultar ▲' : 'Exibir ▼'}
              </button>
            </div>

            {showJurosCompostos && (
              <div className="p-4 space-y-3">
                {/* Simulação de retorno composto */}
                <div className="flex items-center gap-2 flex-wrap bg-green-500/5 border border-green-500/15 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-500 text-[10px]">Início</span>
                    <span className="font-bold text-white font-mono">R$ {STAKE_INICIAL.toFixed(2)}</span>
                  </div>
                  {etapas.map((e, i) => (
                    <React.Fragment key={i}>
                      <span className="text-green-500/60 text-sm">→</span>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-600">entrada {i + 1} @{topJurosCompostos[i].odd.toFixed(2)}</span>
                        <span className={`font-bold font-mono text-xs ${i === etapas.length - 1 ? 'text-green-300' : 'text-white'}`}>
                          R$ {e.retorno.toFixed(2)}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                  <div className="ml-auto flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[9px] text-slate-500">Lucro potencial</div>
                      <div className="text-sm font-bold text-green-300 font-mono">+R$ {lucroTotal.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-500">Prob. combinada</div>
                      <div className={`text-sm font-bold font-mono ${probCombinada >= 0.5 ? 'text-green-300' : 'text-amber-300'}`}>
                        {(probCombinada * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cards dos 3 jogos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {topJurosCompostos.map(({ game, best, odd }, i) => {
                    const isActive = highlightedGameId === game.id;
                    const entrada = etapas[i];
                    const labels = ['1ª Entrada', '2ª Entrada', '3ª Entrada'];
                    return (
                      <button
                        key={game.id}
                        onClick={() => navigateToGame(game.id)}
                        className={`text-left p-3 rounded-xl border transition-all group ${
                          isActive
                            ? 'bg-green-500/15 border-green-500/50 shadow-[0_0_16px_rgba(34,197,94,0.2)]'
                            : 'bg-background-dark border-border-subtle hover:border-green-500/30 hover:bg-green-500/5'
                        }`}
                      >
                        {/* Header: ordem + retorno da entrada */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                            {labels[i]}
                          </span>
                          <div className="text-right">
                            <div className="text-[9px] text-slate-600 font-mono">
                              R$ {entrada.stake.toFixed(2)} →
                            </div>
                            <div className="text-xs font-bold text-green-300 font-mono">
                              R$ {entrada.retorno.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* Times */}
                        <p className="text-xs font-bold text-white truncate leading-tight">
                          {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mb-2">{game.country} — {game.league}</p>

                        {/* Mercado + odd + prob */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/25">
                            {best.short}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-white">@{odd.toFixed(2)}</span>
                        </div>

                        {/* Prob + EV */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-background-dark rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-green-400/60 rounded-full"
                              style={{ width: `${Math.min(100, best.prob * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-green-300 font-mono">
                            {(best.prob * 100).toFixed(1)}%
                          </span>
                        </div>

                        {/* xG */}
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                          <span>xG</span>
                          <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                          <span>—</span>
                          <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                        </div>

                        <div className={`mt-1.5 text-[9px] font-medium transition-colors ${
                          isActive ? 'text-green-400' : 'text-slate-600 group-hover:text-green-400'
                        }`}>
                          {isActive ? '→ localizado na lista' : 'clique para localizar'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── Top 5 do Dia ──────────────────────────────────────────────────────── */}
      {top3.length > 0 && (
        <div className="bg-surface border border-violet-500/20 rounded-xl shadow-xl overflow-hidden">
          {/* Header sempre visível */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-500/10">
            <span className="text-sm font-bold text-white">Top {top3.length} do Dia</span>
            <span className="text-[10px] text-slate-500">— maior edge por modelo Poisson ({filteredGames.length} analisados)</span>
            <button
              onClick={() => setShowTopPicks(v => !v)}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showTopPicks ? 'Ocultar ▲' : 'Exibir ▼'}
            </button>
          </div>

          {/* Cards — colapsáveis */}
          {showTopPicks && (
          <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {top3.map(({ game, best, odd }, i: number) => {
              const isActive = highlightedGameId === game.id;
              const medal = ['🥇', '🥈', '🥉', '4°', '5°'][i];
              return (
                <button
                  key={game.id}
                  onClick={() => navigateToGame(game.id)}
                  className={`text-left p-3 rounded-xl border transition-all group ${
                    isActive
                      ? 'bg-violet-500/15 border-violet-500/50 shadow-[0_0_16px_rgba(139,92,246,0.2)]'
                      : 'bg-background-dark border-border-subtle hover:border-violet-500/40 hover:bg-violet-500/5'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{medal}</span>
                    <span className="text-xs font-bold text-violet-300 font-mono bg-violet-500/10 px-2 py-0.5 rounded-full">
                      +{(best.ev * 100).toFixed(1)}% EV
                    </span>
                  </div>

                  {/* Teams */}
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{game.country} — {game.league}</p>

                  {/* Market + Stats */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {best.short}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-white">
                      @{odd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {(best.prob * 100).toFixed(0)}% prob
                    </span>
                  </div>

                  {/* xG */}
                  <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                    <span>xG</span>
                    <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                    <span>—</span>
                    <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                  </div>

                  {/* Localizar hint */}
                  <div className={`mt-2 text-[9px] font-medium transition-colors ${
                    isActive ? 'text-violet-400' : 'text-slate-600 group-hover:text-violet-400'
                  }`}>
                    {isActive ? '→ localizado na lista' : 'clique para localizar'}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
          )}
        </div>
      )}

      {/* ─── Top 5 Odds Baixas (1.25–1.34) ─────────────────────────────────────── */}
      {topLowOdds.length > 0 && (
        <div className="bg-surface border border-emerald-500/20 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-500/10">
            <span className="text-sm font-bold text-white">Top {topLowOdds.length} Alta Confiança</span>
            <span className="text-[10px] text-slate-500">— odds 1.25–1.34 · prob ≥ 70% · maior prob por modelo Poisson</span>
            <button
              onClick={() => setShowTopLowOdds(v => !v)}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showTopLowOdds ? 'Ocultar ▲' : 'Exibir ▼'}
            </button>
          </div>

          {showTopLowOdds && (
          <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {topLowOdds.map(({ game, best, odd }, i: number) => {
              const isActive = highlightedGameId === game.id;
              const medal = ['🥇', '🥈', '🥉', '4°', '5°'][i];
              return (
                <button
                  key={game.id}
                  onClick={() => navigateToGame(game.id)}
                  className={`text-left p-3 rounded-xl border transition-all group ${
                    isActive
                      ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                      : 'bg-background-dark border-border-subtle hover:border-emerald-500/40 hover:bg-emerald-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{medal}</span>
                    <span className="text-xs font-bold text-emerald-300 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      +{(best.ev * 100).toFixed(1)}% EV
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{game.country} — {game.league}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {best.short}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-white">
                      @{odd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {(best.prob * 100).toFixed(0)}% prob
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                    <span>xG</span>
                    <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                    <span>—</span>
                    <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                  </div>

                  <div className={`mt-2 text-[9px] font-medium transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-slate-600 group-hover:text-emerald-400'
                  }`}>
                    {isActive ? '→ localizado na lista' : 'clique para localizar'}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
          )}
        </div>
      )}

      {/* ─── Top 5 Favorito Dominante ─────────────────────────────────────── */}
      {topDominant.length > 0 && (
        <div className="bg-surface border border-orange-500/20 rounded-xl shadow-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-orange-500/10">
            <span className="text-sm font-bold text-white">Top {topDominant.length} Favorito Dominante</span>
            <span className="text-[10px] text-slate-500">— Win% ≤ 15% · favorito {'>'} 60% · odd 1.30–2.20</span>
            <button
              onClick={() => setShowTopDominant(v => !v)}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showTopDominant ? 'Ocultar ▲' : 'Exibir ▼'}
            </button>
          </div>

          {showTopDominant && (
          <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {topDominant.map(({ game, best, odd }, i: number) => {
              const isActive = highlightedGameId === game.id;
              const medal = ['🥇', '🥈', '🥉', '4°', '5°'][i];
              return (
                <button
                  key={game.id}
                  onClick={() => navigateToGame(game.id)}
                  className={`text-left p-3 rounded-xl border transition-all group ${
                    isActive
                      ? 'bg-orange-500/15 border-orange-500/50 shadow-[0_0_16px_rgba(249,115,22,0.2)]'
                      : 'bg-background-dark border-border-subtle hover:border-orange-500/40 hover:bg-orange-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{medal}</span>
                    <span className="text-xs font-bold text-orange-400 font-mono bg-orange-500/10 px-2 py-0.5 rounded-full">
                      +{(best.ev * 100).toFixed(1)}% EV
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{game.country} — {game.league}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      {best.short}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-white">
                      @{odd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {(best.prob * 100).toFixed(0)}% prob
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                    <span>xG</span>
                    <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                    <span>—</span>
                    <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                  </div>

                  <div className={`mt-2 text-[9px] font-medium transition-colors ${
                    isActive ? 'text-orange-400' : 'text-slate-600 group-hover:text-orange-400'
                  }`}>
                    {isActive ? '→ localizado na lista' : 'clique para localizar'}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
          )}
        </div>
      )}

      {/* ─── Top 5 Under 2.5 ─────────────────────────────────────── */}
      {topUnder25.length > 0 && (
        <div className="bg-surface border border-pink-500/20 rounded-xl shadow-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-pink-500/10">
            <span className="text-sm font-bold text-white">Top {topUnder25.length} Under 2.5</span>
            <span className="text-[10px] text-slate-500">— maior EV · prob Poisson · ligas de baixa pontuação</span>
            <button
              onClick={() => setShowTopUnder25(v => !v)}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showTopUnder25 ? 'Ocultar ▲' : 'Exibir ▼'}
            </button>
          </div>

          {showTopUnder25 && (
          <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {topUnder25.map(({ game, best, odd }, i: number) => {
              const isActive = highlightedGameId === game.id;
              const medal = ['🥇', '🥈', '🥉', '4°', '5°'][i];
              return (
                <button
                  key={game.id}
                  onClick={() => navigateToGame(game.id)}
                  className={`text-left p-3 rounded-xl border transition-all group ${
                    isActive
                      ? 'bg-pink-500/15 border-pink-500/50 shadow-[0_0_16px_rgba(236,72,153,0.2)]'
                      : 'bg-background-dark border-border-subtle hover:border-pink-500/40 hover:bg-pink-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{medal}</span>
                    <span className="text-xs font-bold text-pink-400 font-mono bg-pink-500/10 px-2 py-0.5 rounded-full">
                      {(best.prob * 100).toFixed(1)}% prob
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{game.country} — {game.league}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                      {best.short}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-white">
                      @{odd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {(best.ev > 0 ? '+' : '')}{(best.ev * 100).toFixed(1)}% EV
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                    <span>xG</span>
                    <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                    <span>—</span>
                    <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                  </div>

                  <div className={`mt-2 text-[9px] font-medium transition-colors ${
                    isActive ? 'text-pink-400' : 'text-slate-600 group-hover:text-pink-400'
                  }`}>
                    {isActive ? '→ localizado na lista' : 'clique para localizar'}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
          )}
        </div>
      )}

      {/* ─── Top 5 Dupla Chance ─────────────────────────────────────── */}
      {topDoubleChance.length > 0 && (
        <div className="bg-surface border border-indigo-500/20 rounded-xl shadow-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-500/10">
            <span className="text-sm font-bold text-white">Top {topDoubleChance.length} Dupla Chance</span>
            <span className="text-[10px] text-slate-500">— maior EV · prob ≥ 70% · odd ≥ 1.15 · 1X e X2</span>
            <button
              onClick={() => setShowTopDoubleChance(v => !v)}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showTopDoubleChance ? 'Ocultar ▲' : 'Exibir ▼'}
            </button>
          </div>

          {showTopDoubleChance && (
          <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {topDoubleChance.map(({ game, best, odd }, i: number) => {
              const isActive = highlightedGameId === game.id;
              const medal = ['🥇', '🥈', '🥉', '4°', '5°'][i];
              return (
                <button
                  key={game.id}
                  onClick={() => navigateToGame(game.id)}
                  className={`text-left p-3 rounded-xl border transition-all group ${
                    isActive
                      ? 'bg-indigo-500/15 border-indigo-500/50 shadow-[0_0_16px_rgba(99,102,241,0.2)]'
                      : 'bg-background-dark border-border-subtle hover:border-indigo-500/40 hover:bg-indigo-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{medal}</span>
                    <span className="text-xs font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      {(best.prob * 100).toFixed(1)}% prob
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{game.country} — {game.league}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {best.short}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-white">
                      @{odd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {(best.ev > 0 ? '+' : '')}{(best.ev * 100).toFixed(1)}% EV
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                    <span>xG</span>
                    <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                    <span>—</span>
                    <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                  </div>

                  <div className={`mt-2 text-[9px] font-medium transition-colors ${
                    isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-indigo-400'
                  }`}>
                    {isActive ? '→ localizado na lista' : 'clique para localizar'}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
          )}
        </div>
      )}

      {/* ─── Top 5 BTTS Científico ─────────────────────────────────────── */}
      {topBTTS.length > 0 && (
        <div className="bg-surface border border-teal-500/20 rounded-xl shadow-xl overflow-hidden mb-6">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-teal-500/10">
            <span className="text-sm font-bold text-white">Top {topBTTS.length} BTTS Científico</span>
            <span className="text-[10px] text-slate-500">— ambas marcam · EV positivo · perfil ofensivo confirmado</span>
            <button
              onClick={() => setShowTopBTTS(v => !v)}
              className="ml-auto text-[10px] font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              {showTopBTTS ? 'Ocultar ▲' : 'Exibir ▼'}
            </button>
          </div>

          {showTopBTTS && (
          <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {topBTTS.map(({ game, best, odd }, i: number) => {
              const isActive = highlightedGameId === game.id;
              const medal = ['🥇', '🥈', '🥉', '4°', '5°'][i];
              return (
                <button
                  key={game.id}
                  onClick={() => navigateToGame(game.id)}
                  className={`text-left p-3 rounded-xl border transition-all group ${
                    isActive
                      ? 'bg-teal-500/15 border-teal-500/50 shadow-[0_0_16px_rgba(20,184,166,0.2)]'
                      : 'bg-background-dark border-border-subtle hover:border-teal-500/40 hover:bg-teal-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{medal}</span>
                    <span className="text-xs font-bold text-teal-300 font-mono bg-teal-500/10 px-2 py-0.5 rounded-full">
                      +{(best.ev * 100).toFixed(1)}% EV
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {game.home_team} <span className="text-slate-500 font-normal">v</span> {game.away_team}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mb-2">{game.country} — {game.league}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">{game.match_time}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {best.short}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-white">
                      @{odd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {(best.prob * 100).toFixed(0)}% prob
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                    <span>xG</span>
                    <span className="text-slate-400">{best.xg_home.toFixed(2)}</span>
                    <span>—</span>
                    <span className="text-slate-400">{best.xg_away.toFixed(2)}</span>
                  </div>

                  {/* Médias de gols do jogo */}
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-600 font-mono">
                    <span>avg</span>
                    <span className="text-teal-500/70">{(game.avg_goals_scored_home ?? 0).toFixed(1)}sc</span>
                    <span>/</span>
                    <span className="text-rose-500/70">{(game.avg_goals_conceded_home ?? 0).toFixed(1)}cc</span>
                    <span className="text-slate-700">|</span>
                    <span className="text-teal-500/70">{(game.avg_goals_scored_away ?? 0).toFixed(1)}sc</span>
                    <span>/</span>
                    <span className="text-rose-500/70">{(game.avg_goals_conceded_away ?? 0).toFixed(1)}cc</span>
                  </div>

                  <div className={`mt-2 text-[9px] font-medium transition-colors ${
                    isActive ? 'text-teal-400' : 'text-slate-600 group-hover:text-teal-400'
                  }`}>
                    {isActive ? '→ localizado na lista' : 'clique para localizar'}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
          )}
        </div>
      )}

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-background-dark/50 text-[10px] uppercase text-slate-400 font-semibold tracking-wide">
                    <tr>
                        {/* Pick column */}
                        <th className="px-2 py-2 border-b border-border-subtle text-center w-8 sticky left-0 bg-surface z-10">
                          <BookmarkCheck className="w-3 h-3 inline text-amber-400/60" />
                        </th>
                        <th className="px-2 py-2 border-b border-border-subtle sticky left-8 bg-surface z-10 min-w-[60px] max-w-[80px] cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('match_time')}>Hora {getSortIcon('match_time')}</th>
                        {filterLowWin && (
                          <>
                            <th
                              className="px-1 py-2 border-b border-border-subtle text-center cursor-pointer hover:bg-primary/5 transition-colors text-primary/70 bg-primary/3"
                              onClick={() => handleSort('wins_percent_home')}
                              title="Win% Casa — ordenar"
                            >Win%H {getSortIcon('wins_percent_home')}</th>
                            <th
                              className="px-1 py-2 border-b border-border-subtle text-center cursor-pointer hover:bg-rose-400/5 transition-colors text-rose-400/70 bg-rose-400/3"
                              onClick={() => handleSort('wins_percent_away')}
                              title="Win% Visitante — ordenar"
                            >Win%A {getSortIcon('wins_percent_away')}</th>
                          </>
                        )}
                        <th className="px-2 py-2 border-b border-border-subtle min-w-[200px]">Partida</th>
                        {showEvColumn && (
                          <th className="px-2 py-2 border-b border-border-subtle text-center text-violet-400/70 bg-violet-500/5 whitespace-nowrap" title="EV% do melhor mercado histórico">
                            Edge EV%
                          </th>
                        )}
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
                        <th className="px-1 py-2 border-b border-border-subtle bg-primary/5 text-primary text-center">Away</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-primary/5 text-primary text-center">1X</th>
                        <th className="px-1 py-2 border-b border-border-subtle bg-primary/5 text-primary text-center border-r border-border-subtle">X2</th>
                        
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
                            <td colSpan={38} className="p-8 text-center text-slate-500">Nenhum jogo encontrado para estes filtros.</td>
                        </tr>
                    ) : (
                        paginatedGames.map((game) => {
                          const alreadySaved = isPickSaved(game.id);
                          const isPopoverOpen = popover?.gameId === game.id;
                          const isTop3Highlighted = highlightedGameId === game.id;
                          return (
                            <tr
                              key={game.id}
                              id={`game-row-${game.id}`}
                              className={`hover:bg-white/5 transition-colors relative ${
                                isTop3Highlighted
                                  ? 'bg-violet-500/10 outline outline-1 outline-violet-500/40'
                                  : alreadySaved ? 'bg-amber-400/5' : ''
                              }`}
                            >
                                {/* Bookmark button cell */}
                                <td className="px-1 py-1.5 text-center sticky left-0 bg-inherit z-20">
                                  <div className="relative inline-block">
                                    <button
                                      onClick={() => openPopover(game.id)}
                                      title={alreadySaved ? 'Pick já salvo (clique para adicionar outro mercado)' : (filterLowWin ? 'Enviar para Sniper List' : 'Salvar como pick')}
                                      className={`p-0.5 rounded transition-all hover:scale-110 ${
                                        filterLowWin
                                          ? 'text-orange-400'
                                          : alreadySaved
                                          ? 'text-amber-400'
                                          : 'text-slate-600 hover:text-amber-400'
                                      }`}
                                    >
                                      {alreadySaved
                                        ? <BookmarkCheck className="w-3.5 h-3.5" />
                                        : <Bookmark className="w-3.5 h-3.5" />
                                      }
                                    </button>

                                    {/* Popover */}
                                    {isPopoverOpen && (
                                      <div
                                        ref={popoverRef}
                                        className={`absolute left-6 top-0 z-50 bg-surface border rounded-xl shadow-2xl p-4 w-64 ${
                                          filterLowWin ? 'border-orange-500/30' : 'border-border-subtle'
                                        }`}
                                        style={{ minWidth: '256px' }}
                                      >
                                        <div className="flex items-center justify-between mb-3">
                                          <span className="text-xs font-bold text-white">
                                            {filterLowWin ? '🎯 Sniper List' : 'Salvar Pick'}
                                          </span>
                                          <button onClick={() => setPopover(null)} className="text-slate-500 hover:text-white">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                                          {game.home_team} <span className="text-slate-600">v</span> {game.away_team}
                                        </p>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                                          Mercado
                                        </label>
                                        <select
                                          value={popover.market}
                                          onChange={e => setPopover(prev => prev ? { ...prev, market: e.target.value as MarketValue } : null)}
                                          className="w-full bg-background-dark border border-border-subtle rounded-lg text-xs text-white focus:ring-primary focus:border-primary px-3 h-9 appearance-none mb-3"
                                        >
                                          {MARKET_OPTIONS.map(o => {
                                            const oddVal = game[o.oddKey as keyof GameRecord] as number;
                                            const hasOdd = oddVal && oddVal > 0;
                                            return (
                                              <option key={o.value} value={o.value} disabled={!hasOdd}>
                                                {o.label}{hasOdd ? ` — ${oddVal.toFixed(2)}` : ' (sem odd)'}
                                              </option>
                                            );
                                          })}
                                        </select>

                                        {/* Preview odd */}
                                        {(() => {
                                          const mObj = MARKET_OPTIONS.find(o => o.value === popover.market)!;
                                          const oddVal = game[mObj.oddKey as keyof GameRecord] as number;
                                          return oddVal && oddVal > 0 ? (
                                            <div className={`flex items-center justify-between mb-3 rounded-lg px-3 py-2 ${
                                              filterLowWin
                                                ? 'bg-orange-500/5 border border-orange-500/20'
                                                : 'bg-primary/5 border border-primary/20'
                                            }`}>
                                              <span className="text-[10px] text-slate-400">Odd selecionada</span>
                                              <span className={`text-sm font-bold font-mono ${
                                                filterLowWin ? 'text-orange-400' : 'text-primary'
                                              }`}>{oddVal.toFixed(2)}</span>
                                            </div>
                                          ) : (
                                            <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-[10px] text-red-400">
                                              ⚠️ Odd não disponível
                                            </div>
                                          );
                                        })()}

                                        {isPickSaved(game.id, popover.market) && (
                                          <div className="mb-2 text-[10px] text-amber-400 flex items-center gap-1">
                                            <BookmarkCheck className="w-3 h-3" />
                                            Já salvo para este mercado
                                          </div>
                                        )}

                                        <button
                                          onClick={handleSavePick}
                                          disabled={popover.saving}
                                          className={`w-full h-9 font-bold text-xs rounded-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                                            filterLowWin
                                              ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(255,102,0,0.3)]'
                                              : 'bg-primary text-background-dark shadow-[0_0_10px_rgba(36,255,189,0.2)]'
                                          }`}
                                        >
                                          {popover.saving ? (
                                            <>Salvando…</>
                                          ) : filterLowWin ? (
                                            <>🎯 Sniper List</>
                                          ) : (
                                            <><BookmarkCheck className="w-3.5 h-3.5" /> Salvar Pick</>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className={`px-2 py-1.5 sticky left-8 bg-surface z-10 border-r border-border-subtle font-mono ${
                                    isTimeHighlighted(game.match_time)
                                      ? 'text-cyan-300 font-bold'
                                      : 'text-slate-400'
                                  }`}>
                                    {game.match_time}
                                </td>
                                {filterLowWin && (() => {
                                  const { homeWin, awayWin } = calcWinProbs(game);
                                  const hFav = homeWin >= awayWin;
                                  return (
                                    <>
                                      <td className="px-2 py-1.5 text-center tabular-nums">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${hFav ? 'text-primary bg-primary/10' : 'text-rose-400 bg-rose-400/10'}`}>
                                          {Math.round(homeWin)}%
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5 text-center tabular-nums">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${!hFav ? 'text-primary bg-primary/10' : 'text-rose-400 bg-rose-400/10'}`}>
                                          {Math.round(awayWin)}%
                                        </span>
                                      </td>
                                    </>
                                  );
                                })()}
                                <td
                                    className="px-2 py-1.5 font-medium text-white truncate max-w-[200px] cursor-pointer hover:text-primary hover:underline transition-colors"
                                    title={`${game.home_team} vs ${game.away_team} — Clique para analisar`}
                                    onClick={() => setAnalysisGame(game)}
                                >
                                    {game.home_team} <span className="text-slate-500 mx-0.5">v</span> {game.away_team}
                                    {(() => {
                                      const best = bestMarketMap.get(game.id);
                                      if (!best) return null;
                                      return (
                                        <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30 align-middle whitespace-nowrap">
                                          {best.short}
                                        </span>
                                      );
                                    })()}
                                </td>
                                {showEvColumn && (() => {
                                  const best = bestMarketMap.get(game.id);
                                  return (
                                    <td className="px-2 py-1.5 text-center bg-violet-500/5">
                                      {best ? (
                                        <span className="text-[10px] font-bold text-violet-300 font-mono">
                                          +{(best.ev * 100).toFixed(1)}%
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-600">—</span>
                                      )}
                                    </td>
                                  );
                                })()}
                                <td className="px-2 py-1.5 text-slate-400 truncate max-w-[120px]" title={`${game.country} - ${game.league}`}>{game.country} - {game.league}</td>
                                <td className="px-1 py-1.5 text-center font-mono text-slate-500">{game.status}</td>
                                <td className="px-1 py-1.5 text-center font-bold text-white bg-background-dark/30">
                                    {game.home_score !== null ? `${game.home_score}-${game.away_score}` : '-'}
                                </td>
                                <td className="px-1 py-1.5 text-center text-slate-500">
                                    {game.home_score_ht !== null ? `${game.home_score_ht}-${game.away_score_ht}` : '-'}
                                </td>

                                {/* Odds — viola=melhor mercado histórico, âmbar=filtro range */}
                                <td className={`px-1 py-1.5 text-center font-mono border-l border-border-subtle ${getOddClass(game.id, 'odd_home', game.odd_home, 'text-primary bg-primary/5')}`} title={getBestMarketTooltip(game.id, 'odd_home')}>{fmt(game.odd_home)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono bg-primary/5 ${isOddHighlighted(game.odd_draw) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-primary'}`}>{fmt(game.odd_draw)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_away', game.odd_away, 'text-primary bg-primary/5')}`} title={getBestMarketTooltip(game.id, 'odd_away')}>{fmt(game.odd_away)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_1x', game.odd_1x, 'text-primary bg-primary/5')}`} title={getBestMarketTooltip(game.id, 'odd_1x')}>{fmt(game.odd_1x)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono border-r border-border-subtle ${getOddClass(game.id, 'odd_x2', game.odd_x2, 'text-primary bg-primary/5')}`} title={getBestMarketTooltip(game.id, 'odd_x2')}>{fmt(game.odd_x2)}</td>

                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_over05_ht', game.odd_over05_ht, 'text-slate-300')}`} title={getBestMarketTooltip(game.id, 'odd_over05_ht')}>{fmt(game.odd_over05_ht)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_over05) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_over05)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_over15', game.odd_over15, 'text-slate-300')}`} title={getBestMarketTooltip(game.id, 'odd_over15')}>{fmt(game.odd_over15)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_over25', game.odd_over25, 'text-slate-300')}`} title={getBestMarketTooltip(game.id, 'odd_over25')}>{fmt(game.odd_over25)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_under15) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_under15)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${isOddHighlighted(game.odd_under25) ? 'text-amber-300 font-bold bg-amber-400/10 ring-1 ring-inset ring-amber-400/40' : 'text-slate-300'}`}>{fmt(game.odd_under25)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_under35', game.odd_under35, 'text-slate-300')}`} title={getBestMarketTooltip(game.id, 'odd_under35')}>{fmt(game.odd_under35)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_under45', game.odd_under45, 'text-slate-300')}`} title={getBestMarketTooltip(game.id, 'odd_under45')}>{fmt(game.odd_under45)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_btts_yes', game.odd_btts_yes, 'text-slate-300')}`} title={getBestMarketTooltip(game.id, 'odd_btts_yes')}>{fmt(game.odd_btts_yes)}</td>
                                <td className={`px-1 py-1.5 text-center font-mono ${getOddClass(game.id, 'odd_btts_no', game.odd_btts_no, 'text-slate-300')}`} title={getBestMarketTooltip(game.id, 'odd_btts_no')}>{fmt(game.odd_btts_no)}</td>

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
                          );
                        })
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
