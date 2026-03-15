/**
 * server/image-generator.js
 * Motor de geração de imagens PNG via Puppeteer.
 * Renderiza os templates HTML com dados reais e salva PNGs em /generated/
 */

'use strict';

const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

// ── Configuração ────────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUTPUT_DIR    = path.join(__dirname, 'generated');

// Garante que a pasta de saída existe
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Caminhos comuns do Chrome no Windows
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_PATH,
].filter(Boolean);

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Helpers de data ─────────────────────────────────────────────────────────────

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function parseDateParts(dateStr) {
  // dateStr: "2026-03-15"
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    day:  String(d).padStart(2, '0'),
    month: MESES[m - 1],
    year: y,
    weekday: DIAS_SEMANA[dt.getDay()],
    full: `${DIAS_SEMANA[dt.getDay()]}, ${d} de ${MESES[m-1]} de ${y}`,
  };
}

// ── Rótulos de mercado ──────────────────────────────────────────────────────────

const MARKET_LABELS = {
  home:     'Casa',
  away:     'Visitante',
  over05ht: 'Over 0.5 HT',
  over15:   'Over 1.5 FT',
  over25:   'Over 2.5 FT',
  under35:  'Under 3.5 FT',
  under45:  'Under 4.5 FT',
  btts:     'BTTS Sim',
};

// ── Builders de HTML parcial ────────────────────────────────────────────────────

function buildFeedRow(pick) {
  return `
    <div class="game">
      <div class="hora">${pick.match_time}</div>
      <div class="info">
        <div class="partida">${pick.home_team} <span style="color:#2a3e50">v</span> ${pick.away_team}</div>
        <div class="mercado">${MARKET_LABELS[pick.market] || pick.market}</div>
        <div class="liga">${pick.country} — ${pick.league}</div>
      </div>
      <div class="odd-box">
        <div class="label">Odd</div>
        <div class="value">${Number(pick.odd_used).toFixed(2)}</div>
      </div>
    </div>
  `;
}

function buildStoryCard(pick) {
  return `
    <div class="card">
      <div class="card-top">
        <div class="hora">${pick.match_time}</div>
        <div class="card-odd">${Number(pick.odd_used).toFixed(2)}</div>
      </div>
      <div class="partida">${pick.home_team} <span style="color:#2a3e50">v</span> ${pick.away_team}</div>
      <div class="mercado">${MARKET_LABELS[pick.market] || pick.market}</div>
      <div class="liga">${pick.country} — ${pick.league}</div>
    </div>
  `;
}

function buildResultRow(pick) {
  const won     = pick.result === 1;
  const pending = pick.resolved === 0;
  const ftScore = (pick.home_score != null && pick.away_score != null)
    ? `${pick.home_score}–${pick.away_score}`
    : null;

  let badge, accentColor;
  if (pending) {
    badge = '⏳';
    accentColor = '#6b8499';
  } else if (won) {
    badge = '✅ GREEN';
    accentColor = '#00f0a8';
  } else {
    badge = '❌ RED';
    accentColor = '#f05050';
  }

  return `
    <div class="row">
      <div class="hora">${pick.match_time}</div>
      <div>
        <div class="partida">${pick.home_team} <span style="color:#2a3e50">v</span> ${pick.away_team}</div>
        <div class="mercado">${MARKET_LABELS[pick.market] || pick.market}</div>
        ${ftScore ? `<div class="score">Placar: ${ftScore}</div>` : ''}
      </div>
      <div class="badge" style="${pending ? '' : `color:${accentColor};border-color:${accentColor}44;background:${accentColor}11`}">${badge}</div>
    </div>
  `;
}

// ── Renderização principal ──────────────────────────────────────────────────────

async function renderTemplate(templateName, html) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Google Chrome não encontrado. Instale o Chrome ou defina CHROME_PATH no .env'
    );
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();

    // Detecta dimensões pelo nome do template
    const dims = templateName.includes('story') || templateName.includes('reel')
      ? { width: 1080, height: 1920 }
      : { width: 1080, height: 1350 };

    await page.setViewport(dims);

    // Carrega o HTML
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000,
    });

    // Aguarda fontes carregarem (se Google Fonts não estiver disponível, já usa fallback)
    await page.evaluateHandle('document.fonts.ready');

    const buffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, ...dims },
    });

    return buffer;
  } finally {
    await browser.close();
  }
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Gera imagens para uma set de picks.
 * @param {string} date           "YYYY-MM-DD"
 * @param {Array}  picks          array de picks (com placar, resultado, etc.)
 * @param {string[]} types        ['feed','story','resultado','reel'] ou subset
 * @param {string} logoUrl        URL pública do logo (pode ser base64 ou http)
 * @returns {Array} [{ type, filename, url }]
 */
