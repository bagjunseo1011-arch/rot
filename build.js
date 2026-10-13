#!/usr/bin/env node
/* ============================================================
   정적 사이트 생성기 — 외부 의존성 0.  실행: node build.js
   content/*.js 를 읽어 HTML · sitemap.xml · robots.txt · ads.txt 를 만듭니다.
   what-ai.kr 생성기에서 공통 부분(레이아웃·SEO 태그·sitemap)만 가져와 줄였습니다.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const site = require('./content/site');
const tools = require('./content/tools');

const OUT = __dirname;
const BUILT = []; // sitemap 에 넣을 페이지

/* ---------- 유틸 ---------- */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function write(file, html, opts = {}) {
  fs.writeFileSync(path.join(OUT, file), html, 'utf8');
  if (!opts.noIndex) BUILT.push({ url: file === 'index.html' ? '' : file, priority: opts.priority || 0.5 });
}

/**
 * 파비콘처럼 CSS 변수를 쓸 수 없는 곳에 넣을 색. tokens.css 에서 읽어 와 색 정의를 한 곳에만 둡니다.
 * 반환값은 data URI 안에 바로 넣을 수 있게 # 을 %23 으로 바꾼 값입니다.
 */
const TOKENS_CSS = fs.readFileSync(path.join(OUT, 'assets', 'tokens.css'), 'utf8');
function tokenColor(name) {
  const m = TOKENS_CSS.match(new RegExp(`--${name}:\\s*#([0-9A-Fa-f]{6})\\b`));
  if (!m) throw new Error(`tokens.css 에 --${name} 색(#RRGGBB)이 없습니다`);
  return '%23' + m[1];
}

