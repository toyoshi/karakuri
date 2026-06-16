/* ============================================================
   KARAKURI — the ladder of levels.
   Chapter 0 starts BELOW NAND (transistors, switch-level sim).
   From there it's NAND-as-primitive up the abstraction ladder.
   Solve a gate level → it becomes a chip you can reuse.
   ============================================================ */
import type { Bit } from '../sim/netlist';
import type { Instance, Circuit } from '../sim/circuit';
import { CELL } from './layout';

export interface PaletteItem {
  kind: 'nand' | 'high' | 'low' | 'chip' | 'nmos' | 'pmos' | 'dff';
  chipId?: string;
}

export interface IfacePin { name: string; y: number }

export interface Level {
  id: string;
  chapter: string; chapterEn: string;
  glyph: string;          // shown in the level nav
  navName: string;
  navNameEn?: string;
  title: string; titleEn: string;
  concept: string; conceptEn: string;
  goal: string; goalEn: string;
  idea: string; ideaEn: string;
  cols: number; rows: number;
  inputs: IfacePin[];
  outputs: IfacePin[];
  palette: PaletteItem[];
  substrate?: 'gate' | 'switch';
  sequential?: boolean;
  spec?: (inMap: Record<string, Bit>) => Record<string, Bit>;
  steps?: { in: Record<string, Bit>; expected: Record<string, Bit> }[];
  produces?: { id: string; name: string; nameEn?: string; glyph: string };
  par: number;            // reference cost (transistors for switch levels, NANDs for gate levels)
  sandbox?: boolean;      // free-build: no goal, full palette, fixed toggleable I/O
  demo?: boolean;         // wordless intro: pre-wired, just toggle inputs and watch it light
  derived?: boolean;      // side-quest: applies a part you built (doesn't unlock the main spine)
  prewired?: { instances: Instance[]; wires: { a: { inst: string; pin: string }; b: { inst: string; pin: string } }[] };
}

const COLS = 14, ROWS = 9;

