/* ============================================================
   KARAKURI — reactive game store (Svelte 5 runes).
   Holds the circuit, the chip library you've earned, the current
   level, and a LIVE simulation that re-runs on every edit so the
   wires light up as you build.
   ============================================================ */
import type { Bit } from '../sim/netlist';
import { Simulator } from '../sim/netlist';
import type { Circuit, Instance, Wire, ChipDef, ChipLib, PinRef } from '../sim/circuit';
import { compile } from '../sim/circuit';
import { verifyCombinational, verifySequential, truthTable } from '../sim/verify';
import { LEVELS, initialCircuit, type Level, type PaletteItem } from './levels';
import { pinKey } from './layout';

const LS_CHIPS = 'karakuri.chips.v1';
const LS_DONE = 'karakuri.completed.v1';
const LS_LANG = 'karakuri.lang';
const LS_BEST = 'karakuri.best.v1';

export type Tool =
  | { type: 'wire' }
  | { type: 'delete' }
  | { type: 'place'; item: PaletteItem };

export type Lang = 'ja' | 'en';

let uidN = 0;
const uid = () => 'n' + (uidN++).toString(36) + Date.now().toString(36).slice(-3);

function loadChips(): ChipLib {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_CHIPS) || '[]') as ChipDef[];
    return new Map(arr.map(c => [c.id, c]));
  } catch { return new Map(); }
}
function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function loadBest(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_BEST) || '{}'); } catch { return {}; }
}

export class Game {
  circuit = $state<Circuit>({ instances: [], wires: [] });
  chipLib = $state<ChipLib>(loadChips());
  completed = $state<Set<string>>(loadSet(LS_DONE));
  best = $state<Record<string, number>>(loadBest());
  levelIdx = $state(0);
  tool = $state<Tool>({ type: 'wire' });
  inputs = $state<Record<string, Bit>>({});
  wiring = $state<PinRef | null>(null);
  lang = $state<Lang>((localStorage.getItem(LS_LANG) as Lang) || 'ja');
  message = $state<{ text: string; kind: 'ok' | 'err' | 'info' } | null>(null);
  solved = $state(false);
  lastVerify = $state<ReturnType<typeof verifyCombinational> | null>(null);

  get level(): Level { return LEVELS[this.levelIdx]; }

  compiled = $derived(compile(this.circuit, this.chipLib));

  /** live net values keyed by top-level pin key, recomputed on every edit */
  live = $derived.by(() => {
    const { flat, pinNets } = this.compiled;
    const sim = new Simulator(flat);
    for (const name in this.inputs) {
      try { sim.setInput(name, this.inputs[name]); } catch { /* pin gone */ }
    }
    const res = sim.settle();
    const vals = new Map<string, Bit>();
    for (const [k, net] of pinNets) vals.set(k, sim.values[net] as Bit);
    return { vals, settled: res.settled, ticks: res.ticks };
  });

  pinValue(instId: string, pin: string): Bit | undefined {
    return this.live.vals.get(pinKey(instId, pin));
  }

  /* ---------- lifecycle ---------- */
  loadLevel(idx: number) {
    idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
    this.levelIdx = idx;
    const lv = LEVELS[idx];
    this.circuit = initialCircuit(lv);
    this.inputs = Object.fromEntries(lv.inputs.map(p => [p.name, 0 as Bit]));
    this.tool = { type: 'wire' };
    this.wiring = null;
    this.solved = false;
    this.lastVerify = null;
    this.message = null;
  }

  setLang(l: Lang) { this.lang = l; localStorage.setItem(LS_LANG, l); }

  /* ---------- editing ---------- */
  private touch() { this.circuit = { ...this.circuit }; } // poke reactivity

  placeAt(gx: number, gy: number) {
    if (this.tool.type !== 'place') return;
    // don't stack on an occupied cell
    if (this.circuit.instances.some(i => i.x === gx && i.y === gy)) return;
    const item = this.tool.item;
    const inst: Instance = { id: uid(), kind: item.kind, x: gx, y: gy };
    if (item.kind === 'chip') inst.chipId = item.chipId;
    this.circuit.instances.push(inst);
    this.touch();
  }

