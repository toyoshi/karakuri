/* ============================================================
   KARAKURI — reactive game store (Svelte 5 runes).
   Holds the circuit, the chip library you've earned, the current
   level, and a LIVE simulation that re-runs on every edit so the
   wires light up as you build.
   ============================================================ */
import type { Bit } from '../sim/netlist';
import { Simulator } from '../sim/netlist';
import type { Circuit, Instance, Wire, ChipDef, ChipLib, PinRef } from '../sim/circuit';
import { compile, pinsOf } from '../sim/circuit';
import { CELL, pinXY, cellH } from './layout';
import { buildSwitch, runSwitch, verifySwitch } from '../sim/switchlevel';
import { verifyCombinational, verifySequential, truthTable } from '../sim/verify';
import type { CardData } from './sharecard';
import { submitScore, getDistribution, type Dist } from './leaderboard';
import { LEVELS, initialCircuit, type Level, type PaletteItem } from './levels';
import { pinKey } from './layout';

const LS_CHIPS = 'karakuri.chips.v1';
const LS_DONE = 'karakuri.completed.v1';
const LS_LANG = 'karakuri.lang';
const LS_BEST = 'karakuri.best.v1';
const LS_BESTD = 'karakuri.bestdelay.v1';

export type Tool =
  | { type: 'wire' }
  | { type: 'delete' }
  | { type: 'select' }
  | { type: 'place'; item: PaletteItem };

export type Lang = 'ja' | 'en';

let uidN = 0;
const uid = () => 'n' + (uidN++).toString(36) + Date.now().toString(36).slice(-3);

const CHIP_NAME_EN: Record<string, string> = { HADD: 'Half-add', FADD: 'Full-add', SR: 'SR latch', DLATCH: 'D latch' };
function loadChips(): ChipLib {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_CHIPS) || '[]') as ChipDef[];
    for (const c of arr) if (!c.nameEn && CHIP_NAME_EN[c.id]) c.nameEn = CHIP_NAME_EN[c.id]; // backfill older saves
    return new Map(arr.map(c => [c.id, c]));
  } catch { return new Map(); }
}
function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function loadBest(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_BEST) || '{}'); } catch { return {}; }
}
function loadBestD(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_BESTD) || '{}'); } catch { return {}; }
}

export class Game {
  circuit = $state<Circuit>({ instances: [], wires: [] });
  chipLib = $state<ChipLib>(loadChips());
  completed = $state<Set<string>>(loadSet(LS_DONE));
  best = $state<Record<string, number>>(loadBest());
  bestDelay = $state<Record<string, number>>(loadBestD());
  lastRecord = $state<{ gate: boolean; delay: boolean; optimal: boolean } | null>(null);
  levelIdx = $state(0);
  tool = $state<Tool>({ type: 'wire' });
  inputs = $state<Record<string, Bit>>({});
  wiring = $state<PinRef | null>(null);
  lang = $state<Lang>((localStorage.getItem(LS_LANG) as Lang) || 'ja');
  message = $state<{ text: string; kind: 'ok' | 'err' | 'info' } | null>(null);
  solved = $state(false);
  showWin = $state(false);
  rank = $state<Dist | null>(null);  // leaderboard standing for the current solve (null = no API / not yet)
  lastVerify = $state<ReturnType<typeof verifyCombinational> | null>(null);

  // persistent gate-level sim so feedback circuits actually hold state as you poke them
  private gateSim: Simulator | null = null;
  private gatePinNets: Map<string, number> = new Map();
  liveGate = $state<{ vals: Map<string, Bit>; settled: boolean; ticks: number }>({ vals: new Map(), settled: true, ticks: 0 });

  get level(): Level { return LEVELS[this.levelIdx]; }
  get totalLevels(): number { return LEVELS.length; }
  get substrate(): 'gate' | 'switch' { return this.level.substrate ?? 'gate'; }

  compiled = $derived(compile(this.circuit, this.chipLib));

