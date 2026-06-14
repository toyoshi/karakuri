/* ============================================================
   KARAKURI — Circuit model + compiler.

   A Circuit is component Instances joined by Wires (pin↔pin).
   compile() flattens the whole hierarchy — expanding every saved
   chip into its constituent NANDs — into a flat Netlist the
   Simulator can run. This flattening IS the encapsulation lesson:
   a chip you built is, underneath, just more NANDs.
   ============================================================ */
import type { Flat, Bit } from './netlist';

export type Kind = 'nand' | 'input' | 'output' | 'high' | 'low' | 'chip' | 'nmos' | 'pmos' | 'dff';

export interface PinRef { inst: string; pin: string }
export interface Wire { a: PinRef; b: PinRef }

export interface Instance {
  id: string;
  kind: Kind;
  chipId?: string;     // when kind === 'chip'
  name?: string;       // interface name for input/output pins
  // grid placement (UI only — ignored by the simulator)
  x?: number; y?: number; rot?: number;
  locked?: boolean;    // level-fixed (interface IO the player can't move/delete)
}

export interface Circuit {
  instances: Instance[];
  wires: Wire[];
}

export interface ChipDef {
  id: string;
  name: string;
  glyph?: string;
  inputs: string[];    // ordered interface input names
  outputs: string[];   // ordered interface output names
  circuit: Circuit;    // internal implementation (uses input/output instances named per the above)
}

export type ChipLib = Map<string, ChipDef>;

export interface PinDef { name: string; dir: 'in' | 'out' | 'io' }

export function pinsOf(inst: Instance, lib: ChipLib): PinDef[] {
  switch (inst.kind) {
    case 'nand': return [{ name: 'a', dir: 'in' }, { name: 'b', dir: 'in' }, { name: 'y', dir: 'out' }];
    case 'input': return [{ name: 'y', dir: 'out' }];
    case 'output': return [{ name: 'x', dir: 'in' }];
    case 'high': case 'low': return [{ name: 'y', dir: 'out' }];
    // transistors: gate (control) + two bidirectional channel terminals
    case 'nmos': case 'pmos': return [{ name: 'g', dir: 'in' }, { name: 's', dir: 'io' }, { name: 'd', dir: 'io' }];
    // D flip-flop primitive: data + clock in, Q out
    case 'dff': return [{ name: 'd', dir: 'in' }, { name: 'clk', dir: 'in' }, { name: 'q', dir: 'out' }];
    case 'chip': {
      const def = lib.get(inst.chipId!);
      if (!def) throw new Error(`unknown chip: ${inst.chipId}`);
      return [
        ...def.inputs.map((n): PinDef => ({ name: n, dir: 'in' })),
        ...def.outputs.map((n): PinDef => ({ name: n, dir: 'out' })),
      ];
    }
  }
}

/* --- union-find net allocator --- */
class UF {
  parent: number[] = [];
  fresh(): number { const i = this.parent.length; this.parent.push(i); return i; }
  find(x: number): number { while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; } return x; }
  union(a: number, b: number) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.parent[rb] = ra; }
}

interface Raw { gates: { a: number; b: number; out: number }[]; forced: { net: number; val: Bit }[]; dffs: { d: number; clk: number; q: number }[] }
interface Iface { inputs: Map<string, number>; outputs: Map<string, number> }