// 라인 아이콘 (24x24, stroke 1.5 — 레시피 규격)
const ICONS = {
  wheel: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

/* ---------- 공통 뼈대 ---------- */
const NAV = [...tools.map((t) => [`/${t.slug}.html`, t.name]), ['/about.html', '소개']];

function header(current) {
  const item = ([href, label]) =>
    `<a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="header">
  <div class="container header__inner">
    <a class="logo" href="/">${icon('wheel')}<span>${esc(site.name)}</span></a>
    <nav class="nav" aria-label="주요 메뉴">${NAV.map(item).join('')}</nav>
    <details class="menu">
      <summary aria-label="메뉴 열기">${icon('menu')}</summary>
      <div class="menu__panel">${NAV.map(item).join('')}</div>
    </details>
  </div>
</header>`;
}

function footer() {
  return `<footer class="footer">
  <div class="container">
    <div class="footer__grid footer__grid--3">
      <div>
        <h2>${esc(site.name)}</h2>
        <p class="footer__desc">${esc(site.tagline)}. 가입 없이 브라우저에서 바로 씁니다.</p>
      </div>
      <div>
        <h2>도구</h2>
        <ul>${tools.map((t) => `<li><a href="/${t.slug}.html">${esc(t.name)}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h2>사이트</h2>
        <ul>
          <li><a href="/about.html">사이트 소개</a></li>
          <li><a href="/contact.html">문의하기</a></li>
          <li><a href="/privacy.html">개인정보처리방침</a></li>
          <li><a href="/terms.html">이용약관</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__bottom"><span>© ${new Date().getFullYear()} ${esc(site.name)}</span></div>
  </div>
</footer>`;
}

function breadcrumb(trail) {
  const items = trail
    .map((t) => (t.href ? `<li><a href="${t.href}">${esc(t.label)}</a></li>` : `<li>${esc(t.label)}</li>`))
    .join('');
  return `<nav class="breadcrumb container" aria-label="현재 위치"><ol>${items}</ol></nav>`;
}
const breadcrumbLd = (trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, item: site.url + t.href })),
});

function faqBlock(faq) {
  return `<h2>자주 묻는 질문</h2>
<div class="faq">${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;
}
const faqLd = (faq) => ({
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

/** 페이지 뼈대. SEO 태그는 전부 여기서 붙습니다. scripts 는 도구 페이지에서만 넘깁니다. */
function layout({ title, description, canonical, body, current, jsonld = [], scripts = [] }) {
  const fullTitle = canonical === '/' ? title : `${title} | ${site.name}`;
  const url = site.url + canonical;
  const ld = jsonld.length
    ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonld })}</script>`
    : '';
  const adsense = site.adsensePublisherId
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(site.adsensePublisherId)}" crossorigin="anonymous"></script>`
    : '';
  const verify = [
    site.googleSiteVerification && `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">`,
    site.naverSiteVerification && `<meta name="naver-site-verification" content="${esc(site.naverSiteVerification)}">`,
  ].filter(Boolean).join('\n  ');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">
  ${verify}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(site.name)}">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:locale" content="${esc(site.locale)}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='${tokenColor('terracotta')}'/><path d='M12 2v20M2 12h20' stroke='${tokenColor('shell')}' stroke-width='2'/></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap"></noscript>
  <link rel="stylesheet" href="/assets/tokens.css">
  <link rel="stylesheet" href="/assets/style.css">
  ${ld}
  ${adsense}
</head>
<body>
  <a class="skip-link" href="#main">본문 바로가기</a>
  ${header(current)}
  <main id="main">
${body}
  </main>
  ${footer()}
  ${scripts.map((s) => `<script src="/assets/${s}" defer></script>`).join('\n  ')}
</body>
</html>`;
}

/* ---------- 도구 위젯 (JS 가 채워 넣을 자리) ---------- */
const NOSCRIPT = '<noscript><p class="callout callout--warn">이 도구는 자바스크립트가 켜져 있어야 동작합니다.</p></noscript>';

/** 원판 + 돌리기 버튼 + 결과. 돌림판 페이지와 홈 첫 화면 데모가 같이 씁니다 (roulette.js 가 같은 id 로 찾습니다) */
const wheelMarkup = () => `<div class="wheel">
      <svg id="wheel" viewBox="-110 -112 220 222" role="img" aria-label="돌림판 원판">
        <g id="wheel-rotor"></g>
        <circle class="wheel__rim" r="100"/>
        <circle class="wheel__hub" r="10"/>
        <path class="wheel__pointer" d="M0,-86 L-9,-108 L9,-108 Z"/>
      </svg>
      <button id="spin" class="btn btn--lg" type="button">돌리기</button>
      <p id="result" class="result" aria-live="polite"></p>
    </div>`;

const WIDGETS = {
  roulette: () => `<section class="tool container" aria-label="돌림판">
  ${NOSCRIPT}
  <div class="tool__grid">
    ${wheelMarkup()}
    <div class="panel">
      <label for="items">항목 (한 줄에 하나, 2~30개)</label>
      <textarea id="items" rows="9" spellcheck="false"></textarea>
      <p id="items-msg" class="msg" aria-live="polite"></p>
      <label class="check"><input type="checkbox" id="remove-winner"> 뽑힌 항목은 다음 판에서 빼기</label>
      <div class="panel__actions">
        <button id="share" class="btn btn--ghost btn--sm" type="button">주소 복사</button>
        <button id="reset" class="btn btn--ghost btn--sm" type="button">예시로 되돌리기</button>
      </div>
      <h3>기록</h3>
      <ol id="history" class="history"></ol>
    </div>
  </div>
</section>`,

  ladder: () => `<section class="tool container" aria-label="사다리타기">
  ${NOSCRIPT}
  <div class="tool__grid tool__grid--ladder">
    <div class="panel">
      <label for="players">참가자 (한 줄에 한 명, 2~20명)</label>
      <textarea id="players" rows="6" spellcheck="false"></textarea>
      <label for="prizes">결과 (모자라면 '꽝'으로 채움)</label>
      <textarea id="prizes" rows="6" spellcheck="false"></textarea>
      <p id="ladder-msg" class="msg" aria-live="polite"></p>
      <div class="panel__actions">
        <button id="make" class="btn" type="button">사다리 만들기</button>
        <button id="share" class="btn btn--ghost btn--sm" type="button">주소 복사</button>
      </div>
    </div>
    <div class="board">
      <div class="board__scroll"><div id="board" class="board__inner"></div></div>
      <div class="board__actions"><button id="reveal-all" class="btn btn--outline" type="button" disabled>전체 결과 보기</button></div>
      <ol id="ladder-result" class="history" aria-live="polite"></ol>
    </div>
  </div>
</section>`,
};

/* ---------- 페이지 ---------- */
function buildHome() {
  const list = tools.map((t) => `<li><a href="/${t.slug}.html"><span class="tool-list__name">${esc(t.name)}</span><span class="tool-list__desc">${esc(t.card)}</span></a></li>`).join('');

  const body = `<section class="hero container">
  <div class="hero__text">
    <h1>누가 할지,<br>공정하게.</h1>
    <p class="lede">돌림판과 사다리타기를 가입 없이 바로 씁니다. 결과를 어떻게 정하는지는 도구마다 공개해 두었습니다.</p>
    <p class="hero__hint">이 원판은 점심 메뉴 예시입니다. 항목을 바꾸려면 <a href="/roulette.html">돌림판</a>을 여세요.</p>
  </div>
  <div class="hero__demo">${wheelMarkup()}</div>
</section>
<section class="container" aria-label="도구">
  <ul class="tool-list">${list}</ul>
</section>
<section class="container prose home-principles">
  <h2>이 사이트의 원칙</h2>
  <ul>
    <li><strong>결과를 정하는 방법을 공개합니다.</strong> 어떤 난수를 쓰는지, 사다리를 어떻게 그리는지 도구 페이지마다 적어 두었습니다.</li>
    <li><strong>적은 내용은 서버로 보내지 않습니다.</strong> 항목과 이름은 지금 쓰는 브라우저 안에서만 처리됩니다.</li>
    <li><strong>검사를 통과해야 배포됩니다.</strong> 결과가 고르게 나오는지, 사다리가 정한 결과대로 도착하는지 검사하고, 하나라도 실패하면 사이트가 갱신되지 않습니다.</li>
  </ul>
</section>`;

  write('index.html', layout({
    title: `${site.name} — 돌림판 · 사다리타기 무료 랜덤 도구`,
    description: `돌림판(룰렛 돌리기)과 사다리타기를 가입 없이 바로 쓰는 무료 랜덤 도구. ${site.tagline}입니다.`,
    canonical: '/',
    current: '/',
    body,
    scripts: ['random.js', 'roulette.js'],
    jsonld: [{ '@type': 'WebSite', name: site.name, url: site.url + '/', inLanguage: 'ko' }],
  }), { priority: 1.0 });
}

/** 측정 결과 막대그래프 (content/tools.js 의 proof). 점선 = 공정할 때의 비율 */
function proofChart(p) {
  const scale = Math.ceil(Math.max(...p.values) / 5) * 5 + 5; // 가장 긴 막대가 끝에 붙지 않게 여유
  const rows = p.values.map((v, i) => `<li><span class="proof__label">${i + 1}번 칸</span>` +
    `<span class="proof__track"><span class="proof__bar" style="width:${(v / scale * 100).toFixed(1)}%"></span></span>` +
    `<span class="proof__val">${v.toFixed(1)}%</span></li>`).join('');
  return `<figure class="proof">
      <figcaption>${esc(p.title)}</figcaption>
      <ol class="proof__rows" style="--fair:${(p.fair / scale * 100).toFixed(1)}%">${rows}</ol>
      <p class="proof__note">${esc(p.note)}</p>
    </figure>`;
}

function buildToolPage(t) {
  const trail = [{ label: '홈', href: '/' }, { label: t.name, href: `/${t.slug}.html` }];
  const other = tools.find((x) => x.slug !== t.slug);

  const body = `${breadcrumb([trail[0], { label: t.name }])}
<div class="container">
  <div class="page-head"><h1>${esc(t.h1)}</h1><p class="lede">${esc(t.description)}</p></div>
</div>
${WIDGETS[t.slug]()}
<div class="container">
  <article class="prose article">
    ${t.intro.map((p) => `<p>${esc(p)}</p>`).join('')}

    <h2>이럴 때 씁니다</h2>
    <ul>${t.uses.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>

    <h2>사용법</h2>
    <ol class="steps">${t.howto.map((s) => `<li><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('')}</ol>

    <h2>${esc(t.fairnessTitle)}</h2>
    ${t.fairness.map((p, i) => `<p>${esc(p)}</p>` + (t.proof && i === t.proof.after ? proofChart(t.proof) : '')).join('')}

    ${faqBlock(t.faq)}

    ${other ? `<div class="cta">
      <h2>${esc(other.name)}도 있습니다</h2>
      <p>${esc(other.card)}</p>
      <a class="btn" href="/${other.slug}.html">${esc(other.name)} 하러 가기</a>
    </div>` : ''}
  </article>
</div>`;

  write(`${t.slug}.html`, layout({
    title: t.title,
    description: t.description,
    canonical: `/${t.slug}.html`,
    current: `/${t.slug}.html`,
    body,
    scripts: ['random.js', `${t.slug}.js`],
    jsonld: [
      breadcrumbLd(trail),
      {
        '@type': 'WebApplication',
        name: `${t.name} — ${site.name}`,
        url: `${site.url}/${t.slug}.html`,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'JavaScript 필요',
        inLanguage: 'ko',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      },
      faqLd(t.faq),
    ],
  }), { priority: 0.9 });
}

function buildStaticPage({ file, title, description, sections }) {
  const body = `${breadcrumb([{ label: '홈', href: '/' }, { label: title }])}
<div class="container">
  <div class="page-head"><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p></div>
  <article class="prose article">${sections}</article>
</div>`;
  write(file, layout({
    title, description, canonical: `/${file}`, current: `/${file}`, body,
    jsonld: [breadcrumbLd([{ label: '홈', href: '/' }, { label: title, href: `/${file}` }])],
  }), { priority: 0.3 });
}

function buildStaticPages() {
  const mail = `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`;

  buildStaticPage({
    file: 'about.html',
    title: '사이트 소개',
    description: `${site.name}은 결과를 어떻게 정하는지 공개하는 돌림판·사다리타기 도구입니다.`,
    sections: `
      <h2>누가 만드나요</h2>
      <p>${esc(site.operator)}가 직접 설계하고 코드를 작성해 운영합니다. 화면의 애니메이션부터 결과를 정하는 로직, 그 로직을 확인하는 검사까지 모두 이 사이트를 위해 만들었습니다.</p>
      <h2>무엇을 다르게 하나요</h2>
      <p>돌림판과 사다리는 결과가 공정하다고 믿을 수 있어야 쓸모가 있는 도구입니다. 그래서 이 사이트는 결과를 어떻게 정하는지 각 도구 페이지에 그대로 적어 둡니다.</p>
      <ul>
        <li><strong>돌림판</strong> — 버튼을 누르는 순간 암호학적 난수로 결과를 정하고, 원판은 그 칸에 멈추도록 돌아갑니다. <a href="/roulette.html">자세히</a></li>
        <li><strong>사다리타기</strong> — 결과를 먼저 공정하게 섞은 뒤 그 결과대로 내려가는 사다리를 그립니다. 가로줄을 무작위로 긋는 흔한 방식에서 생기는 출발 자리 편향을 직접 측정해 정리했습니다. <a href="/ladder.html">자세히</a></li>
      </ul>
      <h2>검사를 통과해야 배포됩니다</h2>
      <p>사이트를 고칠 때마다 결과가 고르게 나오는지, 사다리가 미리 정한 결과대로 도착하는지 자동으로 검사합니다. 검사가 하나라도 실패하면 사이트가 갱신되지 않도록 배포 과정에 묶어 두었습니다.</p>
      <h2>연락처</h2>
      <p>잘못된 점이나 원하는 기능이 있으면 ${mail}로 알려 주세요.</p>`,
  });

  buildStaticPage({
    file: 'privacy.html',
    title: '개인정보처리방침',
    description: '이 사이트가 어떤 정보를 다루고 다루지 않는지 정리했습니다.',
    sections: `
      <h2>1. 수집하는 개인정보</h2>
      <p>이 사이트는 회원가입이 없고, 이름·연락처 같은 개인정보를 수집하지 않습니다. 돌림판 항목과 사다리 참가자 이름은 서버로 전송되지 않습니다.</p>
      <h2>2. 브라우저에 저장되는 정보</h2>
      <p>다음 방문 때 다시 쓸 수 있도록, 마지막으로 입력한 항목을 이용자의 브라우저 저장 공간(localStorage)에 저장합니다. 이 정보는 이용자의 기기에만 남으며, 브라우저의 사이트 데이터 삭제 기능으로 언제든 지울 수 있습니다.</p>
      <h2>3. 주소 공유</h2>
      <p>[주소 복사] 기능으로 만든 주소에는 입력한 항목이 포함됩니다. 이 주소를 다른 사람에게 보내면 그 사람도 항목을 볼 수 있으니, 공개되면 곤란한 내용은 넣지 마세요.</p>
      <h2>4. 광고와 쿠키</h2>
      <p>이 사이트는 운영비를 위해 Google 애드센스 광고를 게재할 수 있습니다. 이 경우 Google을 포함한 제3자 광고 사업자가 쿠키를 사용해, 이용자가 이 사이트나 다른 사이트를 방문한 기록을 바탕으로 광고를 표시할 수 있습니다.</p>
      <p>Google이 광고 쿠키를 사용하는 방식은 <a href="https://policies.google.com/technologies/ads" rel="noopener">Google 광고 정책</a>에서 확인할 수 있고, 맞춤 광고는 <a href="https://adssettings.google.com" rel="noopener">광고 설정</a>에서 끌 수 있습니다.</p>
      <h2>5. 문의</h2>
      <p>개인정보와 관련한 문의는 ${mail}로 보내 주세요.</p>
      <p class="muted">시행일: ${esc(site.policyDate)}</p>`,
  });

  buildStaticPage({
    file: 'terms.html',
    title: '이용약관',
    description: '이 사이트를 이용할 때 알아 두실 내용입니다.',
    sections: `
      <h2>1. 서비스</h2>
      <p>이 사이트는 돌림판과 사다리타기 도구를 무료로 제공합니다. 가입 없이 누구나 이용할 수 있습니다.</p>
      <h2>2. 이용 목적</h2>
      <p>이 도구는 모임, 수업, 이벤트에서 순서나 당첨을 정하는 데 쓰도록 만들었습니다. 금전이나 재물을 걸고 승패를 정하는 도박 목적으로 이용해서는 안 됩니다.</p>
      <h2>3. 결과에 대한 책임</h2>
      <p>결과는 각 도구 페이지에 공개한 방식대로 무작위로 정해집니다. 운영자는 결과를 이용해 이용자 사이에 생긴 약속이나 분쟁에 대해 책임지지 않습니다.</p>
      <h2>4. 변경</h2>
      <p>서비스와 약관은 예고 없이 바뀔 수 있으며, 바뀐 약관은 이 페이지에 게시한 때부터 적용됩니다.</p>
      <p class="muted">시행일: ${esc(site.policyDate)}</p>`,
  });

  buildStaticPage({
    file: 'contact.html',
    title: '문의하기',
    description: '잘못된 점, 원하는 기능, 광고·제휴 문의를 받습니다.',
    sections: `
      <h2>이메일</h2>
      <p>${mail}</p>
      <p>도구가 이상하게 동작하면 쓰고 있는 기기와 브라우저(예: 아이폰 사파리, 윈도우 크롬)와 함께 어떤 상황이었는지 알려 주시면 고치는 데 큰 도움이 됩니다.</p>`,
  });
}

function build404() {
  const body = `<div class="container"><div class="page-head"><h1>페이지를 찾을 수 없습니다</h1>
  <p class="lede">주소가 바뀌었거나 없는 페이지입니다.</p></div>
  <p style="margin-top:24px">${tools.map((t) => `<a class="btn btn--outline" href="/${t.slug}.html">${esc(t.name)}</a>`).join(' ')}</p></div>`;
  write('404.html', layout({ title: '페이지를 찾을 수 없습니다', description: '없는 페이지입니다.', canonical: '/404.html', body }), { noIndex: true });
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = BUILT.map((p) =>
    `  <url><loc>${site.url}/${p.url}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`
  ).join('\n');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`, 'utf8');
}

/** 퍼블리셔 ID가 없으면(신청 전) 만들지 않습니다. 빈 ID로 파일만 있으면 오히려 검증 실패로 뜹니다. */
function buildAdsTxt() {
  if (!site.adsensePublisherId) return;
  const pubId = site.adsensePublisherId.replace(/^ca-/, '');
  fs.writeFileSync(path.join(OUT, 'ads.txt'), `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`, 'utf8');
}

/* ---------- 실행 ---------- */
function main() {
  tools.forEach((t) => {
    if (!WIDGETS[t.slug]) throw new Error(`tools: "${t.slug}" 위젯이 없습니다 (build.js WIDGETS)`);
    if (!fs.existsSync(path.join(OUT, 'assets', `${t.slug}.js`))) throw new Error(`assets/${t.slug}.js 가 없습니다`);
  });

  buildHome();
  tools.forEach(buildToolPage);
  buildStaticPages();
  build404();
  buildSitemap();
  buildAdsTxt();

  console.log('빌드 완료');
  console.log(`  페이지 ${BUILT.length + 1}개 (sitemap ${BUILT.length}개 + 404)`);
  if (/example\.com/.test(site.url)) {
    console.log('  ⚠ content/site.js 의 url 이 아직 example.com 입니다 — 도메인을 정하면 바꾸세요');
  }
}

main();
