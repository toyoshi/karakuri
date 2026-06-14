/* ============================================================
   KARAKURI — component geometry for the grid editor.
   Grid coordinates are integer cells; pins sit at fractional
   anchors within a cell. Everything renders in SVG user units
   where one cell = CELL units.
   ============================================================ */
import type { Instance, ChipLib } from '../sim/circuit';
import { pinsOf } from '../sim/circuit';

export const CELL = 64;

export interface Anchor { name: string; dir: 'in' | 'out'; fx: number; fy: number }

/** Fractional pin anchors within a component's cell box. */
export function anchors(inst: Instance, lib: ChipLib): Anchor[] {
  switch (inst.kind) {
    case 'nand':
      return [
        { name: 'a', dir: 'in', fx: 0, fy: 0.3 },
        { name: 'b', dir: 'in', fx: 0, fy: 0.7 },
        { name: 'y', dir: 'out', fx: 1, fy: 0.5 },
      ];
    case 'input': return [{ name: 'y', dir: 'out', fx: 1, fy: 0.5 }];
    case 'output': return [{ name: 'x', dir: 'in', fx: 0, fy: 0.5 }];
    case 'high': case 'low': return [{ name: 'y', dir: 'out', fx: 1, fy: 0.5 }];
    case 'chip': {
      const pins = pinsOf(inst, lib);
      const ins = pins.filter(p => p.dir === 'in');
      const outs = pins.filter(p => p.dir === 'out');
      const spread = (i: number, n: number) => (n === 1 ? 0.5 : 0.18 + (0.64 * i) / (n - 1));
      return [
        ...ins.map((p, i): Anchor => ({ name: p.name, dir: 'in', fx: 0, fy: spread(i, ins.length) })),
        ...outs.map((p, i): Anchor => ({ name: p.name, dir: 'out', fx: 1, fy: spread(i, outs.length) })),
      ];
    }
  }
}

/** Height in cells a component occupies (chips with many pins grow taller). */
export function cellH(inst: Instance, lib: ChipLib): number {
  if (inst.kind === 'chip') {
    const pins = pinsOf(inst, lib);
    const n = Math.max(pins.filter(p => p.dir === 'in').length, pins.filter(p => p.dir === 'out').length);
    return Math.max(1, Math.ceil(n / 2));
  }
  return 1;
}

/** Absolute SVG position of a pin. */
export function pinXY(inst: Instance, lib: ChipLib, pin: string): { x: number; y: number } {
  const a = anchors(inst, lib).find(p => p.name === pin);
  const h = cellH(inst, lib);
  const gx = inst.x ?? 0, gy = inst.y ?? 0;
  return {
    x: (gx + (a ? a.fx : 0.5)) * CELL,
    y: (gy + (a ? a.fy : 0.5) * h) * CELL,
  };
}

export const pinKey = (instId: string, pin: string) => instId + ':' + pin;