  deleteInstance(id: string) {
    const inst = this.circuit.instances.find(i => i.id === id);
    if (!inst || inst.locked) return;
    this.circuit.instances = this.circuit.instances.filter(i => i.id !== id);
    this.circuit.wires = this.circuit.wires.filter(w => w.a.inst !== id && w.b.inst !== id);
    this.touch();
  }

  toggleInput(name: string) {
    this.inputs = { ...this.inputs, [name]: (this.inputs[name] ? 0 : 1) as Bit };
  }

  /* ---------- wiring ---------- */
  pinClicked(ref: PinRef, dir: 'in' | 'out') {
    if (this.tool.type === 'delete') { this.removeWiresAt(ref); return; }
    if (!this.wiring) { this.wiring = ref; return; }
    if (this.wiring.inst === ref.inst && this.wiring.pin === ref.pin) { this.wiring = null; return; }
    this.addWire(this.wiring, ref);
    this.wiring = null;
  }

  addWire(a: PinRef, b: PinRef) {
    // avoid exact duplicates
    const exists = this.circuit.wires.some(w =>
      (w.a.inst === a.inst && w.a.pin === a.pin && w.b.inst === b.inst && w.b.pin === b.pin) ||
      (w.a.inst === b.inst && w.a.pin === b.pin && w.b.inst === a.inst && w.b.pin === a.pin));
    if (exists) return;
    this.circuit.wires.push({ a, b });
    this.touch();
  }

  removeWiresAt(ref: PinRef) {
    this.circuit.wires = this.circuit.wires.filter(w =>
      !((w.a.inst === ref.inst && w.a.pin === ref.pin) || (w.b.inst === ref.inst && w.b.pin === ref.pin)));
    this.touch();
  }

  removeWire(w: Wire) {
    this.circuit.wires = this.circuit.wires.filter(x => x !== w);
    this.touch();
  }

  clearWiring() { this.wiring = null; }

  /* ---------- verification ---------- */
  verify(): boolean {
    const lv = this.level;
    const { flat, gateCount, errors } = this.compiled;
    if (errors.length) { this.message = { text: errors.join(' / '), kind: 'err' }; return false; }
    let res;
    if (lv.sequential && lv.steps) res = verifySequential(flat, lv.steps);
    else res = verifyCombinational(flat, truthTable(lv.inputs.map(p => p.name), lv.spec!));
    this.lastVerify = res;
    if (res.oscillated) { this.message = { text: this.lang === 'ja' ? '信号が安定しません（発振）。フィードバックを見直そう。' : 'Signal never settles (oscillating).', kind: 'err' }; return false; }
    if (!res.pass) { this.message = { text: this.lang === 'ja' ? '真理値表が一致しません。赤い行を見て。' : "Truth table mismatch — check the red rows.", kind: 'err' }; return false; }
    // success!
    this.solved = true;
    this.completed.add(lv.id); this.persistDone();
    this.recordBest(lv.id, gateCount);
    this.earnChip(lv);
    this.message = { text: this.lang === 'ja' ? `クリア！ ${lv.produces.name} を作った（NAND ${gateCount}個）` : `Solved! You built ${lv.produces.name} (${gateCount} NANDs)`, kind: 'ok' };
    return true;
  }

  private earnChip(lv: Level) {
    const def: ChipDef = {
      id: lv.produces.id, name: lv.produces.name, glyph: lv.produces.glyph,
      inputs: lv.inputs.map(p => p.name), outputs: lv.outputs.map(p => p.name),
      circuit: JSON.parse(JSON.stringify(this.circuit)),
    };
    this.chipLib.set(def.id, def);
    this.chipLib = new Map(this.chipLib);
    this.persistChips();
  }

  private recordBest(id: string, gates: number) {
    if (this.best[id] === undefined || gates < this.best[id]) {
      this.best = { ...this.best, [id]: gates };
      localStorage.setItem(LS_BEST, JSON.stringify(this.best));
    }
  }

  private persistChips() {
    localStorage.setItem(LS_CHIPS, JSON.stringify([...this.chipLib.values()]));
  }
  private persistDone() {
    localStorage.setItem(LS_DONE, JSON.stringify([...this.completed]));
  }

  resetProgress() {
    this.chipLib = new Map(); this.completed = new Set(); this.best = {};
    localStorage.removeItem(LS_CHIPS); localStorage.removeItem(LS_DONE); localStorage.removeItem(LS_BEST);
    this.loadLevel(0);
  }
}

export const game = new Game();
