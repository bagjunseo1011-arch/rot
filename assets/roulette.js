/* ============================================================
   돌림판 화면. 결과는 random.js 의 randInt 가 정하고,
   이 파일은 원판을 그리고 그 칸까지 돌려 보여 주기만 합니다.
   ============================================================ */
(function () {
  'use strict';

  var R = window.FairRandom;
  var MAX = 30;
  var KEY = 'roulette-items';
  var EXAMPLE = ['짜장면', '짬뽕', '김치찌개', '돈까스', '비빔밥', '햄버거'];
  // 칸 색 개수. 색은 tokens.css 의 --wheel-1~6, 칸마다 짝지은 글자색과 함께 style.css 의 .seg--N / .ink--N 이 칠합니다
  var TONES = 6;

  var $ = function (id) { return document.getElementById(id); };
  var input = $('items');
  var rotor = $('wheel-rotor');
  var spinBtn = $('spin');
  var resultEl = $('result');
  var msg = $('items-msg');
  var historyEl = $('history');
  var removeWinner = $('remove-winner');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = [];
  var rotation = 0;
  var spinning = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parse(text) {
    return text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function save() {
    try { localStorage.setItem(KEY, input.value); } catch (e) { /* 저장 불가(사생활 보호 모드 등) — 무시 */ }
  }
  /**
   * el 의 CSS 애니메이션이 끝나면 done 을 한 번 부릅니다. 회전 시간은 style.css 에만 있고 여기엔 숫자가 없습니다.
   * animationend 가 오지 않는 경우(CSS 를 못 불러옴 등) 버튼이 영원히 잠기지 않도록, CSS 에 적힌 시간이 지나면 마무리합니다.
   * (ladder.js 에도 같은 함수가 있습니다)
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

  function load() {
    var shared = new URLSearchParams(location.search).get('items');
    if (shared) return shared;
    try { var saved = localStorage.getItem(KEY); if (saved) return saved; } catch (e) { /* 무시 */ }
    return EXAMPLE.join('\n');
  }

  /** 항목대로 원판을 다시 그립니다. 회전 각도(rotation)는 그대로 둡니다. */
  function draw() {
    items = parse(input.value);
    var n = items.length;

    if (n < 2) msg.textContent = '항목을 2개 이상 적어 주세요.';
    else if (n > MAX) msg.textContent = '항목은 ' + MAX + '개까지 넣을 수 있어요. 지금 ' + n + '개입니다.';
    else msg.textContent = '';
    spinBtn.disabled = spinning || n < 2 || n > MAX;

    var shown = Math.min(n, MAX);
    if (shown < 1) { rotor.innerHTML = ''; return; }

    var seg = 360 / shown;
    var fontSize = Math.max(6, Math.min(13, 110 / shown));
    var maxChars = shown <= 8 ? 8 : 5;
    var html = '';

    for (var i = 0; i < shown; i++) {
      // 첫 칸이 12시 방향에서 시작해 시계 방향으로 이어집니다
      var a0 = (i * seg - 90) * Math.PI / 180;
      var a1 = ((i + 1) * seg - 90) * Math.PI / 180;
      var d = shown === 1
        ? 'M0,-100 A100,100 0 1 1 0,100 A100,100 0 1 1 0,-100 Z'
        : 'M0,0 L' + (100 * Math.cos(a0)).toFixed(2) + ',' + (100 * Math.sin(a0)).toFixed(2) +
          ' A100,100 0 ' + (seg > 180 ? 1 : 0) + ' 1 ' +
          (100 * Math.cos(a1)).toFixed(2) + ',' + (100 * Math.sin(a1)).toFixed(2) + ' Z';

      // 마지막 칸이 첫 칸과 같은 색이면(칸 수 7·13·19·25) 이웃끼리 같은 색이 되므로,
      // 첫 칸(1)과도 바로 앞 칸(6)과도 다른 2번 색으로 바꿉니다
      var tone = i % TONES + 1;
      if (i === shown - 1 && i > 0 && i % TONES === 0) tone = 2;

      var mid = (i + 0.5) * seg - 90;
      var flip = mid > 90 && mid < 270 ? ' rotate(180)' : ''; // 왼쪽 절반 글자가 뒤집히지 않게
      var label = items[i].length > maxChars ? items[i].slice(0, maxChars) + '…' : items[i];

      html += '<path class="seg seg--' + tone + '" d="' + d + '"/>' +
        '<text class="ink--' + tone + '" transform="rotate(' + mid.toFixed(2) + ') translate(60,0)' + flip + '" font-size="' + fontSize.toFixed(1) +
        '" text-anchor="middle" dominant-baseline="central">' + esc(label) + '</text>';
    }
    rotor.innerHTML = html;
  }

  function spin() {
    if (spinning || items.length < 2 || items.length > MAX) return;
    var n = items.length;
    var seg = 360 / n;

    // 결과는 여기서 정해집니다. 아래 회전은 이 칸을 화살표 아래로 데려오는 연출입니다.
    var win = R.randInt(n);
    // 칸 안 어디쯤 멈출지도 보기 좋게 흔들어 줍니다 (칸 폭의 ±35%, 결과와 무관)
    var jitter = (R.randInt(1001) / 1000 - 0.5) * seg * 0.7;
    var target = -(win + 0.5) * seg + jitter;               // 이 각도에 있으면 win 칸이 12시에 옴
    var delta = (((target - rotation) % 360) + 360) % 360;
    var from = rotation;
    rotation += 360 * 5 + delta; // 최종 각도. 연출이 어떻게 흔들리든 마지막엔 반드시 여기서 멈춥니다

    spinning = true;
    spinBtn.disabled = true;
    input.disabled = true;
    resultEl.classList.remove('is-pop');
    resultEl.textContent = '돌아가는 중…'; // 최종 정지 전까지 결과·기록·안내는 내보내지 않습니다

    if (reduceMotion) {
      rotor.style.transform = 'rotate(' + rotation + 'deg)';
      finish(win);
      return;
    }

    // "멈출 듯 말 듯" 변형 고르기 (style.css 의 .spin-1~3). 보기용이라 결과용 난수(R)와 별개로 Math.random 을 씁니다.
    // A = 지나치거나 밀리는 폭. 칸 폭의 80%와 25° 중 작은 값이라, 멈추는 자리(칸 중심 ±35%)에 더해도
    // 가장 큰 1.25A 가 칸 폭 이하 → 바로 옆 칸까지만 가고 두 칸 너머로는 가지 않습니다.
    var A = Math.min(seg * 0.8, 25);
    var F = rotation;
    var variant = Math.floor(Math.random() * 3) + 1;
    var keys = variant === 1 ? [from, F + A, F]                      // 지나쳤다 돌아오기
      : variant === 2 ? [from, F - A, F - 1.25 * A, F]               // 멈칫 → 뒤로 밀림 → 넘어감
      : [from, F + 0.8 * A, F - 0.5 * A, F];                         // 오락가락
    keys.forEach(function (a, i) { rotor.style.setProperty('--a' + i, a + 'deg'); });
    rotor.removeAttribute('class');   // 같은 변형이 연달아 나와도 처음부터 재생되도록 떼었다가
    rotor.getBoundingClientRect();    // 화면을 한 번 계산시킨 뒤
    rotor.setAttribute('class', 'spin-' + variant); // 다시 붙입니다

    afterAnimation(rotor, function () {
      rotor.style.transform = 'rotate(' + F + 'deg)'; // 최종 각도를 먼저 고정해야
      rotor.removeAttribute('class');                  // 애니메이션을 뗄 때 튀지 않습니다
      finish(win);
    });
  }

  /** 원판이 완전히 멈춘 뒤 한 번만: 결과 글자 · 기록 · 뽑힌 항목 빼기 */
  function finish(win) {
    spinning = false;
    input.disabled = false;
    var picked = items[win];
    resultEl.textContent = '결과: ' + picked;
    resultEl.getBoundingClientRect(); // 움직임 줄이기 설정처럼 바로 이어 불릴 때도 톡 효과가 다시 재생되도록
    resultEl.classList.add('is-pop');
    var li = document.createElement('li');
    li.textContent = picked;
    historyEl.appendChild(li);

    if (removeWinner.checked) {
      var lines = parse(input.value);
      lines.splice(win, 1);
      input.value = lines.join('\n');
      changed();
    } else {
      draw();
    }
  }

  function share() {
    var url = location.origin + location.pathname + '?items=' + encodeURIComponent(input.value.trim());
    var done = function () { msg.textContent = '항목이 담긴 주소를 복사했어요.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('이 주소를 복사하세요', url); });
    else window.prompt('이 주소를 복사하세요', url);
  }

  /** 항목을 고쳤을 때 공통 처리. 공유 주소로 들어온 뒤라면, 새로고침 때 옛 주소 값이 덮어쓰지 않게 주소를 정리합니다 */
  function changed() {
    save();
    if (location.search) history.replaceState(null, '', location.pathname);
    draw();
  }

  input.value = load();
  draw();

  input.addEventListener('input', changed);
  spinBtn.addEventListener('click', spin);
  $('share').addEventListener('click', share);
  $('reset').addEventListener('click', function () {
    input.value = EXAMPLE.join('\n');
    historyEl.innerHTML = '';
    resultEl.textContent = '';
    resultEl.classList.remove('is-pop');
    changed();
  });
})();
