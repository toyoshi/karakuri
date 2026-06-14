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
  /* ---------- Chapter 0 — transistors (below NAND) ---------- */
  {
    id: 't-not', chapter: 'トランジスタ', chapterEn: 'Transistors',
    glyph: '◁', navName: '反転', substrate: 'switch',
    title: 'スイッチで反転', titleEn: 'Invert, with switches',
    concept: 'CMOSインバータ', conceptEn: 'CMOS inverter',
    goal: 'トランジスタは「導通するスイッチ」。PMOSとNMOSと電源・接地を使って、X を反転して Y に出そう。',
    goalEn: 'A transistor is just a switch. Use a PMOS, an NMOS, power and ground to invert X into Y.',
    idea: 'PMOS は 0 で導通して上から 1 を引き、NMOS は 1 で導通して下へ 0 を落とす。二つ一組で「反転」になる——これがCMOS。',
    ideaEn: 'PMOS conducts on 0 (pulls 1 from above); NMOS conducts on 1 (drains to 0 below). The pair is an inverter — that is CMOS.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'X', y: 4 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'pmos' }, { kind: 'nmos' }, { kind: 'high' }, { kind: 'low' }],
    spec: (m) => ({ Y: (m.X ? 0 : 1) as Bit }),
    par: 2,
  },
  {
    id: 't-nand', chapter: 'トランジスタ', chapterEn: 'Transistors',
    glyph: 'NAND', navName: 'NAND', substrate: 'switch',
    title: 'スイッチでNAND', titleEn: 'NAND, with switches',
    concept: 'すべての母', conceptEn: 'the mother gate',
    goal: 'PMOS 2個・NMOS 2個で NAND を作る。両方が 1 のときだけ Y を 0 に。これが全ての論理の母。',
    goalEn: 'Build NAND from 2 PMOS and 2 NMOS. Y is 0 only when both inputs are 1 — the gate everything is made of.',
    idea: '上(PMOS)を並列、下(NMOS)を直列に。両方1のときだけ下が繋がり0へ落ちる。論理ゲートの正体は、スイッチの配置だった。これ以降は、この NAND だけで全部を作る。',
    ideaEn: 'PMOS in parallel on top, NMOS in series below. Only when both are 1 does the path to ground close. A logic gate is just an arrangement of switches. From here on, NAND is all you need.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'pmos' }, { kind: 'nmos' }, { kind: 'high' }, { kind: 'low' }],
    spec: (m) => ({ Y: (m.A && m.B ? 0 : 1) as Bit }),
    par: 4,
  },

  /* ---------- Chapter 1 — gates from NAND ---------- */
  {
    id: 'not', chapter: '基本ゲート', chapterEn: 'Basic gates',
    glyph: '¬', navName: 'NOT',
    title: 'NOT — 反転', titleEn: 'NOT — Inverter',
    concept: 'NANDからNOTを作る', conceptEn: 'NOT from NAND',
    goal: 'ここからは NAND を原始部品として使う。入力 X を反転して Y に出そう。',
    goalEn: 'From here, NAND is your primitive. Invert X into Y using only NAND.',
    idea: 'NANDの両入力に同じ信号を入れると、反転器になる。トランジスタはもう忘れていい——NANDが新しい原子だ。',
    ideaEn: 'Tie both NAND inputs together and it becomes an inverter. Forget transistors now — NAND is the new atom.',
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