  /** cost metric: transistors for switch levels, NAND count for gate levels */
  cost = $derived.by(() => {
    if (this.substrate === 'switch') return this.circuit.instances.filter(i => i.kind === 'nmos' || i.kind === 'pmos').length;
    return this.compiled.gateCount;
  });

  /** live net values keyed by top-level pin key */
  live = $derived.by(() => {
    if (this.substrate === 'switch') {
      const net = buildSwitch(this.circuit, this.chipLib);
      const res = runSwitch(net, this.inputs);
      const vals = new Map<string, Bit>();
      for (const [k, n] of net.pinNets) vals.set(k, res.val[n] as Bit);
      return { vals, settled: res.settled, ticks: 0, shorted: res.shorted, floating: res.floating };
    }
    return { ...this.liveGate, shorted: false, floating: false };
  });

  private mapPins(): Map<string, Bit> {
    const vals = new Map<string, Bit>();
    if (this.gateSim) for (const [k, n] of this.gatePinNets) vals.set(k, this.gateSim.values[n] as Bit);
    return vals;
  }
  /** rebuild the persistent gate sim from the current structure (resets state) */
  private syncLive() {
    if (this.substrate === 'switch') return;
    const { flat, pinNets } = this.compiled;
    const sim = new Simulator(flat);
    sim.reset();
    for (const name in this.inputs) { try { sim.setInput(name, this.inputs[name]); } catch {} }
    const res = sim.settle();
    this.gateSim = sim; this.gatePinNets = pinNets;
    this.liveGate = { vals: this.mapPins(), settled: res.settled, ticks: res.ticks };
  }

  pinValue(instId: string, pin: string): Bit | undefined {
    return this.live.vals.get(pinKey(instId, pin));
  }

  /* ---------- lifecycle ---------- */
  loadLevel(idx: number) {
    idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
    this.levelIdx = idx;
    const lv = LEVELS[idx];
    this.circuit = initialCircuit(lv);
    // inputs usually start ON so wires show life; the demo starts OFF so pressing them lights the lamp
    this.inputs = Object.fromEntries(lv.inputs.map(p => [p.name, (lv.demo ? 0 : 1) as Bit]));
    this.tool = { type: 'wire' };
    this.wiring = null;
    this.solved = false;
    this.showWin = false;
    this.rank = null;
    this.selection = new Set();
    this.lastVerify = null;
    this.message = null;
    this.lastRecord = null;
    this.syncLive();
  }

  setLang(l: Lang) { this.lang = l; localStorage.setItem(LS_LANG, l); }

  /* ---------- editing ---------- */
  private touch() { this.circuit = { ...this.circuit }; this.syncLive(); } // poke reactivity + rebuild sim

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
    // gate: advance the persistent sim WITHOUT reset, so latches hold their state
    if (this.substrate !== 'switch' && this.gateSim) {
      try { this.gateSim.setInput(name, this.inputs[name]); } catch {}
      const res = this.gateSim.settle();
      this.liveGate = { vals: this.mapPins(), settled: res.settled, ticks: res.ticks };
    }
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

  /* ---------- selection / clipboard (reduce wiring tedium) ---------- */
  selection = $state<Set<string>>(new Set());
  private clipboard: { instances: Instance[]; wires: Wire[] } | null = null;