export const LEVELS: Level[] = [
  /* ---------- Level 0 — wordless "touch it and watch it light" ---------- */
  {
    id: 'demo', chapter: 'はじめに', chapterEn: 'Start',
    glyph: '◐', navName: '体験', navNameEn: 'Try', demo: true,
    title: 'まず、触ってみる', titleEn: 'First — just touch it',
    concept: '信号で遊ぶ', conceptEn: 'play with signals',
    goal: '左のスイッチ A・B を押して、ランプ Y を光らせよう。線を電気（信号）が流れる。',
    goalEn: 'Press switches A and B on the left to light lamp Y — watch the signal flow along the wires.',
    idea: '回路は 0 と 1 だけで動く。スイッチ＝1、ランプが光れば＝1。組み立てるのは次から。まずは動かして感じよう。',
    ideaEn: 'Circuits run on just 0 and 1. A switch on = 1; a lit lamp = 1. You start building next level — for now, just feel it work.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [],
    par: 0,
    prewired: {
      instances: [
        { id: 'pg1', kind: 'nand', x: 6, y: 4 },
        { id: 'pg2', kind: 'nand', x: 9, y: 4 },
      ],
      wires: [
        { a: { inst: 'in_A', pin: 'y' }, b: { inst: 'pg1', pin: 'a' } },
        { a: { inst: 'in_B', pin: 'y' }, b: { inst: 'pg1', pin: 'b' } },
        { a: { inst: 'pg1', pin: 'y' }, b: { inst: 'pg2', pin: 'a' } },
        { a: { inst: 'pg1', pin: 'y' }, b: { inst: 'pg2', pin: 'b' } },
        { a: { inst: 'pg2', pin: 'y' }, b: { inst: 'out_Y', pin: 'x' } },
      ],
    },
  },

  /* ---------- Chapter 1 — gates from NAND (the transistor→NAND story is told in the intro modal) ---------- */
  {
    id: 'not', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '¬', navName: 'NOT',
    title: 'NOT — 反転', titleEn: 'NOT — Inverter',
    concept: 'NANDからNOTを作る', conceptEn: 'NOT from NAND',
    goal: 'NAND ひとつだけを使って、入力 X を反転して Y に出そう。（NANDがどう生まれたかは、上の「NANDの作り方」で。）',
    goalEn: 'Using only NAND, invert X into Y. (How NAND itself is built: see "How NAND is made" up top.)',
    idea: 'NANDの両入力に同じ信号を入れると、反転器になる。NANDが、これから全てを組み上げる原子だ。',
    ideaEn: 'Tie both NAND inputs together and it becomes an inverter. NAND is the atom you build everything from.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'X', y: 4 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }],
    spec: (m) => ({ Y: (m.X ? 0 : 1) as Bit }),
    produces: { id: 'NOT', name: 'NOT', glyph: '¬' },
    par: 1,
  },
  {
    id: 'and', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '∧', navName: 'AND',
    title: 'AND — 論理積', titleEn: 'AND',
    concept: '両方が1のとき1', conceptEn: 'true only when both are true',
    goal: 'A と B が両方 1 のときだけ Y を 1 に。さっき作った NOT が道具箱にある。',
    goalEn: 'Y is 1 only when A and B are both 1. Your NOT chip is in the toolbox now.',
    idea: 'NAND を反転すれば AND。自分で作った NOT を黒箱として置けることに注目——これが「抽象化」。',
    ideaEn: 'AND is a NAND, inverted. Notice you can drop in the NOT you built — that is abstraction.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }],
    spec: (m) => ({ Y: (m.A && m.B ? 1 : 0) as Bit }),
    produces: { id: 'AND', name: 'AND', glyph: '∧' },
    par: 2,
  },
  {
    id: 'or', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '∨', navName: 'OR',
    title: 'OR — 論理和', titleEn: 'OR',
    concept: 'どちらかが1なら1', conceptEn: 'true when either is true',
    goal: 'A か B のどちらかが 1 なら Y を 1 に。',
    goalEn: 'Y is 1 when A or B (or both) is 1.',
    idea: 'ド・モルガンの法則：A∨B = ¬(¬A ∧ ¬B)。否定で挟めば OR になる。法則が回路になる瞬間。',
    ideaEn: "De Morgan's law made physical: A∨B = ¬(¬A ∧ ¬B).",
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }, { kind: 'chip', chipId: 'AND' }],
    spec: (m) => ({ Y: (m.A || m.B ? 1 : 0) as Bit }),
    produces: { id: 'OR', name: 'OR', glyph: '∨' },
    par: 3,
  },
  {
    id: 'xor', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '⊕', navName: 'XOR',
    title: 'XOR — 排他的論理和', titleEn: 'XOR',
    concept: '違うときだけ1', conceptEn: 'true only when they differ',
    goal: 'A と B が異なるときだけ Y を 1 に。加算器の心臓部になるゲート。',
    goalEn: 'Y is 1 only when A and B differ — the heart of the adder.',
    idea: 'XOR は「違いの検出器」。半加算器の和の桁は、まさにこれ。次は数を足す回路へ。',
    ideaEn: 'XOR detects difference — exactly the sum bit of a half-adder. Next: circuits that add.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }, { kind: 'chip', chipId: 'AND' }, { kind: 'chip', chipId: 'OR' }],
    spec: (m) => ({ Y: ((m.A ? 1 : 0) ^ (m.B ? 1 : 0)) as Bit }),
    produces: { id: 'XOR', name: 'XOR', glyph: '⊕' },
    par: 4,
  },
  {
    id: 'nor', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '⊽', navName: 'NOR',
    title: 'NOR — OR の反対', titleEn: 'NOR — the opposite of OR',
    concept: 'どちらも0のときだけ1', conceptEn: 'true only when both are 0',
    goal: 'A も B も 0 のときだけ Y を 1 に（OR の反転）。作った部品を組み合わせれば一瞬。',
    goalEn: 'Y is 1 only when both A and B are 0 (OR, inverted). Quick if you reuse your chips.',
    idea: 'OR して NOT するだけ。小さな部品が増えるほど、新しいゲートは「組み合わせ」で一瞬で出来る。これが部品化の力。',
    ideaEn: 'Just OR then NOT. The more chips you have, the faster new gates fall out of combination — the power of encapsulation.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }, { kind: 'chip', chipId: 'OR' }],
    spec: (m) => ({ Y: (m.A || m.B ? 0 : 1) as Bit }),
    produces: { id: 'NOR', name: 'NOR', glyph: '⊽' },
    par: 4,
  },
  {
    id: 'xnor', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '⊙', navName: 'XNOR',
    title: 'XNOR — 同じなら1', titleEn: 'XNOR — equal detector',
    concept: '同じときだけ1（一致）', conceptEn: 'true when they are equal',
    goal: 'A と B が同じ値のときだけ Y を 1 に（XOR の反転）。「等しいか？」を判定する回路。',
    goalEn: 'Y is 1 only when A and B are equal (XOR, inverted). An "are these the same?" detector.',
    idea: 'XOR は「違うとき1」。反転すれば「同じとき1」＝一致検出器。比較器（コンピュータが等しさを判定する部品）の芯になる。',
    ideaEn: 'XOR is "differ"; invert it for "equal" — an equality detector, the core of a comparator.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }, { kind: 'chip', chipId: 'XOR' }],
    spec: (m) => ({ Y: ((m.A ? 1 : 0) === (m.B ? 1 : 0) ? 1 : 0) as Bit }),
    produces: { id: 'XNOR', name: 'XNOR', glyph: '⊙' },
    par: 5,
  },
  /* ---- derived side-quest: many equal-detectors make a comparator ---- */
  {
    id: 'eq4', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '=4', navName: '4bit一致', navNameEn: '4-bit equal', derived: true,
    title: '4ビット一致比較器', titleEn: '4-bit equality',
    concept: '一桁ずつ比べて束ねる', conceptEn: 'compare each bit, then AND',
    goal: '2つの4ビットの数 A（a0〜a3）と B（b0〜b3）が完全に等しいときだけ eq を 1 に。各桁を XNOR で比べ、その結果を全部 AND でまとめよう。',
    goalEn: 'Output eq = 1 only when two 4-bit numbers A (a0–a3) and B (b0–b3) are identical. Compare each bit with XNOR, then AND all the results together.',
    idea: '「等しい」とは「どの桁も一致」。一致検出器(XNOR)を桁ごとに置き、AND で「全部そろったか」を見る。これがコンピュータの比較・分岐の芯。先には進まないが、君の XNOR が“判断”に化ける。',
    ideaEn: 'Equal means "every bit matches": one XNOR per bit, all AND-ed. This is the core of how a computer compares and branches. A side-quest, but your XNOR becomes a decision.',
    cols: 18, rows: 12,
    inputs: [{ name: 'a0', y: 1 }, { name: 'a1', y: 2 }, { name: 'a2', y: 3 }, { name: 'a3', y: 4 }, { name: 'b0', y: 6 }, { name: 'b1', y: 7 }, { name: 'b2', y: 8 }, { name: 'b3', y: 9 }],
    outputs: [{ name: 'eq', y: 5 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'XNOR' }, { kind: 'chip', chipId: 'AND' }],
    spec: (m) => ({ eq: ((m.a0 ? 1 : 0) === (m.b0 ? 1 : 0) && (m.a1 ? 1 : 0) === (m.b1 ? 1 : 0) && (m.a2 ? 1 : 0) === (m.b2 ? 1 : 0) && (m.a3 ? 1 : 0) === (m.b3 ? 1 : 0) ? 1 : 0) as Bit }),
    par: 35,
  },

  /* ---------- Chapter 2 — arithmetic ---------- */
  {
    id: 'hadd', chapter: '算術', chapterEn: 'Arithmetic',
    glyph: '½+', navName: '半加算', navNameEn: 'Half',
    title: '半加算器', titleEn: 'Half adder',
    concept: '1ビットの足し算', conceptEn: '1-bit addition',
    goal: '1ビット同士を足す。和 S と、繰り上がり C を出す。1+1 は「桁が上がって 10」——2進数の足し算の最小単位。',
    goalEn: 'Add two bits. Output the sum S and the carry C. 1+1 carries — the atom of binary addition.',
    idea: '和は「違うときだけ1」＝XOR、繰り上がりは「両方1のとき1」＝AND。足し算は、君が作ったゲートの組み合わせだった。',
    ideaEn: 'Sum = XOR (differ), carry = AND (both). Addition is just the gates you already built.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'S', y: 3 }, { name: 'C', y: 6 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'XOR' }, { kind: 'chip', chipId: 'AND' }],
    spec: (m) => ({ S: ((m.A ? 1 : 0) ^ (m.B ? 1 : 0)) as Bit, C: (m.A && m.B ? 1 : 0) as Bit }),
    produces: { id: 'HADD', name: '半加算', nameEn: 'Half-add', glyph: '½+' },
    par: 6,
  },
  {
    id: 'fadd', chapter: '算術', chapterEn: 'Arithmetic',
    glyph: 'Σ', navName: '全加算', navNameEn: 'Full',
    title: '全加算器', titleEn: 'Full adder',
    concept: '繰り上がりも足す', conceptEn: 'add the carry too',
    goal: '下の桁からの繰り上がり Cin も含めて 3 入力を足す。和 S と繰り上がり Cout を出す。これを並べれば、何ビットでも足せる。',
    goalEn: 'Add three bits including the incoming carry Cin. Chain these and you can add any width.',
    idea: '半加算器を2つ重ね、繰り上がりを OR でまとめる。自分で作った半加算器を部品として使う——抽象の階段を一段上がる。',
    ideaEn: 'Two half-adders stacked, carries OR-ed together. Reuse your half-adder as a part — one more rung up.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 2 }, { name: 'B', y: 4 }, { name: 'Cin', y: 6 }],
    outputs: [{ name: 'S', y: 3 }, { name: 'Cout', y: 5 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'HADD' }, { kind: 'chip', chipId: 'OR' }, { kind: 'chip', chipId: 'XOR' }, { kind: 'chip', chipId: 'AND' }],
    spec: (m) => { const s = (m.A ? 1 : 0) + (m.B ? 1 : 0) + (m.Cin ? 1 : 0); return { S: (s & 1) as Bit, Cout: (s >= 2 ? 1 : 0) as Bit }; },
    produces: { id: 'FADD', name: '全加算', nameEn: 'Full-add', glyph: 'Σ' },
    par: 14,
  },
  /* ---- derived side-quest: chain full adders into a real multi-bit adder ---- */
  {
    id: 'add4', chapter: '算術', chapterEn: 'Arithmetic',
    glyph: '4+', navName: '4bit加算', navNameEn: '4-bit add', derived: true,
    title: '4ビット加算器', titleEn: '4-bit adder',
    concept: '全加算器を4つ連ねる', conceptEn: 'chain four full adders',
    goal: '作った全加算器を4つ並べ、4ビットの数 A（a0〜a3）と B（b0〜b3）を足す。各桁の繰り上がりを次の桁の Cin へ送る（リップルキャリー）。和 s0〜s3 と最上位の繰り上がり c を出そう。',
    goalEn: 'Place four of your full adders to add two 4-bit numbers A (a0–a3) and B (b0–b3). Feed each carry into the next bit (ripple carry). Output the sum s0–s3 and the final carry c.',
    idea: '1ビットの全加算器が、そのまま「桁」になる。繰り上がりを鎖のように next の Cin へ渡すだけで、何ビットの足し算も作れる——これが本物の足し算回路だ。この課題は先に進まないが、君の部品が“数”を扱えることが分かる。',
    ideaEn: 'A 1-bit full adder simply becomes a digit. Pass each carry along the chain and you can add any width — this is a real arithmetic unit. A side-quest that goes nowhere, but it shows your parts can handle numbers.',
    cols: 20, rows: 12,
    inputs: [{ name: 'a0', y: 1 }, { name: 'a1', y: 2 }, { name: 'a2', y: 3 }, { name: 'a3', y: 4 }, { name: 'b0', y: 6 }, { name: 'b1', y: 7 }, { name: 'b2', y: 8 }, { name: 'b3', y: 9 }],
    outputs: [{ name: 's0', y: 1 }, { name: 's1', y: 3 }, { name: 's2', y: 5 }, { name: 's3', y: 7 }, { name: 'c', y: 9 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'FADD' }, { kind: 'chip', chipId: 'HADD' }, { kind: 'low' }],
    spec: (m) => {
      const A = (m.a0 ? 1 : 0) + (m.a1 ? 2 : 0) + (m.a2 ? 4 : 0) + (m.a3 ? 8 : 0);
      const B = (m.b0 ? 1 : 0) + (m.b1 ? 2 : 0) + (m.b2 ? 4 : 0) + (m.b3 ? 8 : 0);
      const s = A + B;
      return { s0: (s & 1) as Bit, s1: ((s >> 1) & 1) as Bit, s2: ((s >> 2) & 1) as Bit, s3: ((s >> 3) & 1) as Bit, c: ((s >> 4) & 1) as Bit };
    },
    par: 56,
  },

  /* ---------- Chapter 3 — memory (feedback!) ---------- */
  {
    id: 'srlatch', chapter: '記憶', chapterEn: 'Memory',
    glyph: '⊐', navName: 'SRラッチ', navNameEn: 'SR latch', sequential: true,
    title: 'SRラッチ — 1ビットの記憶', titleEn: 'SR latch — one bit of memory',
    concept: 'フィードバック＝記憶', conceptEn: 'feedback = memory',
    goal: '出力を入力に戻す（フィードバック）と、回路は値を「覚える」。NAND 2個を互いに繋ぎ、S=0でセット・R=0でリセット・両方1で保持。手順どおり Q が変わり、そして保たれるように。',
    goalEn: 'Loop an output back to an input and the circuit remembers. Cross-couple 2 NANDs: S=0 sets, R=0 resets, both-1 holds. (S/R are active-low.)',
    idea: 'ここまでは入力だけで出力が決まる「組み合わせ回路」。出力を戻した瞬間、回路は“いま何時か”ならぬ“さっき何だったか”を持つ。記憶＝時間を持つ回路。CPUのレジスタも、この子孫だ。',
    ideaEn: 'Until now, outputs depended only on inputs. The moment you feed an output back, the circuit gains a past — it remembers. Memory is a circuit with time. A CPU register is this, grown up.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'S', y: 3 }, { name: 'R', y: 5 }],
    outputs: [{ name: 'Q', y: 4 }],
    palette: [{ kind: 'nand' }],
    steps: [
      { in: { S: 0, R: 1 }, expected: { Q: 1 } },
      { in: { S: 1, R: 1 }, expected: { Q: 1 } },
      { in: { S: 1, R: 0 }, expected: { Q: 0 } },
      { in: { S: 1, R: 1 }, expected: { Q: 0 } },
      { in: { S: 0, R: 1 }, expected: { Q: 1 } },
    ],
    produces: { id: 'SR', name: 'SRラッチ', nameEn: 'SR latch', glyph: '⊐' },
    par: 2,
  },
  {
    id: 'dlatch', chapter: '記憶', chapterEn: 'Memory',
    glyph: 'D', navName: 'Dラッチ', navNameEn: 'D latch', sequential: true,
    title: 'Dラッチ — 書き込み制御', titleEn: 'D latch — gated write',
    concept: '「いつ覚えるか」を制御', conceptEn: 'control when to store',
    goal: 'E（書き込み許可）が1のとき、Q は D に従う。E が0なら、D が何であっても Q は前の値を保持する。「いつ記憶するか」を制御できる記憶。',
    goalEn: 'When E (enable) is 1, Q follows D. When E is 0, Q holds its value regardless of D. Memory you control the timing of.',
    idea: '生のSRラッチに「書き込み窓」を付けたもの。Eで門を開けた時だけ中身が入れ替わる。これがレジスタの一歩手前。',
    ideaEn: 'A raw latch with a write window: contents change only while E opens the gate. One step short of a register.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'D', y: 3 }, { name: 'E', y: 5 }],
    outputs: [{ name: 'Q', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }],
    steps: [
      { in: { D: 1, E: 1 }, expected: { Q: 1 } },
      { in: { D: 0, E: 0 }, expected: { Q: 1 } },
      { in: { D: 0, E: 1 }, expected: { Q: 0 } },
      { in: { D: 1, E: 0 }, expected: { Q: 0 } },
      { in: { D: 1, E: 1 }, expected: { Q: 1 } },
    ],
    produces: { id: 'DLATCH', name: 'Dラッチ', nameEn: 'D latch', glyph: 'D' },
    par: 5,
  },

  /* ---------- Chapter 4 — registers ---------- */
  {
    id: 'mux', chapter: 'レジスタ', chapterEn: 'Registers',
    glyph: '⑂', navName: 'セレクタ', navNameEn: 'MUX',
    title: 'マルチプレクサ（選択器）', titleEn: 'Multiplexer (selector)',
    concept: '信号でデータを選ぶ', conceptEn: 'pick data with a control signal',
    goal: '選択線 S で出力を切り替える。S=0 なら Y=A、S=1 なら Y=B。「どちらを通すか」をスイッチできる、回路の交差点。',
    goalEn: 'A selector: when S=0, Y=A; when S=1, Y=B. The crossroads of a circuit — choose which input flows through.',
    idea: 'Y =（A かつ S でない）または（B かつ S）。たった3入力の選択器が、レジスタやCPUのデータ経路の心臓になる。',
    ideaEn: 'Y = (A and not-S) or (B and S). This tiny chooser becomes the heart of registers and a CPU datapath.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 2 }, { name: 'B', y: 4 }, { name: 'S', y: 6 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }, { kind: 'chip', chipId: 'AND' }, { kind: 'chip', chipId: 'OR' }],
    spec: (m) => ({ Y: ((m.S ? m.B : m.A) ? 1 : 0) as Bit }),
    produces: { id: 'MUX', name: 'セレクタ', nameEn: 'MUX', glyph: '⑂' },
    par: 9,
  },
  {
    id: 'register', chapter: 'レジスタ', chapterEn: 'Registers',
    glyph: '▭', navName: 'レジスタ', navNameEn: 'Register', sequential: true,
    title: '1ビットレジスタ', titleEn: '1-bit register',
    concept: '「読める・書ける」記憶', conceptEn: 'memory you can read and write',
    goal: '新しい部品 DFF（クロックの立ち上がりで D を記憶）が道具箱に。load=1 のとき clk の立ち上がりで in を記憶し、load=0 なら値を保持する 1 ビットレジスタを作ろう。セレクタ(MUX)で「新しい値か、今の値か」を選ぶのがコツ。',
    goalEn: 'A new part — DFF (stores D on the clock edge) — is in your toolbox. Build a 1-bit register: on a clk rising edge it stores in when load=1, and holds otherwise. Trick: use a MUX to choose "new value vs. current value".',
    idea: 'DFFの入力に「load なら in、さもなくば自分の出力 Q」を MUX で選んで戻す。これが CPU のレジスタそのもの。記憶に「読み書き」が付いた瞬間だ。',
    ideaEn: "Feed the DFF either in (if load) or its own Q (else) via a MUX. That's exactly a CPU register — memory you can read and write.",
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'in', y: 2 }, { name: 'load', y: 4 }, { name: 'clk', y: 6 }],
    outputs: [{ name: 'Q', y: 4 }],
    palette: [{ kind: 'dff' }, { kind: 'chip', chipId: 'MUX' }, { kind: 'nand' }],
    steps: [
      { in: { in: 1, load: 1, clk: 0 }, expected: { Q: 0 } },
      { in: { in: 1, load: 1, clk: 1 }, expected: { Q: 1 } }, // load 1 on edge → store in=1
      { in: { in: 0, load: 0, clk: 0 }, expected: { Q: 1 } },
      { in: { in: 0, load: 0, clk: 1 }, expected: { Q: 1 } }, // load 0 → hold
      { in: { in: 0, load: 1, clk: 0 }, expected: { Q: 1 } },
      { in: { in: 0, load: 1, clk: 1 }, expected: { Q: 0 } }, // load 1 on edge → store in=0
      { in: { in: 1, load: 0, clk: 0 }, expected: { Q: 0 } },
      { in: { in: 1, load: 0, clk: 1 }, expected: { Q: 0 } }, // hold
    ],
    produces: { id: 'REG', name: 'レジスタ', nameEn: 'Register', glyph: '▭' },
    par: 9,
  },

  /* ---------- Chapter 5 — ALU ---------- */
  {
    id: 'alu', chapter: '演算装置', chapterEn: 'ALU',
    glyph: '⊞', navName: 'ALU',
    title: 'ALU — 演算をえらぶ', titleEn: 'ALU — choose the operation',
    concept: '制御ビットで演算を選ぶ', conceptEn: 'control bits pick the operation',
    goal: 'CPUの計算核。2本の制御線 (op1,op0) で、a と b に施す演算を切り替える。00=AND, 01=OR, 10=XOR(=和), 11=NAND を、結果 y に出そう。',
    goalEn: 'A CPU\'s compute core. Two control lines (op1,op0) pick the operation on a and b: 00=AND, 01=OR, 10=XOR(sum), 11=NAND → y.',
    idea: '演算装置の正体は「いくつかの結果を全部計算しておき、制御ビットでセレクタが1つ選ぶ」。XOR は足し算の和の桁そのもの。これに記憶(レジスタ)とプログラムカウンタを足せば、CPUになる。',
    ideaEn: 'An ALU computes several results, then a selector picks one by the control bits. XOR is the sum bit of addition. Add registers and a program counter, and this becomes a CPU.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'a', y: 2 }, { name: 'b', y: 3 }, { name: 'op0', y: 5 }, { name: 'op1', y: 6 }],
    outputs: [{ name: 'y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'MUX' }, { kind: 'chip', chipId: 'AND' }, { kind: 'chip', chipId: 'OR' }, { kind: 'chip', chipId: 'XOR' }],
    spec: (m) => {
      const a = m.a ? 1 : 0, b = m.b ? 1 : 0, sel = (m.op1 ? 2 : 0) + (m.op0 ? 1 : 0);
      const r = [a & b, a | b, a ^ b, (a & b) ? 0 : 1][sel];
      return { y: r as Bit };
    },
    produces: { id: 'ALU', name: 'ALU', nameEn: 'ALU', glyph: '⊞' },
    par: 34,
  },
  /* ---- multi-bit + arithmetic: a real 4-bit ALU that can ADD ---- */
  {
    id: 'alu4', chapter: '演算装置', chapterEn: 'ALU',
    glyph: '⊞4', navName: '4bit ALU', navNameEn: '4-bit ALU',
    title: '4ビットALU — 加算もできる演算装置', titleEn: '4-bit ALU — now it can add',
    concept: '多ビット化＋算術', conceptEn: 'go multi-bit, add arithmetic',
    goal: '4ビットの a（a0〜a3）と b（b0〜b3）に対し、op で演算を選ぶ：00=加算(a+b), 01=AND, 10=OR, 11=XOR。結果を y0〜y3 に、加算の桁あふれを cout に出そう。論理は桁ごと、加算は全加算器の連鎖だ。',
    goalEn: 'On 4-bit a (a0–a3) and b (b0–b3), op selects: 00=add (a+b), 01=AND, 10=OR, 11=XOR. Put the result in y0–y3 and the add overflow in cout. Logic is per-bit; addition is a chain of full adders.',
    idea: '1ビットのALUの考え方を4本に束ね、加算だけは全加算器を鎖につなぐ。論理しか無かった演算装置が、ついに“数”を計算する。これが電卓の中身だ。',
    ideaEn: 'Bundle the 1-bit ALU idea across four bits, and chain full adders for the add path. The logic-only ALU can finally compute numbers — the guts of a calculator.',
    cols: 26, rows: 14,
    inputs: [{ name: 'a0', y: 1 }, { name: 'a1', y: 2 }, { name: 'a2', y: 3 }, { name: 'a3', y: 4 }, { name: 'b0', y: 6 }, { name: 'b1', y: 7 }, { name: 'b2', y: 8 }, { name: 'b3', y: 9 }, { name: 'op0', y: 11 }, { name: 'op1', y: 12 }],
    outputs: [{ name: 'y0', y: 2 }, { name: 'y1', y: 4 }, { name: 'y2', y: 6 }, { name: 'y3', y: 8 }, { name: 'cout', y: 11 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'FADD' }, { kind: 'chip', chipId: 'HADD' }, { kind: 'chip', chipId: 'AND' }, { kind: 'chip', chipId: 'OR' }, { kind: 'chip', chipId: 'XOR' }, { kind: 'chip', chipId: 'MUX' }, { kind: 'low' }],
    spec: (m) => {
      const A = (m.a0 ? 1 : 0) + (m.a1 ? 2 : 0) + (m.a2 ? 4 : 0) + (m.a3 ? 8 : 0);
      const B = (m.b0 ? 1 : 0) + (m.b1 ? 2 : 0) + (m.b2 ? 4 : 0) + (m.b3 ? 8 : 0);
      const sel = (m.op1 ? 2 : 0) + (m.op0 ? 1 : 0);
      let y = 0, cout = 0;
      if (sel === 0) { const s = A + B; y = s & 15; cout = (s >> 4) & 1; }
      else if (sel === 1) y = A & B;
      else if (sel === 2) y = A | B;
      else y = A ^ B;
      return { y0: (y & 1) as Bit, y1: ((y >> 1) & 1) as Bit, y2: ((y >> 2) & 1) as Bit, y3: ((y >> 3) & 1) as Bit, cout: cout as Bit };
    },
    produces: { id: 'ALU4', name: '4bit ALU', nameEn: '4-bit ALU', glyph: '⊞4' },
    par: 180,
  },

  /* ---------- Chapter 6 — counting / time ---------- */
  {
    id: 'counter', chapter: 'プログラムカウンタ', chapterEn: 'Program counter',
    glyph: '↻', navName: 'カウンタ', navNameEn: 'Counter', sequential: true,
    title: '1ビットカウンタ', titleEn: '1-bit counter',
    concept: '時間を刻む', conceptEn: 'keep time',
    goal: 'en=1 のあいだ、クロックの立ち上がりごとに Q が反転する（0→1→0→1…）。en=0 なら止まって保持。DFF と XOR で作ろう。',
    goalEn: 'While en=1, Q flips on every clock rising edge (0→1→0…). While en=0 it holds. Build it from a DFF and an XOR.',
    idea: '数えることは、時間を刻むこと。DFF の入力に「いまの自分 XOR en」を戻すと、en の間だけ反転し続ける。これを多ビットに束ねれば、プログラムを1命令ずつ進める「プログラムカウンタ」になる——CPUの拍動だ。',
    ideaEn: 'Counting is keeping time. Feed the DFF "(its own Q) XOR en" and it toggles while en is on. Stack these and you get a program counter — a CPU\'s heartbeat, stepping through instructions.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'en', y: 3 }, { name: 'clk', y: 6 }],
    outputs: [{ name: 'Q', y: 4 }],
    palette: [{ kind: 'dff' }, { kind: 'chip', chipId: 'XOR' }, { kind: 'nand' }],
    steps: [
      { in: { en: 0, clk: 0 }, expected: { Q: 0 } },
      { in: { en: 0, clk: 1 }, expected: { Q: 0 } }, // en 0 → hold
      { in: { en: 1, clk: 0 }, expected: { Q: 0 } },
      { in: { en: 1, clk: 1 }, expected: { Q: 1 } }, // toggle
      { in: { en: 1, clk: 0 }, expected: { Q: 1 } },
      { in: { en: 1, clk: 1 }, expected: { Q: 0 } }, // toggle
      { in: { en: 1, clk: 0 }, expected: { Q: 0 } },
      { in: { en: 1, clk: 1 }, expected: { Q: 1 } }, // toggle
      { in: { en: 0, clk: 0 }, expected: { Q: 1 } },
      { in: { en: 0, clk: 1 }, expected: { Q: 1 } }, // en 0 → hold
    ],
    produces: { id: 'CNT', name: 'カウンタ', nameEn: 'Counter', glyph: '↻' },
    par: 4,
  },

  /* ---------- Chapter 7 — capstone: a tiny CPU (accumulator machine) ---------- */
  {
    id: 'cpu', chapter: 'CPU', chapterEn: 'CPU',
    glyph: '▣', navName: 'CPU', sequential: true,
    title: 'アキュムレータ — 小さな計算機', titleEn: 'Accumulator — a tiny computer',
    concept: '記憶 × 計算 × クロック', conceptEn: 'memory × compute × clock',
    goal: '集大成。ALU（計算）の出力を DFF（記憶）に戻し、その値をまた ALU の入力 a に。クロックごとに「acc ← (acc op in)」が実行される。op を変えれば違う計算＝プログラム可能な計算機だ。手順どおり acc が動くように組もう。',
    goalEn: 'The capstone. Feed the ALU output into a DFF, and that value back into the ALU\'s a input. Each clock runs "acc ← (acc op in)". Change op and it computes differently — a programmable machine. Make acc follow the sequence.',
    idea: 'これがコンピュータの心臓だ。記憶(DFF)・計算(ALU)・時間(クロック)が一つの輪になり、命令(op)の列でデータを変えていく——アキュムレータ型CPU。君は NAND ひとつから、ここまで来た。多ビットに束ね、命令をメモリから読めば、それはもう本物のCPUだ。',
    ideaEn: "This is the heart of a computer: memory (DFF), compute (ALU), and time (clock) in one loop, transforming data under a stream of instructions (op) — an accumulator CPU. From a single NAND, you built this. Widen it to many bits and fetch ops from memory, and it is a real CPU.",
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'in', y: 1 }, { name: 'op0', y: 3 }, { name: 'op1', y: 5 }, { name: 'clk', y: 7 }],
    outputs: [{ name: 'acc', y: 4 }],
    palette: [{ kind: 'dff' }, { kind: 'chip', chipId: 'ALU' }, { kind: 'chip', chipId: 'MUX' }, { kind: 'nand' }],
    steps: [
      { in: { in: 1, op0: 1, op1: 0, clk: 0 }, expected: { acc: 0 } },
      { in: { in: 1, op0: 1, op1: 0, clk: 1 }, expected: { acc: 1 } }, // acc = OR(0,1) = 1
      { in: { in: 1, op0: 0, op1: 1, clk: 0 }, expected: { acc: 1 } },
      { in: { in: 1, op0: 0, op1: 1, clk: 1 }, expected: { acc: 0 } }, // acc = XOR(1,1) = 0
      { in: { in: 0, op0: 1, op1: 1, clk: 0 }, expected: { acc: 0 } },
      { in: { in: 0, op0: 1, op1: 1, clk: 1 }, expected: { acc: 1 } }, // acc = NAND(0,0) = 1
      { in: { in: 1, op0: 0, op1: 0, clk: 0 }, expected: { acc: 1 } },
      { in: { in: 1, op0: 0, op1: 0, clk: 1 }, expected: { acc: 1 } }, // acc = AND(1,1) = 1
    ],
    produces: { id: 'ACC', name: 'アキュムレータ', nameEn: 'Accumulator', glyph: '▣' },
    par: 34,
  },
  /* ---- the calculator's insides: 4-bit accumulator with a zero flag ---- */
  {
    id: 'acc4', chapter: 'CPU', chapterEn: 'CPU', sequential: true,
    glyph: '▣4', navName: '4bit計算機', navNameEn: '4-bit acc',
    title: '4ビット・アキュムレータ加算機', titleEn: '4-bit accumulator (+ zero flag)',
    concept: '数を足し込み、ゼロを判定する', conceptEn: 'accumulate numbers, detect zero',
    goal: '4ビットALUを記憶につなぐ。クロックごとに acc ← (acc op in)。op=加算なら数が積み上がる（3を入れ、5を足すと8）。さらに、結果が 0 のとき zero を 1 に——「結果を見て判断する」の第一歩、ゼロ判定フラグだ。',
    goalEn: 'Wire the 4-bit ALU into memory: each clock acc ← (acc op in). With add, numbers pile up (load 3, add 5 → 8). And raise zero when the result is 0 — a zero flag, the first step toward "decide based on the result".',
    idea: 'これが電卓の中身だ。加算で数を足し込み、ゼロ判定で初めて「結果を見て次を変える」素地ができる。減算して0かを見れば、それは比較(CMP)そのもの。命令列を自動で読めば、もう本物のCPUだ。',
    ideaEn: "These are a calculator's insides. Add to accumulate; the zero flag is the seed of branching — subtract and test for zero and you have CMP. Feed it an instruction stream automatically and it is a real CPU.",
    cols: 24, rows: 13,
    inputs: [{ name: 'in0', y: 1 }, { name: 'in1', y: 2 }, { name: 'in2', y: 3 }, { name: 'in3', y: 4 }, { name: 'op0', y: 6 }, { name: 'op1', y: 7 }, { name: 'clk', y: 9 }],
    outputs: [{ name: 'acc0', y: 1 }, { name: 'acc1', y: 3 }, { name: 'acc2', y: 5 }, { name: 'acc3', y: 7 }, { name: 'zero', y: 9 }],
    palette: [{ kind: 'dff' }, { kind: 'chip', chipId: 'ALU4' }, { kind: 'chip', chipId: 'OR' }, { kind: 'chip', chipId: 'NOT' }, { kind: 'nand' }],
    steps: [
      { in: { in0: 1, in1: 1, in2: 0, in3: 0, op0: 0, op1: 0, clk: 0 }, expected: { acc0: 0, acc1: 0, acc2: 0, acc3: 0, zero: 1 } },
      { in: { in0: 1, in1: 1, in2: 0, in3: 0, op0: 0, op1: 0, clk: 1 }, expected: { acc0: 1, acc1: 1, acc2: 0, acc3: 0, zero: 0 } }, // acc = 0 + 3 = 3
      { in: { in0: 1, in1: 0, in2: 1, in3: 0, op0: 0, op1: 0, clk: 0 }, expected: { acc0: 1, acc1: 1, acc2: 0, acc3: 0, zero: 0 } },
      { in: { in0: 1, in1: 0, in2: 1, in3: 0, op0: 0, op1: 0, clk: 1 }, expected: { acc0: 0, acc1: 0, acc2: 0, acc3: 1, zero: 0 } }, // acc = 3 + 5 = 8
      { in: { in0: 0, in1: 1, in2: 1, in3: 0, op0: 1, op1: 0, clk: 0 }, expected: { acc0: 0, acc1: 0, acc2: 0, acc3: 1, zero: 0 } },
      { in: { in0: 0, in1: 1, in2: 1, in3: 0, op0: 1, op1: 0, clk: 1 }, expected: { acc0: 0, acc1: 0, acc2: 0, acc3: 0, zero: 1 } }, // acc = 8 AND 6 = 0 → zero!
      { in: { in0: 1, in1: 1, in2: 1, in3: 0, op0: 0, op1: 1, clk: 0 }, expected: { acc0: 0, acc1: 0, acc2: 0, acc3: 0, zero: 1 } },
      { in: { in0: 1, in1: 1, in2: 1, in3: 0, op0: 0, op1: 1, clk: 1 }, expected: { acc0: 1, acc1: 1, acc2: 1, acc3: 0, zero: 0 } }, // acc = 0 OR 7 = 7
      { in: { in0: 0, in1: 1, in2: 0, in3: 0, op0: 1, op1: 1, clk: 0 }, expected: { acc0: 1, acc1: 1, acc2: 1, acc3: 0, zero: 0 } },
      { in: { in0: 0, in1: 1, in2: 0, in3: 0, op0: 1, op1: 1, clk: 1 }, expected: { acc0: 1, acc1: 0, acc2: 1, acc3: 0, zero: 0 } }, // acc = 7 XOR 2 = 5
    ],
    produces: { id: 'ACC4', name: '4bit計算機', nameEn: '4-bit acc', glyph: '▣4' },
    par: 200,
  },

  /* ---------- Bonus — go BELOW NAND and build it from transistors ---------- */
  {
    id: 't-not', chapter: 'おまけ：トランジスタ', chapterEn: 'Bonus: Transistors',
    glyph: '◁', navName: 'Tr·反転', navNameEn: 'Tr·NOT', substrate: 'switch',
    title: 'スイッチで反転', titleEn: 'Invert, with switches',
    concept: 'CMOSインバータ', conceptEn: 'CMOS inverter',
    goal: '【おまけ】NANDの一段下へ。トランジスタは「導通するスイッチ」。PMOS・NMOS・電源・接地で、X を反転して Y に出そう。',
    goalEn: '[Bonus] One layer below NAND. A transistor is a switch. Use PMOS/NMOS/power/ground to invert X into Y.',
    idea: 'PMOS は 0 で導通して上から 1 を引き、NMOS は 1 で導通して下へ 0 を落とす。二つ一組で「反転」になる——これがCMOS。',
    ideaEn: 'PMOS conducts on 0 (pulls 1 down); NMOS conducts on 1 (drains to 0). The pair is an inverter — that is CMOS.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'X', y: 4 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'pmos' }, { kind: 'nmos' }, { kind: 'high' }, { kind: 'low' }],
    spec: (m) => ({ Y: (m.X ? 0 : 1) as Bit }),
    par: 2,
  },
  {
    id: 't-nand', chapter: 'おまけ：トランジスタ', chapterEn: 'Bonus: Transistors',
    glyph: 'NAND', navName: 'Tr·NAND', substrate: 'switch',
    title: 'スイッチでNAND', titleEn: 'NAND, with switches',
    concept: 'すべての母', conceptEn: 'the mother gate',
    goal: '【おまけ】PMOS 2個・NMOS 2個で NAND を組む。両方が 1 のときだけ Y を 0 に。これが全ての論理の母——君が原始部品として使ってきたもの。',
    goalEn: '[Bonus] Build NAND from 2 PMOS + 2 NMOS. Y is 0 only when both are 1 — the gate you have used as your primitive.',
    idea: '上(PMOS)を並列、下(NMOS)を直列に。両方1のときだけ下が繋がり0へ落ちる。君がずっと部品として使ってきたNANDの、正体だ。',
    ideaEn: 'PMOS in parallel on top, NMOS in series below. The true nature of the NAND you have used all along.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'pmos' }, { kind: 'nmos' }, { kind: 'high' }, { kind: 'low' }],
    spec: (m) => ({ Y: (m.A && m.B ? 0 : 1) as Bit }),
    par: 4,
  },

  /* ---------- Sandbox — free build for those who want to go further ---------- */
  {
    id: 'sandbox', chapter: '自由制作', chapterEn: 'Sandbox',
    glyph: '✦', navName: '自由制作', navNameEn: 'Sandbox', sandbox: true,
    title: '自由制作（サンドボックス）', titleEn: 'Sandbox',
    concept: 'ゴールなし・全部品で自由に', conceptEn: 'no goal — build anything with every part',
    goal: '作ったチップ全部と DFF が使える自由な作業場。多ビットのレジスタや加算器、独自のCPUなど、好きなものを組んで試そう。入力 in0〜in3 を切り替え、out0〜out3 で結果を見る。',
    goalEn: 'A free workbench with every chip you built plus the DFF. Wire up multi-bit registers, adders, your own CPU — anything. Toggle in0–in3 and watch out0–out3.',
    idea: 'ここから先は決まった課題はない。多ビット化も、アセンブリを走らせる機械も、作りたい人がここで実験できる。NAND から始まった旅の、続きは君の手に。',
    ideaEn: 'No set tasks beyond here. Multi-bit machines, something that runs assembly — whoever wants to, can experiment here. The journey that began at NAND is now yours to continue.',
    cols: 18, rows: 11,
    inputs: [{ name: 'in0', y: 1 }, { name: 'in1', y: 3 }, { name: 'in2', y: 5 }, { name: 'in3', y: 7 }, { name: 'clk', y: 9 }],
    outputs: [{ name: 'out0', y: 2 }, { name: 'out1', y: 4 }, { name: 'out2', y: 6 }, { name: 'out3', y: 8 }],
    palette: [{ kind: 'nand' }, { kind: 'dff' }, { kind: 'high' }, { kind: 'low' }],
    par: 0,
  },
];