function expand(circuit: Circuit, lib: ChipLib, uf: UF, raw: Raw, depth: number, topPins?: Map<string, number>): Iface {
  if (depth > 60) throw new Error('chip hierarchy too deep (cyclic chip reference?)');
  const pinNet = new Map<string, number>();
  const netOf = (instId: string, pin: string): number => {
    const k = instId + ':' + pin;
    let n = pinNet.get(k);
    if (n === undefined) { n = uf.fresh(); pinNet.set(k, n); }
    return n;
  };
  // pre-allocate every pin so wires can union pins that are otherwise untouched
  for (const inst of circuit.instances) for (const p of pinsOf(inst, lib)) netOf(inst.id, p.name);
  for (const w of circuit.wires) uf.union(netOf(w.a.inst, w.a.pin), netOf(w.b.inst, w.b.pin));

  const ifIn = new Map<string, number>(), ifOut = new Map<string, number>();
  for (const inst of circuit.instances) {
    switch (inst.kind) {
      case 'nand': raw.gates.push({ a: netOf(inst.id, 'a'), b: netOf(inst.id, 'b'), out: netOf(inst.id, 'y') }); break;
      case 'high': raw.forced.push({ net: netOf(inst.id, 'y'), val: 1 }); break;
      case 'low': raw.forced.push({ net: netOf(inst.id, 'y'), val: 0 }); break;
      case 'input': if (inst.name) ifIn.set(inst.name, netOf(inst.id, 'y')); break;
      case 'output': if (inst.name) ifOut.set(inst.name, netOf(inst.id, 'x')); break;
      case 'dff': raw.dffs.push({ d: netOf(inst.id, 'd'), clk: netOf(inst.id, 'clk'), q: netOf(inst.id, 'q') }); break;
      case 'chip': {
        const def = lib.get(inst.chipId!);
        if (!def) throw new Error(`unknown chip: ${inst.chipId}`);
        const child = expand(def.circuit, lib, uf, raw, depth + 1);
        for (const name of def.inputs) {
          const cn = child.inputs.get(name); if (cn !== undefined) uf.union(cn, netOf(inst.id, name));
        }
        for (const name of def.outputs) {
          const cn = child.outputs.get(name); if (cn !== undefined) uf.union(cn, netOf(inst.id, name));
        }
        break;
      }
    }
  }
  if (topPins) for (const [k, n] of pinNet) topPins.set(k, n);
  return { inputs: ifIn, outputs: ifOut };
}

export interface CompileResult {
  flat: Flat;
  gateCount: number;
  errors: string[];
  /** top-level pin key ("instId:pin") → final net id, for lighting wires in the editor */
  pinNets: Map<string, number>;
}

export function compile(circuit: Circuit, lib: ChipLib = new Map()): CompileResult {
  const uf = new UF();
  const raw: Raw = { gates: [], forced: [], dffs: [] };
  const topPins = new Map<string, number>();
  let top: Iface;
  try {
    top = expand(circuit, lib, uf, raw, 0, topPins);
  } catch (e) {
    return { flat: { numNets: 0, gates: [], forced: [], dffs: [], inputs: [], outputs: [] }, gateCount: 0, errors: [(e as Error).message], pinNets: new Map() };
  }

  // resolve roots and compact net ids
  const remap = new Map<number, number>();
  let k = 0;
  const R = (n: number): number => {
    const r = uf.find(n);
    let m = remap.get(r);
    if (m === undefined) { m = k++; remap.set(r, m); }
    return m;
  };
  const gates = raw.gates.map(g => ({ a: R(g.a), b: R(g.b), out: R(g.out) }));
  const forced = raw.forced.map(f => ({ net: R(f.net), val: f.val }));
  const dffs = raw.dffs.map(d => ({ d: R(d.d), clk: R(d.clk), q: R(d.q) }));
  const inputs = [...top.inputs].map(([name, n]) => ({ name, net: R(n) }));
  const outputs = [...top.outputs].map(([name, n]) => ({ name, net: R(n) }));

  // validation: each net may have at most one driver
  const driverCount = new Array<number>(k).fill(0);
  for (const g of gates) driverCount[g.out]++;
  for (const f of forced) driverCount[f.net]++;
  for (const d of dffs) driverCount[d.q]++;
  for (const i of inputs) driverCount[i.net]++;
  const errors: string[] = [];
  let shorts = 0;
  for (let i = 0; i < k; i++) if (driverCount[i] > 1) shorts++;
  if (shorts > 0) errors.push(`${shorts} 本の配線が複数の出力に繋がっています（ショート）`);

  const pinNets = new Map<string, number>();
  for (const [k, n] of topPins) pinNets.set(k, R(n));

  return { flat: { numNets: k, gates, forced, dffs, inputs, outputs }, gateCount: gates.length, errors, pinNets };
}
