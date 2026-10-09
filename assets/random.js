/* ============================================================
   공정한 무작위 — 돌림판과 사다리가 결과를 정하는 유일한 곳.
   브라우저(전역 FairRandom)와 Node(테스트)에서 같은 코드를 씁니다.
   ============================================================ */
(function (root) {
  'use strict';

  /**
   * 0 이상 n 미만 정수.
   * Math.random 대신 암호학적 난수(crypto.getRandomValues)를 씁니다.
   * 32비트 값을 n으로 나눈 나머지를 그냥 쓰면 앞쪽 숫자가 아주 조금 더 자주 나오므로,
   * n의 배수 범위를 넘는 값은 버리고 다시 뽑습니다.
   */
  function randInt(n) {
    if (!(n >= 1 && n <= 0x100000000)) throw new RangeError('randInt: n 범위 오류');
    var limit = Math.floor(0x100000000 / n) * n;
    var buf = new Uint32Array(1);
    do { globalThis.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }

  /** 피셔-예이츠 셔플. 모든 순서가 정확히 같은 확률로 나옵니다. */
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * 결과를 먼저 정하고, 그 결과대로 내려가는 사다리를 만듭니다.
   * perm[i] = i번째 참가자가 도착할 칸.
   *
   * 버블 정렬로 참가자를 도착 칸 순서로 정렬하면서, 이웃한 두 칸을 바꿀 때마다
   * 그 두 세로줄 사이에 가로줄 하나를 긋습니다. 같은 세로줄을 건드리는 가로줄은
   * 정렬 순서를 지키도록 항상 더 아래 행에 놓습니다.
   */
  function buildLadder(perm) {
    var n = perm.length;
    var arr = [];                         // arr[칸] = 지금 그 칸에 있는 참가자
    var last = [];                        // 세로줄마다 마지막으로 놓인 가로줄의 행
    for (var i = 0; i < n; i++) { arr.push(i); last.push(-1); }
    var rungs = [];                       // { row, col } — col 과 col+1 을 잇는 가로줄

    var swapped = true;
    while (swapped) {
      swapped = false;
      for (var c = 0; c < n - 1; c++) {
        if (perm[arr[c]] > perm[arr[c + 1]]) {
          var t = arr[c]; arr[c] = arr[c + 1]; arr[c + 1] = t;
          var row = Math.max(last[c], last[c + 1]) + 1;
          last[c] = last[c + 1] = row;
          rungs.push({ row: row, col: c });
          swapped = true;
        }
      }
    }

    var rows = 0;
    rungs.forEach(function (r) { rows = Math.max(rows, r.row + 1); });

    // 결과가 거의 안 섞인 판은 가로줄이 몇 개 없어 고장 난 사다리처럼 보입니다.
    // 같은 자리에 연달아 두 줄을 그으면 건너갔다 바로 돌아오므로 결과는 그대로입니다.
    // ponytail: 장식용 쌍은 맨 아래에 붙임. 사다리가 길어 보이면 빈 행 사이에 끼워 넣도록 바꿀 것
    while (rungs.length < n - 1) {
      var col = randInt(n - 1);
      rungs.push({ row: rows, col: col }, { row: rows + 1, col: col });
      rows += 2;
    }

    return { n: n, rows: rows, rungs: rungs };
  }

  /**
   * start 칸에서 내려갔을 때의 도착 칸과 지나간 꼭짓점.
   * path 의 각 점은 [칸, 행]. 행 -1 은 맨 위, rows 는 맨 아래입니다.
   */
  function trace(ladder, start) {
    var at = {};
    ladder.rungs.forEach(function (r) { at[r.row + ':' + r.col] = true; });
    var c = start;
    var path = [[c, -1]];
    for (var row = 0; row < ladder.rows; row++) {
      if (at[row + ':' + (c - 1)]) { path.push([c, row], [c - 1, row]); c--; }
      else if (at[row + ':' + c]) { path.push([c, row], [c + 1, row]); c++; }
    }
    path.push([c, ladder.rows]);
    return { end: c, path: path };
  }

  var api = { randInt: randInt, shuffle: shuffle, buildLadder: buildLadder, trace: trace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FairRandom = api;
})(this);
