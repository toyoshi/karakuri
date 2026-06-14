/* ============================================================
   KARAKURI — the ladder of levels.
   Each level: build a logic function from the parts you have so
   far. Solve it → it becomes a chip you can use in later levels.
   This is the abstraction ladder: NAND → gates → … → CPU.
   ============================================================ */
import type { Bit } from '../sim/netlist';
import type { Instance, Circuit } from '../sim/circuit';
import { CELL } from './layout';

export interface PaletteItem {
  kind: 'nand' | 'high' | 'low' | 'chip';
  chipId?: string;
}

export interface IfacePin { name: string; y: number }

export interface Level {
  id: string;
  chapter: string;
  title: string; titleEn: string;
  concept: string; conceptEn: string;
  goal: string; goalEn: string;
  idea: string; ideaEn: string;
  cols: number; rows: number;
  inputs: IfacePin[];
  outputs: IfacePin[];
  palette: PaletteItem[];
  sequential?: boolean;
  spec?: (inMap: Record<string, Bit>) => Record<string, Bit>;
  steps?: { in: Record<string, Bit>; expected: Record<string, Bit> }[];
  produces: { id: string; name: string; glyph: string };
  par: number;        // reference gate count
}

const COLS = 14, ROWS = 9;

export const LEVELS: Level[] = [
  {
    id: 'not', chapter: '基本ゲート',
    title: 'NOT — 反転', titleEn: 'NOT — Inverter',
    concept: 'NANDからNOTを作る', conceptEn: 'NOT from NAND',
    goal: '入力 X を反転して Y に出す（X=0→Y=1, X=1→Y=0）。使えるのは NAND ひとつだけ。',
    goalEn: 'Invert X to Y. Your only tool is the NAND gate.',
    idea: 'NANDの両入力に同じ信号を入れると、反転器になる。すべてはここから始まる。',
    ideaEn: 'Tie both NAND inputs together and it becomes an inverter. Everything starts here.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'X', y: 4 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }],
    spec: (m) => ({ Y: (m.X ? 0 : 1) as Bit }),
    produces: { id: 'NOT', name: 'NOT', glyph: '¬' },
    par: 1,
  },
  {
    id: 'and', chapter: '基本ゲート',
    title: 'AND — 論理積', titleEn: 'AND',
    concept: '両方が1のとき1', conceptEn: 'true only when both are true',
    goal: 'A と B が両方 1 のときだけ Y を 1 に。さっき作った NOT が道具箱にある。',
    goalEn: 'Y is 1 only when A and B are both 1. Your NOT chip is in the toolbox now.',
    idea: 'NAND を反転すれば AND。自分で作った NOT を黒箱として置けることに注目——これが「抽象化」。',
    ideaEn: 'AND is just a NAND, inverted. Notice you can drop in the NOT you built — that is abstraction.',
    cols: COLS, rows: ROWS,
    inputs: [{ name: 'A', y: 3 }, { name: 'B', y: 5 }],
    outputs: [{ name: 'Y', y: 4 }],
    palette: [{ kind: 'nand' }, { kind: 'chip', chipId: 'NOT' }],
    spec: (m) => ({ Y: (m.A && m.B ? 1 : 0) as Bit }),
    produces: { id: 'AND', name: 'AND', glyph: '∧' },
    par: 2,
  },
  {
    id: 'or', chapter: '基本ゲート',
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
    id: 'xor', chapter: '基本ゲート',
    title: 'XOR — 排他的論理和', titleEn: 'XOR',
    concept: '違うときだけ1', conceptEn: 'true only when they differ',
    goal: 'A と B が異なるときだけ Y を 1 に。加算器の心臓部になるゲート。',
    goalEn: 'Y is 1 only when A and B differ — the heart of the adder.',
    idea: 'XOR は「違いの検出器」。半加算器の和の桁は、まさにこれ。次章で加算器を組む布石。',
    ideaEn: 'XOR detects difference — it is exactly the sum bit of a half-adder.',
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
