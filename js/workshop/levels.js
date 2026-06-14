/* ============================================================
   KARAKURI — Workshop curriculum
   Each level is a puzzle whose mechanics ARE a CS concept.
   build(sim) pre-places locked parts; palette lists what the
   player may place; goal.check(collected, sim) decides victory.
   ============================================================ */
import { Sim, DIR, Op, Pred, makeSource, makeSink, makeBelt } from './engine.js';

const sortedEq = (a, b) => {
  if (a.length !== b.length) return false;
  const x = [...a].sort((m, n) => m - n), y = [...b].sort((m, n) => m - n);
  return x.every((v, i) => v === y[i]);
};
const allPass = (arr, fn) => arr.length > 0 && arr.every(fn);

/* palette tool descriptors understood by the UI */
const T = {
  belt: (count = Infinity) => ({ id: 'belt', kind: 'belt', label: 'ベルト', sub: 'はこぶ', count }),
  op: (op, count = 1) => ({ id: 'op:' + op.type + op.n, kind: 'op', op, label: op.glyph, sub: op.label, count }),
  filter: (pred, count = 1) => ({ id: 'filter:' + pred.type + (pred.n ?? ''), kind: 'filter', pred, label: pred.glyph, sub: pred.label, count }),
  splitter: (count = 1) => ({ id: 'splitter', kind: 'splitter', label: '分配', sub: '交互に振り分け', count }),
};

