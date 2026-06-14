/* ============================================================
   KARAKURI — switch-level simulator (the transistor prologue).

   Below NAND, logic isn't a function — it's CONDUCTION. A
   transistor is a switch: an NMOS connects its two channel
   terminals when its gate is 1; a PMOS when its gate is 0.
   A node's value is decided by what it's connected to, through
   closed switches: tied to power(1), to ground(0), to both
   (a short), or to neither (floating). We iterate to a fixed
   point because gate values depend on node values and back.
   ============================================================ */
import type { Bit } from './netlist';
import type { Circuit, ChipLib } from './circuit';
import { pinsOf } from './circuit';

class UF {
  p: Int32Array;
  constructor(n: number) { this.p = new Int32Array(n); for (let i = 0; i < n; i++) this.p[i] = i; }
  find(x: number): number { while (this.p[x] !== x) { this.p[x] = this.p[this.p[x]]; x = this.p[x]; } return x; }
  union(a: number, b: number) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p[rb] = ra; }
}

interface Transistor { type: 'nmos' | 'pmos'; g: number; s: number; d: number }

export interface SwitchNet {
  numNets: number;
  power: Set<number>;
  ground: Set<number>;
  inputs: { name: string; net: number }[];
  outputs: { name: string; net: number }[];
  transistors: Transistor[];
  pinNets: Map<string, number>;
}

export function buildSwitch(circuit: Circuit, lib: ChipLib = new Map()): SwitchNet {
  const seed = new UF(0);
  const pinNetRaw = new Map<string, number>();
  let counter = 0;
  const ids: number[] = [];
  const fresh = () => { ids.push(counter); return counter++; };
  const netOf = (inst: string, pin: string) => {
    const k = inst + ':' + pin;
    let n = pinNetRaw.get(k);
    if (n === undefined) { n = fresh(); pinNetRaw.set(k, n); }
    return n;
  };
  for (const inst of circuit.instances) for (const p of pinsOf(inst, lib)) netOf(inst.id, p.name);
  const uf = new UF(counter);
  for (const w of circuit.wires) uf.union(netOf(w.a.inst, w.a.pin), netOf(w.b.inst, w.b.pin));

  const power = new Set<number>(), ground = new Set<number>();
  const inputs: { name: string; net: number }[] = [];
  const outputs: { name: string; net: number }[] = [];
  const transistors: Transistor[] = [];
  for (const inst of circuit.instances) {
    switch (inst.kind) {
      case 'high': power.add(netOf(inst.id, 'y')); break;
      case 'low': ground.add(netOf(inst.id, 'y')); break;
      case 'input': if (inst.name) inputs.push({ name: inst.name, net: netOf(inst.id, 'y') }); break;
      case 'output': if (inst.name) outputs.push({ name: inst.name, net: netOf(inst.id, 'x') }); break;
      case 'nmos': transistors.push({ type: 'nmos', g: netOf(inst.id, 'g'), s: netOf(inst.id, 's'), d: netOf(inst.id, 'd') }); break;
      case 'pmos': transistors.push({ type: 'pmos', g: netOf(inst.id, 'g'), s: netOf(inst.id, 's'), d: netOf(inst.id, 'd') }); break;
    }
  }

  // compact
  const remap = new Map<number, number>(); let k = 0;
  const R = (n: number) => { const r = uf.find(n); let m = remap.get(r); if (m === undefined) { m = k++; remap.set(r, m); } return m; };
  const pinNets = new Map<string, number>();
  for (const [key, n] of pinNetRaw) pinNets.set(key, R(n));
  return {
    numNets: k,
    power: new Set([...power].map(R)),
    ground: new Set([...ground].map(R)),
    inputs: inputs.map(x => ({ name: x.name, net: R(x.net) })),
    outputs: outputs.map(x => ({ name: x.name, net: R(x.net) })),
    transistors: transistors.map(t => ({ type: t.type, g: R(t.g), s: R(t.s), d: R(t.d) })),
    pinNets,
  };
}

export interface SwitchResult {
  val: Int8Array;
  outputs: Record<string, Bit>;
  settled: boolean;
  /** any OUTPUT net is shorted (tied to both rails) */
  shorted: boolean;
  /** any OUTPUT net is floating (tied to neither rail) */
  floating: boolean;
}

export function runSwitch(net: SwitchNet, inputVals: Record<string, Bit>): SwitchResult {
  const val = new Int8Array(net.numNets);
  const inNet = new Map<number, Bit>();
  for (const i of net.inputs) inNet.set(i.net, (inputVals[i.name] ? 1 : 0) as Bit);
  // seed inputs so the first iteration already reflects them
  for (const [n, v] of inNet) val[n] = v;

  let settled = false;
  let lastHas1 = new Map<number, boolean>(), lastHas0 = new Map<number, boolean>(), lastUf = new UF(net.numNets);

  for (let it = 0; it < 300; it++) {
    const luf = new UF(net.numNets);
    for (const t of net.transistors) {
      const on = t.type === 'nmos' ? val[t.g] === 1 : val[t.g] === 0;
      if (on) luf.union(t.s, t.d);
    }
    const has1 = new Map<number, boolean>(), has0 = new Map<number, boolean>();
    const mark = (n: number, bit: 0 | 1) => { const r = luf.find(n); if (bit) has1.set(r, true); else has0.set(r, true); };
    for (const p of net.power) mark(p, 1);
    for (const g of net.ground) mark(g, 0);
    for (const [n, v] of inNet) mark(n, v as 0 | 1);

    const next = new Int8Array(net.numNets);
    for (let n = 0; n < net.numNets; n++) {
      const r = luf.find(n); const h1 = has1.get(r), h0 = has0.get(r);
      next[n] = h1 ? 1 : 0; // short or pure-1 → 1; pure-0 or floating → 0
    }
    let same = true;
    for (let n = 0; n < net.numNets; n++) if (next[n] !== val[n]) { same = false; break; }
    val.set(next);
    lastHas1 = has1; lastHas0 = has0; lastUf = luf;
    if (same) { settled = true; break; }
  }

  let shorted = false, floating = false;
  for (const o of net.outputs) {
    const r = lastUf.find(o.net); const h1 = lastHas1.get(r), h0 = lastHas0.get(r);
    if (h1 && h0) shorted = true;
    if (!h1 && !h0) floating = true;
  }
  const outputs: Record<string, Bit> = {};
  for (const o of net.outputs) outputs[o.name] = val[o.net] as Bit;
  return { val, outputs, settled, shorted, floating };
}

import type { VerifyResult } from './verify';
export function verifySwitch(
  net: SwitchNet,
  rows: { in: Record<string, Bit>; expected: Record<string, Bit> }[],
): VerifyResult {
  const out: VerifyResult['rows'] = [];
  let pass = true, osc = false;
  for (const r of rows) {
    const res = runSwitch(net, r.in);
    const ok = res.settled && !res.shorted && !res.floating &&
      Object.keys(r.expected).every(k => res.outputs[k] === r.expected[k]);
    if (!res.settled) osc = true;
    if (!ok) pass = false;
    out.push({ in: r.in, expected: r.expected, got: res.outputs, pass: ok, settled: res.settled });
  }
  return { pass, rows: out, oscillated: osc, maxTicks: 0 };
}