async function generateImages({ date, picks, types = ['feed', 'story', 'resultado', 'reel'], logoUrl = '' }) {
  const dateParts = parseDateParts(date);
  const results   = [];

  // Pré-calcula estatísticas para os templates de resultado/reel
  const resolved  = picks.filter(p => p.resolved === 1);
  const wins      = picks.filter(p => p.result === 1).length;
  const losses    = picks.filter(p => p.result === 0).length;
  const winRate   = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;
  const avgOdd    = picks.length > 0
    ? (picks.reduce((s, p) => s + Number(p.odd_used), 0) / picks.length).toFixed(2)
    : '—';

  // Mercado mais frequente
  const mktCount = {};
  picks.forEach(p => { mktCount[p.market] = (mktCount[p.market] || 0) + 1; });
  const topMarket = Object.entries(mktCount).sort((a, b) => b[1] - a[1])[0];
  const mercadoPrincipal = topMarket ? (MARKET_LABELS[topMarket[0]] || topMarket[0]) : '—';

  // Cor temática do resultado
  const isGreen = winRate >= 50;
  const ACCENT_GREEN  = { color: '#00f0a8', subtle: 'rgba(0,240,168,.07)', border: 'rgba(0,240,168,.3)', glow: 'rgba(0,240,168,.18)' };
  const ACCENT_RED    = { color: '#f05050', subtle: 'rgba(240,80,80,.07)',  border: 'rgba(240,80,80,.3)',  glow: 'rgba(240,80,80,.18)'  };
  const accent = isGreen ? ACCENT_GREEN : ACCENT_RED;

  for (const type of types) {
    const tplPath = path.join(TEMPLATES_DIR, `${type}.html`);
    if (!fs.existsSync(tplPath)) {
      console.warn(`[gen] Template não encontrado: ${tplPath}`);
      continue;
    }

    let tpl = fs.readFileSync(tplPath, 'utf8');

    // Monta HTML de jogos específico por template
    let jogosHtml = '';

    switch (type) {
      case 'feed':
        jogosHtml = picks.map(buildFeedRow).join('');
        break;
      case 'story':
        // Story: limita a no máximo 4 cards para não estourar
        jogosHtml = picks.slice(0, 4).map(buildStoryCard).join('');
        break;
      case 'resultado':
        jogosHtml = picks.map(buildResultRow).join('');
        break;
      case 'reel':
        // Reel cover não tem lista de jogos inline
        break;
    }

    // Determina status para resultado
    let statusEmoji = '', statusText = '';
    if (type === 'resultado') {
      if (picks.some(p => p.resolved === 0)) {
        statusEmoji = '⏳'; statusText = 'Pendente';
      } else if (winRate === 100) {
        statusEmoji = '🟢'; statusText = 'ALL GREEN!';
      } else if (wins > losses) {
        statusEmoji = '🟢'; statusText = 'GREEN';
      } else if (wins === losses) {
        statusEmoji = '🟡'; statusText = 'NEUTRO';
      } else {
        statusEmoji = '🔴'; statusText = 'RED';
      }
    }

    // Substitui todos os placeholders
    const replacements = {
      LOGO_URL:          logoUrl,
      DATA_DIA:          dateParts.day,
      DATA_MES:          dateParts.month,
      DATA_TEXTO:        dateParts.full,
      TOTAL_PICKS:       String(picks.length),
      JOGOS_HTML:        jogosHtml,
      RESULTADOS_HTML:   jogosHtml,
      STATUS_EMOJI:      statusEmoji,
      STATUS:            statusText,
      WINS:              String(wins),
      LOSSES:            String(losses),
      WIN_RATE:          String(winRate),
      MERCADO_PRINCIPAL: mercadoPrincipal,
      ODD_MEDIA:         avgOdd,
      // Cores dinâmicas (resultado)
      ACCENT_COLOR:      accent.color,
      ACCENT_SUBTLE:     accent.subtle,
      ACCENT_BORDER:     accent.border,
      ACCENT_GLOW:       accent.glow,
      // Legado (resultado.html antigo)
      GLOW_COLOR:        accent.color,
    };

    for (const [key, val] of Object.entries(replacements)) {
      tpl = tpl.replaceAll(`{{${key}}}`, val);
    }

    // Renderiza com Puppeteer
    console.log(`[gen] Renderizando ${type}...`);
    const buffer = await renderTemplate(type, tpl);

    // Salva arquivo
    const filename = `${type}_${date}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    results.push({ type, filename, url: `/generated/${filename}` });
    console.log(`[gen] ✅ ${filename} salvo.`);
  }

  return results;
}

module.exports = { generateImages };
