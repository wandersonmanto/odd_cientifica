## Esse template gera um post vertical para feed.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Seleção do Dia</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1080px;
      height: 1350px;
      font-family: Arial, sans-serif;
      background:
        radial-gradient(circle at top, rgba(0,255,163,.15), transparent 35%),
        linear-gradient(180deg, #06090d 0%, #0b1016 100%);
      color: white;
    }

    .page {
      width: 1080px;
      height: 1350px;
      padding: 48px;
      position: relative;
    }

    .glow {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(0,255,163,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,255,163,.04) 1px, transparent 1px);
      background-size: 40px 40px;
      opacity: .25;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 22px;
      margin-bottom: 24px;
    }

    .logo {
      width: 78px;
      height: 78px;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 0 24px rgba(0,255,163,.28);
      border: 1px solid rgba(0,255,163,.35);
      background: #0f151d;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .brand h1 {
      margin: 0;
      font-size: 38px;
      font-weight: 900;
      letter-spacing: .5px;
    }

    .brand h1 span {
      color: #00f0a8;
    }

    .subtitle {
      margin-top: 10px;
      font-size: 58px;
      font-weight: 900;
      line-height: 1.02;
    }

    .subtitle small {
      display: block;
      margin-top: 10px;
      font-size: 22px;
      color: #9fb2c8;
      font-weight: 500;
    }

    .list {
      margin-top: 28px;
      padding: 24px;
      border: 1px solid rgba(0,255,163,.25);
      border-radius: 28px;
      background: rgba(255,255,255,.03);
      box-shadow: 0 0 32px rgba(0,255,163,.12);
    }

    .game {
      display: grid;
      grid-template-columns: 140px 1fr 170px;
      gap: 18px;
      align-items: center;
      padding: 18px 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .game:last-child { border-bottom: none; }

    .hora {
      font-size: 28px;
      font-weight: 800;
      color: #d8fff1;
      padding: 12px 18px;
      border-radius: 16px;
      border: 1px solid rgba(0,255,163,.25);
      text-align: center;
      background: rgba(0,255,163,.06);
    }

    .info .partida {
      font-size: 31px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .info .mercado {
      font-size: 22px;
      color: #00f0a8;
      font-weight: 700;
    }

    .info .liga {
      font-size: 18px;
      color: #91a3b8;
      margin-top: 6px;
    }

    .odd {
      text-align: center;
      font-size: 30px;
      font-weight: 900;
      color: #00ffb0;
      border-radius: 18px;
      padding: 16px 10px;
      background: rgba(0,255,163,.08);
      border: 1px solid rgba(0,255,163,.3);
      box-shadow: inset 0 0 18px rgba(0,255,163,.08);
    }

    .footer {
      position: absolute;
      left: 48px;
      right: 48px;
      bottom: 34px;
      display: flex;
      justify-content: space-between;
      font-size: 18px;
      color: #8ca0b7;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="glow"></div>

    <div class="header">
      <div class="logo">
        <img src="{{LOGO_URL}}" alt="Logo" />
      </div>
      <div class="brand">
        <h1>ODD <span>CIENTÍFICA</span></h1>
      </div>
    </div>

    <div class="subtitle">
      Seleção de Jogos do Dia ⚽
      <small>{{DATA_TEXTO}}</small>
    </div>

    <div class="list">
      {{JOGOS_HTML}}
    </div>

    <div class="footer">
      <div>Dados analisados por IA</div>
      <div>@oddcientifica</div>
    </div>
  </div>
</body>
</html>
```

## Template de Story

  ```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Story</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1080px;
      height: 1920px;
      font-family: Arial, sans-serif;
      background:
        radial-gradient(circle at top, rgba(0,255,163,.15), transparent 35%),
        linear-gradient(180deg, #05080c 0%, #0a1118 100%);
      color: white;
    }
    .page { padding: 50px; }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 30px;
    }
    .logo-row img {
      width: 80px;
      height: 80px;
      border-radius: 18px;
    }
    .brand {
      font-size: 38px;
      font-weight: 900;
    }
    .brand span { color: #00f0a8; }

    .title {
      font-size: 64px;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 14px;
    }
    .sub {
      font-size: 24px;
      color: #99adc4;
      margin-bottom: 32px;
    }
    .card {
      border-radius: 30px;
      padding: 28px;
      margin-bottom: 22px;
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(0,255,163,.22);
      box-shadow: 0 0 24px rgba(0,255,163,.12);
    }
    .hora {
      display: inline-block;
      font-size: 28px;
      font-weight: 800;
      color: #d6fff1;
      margin-bottom: 14px;
    }
    .partida {
      font-size: 38px;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 12px;
    }
    .mercado {
      font-size: 28px;
      color: #00f0a8;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .odd {
      font-size: 34px;
      font-weight: 900;
      color: #00ffb0;
    }
    .cta {
      margin-top: 30px;
      text-align: center;
      font-size: 30px;
      font-weight: 700;
      color: #dffef2;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="logo-row">
      <img src="{{LOGO_URL}}" alt="logo" />
      <div class="brand">ODD <span>CIENTÍFICA</span></div>
    </div>

    <div class="title">Seleção do Dia</div>
    <div class="sub">{{DATA_TEXTO}}</div>

    {{JOGOS_HTML}}

    <div class="cta">Volte mais tarde para ver o GREEN / RED 👀</div>
  </div>
</body>
</html>
```

## Template de Resultado

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Resultado</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1080px;
      height: 1350px;
      font-family: Arial, sans-serif;
      background: linear-gradient(180deg, #05080c 0%, #0d1117 100%);
      color: white;
    }

    .page {
      width: 1080px;
      height: 1350px;
      padding: 48px;
      background:
        radial-gradient(circle at top, {{GLOW_COLOR}}33, transparent 35%);
    }

    .header {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 30px;
    }

    .header img {
      width: 78px;
      height: 78px;
      border-radius: 18px;
    }

    .brand {
      font-size: 38px;
      font-weight: 900;
    }

    .brand span {
      color: #00f0a8;
    }

    .title {
      font-size: 42px;
      color: #d9e4ef;
      margin-bottom: 18px;
      font-weight: 700;
    }

    .status {
      font-size: 120px;
      font-weight: 900;
      line-height: 1;
      color: {{GLOW_COLOR}};
      text-shadow: 0 0 28px {{GLOW_COLOR}}55;
      margin-bottom: 28px;
    }

    .box {
      border: 1px solid {{GLOW_COLOR}}66;
      border-radius: 28px;
      background: rgba(255,255,255,.03);
      padding: 24px;
      box-shadow: 0 0 28px {{GLOW_COLOR}}22;
    }

    .row {
      display: grid;
      grid-template-columns: 120px 1fr 140px;
      gap: 16px;
      padding: 18px 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
      align-items: center;
    }

    .row:last-child {
      border-bottom: none;
    }

    .hora {
      font-size: 24px;
      font-weight: 800;
    }

    .partida {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .mercado {
      font-size: 20px;
      color: #b7c8d8;
    }

    .badge {
      text-align: center;
      padding: 12px;
      border-radius: 14px;
      font-size: 22px;
      font-weight: 900;
      background: {{GLOW_COLOR}}22;
      color: {{GLOW_COLOR}};
      border: 1px solid {{GLOW_COLOR}}66;
    }

    .summary {
      margin-top: 28px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .sum-card {
      padding: 20px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
    }

    .sum-card .label {
      font-size: 18px;
      color: #8fa3ba;
      margin-bottom: 10px;
    }

    .sum-card .value {
      font-size: 36px;
      font-weight: 900;
      color: {{GLOW_COLOR}};
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img src="{{LOGO_URL}}" alt="logo" />
      <div class="brand">ODD <span>CIENTÍFICA</span></div>
    </div>

    <div class="title">Resultado do Dia</div>
    <div class="status">{{STATUS}}</div>

    <div class="box">
      {{RESULTADOS_HTML}}
    </div>

    <div class="summary">
      <div class="sum-card">
        <div class="label">Jogos</div>
        <div class="value">{{TOTAL_JOGOS}}</div>
      </div>
      <div class="sum-card">
        <div class="label">Lucro / Prejuízo</div>
        <div class="value">{{VALOR_RESULTADO}}</div>
      </div>
      <div class="sum-card">
        <div class="label">ROI</div>
        <div class="value">{{ROI}}</div>
      </div>
    </div>
  </div>
</body>
</html>
```