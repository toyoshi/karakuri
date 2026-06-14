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

/** A fully-flattened circuit: only NAND gates + forced (power/ground) nets. */
export interface Flat {
  numNets: number;
  gates: { a: number; b: number; out: number }[];
  forced: { net: number; val: Bit }[];
  inputs: { name: string; net: number }[];
  outputs: { name: string; net: number }[];
}

export interface SettleResult { settled: boolean; ticks: number }

export class Simulator {
  values: Uint8Array;
  private inputNet = new Map<string, number>();
  private outputNet = new Map<string, number>();

  constructor(public flat: Flat) {
    this.values = new Uint8Array(flat.numNets);
    for (const i of flat.inputs) this.inputNet.set(i.name, i.net);
    for (const o of flat.outputs) this.outputNet.set(o.name, o.net);
    this.applyForced();
  }

  private applyForced() {
    for (const f of this.flat.forced) this.values[f.net] = f.val;
  }

  /** Clear all net state (use between independent combinational test vectors). */
  reset() {
    this.values.fill(0);
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

  /** Run the synchronous update to a fixed point (state preserved across calls,
      so sequential circuits / memory work — call reset() to clear). */
  settle(maxTicks = 400): SettleResult {
    const { gates, forced } = this.flat;
    let cur = this.values;
    for (let t = 1; t <= maxTicks; t++) {
      const next = cur.slice();
      for (let i = 0; i < gates.length; i++) {
        const g = gates[i];
        next[g.out] = cur[g.a] && cur[g.b] ? 0 : 1;
      }
      for (const f of forced) next[f.net] = f.val;
      let changed = false;
      for (let i = 0; i < next.length; i++) {
        if (next[i] !== cur[i]) { changed = true; break; }
      }
      cur = next;
      if (!changed) { this.values = cur; return { settled: true, ticks: t }; }
    }
    this.values = cur;
    return { settled: false, ticks: maxTicks };
  }
}
