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
import { LEVELS, initialCircuit, type Level, type PaletteItem } from './levels';
import { pinKey } from './layout';

const LS_CHIPS = 'karakuri.chips.v1';
const LS_DONE = 'karakuri.completed.v1';
const LS_LANG = 'karakuri.lang';
const LS_BEST = 'karakuri.best.v1';
const LS_BESTD = 'karakuri.bestdelay.v1';
const LS_CIRCUITS = 'karakuri.circuits.v1';
const LS_GRID = 'karakuri.grid.v1';
const GRID_MAX_EXTRA = 30;

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
function loadCircuits(): Record<string, Circuit> {
  try { return JSON.parse(localStorage.getItem(LS_CIRCUITS) || '{}'); } catch { return {}; }
}
/** Japanese for ja-locale browsers, English for everyone else — unless the
    player has explicitly chosen a language before (that choice is persisted). */
function initLang(): Lang {
  try {
    const saved = localStorage.getItem(LS_LANG);
    if (saved === 'ja' || saved === 'en') return saved;
    const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]) || [];
    return langs.some(l => l?.toLowerCase().startsWith('ja')) ? 'ja' : 'en';
  } catch { return 'en'; }
}
function loadGrid(): Record<string, { dc: number; dr: number }> {
  try { return JSON.parse(localStorage.getItem(LS_GRID) || '{}'); } catch { return {}; }
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
  lang = $state<Lang>(initLang());
  message = $state<{ text: string; kind: 'ok' | 'err' | 'info' } | null>(null);
  solved = $state(false);
  showWin = $state(false);
  lastVerify = $state<ReturnType<typeof verifyCombinational> | null>(null);

  // every level's in-progress circuit, kept so leaving and returning never loses your work
  private circuits: Record<string, Circuit> = loadCircuits();

  // persistent gate-level sim so feedback circuits actually hold state as you poke them
  private gateSim: Simulator | null = null;
  private gatePinNets: Map<string, number> = new Map();
  liveGate = $state<{ vals: Map<string, Bit>; settled: boolean; ticks: number }>({ vals: new Map(), settled: true, ticks: 0 });

  constructor() {
    // one-time repair of the old vacuous-clear bug: a best of 0 was impossible
    // for a real solve, so drop those records and un-mark the level as cleared.
    let changed = false;
    for (const id of Object.keys(this.best)) {
      if (!(this.best[id] > 0)) { delete this.best[id]; this.completed.delete(id); changed = true; }
    }
    if (changed) {
      this.best = { ...this.best };
      this.completed = new Set(this.completed);
      try { localStorage.setItem(LS_BEST, JSON.stringify(this.best)); localStorage.setItem(LS_DONE, JSON.stringify([...this.completed])); } catch { /* ignore */ }
    }
  }

  get level(): Level { return LEVELS[this.levelIdx]; }
  get totalLevels(): number { return LEVELS.length; }
  get substrate(): 'gate' | 'switch' { return this.level.substrate ?? 'gate'; }

  // free-running clock: auto-pulse a level's `clk` input so sequential
  // circuits (counter / register / CPU / accumulator / processor) run on
  // their own — you watch them tick instead of toggling clk by hand.
  autoClock = $state(false);
  clockMs = $state(450);
  get hasClock(): boolean { return this.level.inputs.some(p => p.name === 'clk'); }

  // power-user grid expansion: enlarge the editor per level (e.g. build a CPU from NAND only)
  gridExpand = $state<Record<string, { dc: number; dr: number }>>(loadGrid());
  get cols(): number { return this.level.cols + (this.gridExpand[this.level.id]?.dc ?? 0); }
  get rows(): number { return this.level.rows + (this.gridExpand[this.level.id]?.dr ?? 0); }

  /** the parts the player may use right now: level primitives + every chip earned
      (single source of truth for both the Palette UI and the agent API) */
  get availableParts(): PaletteItem[] {
    const lv = this.level;
    if (lv.demo) return [];
    if (this.substrate === 'switch') return lv.palette;          // transistor primitives only
    const prims = lv.palette.filter(it => it.kind !== 'chip');   // nand / dff / power / ground
    const earned = [...this.chipLib.values()].map((c): PaletteItem => ({ kind: 'chip', chipId: c.id }));
    return [...prims, ...earned];
  }

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

  /* ---------- per-level persistence ---------- */
  /** stash the circuit of the level we're leaving so it's there when we come back */
  private saveCircuit() {
    const lv = this.level;
    if (lv.demo) return;                       // demo is fixed/prewired — nothing to save
    if (!this.circuit.instances.length) return; // nothing loaded yet (initial boot)
    this.circuits[lv.id] = $state.snapshot(this.circuit) as Circuit;
    try { localStorage.setItem(LS_CIRCUITS, JSON.stringify(this.circuits)); } catch {}
  }
  /** rebuild a saved circuit, re-deriving the locked interface I/O from the current level def
      (so it stays correct even if the level's I/O or grid changes between versions) */
  private reviveCircuit(saved: Circuit, lv: Level): Circuit {
    const base = initialCircuit(lv);                       // locked I/O (+ any prewired)
    const lockedIds = new Set(base.instances.map(i => i.id));
    const userInsts = saved.instances.filter(i => !lockedIds.has(i.id) && !i.locked);
    const ids = new Set([...lockedIds, ...userInsts.map(i => i.id)]);
    const wires = saved.wires.filter(w => ids.has(w.a.inst) && ids.has(w.b.inst));
    return { instances: [...base.instances, ...userInsts], wires };
  }

  /* ---------- grid size (power users) ---------- */
  /** keep the locked output pins glued to the right edge as the grid grows/shrinks */
  private placeOutputsAtEdge() {
    const right = this.cols - 1;
    for (const i of this.circuit.instances) if (i.kind === 'output') i.x = right;
  }
  private persistGrid() { try { localStorage.setItem(LS_GRID, JSON.stringify(this.gridExpand)); } catch {} }
  growGrid(dc: number, dr: number) {
    const e = this.gridExpand[this.level.id] ?? { dc: 0, dr: 0 };
    const next = { dc: Math.max(0, Math.min(GRID_MAX_EXTRA, e.dc + dc)), dr: Math.max(0, Math.min(GRID_MAX_EXTRA, e.dr + dr)) };
    this.gridExpand = { ...this.gridExpand, [this.level.id]: next };
    this.persistGrid();
    this.placeOutputsAtEdge();
    this.touch();
  }
  resetGrid() {
    if (!this.gridExpand[this.level.id]) return;
    const { [this.level.id]: _drop, ...rest } = this.gridExpand;
    this.gridExpand = rest;
    this.persistGrid();
    this.placeOutputsAtEdge();
    this.touch();
  }

  /* ---------- lifecycle ---------- */
  loadLevel(idx: number) {
    idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
    this.saveCircuit();                          // preserve the level we're leaving
    this.levelIdx = idx;
    const lv = LEVELS[idx];
    const saved = this.circuits[lv.id];
    this.circuit = saved ? this.reviveCircuit(saved, lv) : initialCircuit(lv);
    this.placeOutputsAtEdge();                   // honor any saved grid expansion for this level
    // inputs usually start ON so wires show life; the demo starts OFF so pressing them lights the lamp
    this.inputs = Object.fromEntries(lv.inputs.map(p => [p.name, (lv.demo ? 0 : 1) as Bit]));
    this.tool = { type: 'wire' };
    this.wiring = null;
    this.autoClock = false;                    // stop the free-running clock on level change
    this.solved = this.completed.has(lv.id);  // returning to a cleared level: keep it marked solved
    this.showWin = false;
    this.selection = new Set();
    this.lastVerify = null;
    this.message = null;
    this.lastRecord = null;
    this.syncLive();
  }

  setLang(l: Lang) { this.lang = l; localStorage.setItem(LS_LANG, l); }

  /* ---------- editing ---------- */
  private touch() { this.circuit = { ...this.circuit }; this.syncLive(); this.saveCircuit(); } // poke reactivity + rebuild sim + persist

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

  /** place a part programmatically and return its new id (used by the agent API) */
  placePart(kind: Instance['kind'], gx: number, gy: number, chipId?: string): string | null {
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return null;
    if (this.circuit.instances.some(i => i.x === gx && i.y === gy)) return null;
    const inst: Instance = { id: uid(), kind, x: gx, y: gy };
    if (kind === 'chip') inst.chipId = chipId;
    this.circuit.instances.push(inst);
    this.touch();
    return inst.id;
  }

  /** move a placed (unlocked) part to a free cell; returns success (used by the agent API) */
  moveInstance(id: string, gx: number, gy: number): boolean {
    const inst = this.circuit.instances.find(i => i.id === id);
    if (!inst || inst.locked) return false;
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return false;
    if (this.circuit.instances.some(i => i.id !== id && i.x === gx && i.y === gy)) return false;
    inst.x = gx; inst.y = gy;
    this.touch();
    return true;
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
    this.saveCircuit();
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
    const steps = (lv.sequential && lv.steps?.length) ? lv.steps : null;
    // never pass vacuously: a level with neither a truth table nor a step
    // sequence has nothing to check, so an empty circuit must not "clear".
    if (!steps && !rows.length) {
      this.message = { text: ja ? 'この課題には検証用の仕様（真理値表・手順）がありません。' : 'This level has no spec (truth table / sequence) to verify against.', kind: 'err' };
      return false;
    }
    let res;
    if (this.substrate === 'switch') {
      res = verifySwitch(buildSwitch(this.circuit, this.chipLib), rows);
    } else {
      const { flat, errors } = this.compiled;
      if (errors.length) { this.message = { text: errors.join(' / '), kind: 'err' }; return false; }
      res = steps ? verifySequential(flat, steps) : verifyCombinational(flat, rows);
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
    return true;
  }

  /** data for the share card / win modal (single source of truth) */
  cardData(): CardData {
    const lv = this.level, ja = this.lang === 'ja';
    const n = this.best[lv.id] > 0 ? this.best[lv.id] : this.cost;
    const table = (!lv.sequential && !lv.sandbox && lv.spec)
      ? { inputs: lv.inputs.map(p => p.name), outputs: lv.outputs.map(p => p.name), rows: truthTable(lv.inputs.map(p => p.name), lv.spec).map(r => ({ in: r.in, out: r.expected })) }
      : null;
    return {
      title: ja ? lv.title : lv.titleEn,
      unit: this.substrate === 'switch' ? (ja ? 'トランジスタ' : 'transistors') : 'NAND',
      cost: n, par: lv.par, delay: this.substrate === 'switch' ? null : (this.bestDelay[lv.id] ?? this.live.ticks),
      lang: this.lang, solved: this.solved, optimal: this.solved && n <= lv.par, totalNands: this.totalNands, stars: this.starCount,
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
    const n = this.best[lv.id] > 0 ? this.best[lv.id] : this.cost;
    const unit = this.substrate === 'switch' ? (ja ? 'トランジスタ' : 'transistors') : 'NAND';
    return ja
      ? `「${lv.title}」を ${unit} ${n}個で組み上げた！ — スイッチからCPU：スイッチひとつから計算機を作る`
      : `Built "${lv.titleEn}" from ${n} ${unit} — Switch → CPU: build a computer from a single switch.`;
  }

  /** aggregate stats for the "compete on totals" loop */
  get totalNands(): number {
    let s = 0; for (const lv of LEVELS) if (lv.substrate !== 'switch' && this.best[lv.id] > 0) s += this.best[lv.id]; return s;
  }
  get clearedCount(): number { return [...this.completed].filter(id => LEVELS.some(l => l.id === id)).length; }
  get starCount(): number { return LEVELS.filter(l => this.best[l.id] > 0 && this.best[l.id] <= l.par).length; }
  isOptimal(id: string): boolean { const lv = LEVELS.find(l => l.id === id); return !!lv && this.best[id] > 0 && this.best[id] <= lv.par; }

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
    const prev = this.best[id];
    const hadValid = prev > 0;                       // treat a missing / bogus 0 record as "none"
    if (!hadValid || gates < prev) {
      gate = hadValid && gates < prev;
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
    this.chipLib = new Map(); this.completed = new Set(); this.best = {}; this.bestDelay = {}; this.circuits = {}; this.gridExpand = {};
    localStorage.removeItem(LS_CHIPS); localStorage.removeItem(LS_DONE); localStorage.removeItem(LS_BEST); localStorage.removeItem(LS_BESTD); localStorage.removeItem(LS_CIRCUITS); localStorage.removeItem(LS_GRID);
    this.circuit = { instances: [], wires: [] };  // so loadLevel's save-on-leave is a no-op
    this.loadLevel(0);
  }
}

export const game = new Game();

// dev convenience: reach the live store from the console / e2e checks
if (import.meta.env.DEV) (globalThis as Record<string, unknown>).game = game;
