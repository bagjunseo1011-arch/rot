#!/usr/bin/env node
/* 결과를 정하는 로직 검사.  실행: node test-random.js
   하나라도 틀리면 예외로 멈춥니다. 콘텐츠를 고친 뒤가 아니라 random.js 를 고친 뒤 돌리세요. */
'use strict';

const assert = require('assert');
const { randInt, shuffle, buildLadder, trace } = require('./assets/random');

// 1) 사다리는 정해 둔 결과 그대로 도착해야 한다 (2~20명, 판마다 다른 결과)
for (let n = 2; n <= 20; n++) {
  for (let k = 0; k < 300; k++) {
    const perm = shuffle([...Array(n).keys()]);
    const ladder = buildLadder(perm);
    for (let i = 0; i < n; i++) assert.strictEqual(trace(ladder, i).end, perm[i], `n=${n} 참가자 ${i}`);

    // 같은 행에서 세로줄 하나를 두 가로줄이 함께 쓰면 그릴 수 없는 사다리다
    const used = new Set();
    for (const r of ladder.rungs) {
      for (const col of [r.col, r.col + 1]) {
        const key = `${r.row}:${col}`;
        assert(!used.has(key), `n=${n} ${key} 겹침`);
        used.add(key);
      }
    }
    assert(ladder.rungs.length >= n - 1, `n=${n} 가로줄 부족`);
  }
}

// 2) 하나도 안 섞인 결과도 가로줄이 그려지고, 결과는 그대로여야 한다
const id = buildLadder([0, 1, 2, 3, 4]);
assert(id.rungs.length >= 4);
for (let i = 0; i < 5; i++) assert.strictEqual(trace(id, i).end, i);

// 3) randInt 는 고르게 나와야 한다 (7칸 × 1만 번, 칸마다 ±5% 안)
const counts = Array(7).fill(0);
for (let i = 0; i < 70000; i++) counts[randInt(7)]++;
counts.forEach((c, i) => assert(Math.abs(c - 10000) < 500, `randInt 편향: ${i}번 ${c}회`));

// 4) 셔플은 원소를 잃거나 복제하지 않는다
assert.deepStrictEqual(shuffle([1, 2, 3, 4]).sort(), [1, 2, 3, 4]);

console.log('통과 — 사다리 2~20명 × 300판, 무섞임 판, randInt 균등성, 셔플 보존');

/* ---- 참고: 가로줄을 무작위로 긋는 단순한 방식의 편향 (검사 아님, 콘텐츠 근거용) ----
   6명, 10행, 행마다 왼쪽부터 각 칸 사이에 50% 확률로 가로줄 (바로 왼쪽에 줄이 있으면 건너뜀) */
if (process.argv.includes('--naive')) {
  const N = 6, ROWS = 10, TRIALS = 200000;
  const same = Array(N).fill(0);
  const fromLeft = Array(N).fill(0);
  for (let t = 0; t < TRIALS; t++) {
    const rungs = [];
    for (let row = 0; row < ROWS; row++) {
      let prev = false;
      for (let col = 0; col < N - 1; col++) {
        const put = !prev && Math.random() < 0.5;
        if (put) rungs.push({ row, col });
        prev = put;
      }
    }
    const ladder = { n: N, rows: ROWS, rungs };
    for (let s = 0; s < N; s++) {
      const end = trace(ladder, s).end;
      if (end === s) same[s]++;
      if (s === 0) fromLeft[end]++;
    }
  }
  const pct = (x) => (x / TRIALS * 100).toFixed(1) + '%';
  console.log(`\n[단순 방식] ${N}명 ${ROWS}행, ${TRIALS}판 — 공정하면 모든 칸이 ${(100 / N).toFixed(1)}%`);
  console.log('  자기 바로 아래 칸에 도착할 확률:', same.map(pct).join(' / '));
  console.log('  맨 왼쪽에서 출발했을 때 도착 칸 분포:', fromLeft.map(pct).join(' / '));
}