export const LEVELS = [
  /* ---------- 01 ---------- */
  {
    id: 1, title: '一本のベルト', jp: 'はじまりの線', concept: 'データフロー',
    brief: '源（みなもと）から流れ出る数を、ベルトでつないで溜（たまり）まで運ぼう。',
    idea: 'プログラムとは「データが流れる道」。まずはその道を、自分の手で敷くことから。',
    rows: 5, cols: 8,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5], interval: 3, dir: DIR.E }); s.locked = true;
      sim.set(2, 1, s);
      const k = makeSink('A'); k.locked = true; sim.set(2, 6, k);
    },
    palette: [T.belt()],
    goal: {
      label: '溜に 5 個とどける',
      check: (col) => ({ win: col.length >= 5, detail: `${col.length} / 5 個` }),
    },
    hint: '源は右（→）に数を吐き出す。ベルトも右向きで一直線につなげば届く。クリックで置き、もう一度クリックで回転。',
  },

  /* ---------- 02 ---------- */
  {
    id: 2, title: '二倍の機械', jp: 'map・写像', concept: 'map（写像）',
    brief: '流れる数すべてを 2 倍にしてから溜へ。途中に「×2」の機械を置こう。',
    idea: '流れてくるもの全部に同じ処理をかける——これが map。ループを書かずに「全部に」を表す。',
    rows: 5, cols: 9,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5], interval: 3, dir: DIR.E }); s.locked = true;
      sim.set(2, 1, s);
      const k = makeSink('A'); k.locked = true; sim.set(2, 7, k);
    },
    palette: [T.belt(), T.op(Op.mul(2), 1)],
    goal: {
      label: 'すべて 2 倍にして集める → 2,4,6,8,10',
      check: (col) => ({ win: sortedEq(col, [2, 4, 6, 8, 10]), detail: `集めた: [${col.join(', ')}]` }),
    },
    hint: '機械もベルトと同じく流れの「上」に置く。源→（ベルト）→×2→（ベルト）→溜。',
  },

  /* ---------- 03 ---------- */
  {
    id: 3, title: '順番が命', jp: '関数合成', concept: '関数合成・順序',
    brief: '「2倍して、1足す」。二つの機械をどの順に並べる？ 目標は 3,5,7,9,11。',
    idea: 'f(g(x)) と g(f(x)) は違う。機械の並び順が、答えそのものを変える。これが合成。',
    rows: 6, cols: 9,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5], interval: 3, dir: DIR.E }); s.locked = true;
      sim.set(2, 1, s);
      const k = makeSink('A'); k.locked = true; sim.set(2, 7, k);
    },
    palette: [T.belt(), T.op(Op.mul(2), 1), T.op(Op.add(1), 1)],
    goal: {
      label: '×2 してから ＋1 → 3,5,7,9,11',
      check: (col) => ({ win: sortedEq(col, [3, 5, 7, 9, 11]), detail: `集めた: [${col.join(', ')}]` }),
    },
    hint: '先に ×2、あとで ＋1。逆に並べると 1 を足してから倍になり、答えがズレる。試して確かめよう。',
  },

  /* ---------- 04 ---------- */
  {
    id: 4, title: '選り分け', jp: 'filter・ふるい', concept: 'filter（選別）',
    brief: '1〜8 が流れてくる。偶数だけを溜に通そう。奇数は選別機がはじいて落とす。',
    idea: '条件で流れをしぼる——これが filter。通すものと落とすものを、ゲート一つで分ける。',
    rows: 6, cols: 9,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5, 6, 7, 8], interval: 3, dir: DIR.E }); s.locked = true;
      sim.set(2, 1, s);
      const k = makeSink('A'); k.locked = true; sim.set(2, 7, k);
    },
    palette: [T.belt(), T.filter(Pred.even(), 1)],
    goal: {
      label: '偶数だけ集める → 2,4,6,8',
      check: (col) => ({ win: sortedEq(col, [2, 4, 6, 8]) && allPass(col, v => v % 2 === 0), detail: `集めた: [${col.join(', ')}]` }),
    },
    hint: '選別機は「通った数」を前（→）へ、「はじいた数」を右（↓）へ出す。右に何も無ければ、はじかれた数は落ちて消える。',
  },

  /* ---------- 05 ---------- */
  {
    id: 5, title: '両どり', jp: '条件分岐', concept: '分岐（if/else）',
    brief: '偶数は上の溜 A へ、奇数は下の溜 B へ。選別機の「はじいた側」も、ベルトで拾って運ぼう。',
    idea: 'if は片方を選ぶだけじゃない。「真なら こちら、偽なら あちら」——両方の道を設計するのが分岐。',
    rows: 7, cols: 10,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5, 6], interval: 3, dir: DIR.E }); s.locked = true;
      sim.set(3, 1, s);
      const a = makeSink('A'); a.locked = true; sim.set(1, 8, a);
      const b = makeSink('B'); b.locked = true; sim.set(5, 8, b);
    },
    palette: [T.belt(), T.filter(Pred.even(), 1)],
    goal: {
      label: 'A に偶数 (2,4,6) ・ B に奇数 (1,3,5)',
      check: (col, sim) => {
        const A = sim.sinkById('A')?.collected || [];
        const B = sim.sinkById('B')?.collected || [];
        const win = sortedEq(A, [2, 4, 6]) && sortedEq(B, [1, 3, 5]);
        return { win, detail: `A:[${A.join(',')}]  B:[${B.join(',')}]` };
      },
    },
    hint: '選別機の前（→）が「通った側」、右（↓）が「はじいた側」。向きを工夫して、二つの出口を二つの溜へ導く。',
  },

  /* ---------- 06 ---------- */
  {
    id: 6, title: '分配', jp: '並行・スループット', concept: '並行処理・分配',
    brief: '速く流れる数を、分配機で二手に分けて、二つの溜へ均等に。一本の線では追いつかない。',
    idea: '仕事を複数のラインに散らせば、同じ時間でより多くさばける。これが並行処理の素朴な核心。',
    rows: 7, cols: 10,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5, 6, 7, 8], interval: 2, dir: DIR.E }); s.locked = true;
      sim.set(3, 1, s);
      const a = makeSink('A'); a.locked = true; sim.set(1, 8, a);
      const b = makeSink('B'); b.locked = true; sim.set(5, 8, b);
    },
    palette: [T.belt(), T.splitter(1)],
    goal: {
      label: '両方の溜に 3 個以上ずつ',
      check: (col, sim) => {
        const A = sim.sinkById('A')?.collected || [];
        const B = sim.sinkById('B')?.collected || [];
        return { win: A.length >= 3 && B.length >= 3, detail: `A:${A.length}個  B:${B.length}個` };
      },
    },
    hint: '分配機は届いた数を、前（→）と右（↓）へ交互に送る。二つの出口それぞれにベルトをつなぎ、別々の溜へ。',
  },

  /* ---------- 07 ---------- */
  {
    id: 7, title: '倍数のふるい', jp: '剰余・modulo', concept: '剰余（mod）',
    brief: '1〜12 のうち、3 の倍数だけを溜へ。割り算の「余り」が選別の鍵。',
    idea: '「3 で割った余りが 0」＝ 3 の倍数。剰余（mod）は、周期やパターンを見抜く道具になる。',
    rows: 6, cols: 11,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], interval: 2, dir: DIR.E }); s.locked = true;
      sim.set(2, 1, s);
      const k = makeSink('A'); k.locked = true; sim.set(2, 9, k);
    },
    palette: [T.belt(), T.filter(Pred.multiple(3), 1)],
    goal: {
      label: '3 の倍数だけ → 3,6,9,12',
      check: (col) => ({ win: sortedEq(col, [3, 6, 9, 12]), detail: `集めた: [${col.join(', ')}]` }),
    },
    hint: 'FizzBuzz の正体もこれ。mod を使えば「○個ごと」を判定できる。',
  },

  /* ---------- 08 ---------- */
  {
    id: 8, title: '仕上げ', jp: 'パイプライン', concept: 'filter → map の合成',
    brief: '1〜8 から偶数だけを選び、それを 2 倍して集める。目標は 4,8,12,16。',
    idea: '選別（filter）して、変換（map）する。小さな部品を順につなぐだけで、複雑な処理が組み上がる。これがプログラミングの設計そのもの。',
    rows: 7, cols: 11,
    build(sim) {
      const s = makeSource({ seq: [1, 2, 3, 4, 5, 6, 7, 8], interval: 3, dir: DIR.E }); s.locked = true;
      sim.set(3, 1, s);
      const k = makeSink('A'); k.locked = true; sim.set(3, 9, k);
    },
    palette: [T.belt(), T.filter(Pred.even(), 1), T.op(Op.mul(2), 1)],
    goal: {
      label: '偶数を 2 倍して集める → 4,8,12,16',
      check: (col) => ({ win: sortedEq(col, [4, 8, 12, 16]), detail: `集めた: [${col.join(', ')}]` }),
    },
    hint: '順番は自由だが最短は: 偶数で選別 → ×2 → 溜。奇数ははじいて落とす。',
  },
];

/** Build a fresh Sim for a level definition. */
export function buildSim(level) {
  const sim = new Sim(level.rows, level.cols);
  level.build(sim);
  return sim;
}
