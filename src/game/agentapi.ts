/* ============================================================
   スイッチからCPU — in-page operation API for an AI co-solver.

   Exposed at  window.karakuri  so a browser-side agent (e.g. Claude
   in Chrome) can read the current puzzle as structured data and
   operate the circuit precisely, instead of guessing from pixels.

   Everything is plain JSON in / out. Grid coordinates are integer
   cells (x = column, y = row). Pins are named per-part (see parts()).
   Start with  karakuri.help()  and  karakuri.problem().
   ============================================================ */
import { game } from './store.svelte';
import { LEVELS, HINTS, type Level, type PaletteItem } from './levels';
import { pinsOf, type Instance } from '../sim/circuit';
import { truthTable } from '../sim/verify';

const VERSION = '1.1';

const partLabel = (it: PaletteItem): string => {
  if (it.kind === 'chip') return game.chipLib.get(it.chipId!)?.name ?? it.chipId!;
  return ({ nand: 'NAND', high: 'POWER(1)', low: 'GROUND(0)', dff: 'DFF', nmos: 'NMOS', pmos: 'PMOS' } as Record<string, string>)[it.kind] ?? it.kind;
};

const pinsOfPart = (it: PaletteItem) =>
  pinsOf({ id: '_', kind: it.kind, chipId: it.chipId, x: 0, y: 0 } as Instance, game.chipLib).map(p => ({ name: p.name, dir: p.dir }));

const partInfo = (it: PaletteItem) => ({
  kind: it.kind,
  chipId: it.chipId,
  label: partLabel(it),
  pins: pinsOfPart(it),
});

/** pins of a placed instance, tolerant of a stray instance referencing an unknown chip */
const pinNames = (inst: Instance): string[] => {
  try { return pinsOf(inst, game.chipLib).map(p => p.name); } catch { return []; }
};

const levelKind = (lv: Level) =>
  lv.demo ? 'demo' : lv.sandbox ? 'sandbox' : lv.substrate === 'switch' ? 'transistor' : lv.sequential ? 'sequential' : 'combinational';

function problem() {
  const lv = game.level;
  const ja = game.lang === 'ja';
  const table = lv.spec && !lv.sequential ? truthTable(lv.inputs.map(p => p.name), lv.spec) : null;
  return {
    index: game.levelIdx,
    id: lv.id,
    kind: levelKind(lv),
    chapter: ja ? lv.chapter : lv.chapterEn,
    title: ja ? lv.title : lv.titleEn,
    concept: ja ? lv.concept : lv.conceptEn,
    goal: ja ? lv.goal : lv.goalEn,
    idea: ja ? lv.idea : lv.ideaEn,
    inputs: lv.inputs.map(p => p.name),
    outputs: lv.outputs.map(p => p.name),
    grid: { cols: game.cols, rows: game.rows },
    par: lv.par,
    parUnit: lv.substrate === 'switch' ? 'transistors' : 'NANDs',
    solved: game.completed.has(lv.id),
    bestCost: game.best[lv.id] ?? null,
    // what to build:
    truthTable: table ? { inputs: lv.inputs.map(p => p.name), outputs: lv.outputs.map(p => p.name), rows: table.map(r => ({ in: r.in, out: r.expected })) } : null,
    sequence: lv.sequential && lv.steps ? lv.steps : null,
    availableParts: game.availableParts.map(partInfo),
    hintsAvailable: (HINTS[lv.id]?.length ?? 0),
  };
}

function state() {
  const vals = game.live.vals;
  const safePins = (i: Instance) => {
    try { return pinsOf(i, game.chipLib); } catch { return []; }
  };
  const instances = game.circuit.instances.map(i => ({
    id: i.id, kind: i.kind, chipId: i.chipId, name: i.name, x: i.x ?? 0, y: i.y ?? 0, locked: !!i.locked,
    pins: safePins(i).map(p => ({ name: p.name, dir: p.dir, value: vals.get(i.id + ':' + p.name) ?? null })),
  }));
  const lv = game.level;
  return {
    levelId: lv.id,
    grid: { cols: game.cols, rows: game.rows },
    inputs: { ...game.inputs },
    // `cost` is the CURRENT editing board; `bestCost` is your saved record (may differ).
    cost: game.cost,
    costUnit: game.substrate === 'switch' ? 'transistors' : 'NANDs',
    par: lv.par,
    solved: game.solved,
    bestCost: game.best[lv.id] ?? null,
    settled: game.live.settled,
    instances,
    wires: game.circuit.wires.map(w => ({ from: { inst: w.a.inst, pin: w.a.pin }, to: { inst: w.b.inst, pin: w.b.pin } })),
  };
}

