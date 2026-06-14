/* ============================================================
   KARAKURI — Workshop simulation engine (pure, no DOM)
   A tick-based dataflow factory. Tokens (values) ride belts,
   get transformed by machines, routed by filters/splitters,
   and collected by sinks. Movement has real backpressure.
   ============================================================ */

export const DIR = { N: 0, E: 1, S: 2, W: 3 };
export const DELTA = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // [dr,dc] by dir
export const right = d => (d + 1) % 4;
export const left = d => (d + 3) % 4;
export const opp = d => (d + 2) % 4;
const key = (r, c) => r * 1000 + c;

/* --- Operation catalog (machines) --- */
export const Op = {
  add: (n) => ({ type: 'add', n, glyph: `＋${n}`, label: `${n} を足す`, apply: v => v + n }),
  sub: (n) => ({ type: 'sub', n, glyph: `−${n}`, label: `${n} を引く`, apply: v => v - n }),
  mul: (n) => ({ type: 'mul', n, glyph: `×${n}`, label: `${n} 倍する`, apply: v => v * n }),
  set: (n) => ({ type: 'set', n, glyph: `=${n}`, label: `${n} にする`, apply: () => n }),
  mod: (n) => ({ type: 'mod', n, glyph: `%${n}`, label: `${n} で割った余り`, apply: v => ((v % n) + n) % n }),
};

/* --- Predicate catalog (filters) --- */
export const Pred = {
  even: () => ({ type: 'even', glyph: '偶', label: '偶数だけ通す', test: v => v % 2 === 0 }),
  odd: () => ({ type: 'odd', glyph: '奇', label: '奇数だけ通す', test: v => Math.abs(v % 2) === 1 }),
  gt: (n) => ({ type: 'gt', n, glyph: `>${n}`, label: `${n} より大きい`, test: v => v > n }),
  lt: (n) => ({ type: 'lt', n, glyph: `<${n}`, label: `${n} より小さい`, test: v => v < n }),
  gte: (n) => ({ type: 'gte', n, glyph: `≥${n}`, label: `${n} 以上`, test: v => v >= n }),
  eq: (n) => ({ type: 'eq', n, glyph: `=${n}`, label: `${n} と等しい`, test: v => v === n }),
  multiple: (n) => ({ type: 'multiple', n, glyph: `${n}の倍数`, label: `${n} の倍数だけ通す`, test: v => v % n === 0 }),
};

/* --- Fold catalog (accumulator: emits a running result) --- */
export const Fold = {
  sum: () => ({ type: 'sum', seed: 0, glyph: 'Σ', label: '流れを合計（reduce ＋）', code: '(a,x)=>a+x', apply: (a, v) => a + v }),
  prod: () => ({ type: 'prod', seed: 1, glyph: 'Π', label: '流れを掛け合わせる', code: '(a,x)=>a*x', apply: (a, v) => a * v }),
  max: () => ({ type: 'max', seed: -Infinity, glyph: '⌃', label: '最大を覚える', code: 'Math.max', apply: (a, v) => Math.max(a, v) }),
  min: () => ({ type: 'min', seed: Infinity, glyph: '⌄', label: '最小を覚える', code: 'Math.min', apply: (a, v) => Math.min(a, v) }),
};

/* --- Part factories --- */
export function makeBelt(dir = DIR.E) { return { kind: 'belt', dir }; }
export function makeAcc(fold, dir = DIR.E) { return { kind: 'acc', dir, fold, value: fold.seed, pending: false, absorbed: false }; }
export function makeOp(op, dir = DIR.E) { return { kind: 'op', dir, op }; }
export function makeFilter(pred, dir = DIR.E) { return { kind: 'filter', dir, pred }; }
export function makeSplitter(dir = DIR.E) { return { kind: 'splitter', dir, toggle: false }; }
export function makeSink(id = null) { return { kind: 'sink', dir: DIR.E, id, collected: [] }; }
export function makeSource(opts) {
  return {
    kind: 'source', dir: opts.dir ?? DIR.E,
    seq: opts.seq || null, loop: opts.loop ?? false,
    start: opts.start ?? 1, step: opts.step ?? 1,
    interval: opts.interval ?? 3,
    idx: 0, count: 0, done: false,
  };
}

