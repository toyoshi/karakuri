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
  produces?: { id: string; name: string; glyph: string };
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
    glyph: '½+', navName: '半加算',
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
    produces: { id: 'HADD', name: '半加算', glyph: '½+' },
    par: 6,
  },
  {
    id: 'fadd', chapter: '算術', chapterEn: 'Arithmetic',
    glyph: 'Σ', navName: '全加算',
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
    produces: { id: 'FADD', name: '全加算', glyph: 'Σ' },
    par: 14,
  },

  /* ---------- Bonus — go BELOW NAND and build it from transistors ---------- */
  {
    id: 't-not', chapter: 'おまけ：トランジスタ', chapterEn: 'Bonus: Transistors',
    glyph: '◁', navName: 'Tr·反転', substrate: 'switch',
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