function verify() {
  const ok = game.verify();
  const v = game.lastVerify;
  if (!v) return { pass: ok, error: game.message?.text ?? 'compile error', rows: [] as unknown[] };
  return {
    pass: v.pass,
    oscillated: v.oscillated,
    rows: v.rows.map(r => ({ in: r.in, expected: r.expected, got: r.got, pass: r.pass })),
    failing: v.rows.filter(r => !r.pass).map(r => ({ in: r.in, expected: r.expected, got: r.got })),
  };
}

function levels() {
  return LEVELS.map((lv, i) => ({ index: i, id: lv.id, kind: levelKind(lv), title: game.lang === 'ja' ? lv.title : lv.titleEn, solved: game.completed.has(lv.id) }));
}

function goto(idOrIndex: string | number): ReturnType<typeof problem> | { error: string } {
  const i = typeof idOrIndex === 'number' ? idOrIndex : LEVELS.findIndex(l => l.id === idOrIndex);
  if (i < 0 || i >= LEVELS.length) return { error: `unknown level: ${idOrIndex}` };
  game.loadLevel(i);
  if (location.hash.slice(1) !== LEVELS[i].id) location.hash = '#' + LEVELS[i].id;
  return problem();
}

function place(kind: Instance['kind'], x: number, y: number, chipId?: string) {
  if (kind === 'chip' && (!chipId || !game.chipLib.has(chipId)))
    return { error: `unknown chip: ${chipId}. available: ${[...game.chipLib.keys()].join(', ') || '(none yet)'}` };
  const id = game.placePart(kind, x, y, chipId);
  return id ? { id } : { error: 'cell occupied or out of bounds' };
}

function wire(fromInst: string, fromPin: string, toInst: string, toPin: string) {
  const find = (id: string) => game.circuit.instances.find(i => i.id === id);
  const a = find(fromInst), b = find(toInst);
  if (!a || !b) return { error: `unknown instance id: ${!a ? fromInst : toInst}`, validIds: game.circuit.instances.map(i => i.id) };
  const ap = pinNames(a), bp = pinNames(b);
  if (!ap.includes(fromPin)) return { error: `unknown pin "${fromPin}" on ${fromInst}`, validPins: ap };
  if (!bp.includes(toPin)) return { error: `unknown pin "${toPin}" on ${toInst}`, validPins: bp };
  game.addWire({ inst: fromInst, pin: fromPin }, { inst: toInst, pin: toPin });
  return { ok: true };
}

function setInput(name: string, value: 0 | 1) {
  if (!(name in game.inputs)) return { error: `unknown input: ${name}` };
  if ((game.inputs[name] ? 1 : 0) !== value) game.toggleInput(name);
  return { ok: true, inputs: { ...game.inputs } };
}

function hint(n?: number) {
  const hs = HINTS[game.level.id] ?? [];
  if (!hs.length) return { error: 'no hints for this level' };
  const idx = Math.max(0, Math.min(hs.length - 1, (n ?? 1) - 1));
  return { n: idx + 1, of: hs.length, text: game.lang === 'ja' ? hs[idx].ja : hs[idx].en };
}

