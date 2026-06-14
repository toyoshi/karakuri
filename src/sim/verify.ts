/* ============================================================
   KARAKURI — Verification: does a circuit meet the spec?
   Combinational: try every input combination (a truth table).
   Sequential: apply a sequence of steps, preserving state, the
   way a clocked circuit experiences time.
   ============================================================ */
import type { Flat, Bit } from './netlist';
import { Simulator } from './netlist';

export interface Row { in: Record<string, Bit>; expected: Record<string, Bit>; got: Record<string, Bit>; pass: boolean; settled: boolean }
export interface VerifyResult { pass: boolean; rows: Row[]; oscillated: boolean; maxTicks: number }

const eq = (a: Record<string, Bit>, b: Record<string, Bit>) =>
  Object.keys(b).every(k => a[k] === b[k]);

/** Enumerate all 2^n input combinations for combinational specs. */
export function truthTable(
  inputs: string[],
  spec: (inMap: Record<string, Bit>) => Record<string, Bit>,
): { in: Record<string, Bit>; expected: Record<string, Bit> }[] {
  const rows: { in: Record<string, Bit>; expected: Record<string, Bit> }[] = [];
  const n = inputs.length;
  for (let m = 0; m < (1 << n); m++) {
    const inMap: Record<string, Bit> = {};
    for (let i = 0; i < n; i++) inMap[inputs[i]] = ((m >> i) & 1) as Bit;
    rows.push({ in: inMap, expected: spec(inMap) });
  }
  return rows;
}

/** Combinational: independent vectors, state reset between each. */
export function verifyCombinational(
  flat: Flat,
  rows: { in: Record<string, Bit>; expected: Record<string, Bit> }[],
): VerifyResult {
  const sim = new Simulator(flat);
  const out: Row[] = [];
  let pass = true, osc = false, maxTicks = 0;
  for (const r of rows) {
    sim.reset();
    sim.setInputs(r.in);
    const s = sim.settle();
    maxTicks = Math.max(maxTicks, s.ticks);
    if (!s.settled) osc = true;
    const got = sim.readOutputs();
    const ok = s.settled && eq(got, r.expected);
    if (!ok) pass = false;
    out.push({ in: r.in, expected: r.expected, got, pass: ok, settled: s.settled });
  }
  return { pass, rows: out, oscillated: osc, maxTicks };
}

/** Sequential: ordered steps, state carried across (memory!). */
export function verifySequential(
  flat: Flat,
  steps: { in: Record<string, Bit>; expected: Record<string, Bit> }[],
): VerifyResult {
  const sim = new Simulator(flat);
  sim.reset();
  const out: Row[] = [];
  let pass = true, osc = false, maxTicks = 0;
  for (const r of steps) {
    sim.setInputs(r.in);
    const s = sim.settle();
    maxTicks = Math.max(maxTicks, s.ticks);
    if (!s.settled) osc = true;
    const got = sim.readOutputs();
    const ok = s.settled && eq(got, r.expected);
    if (!ok) pass = false;
    out.push({ in: r.in, expected: r.expected, got, pass: ok, settled: s.settled });
  }
  return { pass, rows: out, oscillated: osc, maxTicks };
}
