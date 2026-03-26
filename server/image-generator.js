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

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Limites de jogos por imagem
const PAGE_LIMITS = {
  feed:         7,
  story:        7,
  'sniper-feed':  7,
  'sniper-story': 7,
  // resultado, reel, sniper-resultado, sniper-reel não têm limite de paginação
};

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

const MESES       = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function parseDateParts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    day:     String(d).padStart(2, '0'),
    month:   MESES[m - 1],
    year:    y,
    weekday: DIAS_SEMANA[dt.getDay()],
    full:    `${DIAS_SEMANA[dt.getDay()]}, ${d} de ${MESES[m-1]} de ${y}`,
  };
}

// ── Rótulos de mercado ──────────────────────────────────────────────────────────

const MARKET_LABELS = {
  home:     'Casa (1X2)',
  away:     'Visitante (1X2)',
  over05ht: 'Over 0.5 HT',
  over15:   'Over 1.5 FT',
  over25:   'Over 2.5 FT',
  under35:  'Under 3.5 FT',
  under45:  'Under 4.5 FT',
  btts:     'BTTS Sim',
};

// ── Builders de HTML parcial ────────────────────────────────────────────────────

/**
 * Feed: coluna esquerda = hora + odd (pequena), coluna direita = partida, mercado, liga
 */
function buildFeedRow(pick) {
  return `
    <div class="game">
      <div class="time-col">
        <div class="hora">${pick.match_time}</div>
        <div class="odd-small">${Number(pick.odd_used).toFixed(2)}</div>
      </div>
      <div class="info">
        <div class="partida">${pick.home_team} <span style="color:#263d4f">v</span> ${pick.away_team}</div>
        <div class="mercado">${MARKET_LABELS[pick.market] || pick.market}</div>
        <div class="liga">${pick.country} — ${pick.league}</div>
      </div>
    </div>
  `;
}

/**
 * Story: mesmo layout do feed (hora+odd | partida/mercado/liga)
 */
function buildStoryCard(pick) {
  return `
    <div class="card">
      <div class="time-col">
        <div class="hora">${pick.match_time}</div>
        <div class="odd-small">${Number(pick.odd_used).toFixed(2)}</div>
      </div>
      <div class="info">
        <div class="partida">${pick.home_team} <span style="color:#263d4f">v</span> ${pick.away_team}</div>
        <div class="mercado">${MARKET_LABELS[pick.market] || pick.market}</div>
        <div class="liga">${pick.country} — ${pick.league}</div>
      </div>
    </div>
  `;
}

/**
 * Resultado: hora | partida + mercado + score | badge GREEN/RED
 */
function buildResultRow(pick) {
  const won     = pick.result === 1;
  const pending = pick.resolved === 0;
  const ftScore = (pick.home_score != null && pick.away_score != null)
    ? `${pick.home_score}–${pick.away_score}`
    : null;

  let badge, style;
  if (pending) {
    badge = '⏳ Pendente';
    style = '';
  } else if (won) {
    badge = '✅ GREEN';
    style = 'color:#00f0a8;border-color:#00f0a844;background:#00f0a811';
  } else {
    badge = '❌ RED';
    style = 'color:#f05050;border-color:#f0505044;background:#f0505011';
  }

  return `
    <div class="row">
      <div class="hora">${pick.match_time}</div>
      <div>
        <div class="partida">${pick.home_team} <span style="color:#263d4f">v</span> ${pick.away_team}</div>
        <div class="mercado">${MARKET_LABELS[pick.market] || pick.market}</div>
        ${ftScore ? `<div class="score">Placar: ${ftScore}</div>` : ''}
      </div>
      <div class="badge" style="${style}">${badge}</div>
    </div>
  `;
}

// ── Renderização Puppeteer ──────────────────────────────────────────────────────

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

    const dims = templateName.includes('story') || templateName.includes('reel')
      ? { width: 1080, height: 1920 }
      : { width: 1080, height: 1350 };

    await page.setViewport(dims);
    await page.setContent(html, { waitUntil: ['networkidle0', 'domcontentloaded'], timeout: 30000 });
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
 * Feed e Story são paginados (max PAGE_LIMITS[type] por imagem).
 * Resultado e Reel são sempre uma imagem.
 */
