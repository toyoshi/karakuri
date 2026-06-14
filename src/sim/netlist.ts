/* ============================================================
   KARAKURI — Logic core: the flat netlist + simulator.

   Everything reduces to ONE primitive gate: NAND.
   (NOT = NAND(x,x), AND = NOT·NAND, OR = NAND of NOTs, … and so
   on, all the way up to a CPU — this is the NAND-to-Tetris spine.)

   Simulation is SYNCHRONOUS with a unit delay per NAND:
   every gate computes its next output from the *previous* tick's
   net values, then all nets update at once. We iterate until the
   state stops changing (settled) or we hit a tick cap (oscillating).
   The number of ticks to settle is the circuit's propagation delay
   — which doubles as an optimisation score.
   ============================================================ */

export type Bit = 0 | 1;

/** A fully-flattened circuit: NAND gates + forced (power/ground) nets +
    DFF primitives (the one given clocked element, à la NAND-to-Tetris). */
export interface Flat {
  numNets: number;
  gates: { a: number; b: number; out: number }[];
  forced: { net: number; val: Bit }[];
  dffs: { d: number; clk: number; q: number }[];
  inputs: { name: string; net: number }[];
  outputs: { name: string; net: number }[];
}

export interface SettleResult { settled: boolean; ticks: number }

export class Simulator {
  values: Uint8Array;
  private inputNet = new Map<string, number>();
  private outputNet = new Map<string, number>();
  // per-DFF stored state: its current output and the clock value last tick
  private dffState: { q: Bit; prevClk: Bit }[];

  constructor(public flat: Flat) {
    this.values = new Uint8Array(flat.numNets);
    for (const i of flat.inputs) this.inputNet.set(i.name, i.net);
    for (const o of flat.outputs) this.outputNet.set(o.name, o.net);
    this.dffState = flat.dffs.map(() => ({ q: 0 as Bit, prevClk: 0 as Bit }));
    this.applyForced();
  }

  private applyForced() {
    for (const f of this.flat.forced) this.values[f.net] = f.val;
    for (let i = 0; i < this.flat.dffs.length; i++) this.values[this.flat.dffs[i].q] = this.dffState[i].q;
  }

  /** Clear all net state (use between independent combinational test vectors). */
  reset() {
    this.values.fill(0);
    for (const s of this.dffState) { s.q = 0; s.prevClk = 0; }
    this.applyForced();
  }

  setInput(name: string, val: Bit) {
    const net = this.inputNet.get(name);
    if (net === undefined) throw new Error(`unknown input pin: ${name}`);
    this.values[net] = val;
  }

  setInputs(vals: Record<string, Bit>) {
    for (const k in vals) this.setInput(k, vals[k]);
  }

  readOutput(name: string): Bit {
    const net = this.outputNet.get(name);
    if (net === undefined) throw new Error(`unknown output pin: ${name}`);
    return this.values[net] as Bit;
  }

  readOutputs(): Record<string, Bit> {
    const out: Record<string, Bit> = {};
    for (const o of this.flat.outputs) out[o.name] = this.values[o.net] as Bit;
    return out;
  }

  /** Combinational fixed point with every DFF output held at its stored value
      (the DFF breaks feedback, so cross-coupled cycles settle deterministically). */
  private combinational(maxTicks: number): SettleResult {
    const { gates, forced, dffs } = this.flat;
    let cur = this.values;
    for (let t = 1; t <= maxTicks; t++) {
      const next = cur.slice();
      for (let i = 0; i < gates.length; i++) {
        const g = gates[i];
        next[g.out] = cur[g.a] && cur[g.b] ? 0 : 1;
      }
      for (const f of forced) next[f.net] = f.val;
      for (let i = 0; i < dffs.length; i++) next[dffs[i].q] = this.dffState[i].q;
      let changed = false;
      for (let i = 0; i < next.length; i++) if (next[i] !== cur[i]) { changed = true; break; }
      cur = next;
      if (!changed) { this.values = cur; return { settled: true, ticks: t }; }
    }
    this.values = cur;
    return { settled: false, ticks: maxTicks };
  }

  /** Settle the circuit. Combinational logic stabilises; then any DFF whose
      clock just rose latches D into Q; if that changed an output, re-stabilise.
      State (DFF contents) persists across calls — call reset() to clear. */
  settle(maxTicks = 400): SettleResult {
    let r = this.combinational(maxTicks);
    let total = r.ticks;
    let changedQ = false;
    for (let i = 0; i < this.flat.dffs.length; i++) {
      const dff = this.flat.dffs[i], s = this.dffState[i];
      const clk = this.values[dff.clk] as Bit;
      if (s.prevClk === 0 && clk === 1) { // rising edge → capture D
        const d = this.values[dff.d] as Bit;
        if (s.q !== d) changedQ = true;
        s.q = d;
      }
      s.prevClk = clk;
    }
    if (changedQ) { r = this.combinational(maxTicks); total += r.ticks; }
    return { settled: r.settled, ticks: total };
  }
}