export class Sim {
  constructor(rows, cols) {
    this.rows = rows; this.cols = cols;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.tokens = [];
    this.tick = 0;
    this.maxTick = 1600;
    this.spawned = 0; // total tokens emitted, for diagnostics
  }
  inGrid(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
  at(r, c) { return this.inGrid(r, c) ? this.grid[r][c] : null; }
  set(r, c, part) { if (this.inGrid(r, c)) this.grid[r][c] = part; }

  /** snapshot of resting-token occupancy by cell */
  _occupancy() {
    const occ = new Map();
    for (const t of this.tokens) occ.set(key(t.r, t.c), t);
    return occ;
  }

  /** where does a resting token at its current cell want to go? */
  _target(t) {
    const part = this.grid[t.r][t.c];
    if (!part) return { type: 'drop' };
    let outDir, dropIfBlocked = false;
    switch (part.kind) {
      case 'belt': case 'op': outDir = part.dir; break;
      case 'splitter': outDir = part.toggle ? right(part.dir) : part.dir; break;
      case 'filter':
        if (part.pred.test(t.value)) { outDir = part.dir; }
        else { outDir = right(part.dir); dropIfBlocked = true; }
        break;
      case 'sink': return { type: 'consume' };
      case 'source': return { type: 'wait' };
      default: return { type: 'wait' };
    }
    const nr = t.r + DELTA[outDir][0], nc = t.c + DELTA[outDir][1];
    if (!this.inGrid(nr, nc) || !this.grid[nr][nc] || this.grid[nr][nc].kind === 'source') {
      return dropIfBlocked ? { type: 'drop' } : { type: 'wait', outDir };
    }
    return { type: 'move', r: nr, c: nc, outDir };
  }

  /** can a token travelling in `outDir` enter the part at (r,c) this tick? */
  _accepts(r, c) {
    const p = this.grid[r][c];
    if (!p) return false;
    if (p.kind === 'acc') return !p.absorbed; // one fold per tick keeps it deterministic
    return true;
  }

  _arrive(t, r, c, occ) {
    const part = this.grid[r][c];
    if (part.kind === 'op') { t.value = part.op.apply(t.value); }
    if (part.kind === 'sink') { part.collected.push(t.value); return false; } // consumed, do not rest
    if (part.kind === 'acc') { part.value = part.fold.apply(part.value, t.value); part.pending = true; part.absorbed = true; return false; }
    occ.set(key(r, c), t);
    return true;
  }

  step() {
    if (this.tick >= this.maxTick) return;
    this.tick++;
    const occ = this._occupancy();
    const remove = new Set();
    // accumulators may fold once per tick
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const p = this.grid[r][c]; if (p && p.kind === 'acc') p.absorbed = false;
    }

    // compute targets up front (filters use current values)
    for (const t of this.tokens) { t.moved = false; t.prevR = t.r; t.prevC = t.c; t.target = this._target(t); }

    // iterative resolution: trains advance as the front frees cells
    let progress = true;
    while (progress) {
      progress = false;
      for (const t of this.tokens) {
        if (t.moved || remove.has(t)) continue;
        const tg = t.target;
        if (tg.type === 'drop') { remove.add(t); occ.delete(key(t.r, t.c)); t.moved = true; progress = true; continue; }
        if (tg.type === 'consume') { const p = this.grid[t.r][t.c]; if (p) p.collected.push(t.value); remove.add(t); occ.delete(key(t.r, t.c)); t.moved = true; progress = true; continue; }
        if (tg.type !== 'move') continue;
        if (occ.has(key(tg.r, tg.c))) continue; // blocked: wait this round
        if (!this._accepts(tg.r, tg.c)) continue; // e.g. accumulator already folded this tick
        const origin = this.grid[t.r][t.c];
        occ.delete(key(t.r, t.c));
        t.r = tg.r; t.c = tg.c; t.moved = true; progress = true;
        if (origin && origin.kind === 'splitter') origin.toggle = !origin.toggle;
        const rested = this._arrive(t, tg.r, tg.c, occ);
        if (!rested) remove.add(t);
      }
    }
    if (remove.size) this.tokens = this.tokens.filter(t => !remove.has(t));

    this._emitAcc(occ);  // accumulators push their running result forward
    this._emit(occ);     // sources emit (after movement freed space)
  }

  /** place `value` onto cell (r,c) coming from (fromR,fromC); handle op/sink/acc/rest.
      returns true if it was placed/consumed, false if the cell couldn't take it. */
  _deposit(value, r, c, fromR, fromC, occ) {
    if (!this.inGrid(r, c)) return false;
    const p = this.grid[r][c];
    if (!p || p.kind === 'source') return false;
    if (occ.has(key(r, c))) return false;
    if (p.kind === 'op') value = p.op.apply(value);
    if (p.kind === 'sink') { p.collected.push(value); return true; }
    if (p.kind === 'acc') { if (p.absorbed) return false; p.value = p.fold.apply(p.value, value); p.pending = true; p.absorbed = true; return true; }
    const tk = { value, r, c, moved: true, prevR: fromR, prevC: fromC };
    this.tokens.push(tk); occ.set(key(r, c), tk);
    return true;
  }

  _emitAcc(occ) {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const a = this.grid[r][c];
      if (!a || a.kind !== 'acc' || !a.pending) continue;
      const d = a.dir, nr = r + DELTA[d][0], nc = c + DELTA[d][1];
      if (this._deposit(a.value, nr, nc, r, c, occ)) { a.pending = false; this.spawned++; }
    }
  }

  _emit(occ) {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const s = this.grid[r][c];
      if (!s || s.kind !== 'source' || s.done) continue;
      if (this.tick % s.interval !== 0) continue;
      const d = s.dir, nr = r + DELTA[d][0], nc = c + DELTA[d][1];
      let v;
      if (s.seq) {
        if (s.idx >= s.seq.length) { if (s.loop) s.idx = 0; else { s.done = true; continue; } }
        v = s.seq[s.idx];
      } else { v = s.start + s.count * s.step; }
      // only advance the source if the deposit actually happened (otherwise retry next tick)
      if (this._deposit(v, nr, nc, r, c, occ)) {
        this.spawned++;
        if (s.seq) s.idx++; else s.count++;
      }
    }
  }

  /** All values collected across every sink, in arrival order per sink (concatenated). */
  collected() {
    const out = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const p = this.grid[r][c];
      if (p && p.kind === 'sink') out.push(...p.collected);
    }
    return out;
  }

  sinkById(id) {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const p = this.grid[r][c];
      if (p && p.kind === 'sink' && p.id === id) return p;
    }
    return null;
  }

  sources() {
    const out = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const p = this.grid[r][c]; if (p && p.kind === 'source') out.push(p);
    }
    return out;
  }

  /** true when nothing more can ever happen: every source is finite & done,
      and no tokens remain in flight. Infinite sources (counters / loops)
      never settle — those levels rely on the win check or the tick cap. */
  isSettled() {
    const allFinite = this.sources().every(s => s.seq && !s.loop);
    const allDone = this.sources().every(s => s.done);
    return allFinite && allDone && this.tokens.length === 0;
  }
}
