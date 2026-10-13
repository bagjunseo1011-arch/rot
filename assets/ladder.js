/* ============================================================
   사다리타기 화면. 누가 무엇을 받을지는 random.js 의 shuffle 이 먼저 정하고,
   buildLadder 가 그 결과대로 내려가는 사다리를 만듭니다. 이 파일은 그리기만 합니다.
   ============================================================ */
(function () {
  'use strict';

  var R = window.FairRandom;
  var MAX = 20;
  var KEY = 'ladder-v1';
  var COL_W = 72;       // 세로줄 간격 (px). style.css 의 이름·결과 칸 폭과 같아야 합니다
  var ROW_GAP = 30;     // 행 간격 (px)
  var MIN_ROWS = 8;     // 가로줄이 적어도 사다리가 납작해 보이지 않게
  var DRAW_MS = 1100;
  var TONES = 4;        // 경로 색 개수 — 색은 tokens.css 의 --route-1~4
  var tone = function (i) { return 'var(--route-' + (i % TONES + 1) + ')'; };
  var DEFAULT = { p: '민수\n지영\n현우\n서연', r: '당첨\n꽝\n꽝\n꽝' };
  var SVG = 'http://www.w3.org/2000/svg';

  var $ = function (id) { return document.getElementById(id); };
  var pIn = $('players');
  var rIn = $('prizes');
  var msg = $('ladder-msg');
  var board = $('board');
  var revealAllBtn = $('reveal-all');
  var resultList = $('ladder-result');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var game = null; // { players, prizes, ladder, svg, H, prizeEls, nameEls, revealed }

  function parse(text) {
    return text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ p: pIn.value, r: rIn.value })); } catch (e) { /* 무시 */ }
  }
  function load() {
    var q = new URLSearchParams(location.search);
    if (q.get('p')) return { p: q.get('p'), r: q.get('r') || '' };
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.p) return s; } catch (e) { /* 무시 */ }
    return DEFAULT;
  }
  function el(tag, attrs, ns) {
    var node = ns ? document.createElementNS(SVG, tag) : document.createElement(tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function make() {
    var players = parse(pIn.value);
    var prizes = parse(rIn.value);
    var n = players.length;

    if (n < 2) { msg.textContent = '참가자를 2명 이상 적어 주세요.'; return; }
    if (n > MAX) { msg.textContent = '참가자는 ' + MAX + '명까지예요. 지금 ' + n + '명입니다.'; return; }
    if (prizes.length > n) { msg.textContent = '결과(' + prizes.length + '개)가 참가자(' + n + '명)보다 많아요. 결과 칸은 참가자 수와 같아야 합니다.'; return; }
    msg.textContent = '';
    while (prizes.length < n) prizes.push('꽝');

    // 결과를 먼저 공정하게 섞습니다: perm[i] = i번째 참가자가 도착할 칸
    var perm = [];
    for (var i = 0; i < n; i++) perm.push(i);
    perm = R.shuffle(perm);
    var ladder = R.buildLadder(perm);

    render(players, prizes, ladder);
    revealAllBtn.disabled = false;
    resultList.innerHTML = '';
    $('make').textContent = '다시 섞기';
  }

  function render(players, prizes, ladder) {
    var n = players.length;
    var W = n * COL_W;
    var H = Math.max(ladder.rows + 1, MIN_ROWS) * ROW_GAP;
    var x = function (c) { return c * COL_W + COL_W / 2; };
    var y = function (r) { return (r + 1) * H / (ladder.rows + 1); }; // 행 -1 → 0(맨 위), rows → H(맨 아래)

    board.innerHTML = '';
    board.style.width = W + 'px';
    board.style.setProperty('--cols', n);

    var names = el('div', { class: 'board__row' });
    var nameEls = players.map(function (name, i) {
      var b = el('button', { type: 'button', class: 'board__name', 'aria-pressed': 'false', title: name });
      b.textContent = name;
      b.style.setProperty('--tone', tone(i));
      b.addEventListener('click', function () { reveal(i); });
      names.appendChild(b);
      return b;
    });

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': n + '명 사다리' }, true);
    for (var c = 0; c < n; c++) svg.appendChild(el('line', { class: 'rail', x1: x(c), y1: 0, x2: x(c), y2: H }, true));
    ladder.rungs.forEach(function (r) {
      svg.appendChild(el('line', { class: 'rung', x1: x(r.col), y1: y(r.row), x2: x(r.col + 1), y2: y(r.row) }, true));
    });

    var prizeRow = el('div', { class: 'board__row' });
    var prizeEls = prizes.map(function (p) {
      var s = el('span', { class: 'board__prize', title: '아직 공개 안 됨' });
      s.textContent = '?';
      prizeRow.appendChild(s);
      return s;
    });

    board.appendChild(names);
    board.appendChild(svg);
    board.appendChild(prizeRow);

    game = { players: players, prizes: prizes, ladder: ladder, svg: svg, x: x, y: y, nameEls: nameEls, prizeEls: prizeEls, revealed: {} };
  }

  function reveal(i) {
    if (!game || game.revealed[i]) return;
    game.revealed[i] = true;

    var t = R.trace(game.ladder, i);
    var color = tone(i);
    var points = t.path.map(function (p) { return game.x(p[0]) + ',' + game.y(p[1]); }).join(' ');
    var route = el('polyline', { class: 'route', points: points }, true);
    route.style.stroke = color; // var() 는 SVG 속성이 아니라 style 로 넣어야 적용됩니다
    game.svg.appendChild(route);
    game.nameEls[i].setAttribute('aria-pressed', 'true');

    if (!reduceMotion) {
      var len = route.getTotalLength();
      route.style.strokeDasharray = len;
      route.style.strokeDashoffset = len;
      route.getBoundingClientRect(); // 시작 상태를 먼저 그리게 해서 전환이 일어나도록
      route.style.transition = 'stroke-dashoffset ' + DRAW_MS + 'ms ease-in-out';
      route.style.strokeDashoffset = 0;
    }

    var g = game;
    setTimeout(function () {
      if (g !== game) return; // 그사이 새 사다리를 만들었으면 무시
      var slot = g.prizeEls[t.end];
      var open = function () {
        if (g !== game) return;
        slot.classList.remove('is-shaking');
        slot.textContent = g.prizes[t.end];
        slot.title = g.prizes[t.end];
        slot.style.setProperty('--tone', color);
        slot.classList.add('is-open'); // 뒤집히며 공개 (style.css 의 prize-flip)
        var li = document.createElement('li');
        li.textContent = g.players[i] + ' → ' + g.prizes[t.end];
        resultList.appendChild(li);
        if (Object.keys(g.revealed).length === g.players.length) revealAllBtn.disabled = true;
      };
      if (reduceMotion) { open(); return; }
      slot.classList.add('is-shaking'); // 공개 직전 살짝 흔들림 (style.css 의 prize-shake)
      afterAnimation(slot, open);
    }, reduceMotion ? 0 : DRAW_MS);
  }

  /**
   * el 의 CSS 애니메이션이 끝나면 done 을 한 번 부릅니다. 시간은 style.css 에만 있고 여기엔 숫자가 없습니다.
   * animationend 가 오지 않아도(CSS 를 못 불러옴 등) CSS 에 적힌 시간이 지나면 마무리합니다. (roulette.js 에도 같은 함수)
   */
  function afterAnimation(el, done) {
    var cs = getComputedStyle(el);
    var ms = (parseFloat(cs.animationDuration) || 0) * 1000 * (parseFloat(cs.animationIterationCount) || 1);
    if (!ms) { done(); return; }
    var fired = false;
    var once = function () {
      if (fired) return;
      fired = true;
      el.removeEventListener('animationend', onEnd);
      done();
    };
    var onEnd = function (e) { if (e.target === el) once(); };
    el.addEventListener('animationend', onEnd);
    setTimeout(once, ms + 300);
  }

  function share() {
    var url = location.origin + location.pathname +
      '?p=' + encodeURIComponent(pIn.value.trim()) + '&r=' + encodeURIComponent(rIn.value.trim());
    var done = function () { msg.textContent = '참가자와 결과가 담긴 주소를 복사했어요.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('이 주소를 복사하세요', url); });
    else window.prompt('이 주소를 복사하세요', url);
  }

  var start = load();
  pIn.value = start.p;
  rIn.value = start.r;
  make();

  [pIn, rIn].forEach(function (box) {
    box.addEventListener('input', function () {
      save();
      if (location.search) history.replaceState(null, '', location.pathname);
    });
  });
  $('make').addEventListener('click', make);
  $('share').addEventListener('click', share);
  revealAllBtn.addEventListener('click', function () {
    for (var i = 0; i < game.players.length; i++) reveal(i);
  });
})();