  clearSelection() { if (this.selection.size) this.selection = new Set(); }
  selectRect(gx0: number, gy0: number, gx1: number, gy1: number) {
    const x0 = Math.min(gx0, gx1), x1 = Math.max(gx0, gx1), y0 = Math.min(gy0, gy1), y1 = Math.max(gy0, gy1);
    const sel = new Set<string>();
    for (const i of this.circuit.instances) {
      if (i.locked) continue;
      const x = i.x ?? 0, y = i.y ?? 0;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) sel.add(i.id);
    }
    this.selection = sel;
  }
  copySelection() {
    const ids = this.selection;
    if (!ids.size) return;
    const instances = this.circuit.instances.filter(i => ids.has(i.id)).map(i => ({ ...i }));
    const wires = this.circuit.wires.filter(w => ids.has(w.a.inst) && ids.has(w.b.inst)).map(w => ({ a: { ...w.a }, b: { ...w.b } }));
    this.clipboard = { instances, wires };
  }
  paste(dgx = 2, dgy = 2) {
    if (!this.clipboard) return;
    const idMap = new Map<string, string>();
    const fresh: Instance[] = [];
    for (const i of this.clipboard.instances) {
      const nid = uid(); idMap.set(i.id, nid);
      fresh.push({ ...i, id: nid, x: (i.x ?? 0) + dgx, y: (i.y ?? 0) + dgy, locked: false });
    }
    // resolve overlaps by nudging the whole batch down until clear (best effort)
    const occupied = new Set(this.circuit.instances.map(i => (i.x ?? 0) + ',' + (i.y ?? 0)));
    let guard = 0;
    while (fresh.some(i => occupied.has((i.x ?? 0) + ',' + (i.y ?? 0))) && guard++ < 12) {
      for (const i of fresh) i.y = (i.y ?? 0) + 1;
    }
    const newWires: Wire[] = this.clipboard.wires.map(w => ({ a: { inst: idMap.get(w.a.inst)!, pin: w.a.pin }, b: { inst: idMap.get(w.b.inst)!, pin: w.b.pin } }));
    this.circuit.instances.push(...fresh);
    this.circuit.wires.push(...newWires);
    this.selection = new Set(fresh.map(i => i.id));
    this.touch();
  }
  deleteSelection() {
    const ids = this.selection;
    if (!ids.size) return;
    this.circuit.instances = this.circuit.instances.filter(i => i.locked || !ids.has(i.id));
    this.circuit.wires = this.circuit.wires.filter(w => !ids.has(w.a.inst) && !ids.has(w.b.inst));
    this.selection = new Set();
    this.touch();
  }
  moveSelection(dgx: number, dgy: number) {
    const ids = this.selection;
    if (!ids.size) return;
    for (const i of this.circuit.instances) if (ids.has(i.id)) { i.x = (i.x ?? 0) + dgx; i.y = (i.y ?? 0) + dgy; }
    this.circuit = { ...this.circuit };
  }

  /** remove everything the player placed (keep the locked interface I/O) */
  clearCircuit() {
    this.circuit = { instances: this.circuit.instances.filter(i => i.locked), wires: [] };
    this.touch();
  }

  /* ---------- verification ---------- */
  verify(): boolean {
    const lv = this.level;
    const ja = this.lang === 'ja';
    const rows = lv.spec ? truthTable(lv.inputs.map(p => p.name), lv.spec) : [];
    let res;
    if (this.substrate === 'switch') {
      res = verifySwitch(buildSwitch(this.circuit, this.chipLib), rows);
    } else {
      const { flat, errors } = this.compiled;
      if (errors.length) { this.message = { text: errors.join(' / '), kind: 'err' }; return false; }
      res = (lv.sequential && lv.steps) ? verifySequential(flat, lv.steps) : verifyCombinational(flat, rows);
    }
    this.lastVerify = res;
    if (res.oscillated) { this.message = { text: ja ? '信号が安定しません（発振）。配線を見直そう。' : 'Signal never settles (oscillating).', kind: 'err' }; return false; }
    if (!res.pass) { this.message = { text: ja ? '一致しません。赤い行を見て。出力が浮いていない？' : 'Mismatch — check the red rows. Is the output floating?', kind: 'err' }; return false; }
    // success!
    this.solved = true;
    this.completed.add(lv.id); this.persistDone();
    const rec = this.recordBest(lv.id, this.cost, this.substrate === 'switch' ? Infinity : this.live.ticks);
    const optimal = this.cost <= lv.par;
    this.lastRecord = { gate: rec.gate, delay: rec.delay, optimal };
    if (lv.produces) this.earnChip(lv);
    const unit = this.substrate === 'switch' ? (ja ? 'トランジスタ' : 'transistors') : (ja ? 'NAND' : 'NANDs');
    const pname = lv.produces ? (ja ? lv.produces.name : (lv.produces.nameEn ?? lv.produces.name)) : '';
    const what = lv.produces ? (ja ? pname + ' を作った' : 'built ' + pname) : (ja ? '完成' : 'done');
    const tags = [optimal ? (ja ? '★最小達成' : '★ optimal') : '', rec.gate ? (ja ? '🏆自己ベスト更新' : '🏆 new best') : ''].filter(Boolean).join(' · ');
    this.message = { text: (ja ? `クリア！ ${what}（${this.cost} ${unit}）` : `Solved — ${what} (${this.cost} ${unit})`) + (tags ? '  ' + tags : ''), kind: 'ok' };
    this.showWin = true;
    // leaderboard (best-effort, optional): submit + fetch standing
    if (!lv.demo && !lv.sandbox) {
      const g = this.cost, d = this.substrate === 'switch' ? 0 : this.live.ticks;
      this.rank = null;
      submitScore(lv.id, g, d).then(() => getDistribution(lv.id, g)).then(r => { if (this.level.id === lv.id) this.rank = r; });
    }
    return true;
  }

  /** data for the share card / win modal (single source of truth) */
  cardData(): CardData {
    const lv = this.level, ja = this.lang === 'ja';
    const n = this.best[lv.id] ?? this.cost;
    const table = (!lv.sequential && !lv.sandbox && lv.spec)
      ? { inputs: lv.inputs.map(p => p.name), outputs: lv.outputs.map(p => p.name), rows: truthTable(lv.inputs.map(p => p.name), lv.spec).map(r => ({ in: r.in, out: r.expected })) }
      : null;
    return {
      title: ja ? lv.title : lv.titleEn,
      unit: this.substrate === 'switch' ? (ja ? 'トランジスタ' : 'transistors') : 'NAND',
      cost: n, par: lv.par, delay: this.substrate === 'switch' ? null : (this.bestDelay[lv.id] ?? this.live.ticks),
      lang: this.lang, optimal: n <= lv.par, totalNands: this.totalNands, stars: this.starCount,
      cleared: `${this.clearedCount}/${LEVELS.length}`, table,
      circuit: this.circuitRender(),
      url: location.origin + location.pathname + '#' + lv.id,
    };
  }

  /** the player's actual circuit as fit-able render data (CELL pixel coords) for the share card */
  circuitRender(): CardData['circuit'] {
    const insts = this.circuit.instances;
    const vals = this.live.vals;
    const byId = (id: string) => insts.find(i => i.id === id);
    const dirOf = (inst: Instance | undefined, pin: string) => (inst ? pinsOf(inst, this.chipLib).find(p => p.name === pin)?.dir : 'io') ?? 'io';
    const orient = (w: Wire): [PinRef, PinRef] => {
      const da = dirOf(byId(w.a.inst), w.a.pin), db = dirOf(byId(w.b.inst), w.b.pin);
      if (da === 'out') return [w.a, w.b]; if (db === 'out') return [w.b, w.a]; if (da === 'in') return [w.b, w.a]; return [w.a, w.b];
    };
    const label = (inst: Instance) => {
      switch (inst.kind) {
        case 'input': case 'output': return inst.name ?? '';
        case 'nand': return '&'; case 'dff': return 'DFF'; case 'high': return '1'; case 'low': return '0';
        case 'nmos': return 'N'; case 'pmos': return 'P';
        case 'chip': return this.chipLib.get(inst.chipId!)?.glyph ?? '?';
      }
    };
    const nodes = insts.map(inst => {
      const h = cellH(inst, this.chipLib);
      const on = inst.kind === 'input' ? vals.get(inst.id + ':y') === 1 : inst.kind === 'output' ? vals.get(inst.id + ':x') === 1 : false;
      return { x: (inst.x ?? 0) * CELL, y: (inst.y ?? 0) * CELL, cw: CELL, ch: h * CELL, kind: inst.kind, label: label(inst), on };
    });
    const wires = this.circuit.wires.map(w => {
      const [fa, fb] = orient(w);
      const a = pinXY(byId(fa.inst)!, this.chipLib, fa.pin), b = pinXY(byId(fb.inst)!, this.chipLib, fb.pin);
      const lit = (vals.get(fa.inst + ':' + fa.pin) ?? vals.get(fb.inst + ':' + fb.pin)) === 1;
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, lit };
    });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + n.cw); maxY = Math.max(maxY, n.y + n.ch); }
    for (const w of wires) { minX = Math.min(minX, w.ax, w.bx); minY = Math.min(minY, w.ay, w.by); maxX = Math.max(maxX, w.ax, w.bx); maxY = Math.max(maxY, w.ay, w.by); }
    if (!isFinite(minX)) return { w: 1, h: 1, nodes: [], wires: [] };
    const P = 14;
    for (const n of nodes) { n.x -= minX - P; n.y -= minY - P; }
    for (const w of wires) { w.ax -= minX - P; w.ay -= minY - P; w.bx -= minX - P; w.by -= minY - P; }
    return { w: maxX - minX + P * 2, h: maxY - minY + P * 2, nodes, wires };
  }
  shareText(): string {
    const lv = this.level, ja = this.lang === 'ja';
    const n = this.best[lv.id] ?? this.cost;
    const unit = this.substrate === 'switch' ? (ja ? 'トランジスタ' : 'transistors') : 'NAND';
    return ja
      ? `「${lv.title}」を ${unit} ${n}個で組み上げた！ — Karakuri（からくり）でCSをゼロから組む`
      : `Built "${lv.titleEn}" from ${n} ${unit} on Karakuri — build a computer from a single NAND.`;
  }

  /** aggregate stats for the "compete on totals" loop */
  get totalNands(): number {
    let s = 0; for (const lv of LEVELS) if (lv.substrate !== 'switch' && this.best[lv.id] !== undefined) s += this.best[lv.id]; return s;
  }
  get clearedCount(): number { return [...this.completed].filter(id => LEVELS.some(l => l.id === id)).length; }
  get starCount(): number { return LEVELS.filter(l => this.best[l.id] !== undefined && this.best[l.id] <= l.par).length; }
  isOptimal(id: string): boolean { const lv = LEVELS.find(l => l.id === id); return !!lv && this.best[id] !== undefined && this.best[id] <= lv.par; }

  private earnChip(lv: Level) {
    if (!lv.produces) return;
    const def: ChipDef = {
      id: lv.produces.id, name: lv.produces.name, nameEn: lv.produces.nameEn, glyph: lv.produces.glyph,
      inputs: lv.inputs.map(p => p.name), outputs: lv.outputs.map(p => p.name),
      circuit: JSON.parse(JSON.stringify(this.circuit)),
    };
    this.chipLib.set(def.id, def);
    this.chipLib = new Map(this.chipLib);
    this.persistChips();
  }

  private recordBest(id: string, gates: number, delay: number): { gate: boolean; delay: boolean } {
    let gate = false, del = false;
    if (this.best[id] === undefined || gates < this.best[id]) {
      gate = this.best[id] !== undefined && gates < this.best[id];
      this.best = { ...this.best, [id]: gates };
      localStorage.setItem(LS_BEST, JSON.stringify(this.best));
    }
    if (Number.isFinite(delay) && (this.bestDelay[id] === undefined || delay < this.bestDelay[id])) {
      del = this.bestDelay[id] !== undefined && delay < this.bestDelay[id];
      this.bestDelay = { ...this.bestDelay, [id]: delay };
      localStorage.setItem(LS_BESTD, JSON.stringify(this.bestDelay));
    }
    return { gate, delay: del };
  }

  private persistChips() {
    localStorage.setItem(LS_CHIPS, JSON.stringify([...this.chipLib.values()]));
  }
  private persistDone() {
    localStorage.setItem(LS_DONE, JSON.stringify([...this.completed]));
  }

  resetProgress() {
    this.chipLib = new Map(); this.completed = new Set(); this.best = {}; this.bestDelay = {};
    localStorage.removeItem(LS_CHIPS); localStorage.removeItem(LS_DONE); localStorage.removeItem(LS_BEST); localStorage.removeItem(LS_BESTD);
    this.loadLevel(0);
  }
}

export const game = new Game();
