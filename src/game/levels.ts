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
  kind: 'nand' | 'high' | 'low' | 'chip' | 'nmos' | 'pmos';
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
}

const COLS = 14, ROWS = 9;

export const LEVELS: Level[] = [
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
];

/** Build the starting circuit for a level: its interface IO, placed and locked. */
export function initialCircuit(level: Level): Circuit {
  const instances: Instance[] = [];
  for (const p of level.inputs) {
    instances.push({ id: 'in_' + p.name, kind: 'input', name: p.name, x: 0, y: p.y, locked: true });
  }
  for (const p of level.outputs) {
    instances.push({ id: 'out_' + p.name, kind: 'output', name: p.name, x: level.cols - 1, y: p.y, locked: true });
  }
  return { instances, wires: [] };
}

export const gridPx = (level: Level) => ({ w: level.cols * CELL, h: level.rows * CELL });