/** Progressive hints per level: concept → which parts → how to wire.
    Revealed one at a time, so players who want to think still can. */
export const HINTS: Record<string, { ja: string; en: string }[]> = {
  not: [
    { ja: 'NANDは「両方が1のときだけ0」。入力が1本しか無いとき、両方の入力に同じ信号を入れたらどうなる？', en: 'NAND is 0 only when both inputs are 1. With one signal, what if you feed it into both inputs?' },
    { ja: 'X を NAND の a と b の両方へ繋ぐ。NAND(X,X) は X の反転になる。', en: 'Wire X into both a and b of the NAND. NAND(X,X) inverts X.' },
  ],
  and: [
    { ja: 'AND は「NAND してから反転」。NANDの出力をひっくり返せば？', en: 'AND = NAND, then invert. Flip the NAND output.' },
    { ja: 'A,B を NAND に入れ、その出力を NOT チップに通して Y へ。', en: 'Feed A,B into a NAND, pass its output through your NOT chip to Y.' },
  ],
  or: [
    { ja: 'ド・モルガンの法則：A∨B = ¬(¬A ∧ ¬B)。まず各入力を反転してみよう。', en: "De Morgan: A∨B = ¬(¬A ∧ ¬B). Start by inverting each input." },
    { ja: 'A を NOT、B を NOT、その2つを NAND に入れる。NAND(¬A,¬B) が OR になる。', en: 'NOT A, NOT B, then NAND them: NAND(¬A,¬B) = A OR B.' },
  ],
  xor: [
    { ja: 'XOR は「違うとき1」。目標の真理値表を見て：両方同じなら0、片方だけ1なら1。', en: 'XOR is 1 when they differ. Look at the target table: same → 0, differ → 1.' },
    { ja: 'XOR =（A∨B）かつ（¬(A∧B)）。「どちらか1」かつ「両方1ではない」。', en: 'XOR = (A OR B) AND NOT(A AND B): "either one" and "not both".' },
    { ja: 'OR(A,B) と AND(A,B) を作り、AND を NOT し、その2つを AND する。', en: 'Build OR(A,B) and AND(A,B); NOT the AND; then AND those two.' },
  ],
  nor: [
    { ja: 'OR の出力を反転すれば NOR。作った OR と NOT を並べるだけ。', en: 'NOR is OR, inverted. Just chain your OR and NOT chips.' },
  ],
  xnor: [
    { ja: 'XOR は「違うとき1」。その出力を NOT すれば「同じとき1」になる。', en: 'XOR is "differ"; NOT its output to get "equal".' },
  ],
  hadd: [
    { ja: '目標の真理値表をよく見て。S（和）の列と C（繰り上がり）の列は、それぞれどのゲートの形？', en: 'Study the target table. The S (sum) column and the C (carry) column each match which gate?' },
    { ja: 'S は「A,B が違うとき1」＝XOR。C は「両方1のとき1」＝AND。どちらも作ったチップがある。', en: 'S = "A,B differ" = XOR. C = "both 1" = AND. You built both chips already.' },
    { ja: 'XORチップに A,B を入れて S へ。ANDチップに A,B を入れて C へ。入力 A,B は両方のチップへ分岐させる。', en: 'XOR(A,B)→S, AND(A,B)→C. Branch A and B into both chips.' },
  ],
  fadd: [
    { ja: '半加算器を2段。まず A,B を半加算（和と繰り上がり）、その和に Cin をもう一度半加算。', en: 'Two half-adders. Half-add A,B; then half-add that sum with Cin.' },
    { ja: '2つの半加算器の繰り上がり(C)を OR でまとめて Cout。和は2段目の S。', en: 'OR the two half-adders\' carries → Cout. The sum is the 2nd half-adder\'s S.' },
  ],
  srlatch: [
    { ja: 'NAND を2つ、たすき掛けに：片方の出力をもう片方の入力へ戻す。これがフィードバック＝記憶。', en: 'Cross-couple two NANDs: each output feeds the other\'s input. That feedback is memory.' },
    { ja: 'g1=NAND(S, g2出力)、g2=NAND(R, g1出力)。Q は g1 の出力。S=0でセット、R=0でリセット、両方1で保持。', en: 'g1=NAND(S, g2out), g2=NAND(R, g1out). Q is g1. S=0 sets, R=0 resets, both-1 holds.' },
  ],
  dlatch: [
    { ja: 'SRラッチの前に「書き込み窓」を付ける。E=1のときだけ D が中に入るように。', en: 'Put a write-gate in front of an SR latch so D enters only when E=1.' },
    { ja: 'S̄=NAND(D,E)、R̄=NAND(¬D,E) を作り、それでSRラッチ(NAND2個)を駆動。E=0なら両方1＝保持。', en: 'Make S̄=NAND(D,E), R̄=NAND(¬D,E) and drive an SR latch with them. E=0 → both 1 → hold.' },
  ],
  mux: [
    { ja: 'Y =（A かつ ¬S）または（B かつ S）。S で2つの AND のどちらが通るかが決まる。', en: 'Y = (A AND ¬S) OR (B AND S). S decides which AND passes.' },
    { ja: '¬S を作り、AND(A,¬S) と AND(B,S) を作って、その2つを OR する。', en: 'Build ¬S, then AND(A,¬S) and AND(B,S), then OR them.' },
  ],
  register: [
    { ja: 'DFF は毎クロック d を記憶する。「load なら in、さもなくば今の Q」を d に入れたい。何で選ぶ？', en: 'A DFF stores d each clock. You want d = "in if load, else current Q". What picks between them?' },
    { ja: 'MUX(A=Q, B=in, S=load) の出力を DFF の d へ。DFF の q を出力にし、MUX の A にも戻す。clk は DFF へ。', en: 'MUX(A=Q, B=in, S=load) → DFF.d. DFF.q is the output and also feeds back to MUX.A. clk → DFF.' },
  ],
  alu: [
    { ja: '4つの演算 AND/OR/XOR/NAND を全部計算しておき、op1,op0 でセレクタが1つを選ぶ。', en: 'Compute all four (AND/OR/XOR/NAND), then let op1,op0 select one.' },
    { ja: 'MUX を3つ：m1=MUX(AND,OR,op0)、m2=MUX(XOR,NAND,op0)、y=MUX(m1,m2,op1)。', en: 'Three MUXes: m1=MUX(AND,OR,op0), m2=MUX(XOR,NAND,op0), y=MUX(m1,m2,op1).' },
  ],
  counter: [
    { ja: 'en=1で反転、en=0で保持。DFF の d に「今の Q XOR en」を戻すとどうなる？', en: 'Toggle when en=1, hold when en=0. What if DFF.d = (current Q) XOR en?' },
    { ja: 'XOR(Q, en) を DFF の d へ。q を Q にし XOR にも戻す。clk は DFF へ。', en: 'XOR(Q, en) → DFF.d. q is Q and feeds back to the XOR. clk → DFF.' },
  ],
  cpu: [
    { ja: 'ALU の結果を DFF に記憶し、その値をまた ALU の入力 a に戻す「輪」を作る。', en: 'Make a loop: ALU result → DFF, and the stored value back into ALU input a.' },
    { ja: 'ALU(a=acc, b=in, op0, op1) の y を DFF の d へ。DFF の q を acc 出力かつ ALU の a に。clk は DFF へ。', en: 'ALU(a=acc, b=in, op0, op1).y → DFF.d. DFF.q is acc and feeds ALU.a. clk → DFF.' },
  ],
  't-not': [
    { ja: 'PMOSは0で導通（上から電源1を引く）、NMOSは1で導通（下へ接地0）。X を両方のゲートへ。', en: 'PMOS conducts on 0 (pulls 1 from power above); NMOS on 1 (drains to ground). Feed X to both gates.' },
    { ja: '電源→PMOS→Y、Y→NMOS→接地。X を両トランジスタのゲートへ。X=0でPMOS ON→Y=1、X=1でNMOS ON→Y=0。', en: 'power→PMOS→Y, Y→NMOS→ground. X to both gates. X=0→PMOS on→Y=1; X=1→NMOS on→Y=0.' },
  ],
  't-nand': [
    { ja: 'PMOS2個を並列で電源→Y、NMOS2個を直列で Y→接地。A,B をゲートへ。', en: 'Two PMOS in parallel (power→Y), two NMOS in series (Y→ground). A,B to the gates.' },
    { ja: '両方1のときだけ直列のNMOSが繋がり Y=0。どちらかが0ならPMOSが Y=1 に引き上げる。', en: 'Only when both are 1 does the series NMOS connect → Y=0. If either is 0, a PMOS pulls Y=1.' },
  ],
};

/** Build the starting circuit for a level: its interface IO, placed and locked. */
export function initialCircuit(level: Level): Circuit {
  const instances: Instance[] = [];
  for (const p of level.inputs) {
    instances.push({ id: 'in_' + p.name, kind: 'input', name: p.name, x: 0, y: p.y, locked: true });
  }
  for (const p of level.outputs) {
    instances.push({ id: 'out_' + p.name, kind: 'output', name: p.name, x: level.cols - 1, y: p.y, locked: true });
  }
  if (level.prewired) {
    for (const i of level.prewired.instances) instances.push({ ...i, locked: true });
    return { instances, wires: level.prewired.wires.map(w => ({ a: { ...w.a }, b: { ...w.b } })) };
  }
  return { instances, wires: [] };
}

export const gridPx = (level: Level) => ({ w: level.cols * CELL, h: level.rows * CELL });