async function generateImages({ date, picks, types = ['feed', 'story', 'resultado', 'reel'], logoUrl = '', filePrefix = '' }) {
  const dateParts = parseDateParts(date);
  const results   = [];

  // Estatísticas globais
  const resolved = picks.filter(p => p.resolved === 1);
  const wins     = picks.filter(p => p.result === 1).length;
  const losses   = picks.filter(p => p.result === 0).length;
  const winRate  = resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : 0;
  const avgOdd   = picks.length > 0
    ? (picks.reduce((s, p) => s + Number(p.odd_used), 0) / picks.length).toFixed(2)
    : '—';

  const mktCount = {};
  picks.forEach(p => { mktCount[p.market] = (mktCount[p.market] || 0) + 1; });
  const topMarket = Object.entries(mktCount).sort((a, b) => b[1] - a[1])[0];
  const mercadoPrincipal = topMarket ? (MARKET_LABELS[topMarket[0]] || topMarket[0]) : '—';

  const isGreen = winRate >= 50;
  const ACCENT_GREEN = { color: '#00f0a8', subtle: 'rgba(0,240,168,.07)', border: 'rgba(0,240,168,.3)', glow: 'rgba(0,240,168,.18)' };
  const ACCENT_RED   = { color: '#f05050', subtle: 'rgba(240,80,80,.07)',  border: 'rgba(240,80,80,.3)',  glow: 'rgba(240,80,80,.18)'  };
  const accent = isGreen ? ACCENT_GREEN : ACCENT_RED;

  for (const type of types) {
    const tplPath = path.join(TEMPLATES_DIR, `${type}.html`);
    if (!fs.existsSync(tplPath)) {
      console.warn(`[gen] Template não encontrado: ${tplPath}`);
      continue;
    }

    const baseTpl = fs.readFileSync(tplPath, 'utf8');
    const limit   = PAGE_LIMITS[type]; // undefined = sem paginação
    const chunks  = limit
      ? Array.from({ length: Math.ceil(picks.length / limit) }, (_, i) => picks.slice(i * limit, (i + 1) * limit))
      : [picks]; // resultado e reel: uma página

    const pageTotal = chunks.length;

    for (let pageIdx = 0; pageIdx < chunks.length; pageIdx++) {
      const chunk   = chunks[pageIdx];
      const pageNum = pageIdx + 1;
      let tpl = baseTpl;

      // Monta HTML de jogos
      let jogosHtml = '';
      switch (type) {
        case 'feed':
        case 'sniper-feed':
          jogosHtml = chunk.map(buildFeedRow).join('');
          break;
        case 'story':
        case 'sniper-story':
          jogosHtml = chunk.map(buildStoryCard).join('');
          break;
        case 'resultado':
        case 'sniper-resultado':
          jogosHtml = picks.map(buildResultRow).join('');
          break;
        case 'reel':
        case 'sniper-reel':
          break;
      }

      // Status para resultado
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

      // Remove bloco {{#if_multi}}…{{/if_multi}} quando só há 1 página
      if (pageTotal === 1) {
        tpl = tpl.replace(/\{\{#if_multi\}\}[\s\S]*?\{\{\/if_multi\}\}/g, '');
      } else {
        tpl = tpl.replace(/\{\{#if_multi\}\}([\s\S]*?)\{\{\/if_multi\}\}/g, '$1');
      }

      const replacements = {
        LOGO_URL:          logoUrl,
        DATA_DIA:          dateParts.day,
        DATA_MES:          dateParts.month,
        DATA_TEXTO:        dateParts.full,
        TOTAL_PICKS:       String(picks.length),
        PAGE_NUM:          String(pageNum),
        PAGE_TOTAL:        String(pageTotal),
        JOGOS_HTML:        jogosHtml,
        RESULTADOS_HTML:   jogosHtml,
        STATUS_EMOJI:      statusEmoji,
        STATUS:            statusText,
        WINS:              String(wins),
        LOSSES:            String(losses),
        WIN_RATE:          String(winRate),
        MERCADO_PRINCIPAL: mercadoPrincipal,
        ODD_MEDIA:         avgOdd,
        ACCENT_COLOR:      accent.color,
        ACCENT_SUBTLE:     accent.subtle,
        ACCENT_BORDER:     accent.border,
        ACCENT_GLOW:       accent.glow,
        GLOW_COLOR:        accent.color,
      };

      for (const [key, val] of Object.entries(replacements)) {
        tpl = tpl.replaceAll(`{{${key}}}`, val);
      }

      console.log(`[gen] Renderizando ${type} (${pageNum}/${pageTotal})…`);
      const buffer = await renderTemplate(type, tpl);

      // Nome do arquivo: inclui sufixo de página se houver mais de uma
      const suffix   = pageTotal > 1 ? `_${pageNum}de${pageTotal}` : '';
      const filename = `${filePrefix}${type}_${date}${suffix}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, buffer);

      results.push({ type, page: pageNum, pageTotal, filename, url: `/generated/${filename}` });
      console.log(`[gen] ✅ ${filename} salvo.`);
    }
  }

  return results;
}

module.exports = { generateImages };