const help = () => ({
  name: 'スイッチからCPU operation API',
  version: VERSION,
  about: 'Build digital circuits from NAND up to a CPU. Read the puzzle, place parts on a grid, wire pins, then verify.',
  coords: 'Integer grid cells. x=column (0 = left, inputs live here), y=row. Outputs sit on the right edge.',
  workflow: ['karakuri.problem() — read the current puzzle + available parts and their pins',
             'karakuri.place(kind, x, y, chipId?) — drop a part, returns its id',
             'karakuri.wire(fromId, fromPin, toId, toPin) — connect two pins (use input/output ids from state())',
             'karakuri.state() — see placed parts, their pins, live values, and wires',
             'karakuri.verify() — check against the spec; returns failing rows if any'],
  methods: {
    'problem()': 'current puzzle as structured data (goal, truth table / sequence, parts, par). includes solved + bestCost.',
    'state()': 'current EDITING board: instances (with pin values), wires, cost (current board), bestCost (saved record), par, solved, grid, input values',
    'parts()': 'available parts with their pin names/directions',
    'levels()': 'all levels with id / kind / solved',
    'goto(idOrIndex)': 'load a level (also updates the URL); returns problem()',
    'place(kind,x,y,chipId?)': "place a part. kind ∈ nand|chip|dff|high|low|nmos|pmos; for chip pass chipId. → {id} on success, else {error} ('cell occupied or out of bounds', or 'unknown chip: …' listing available chips)",
    'wire(fromId,fromPin,toId,toPin)': "connect two pins. interface pins: input id 'in_<NAME>' pin 'y'; output id 'out_<NAME>' pin 'x'. → {ok:true}, else {error, validIds|validPins} so you can correct it without guessing",
    'unwireAt(instId,pin)': 'remove wires touching a pin',
    'move(id,x,y)': 'move a placed part → boolean (false if locked / occupied / out of bounds)',
    'remove(id)': 'delete a placed part (and its wires)',
    'clear()': 'remove everything you placed (keep interface I/O)',
    'setInput(name,0|1)': 'drive an input pin to watch live behavior → {ok, inputs} or {error}',
    'grid(dCols,dRows)': 'enlarge the editor grid (power users)',
    'hint(n?)': 'reveal hint n (1-based) for the current level',
    'verify()': 'run the checker; {pass, oscillated, rows, failing}. NOTE: verify() is what advances scoring/solved — cost in state() is just the current board.',
  },
  tip: 'Interface I/O is pre-placed and locked. From state(), inputs have id "in_X" (drive pin "y"); outputs have id "out_Y" (sink pin "x"). Example NOT: place("nand",6,4) → id; wire("in_X","y",id,"a"); wire("in_X","y",id,"b"); wire(id,"y","out_Y","x"); verify().',
  sequential: "Memory levels (kind:'sequential' — SR/D latch, register, counter, CPU) are checked against problem().sequence: an ordered list of {in, expected} steps applied WITHOUT resetting state between them, so a rising clk edge (e.g. clk 0→1) latches values — that is how time/clocking is modeled. Just build the circuit and call verify(); it replays the whole sequence and returns per-step failing rows. To explore interactively, drive inputs yourself with setInput (e.g. setInput('clk',0) then setInput('clk',1) to pulse a clock) and read pin values from state(). DFF pins: d (in), clk (in), q (out).",
});

export interface KarakuriApi {
  version: string;
  help: typeof help; describe: typeof help;
  problem: typeof problem; state: typeof state; parts: () => ReturnType<typeof partInfo>[];
  levels: typeof levels; goto: typeof goto;
  place: typeof place; wire: typeof wire; move: (id: string, x: number, y: number) => boolean;
  remove: (id: string) => void; unwireAt: (inst: string, pin: string) => void; clear: () => void;
  setInput: typeof setInput; grid: (dc: number, dr: number) => void; resetGrid: () => void;
  hint: typeof hint; verify: typeof verify;
}

export function installAgentApi() {
  const api: KarakuriApi = {
    version: VERSION,
    help, describe: help,
    problem, state,
    parts: () => game.availableParts.map(partInfo),
    levels, goto,
    place, wire,
    move: (id, x, y) => game.moveInstance(id, x, y),
    remove: (id) => game.deleteInstance(id),
    unwireAt: (inst, pin) => game.removeWiresAt({ inst, pin }),
    clear: () => game.clearCircuit(),
    setInput, grid: (dc, dr) => game.growGrid(dc, dr), resetGrid: () => game.resetGrid(),
    hint, verify,
  };
  (globalThis as unknown as { karakuri: KarakuriApi }).karakuri = api;

  // discoverability: make it obvious — to humans AND to AI agents reading the
  // console / DOM — that the page can be driven programmatically.
  try {
    // a one-line console banner an agent sees the moment it reads console messages
    console.info(
      '%cスイッチからCPU%c  operation API ready — call %ckarakuri.help()%c to read & solve puzzles programmatically. Docs: ./llms.txt',
      'font-weight:bold;color:#d8a657', 'color:#8b96a8', 'font-weight:bold;color:#6cc6ff', 'color:#8b96a8',
    );
    // a DOM hint for agents that inspect attributes instead of the console
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-karakuri-api', 'window.karakuri — call karakuri.help(); docs at ./llms.txt');
    }
  } catch { /* non-browser / headless: ignore */ }

  return api;
}
