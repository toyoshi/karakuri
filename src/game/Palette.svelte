<script lang="ts">
  import { game } from './store.svelte';
  import { t, chipName } from './i18n';
  import { compile } from '../sim/circuit';
  import { Simulator, type Bit } from '../sim/netlist';
  import type { Instance, Wire } from '../sim/circuit';
  import type { PaletteItem } from './levels';

  const lv = $derived(game.level);
  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);

  function isActive(kind: string, chipId?: string) {
    const tl = game.tool;
    return tl.type === 'place' && tl.item.kind === kind && tl.item.chipId === chipId;
  }
  function glyphOf(kind: string, chipId?: string) {
    if (kind === 'nand') return 'NAND';
    if (kind === 'high') return '1'; if (kind === 'low') return '0';
    if (kind === 'nmos') return 'N'; if (kind === 'pmos') return 'P';
    return game.chipLib.get(chipId!)?.glyph ?? '?';
  }
  function nameOf(kind: string, chipId?: string) {
    if (kind === 'nand') return 'NAND';
    if (kind === 'high') return t('power'); if (kind === 'low') return t('ground');
    if (kind === 'nmos') return 'NMOS'; if (kind === 'pmos') return 'PMOS';
    return chipName(game.chipLib.get(chipId!)) || chipId!;
  }
  const items = $derived(lv.palette.filter(it => it.kind !== 'chip' || game.chipLib.has(it.chipId!)));

  /* ---------- (i) preview: compute a real truth table by simulating ---------- */
  let preview = $state<null | { item: PaletteItem; top: number; left: number }>(null);
  function showPreview(e: PointerEvent, it: PaletteItem) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    preview = { item: it, top: r.top, left: r.right + 10 };
  }
  const hidePreview = () => { preview = null; };

  function partTable(it: PaletteItem): { inputs: string[]; outputs: string[]; rows: { in: Record<string, Bit>; out: Record<string, Bit> }[] } | null {
    let inputs: string[], outputs: string[];
    const instances: Instance[] = [];
    const wires: Wire[] = [];
    const W = (ai: string, ap: string, bi: string, bp: string) => wires.push({ a: { inst: ai, pin: ap }, b: { inst: bi, pin: bp } });
    if (it.kind === 'nand') {
      inputs = ['A', 'B']; outputs = ['Y'];
      instances.push({ id: 'ia', kind: 'input', name: 'A' }, { id: 'ib', kind: 'input', name: 'B' }, { id: 'g', kind: 'nand' }, { id: 'o', kind: 'output', name: 'Y' });
      W('ia', 'y', 'g', 'a'); W('ib', 'y', 'g', 'b'); W('g', 'y', 'o', 'x');
    } else if (it.kind === 'chip') {
      const def = game.chipLib.get(it.chipId!); if (!def || def.inputs.length > 4) return null;
      inputs = def.inputs; outputs = def.outputs;
      def.inputs.forEach((n, i) => { instances.push({ id: 'i' + i, kind: 'input', name: n }); });
      def.outputs.forEach((n, i) => { instances.push({ id: 'o' + i, kind: 'output', name: n }); });
      instances.push({ id: 'c', kind: 'chip', chipId: it.chipId });
      def.inputs.forEach((n, i) => W('i' + i, 'y', 'c', n));
      def.outputs.forEach((n, i) => W('c', n, 'o' + i, 'x'));
    } else return null;
    const { flat, errors } = compile({ instances, wires }, game.chipLib);
    if (errors.length) return null;
    const sim = new Simulator(flat);
    const rows: { in: Record<string, Bit>; out: Record<string, Bit> }[] = [];
    for (let m = 0; m < (1 << inputs.length); m++) {
      const inMap: Record<string, Bit> = {};
      inputs.forEach((n, i) => { inMap[n] = ((m >> i) & 1) as Bit; });
      sim.reset(); sim.setInputs(inMap); sim.settle();
      rows.push({ in: inMap, out: sim.readOutputs() });
    }
    return { inputs, outputs, rows };
  }
  function previewDesc(it: PaletteItem): string | null {
    if (it.kind === 'nmos') return L('ゲートが1のとき導通するスイッチ', 'a switch that conducts when its gate is 1');
    if (it.kind === 'pmos') return L('ゲートが0のとき導通するスイッチ', 'a switch that conducts when its gate is 0');
    if (it.kind === 'high') return L('常に 1 を出力', 'always outputs 1');
    if (it.kind === 'low') return L('常に 0 を出力', 'always outputs 0');
    if (it.kind === 'nand') return L('両方が1のときだけ0', '0 only when both are 1');
    return null;
  }
</script>

<div class="palette">
  <div class="rail-label">{t('parts')}</div>
  <div class="tools">
    {#each items as it}
      <div class="part-row">
        <button class="part" class:active={isActive(it.kind, it.chipId)} data-kind={it.kind}
                onclick={() => game.tool = { type: 'place', item: it }}>
          <span class="g">{glyphOf(it.kind, it.chipId)}</span>
          <span class="n">{nameOf(it.kind, it.chipId)}</span>
        </button>
        <button class="info" aria-label={L('真理値表を見る', 'show truth table')}
                onpointerenter={(e) => showPreview(e, it)} onpointerleave={hidePreview}
                onfocus={(e) => showPreview(e as unknown as PointerEvent, it)} onblur={hidePreview}
                onclick={(e) => e.stopPropagation()}>i</button>
      </div>
    {/each}
  </div>

  <div class="rail-label">{t('tools')}</div>
  <div class="tools">
    <button class="tool" class:active={game.tool.type === 'wire'} onclick={() => { game.tool = { type: 'wire' }; }}>
      <span class="ti">／</span>{t('wire')}
    </button>
    <button class="tool" class:active={game.tool.type === 'delete'} onclick={() => { game.tool = { type: 'delete' }; }}>
      <span class="ti">⌫</span>{t('erase')}
    </button>
  </div>

  <p class="tip">{t('wireTip')}</p>
</div>

{#if preview}
  {@const tbl = partTable(preview.item)}
  {@const desc = previewDesc(preview.item)}
  <div class="preview" style="top:{preview.top}px; left:{preview.left}px">
    <b>{nameOf(preview.item.kind, preview.item.chipId)}</b>
    {#if desc}<span class="d">{desc}</span>{/if}
    {#if tbl}
      <table>
        <thead><tr>
          {#each tbl.inputs as n}<th>{n}</th>{/each}
          <th class="sep">→</th>
          {#each tbl.outputs as n}<th>{n}</th>{/each}
        </tr></thead>
        <tbody>
          {#each tbl.rows as r}
            <tr>
              {#each tbl.inputs as n}<td class="b{r.in[n]}">{r.in[n]}</td>{/each}
              <td class="sep"></td>
              {#each tbl.outputs as n}<td class="b{r.out[n]}">{r.out[n]}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<style>
  .palette { display: flex; flex-direction: column; gap: var(--sp-3); }
  .rail-label { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-top: var(--sp-2); }
  .tools { display: flex; flex-direction: column; gap: 6px; }
  .part-row { position: relative; display: flex; align-items: stretch; }
  .part {
    display: flex; align-items: center; gap: 10px; flex: 1; text-align: left;
    padding: 8px 10px; border-radius: var(--r-2); border: 1px solid var(--line);
    background: var(--ink-700); color: var(--paper-2); cursor: pointer; font-family: inherit; font-size: var(--step--1);
    transition: border-color 0.14s, background 0.14s;
  }
  .part:hover { border-color: var(--line-strong); background: var(--ink-600); }
  .part.active { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 12%, var(--ink-700)); box-shadow: 0 0 0 1px var(--brass-glow); }
  .part .g {
    flex: none; width: 40px; height: 30px; display: grid; place-items: center; border-radius: 6px;
    font-family: var(--font-mono); font-weight: 600; font-size: 11px;
    background: var(--ink-850); border: 1px solid var(--line-strong); color: var(--paper);
  }
  .part[data-kind="chip"] .g { color: var(--verdigris); border-color: var(--verdigris-d); font-size: 16px; }
  .part .n { font-weight: 500; color: var(--paper); }

  .info {
    position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%;
    display: grid; place-items: center; cursor: help; z-index: 2;
    border: 1px solid var(--line-strong); background: var(--ink-850); color: var(--muted);
    font-family: var(--font-display); font-style: italic; font-size: 11px; line-height: 1;
    transition: color 0.14s, border-color 0.14s;
  }
  .info:hover { color: var(--brass); border-color: var(--brass); }

  .tool {
    display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
    padding: 8px 10px; border-radius: var(--r-2); border: 1px solid var(--line);
    background: var(--ink-700); color: var(--paper-2); cursor: pointer; font-family: inherit; font-size: var(--step--1);
    transition: border-color 0.14s, background 0.14s;
  }
  .tool:hover { border-color: var(--line-strong); background: var(--ink-600); }
  .tool.active { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 12%, var(--ink-700)); box-shadow: 0 0 0 1px var(--brass-glow); }
  .tool .ti { font-family: var(--font-mono); width: 20px; text-align: center; color: var(--brass); }
  .tip { font-size: 0.72rem; color: var(--muted); line-height: 1.5; margin-top: var(--sp-2); }

  .preview {
    position: fixed; z-index: 60; pointer-events: none; min-width: 130px;
    background: var(--ink-700); border: 1px solid var(--line-strong); border-radius: var(--r-2);
    padding: 9px 11px; box-shadow: var(--sh-3); display: flex; flex-direction: column; gap: 5px;
  }
  .preview b { color: var(--paper); font-size: var(--step--1); }
  .preview .d { color: var(--paper-2); font-size: 0.74rem; line-height: 1.4; }
  .preview table { border-collapse: collapse; font-family: var(--font-mono); font-size: 0.74rem; margin-top: 2px; }
  .preview th { color: var(--muted); font-weight: 500; padding: 1px 6px; font-size: 0.66rem; }
  .preview td { text-align: center; padding: 1px 6px; color: var(--paper-2); }
  .preview .sep { color: var(--faint); width: 1.2em; }
  .preview .b1 { color: var(--signal); } .preview .b0 { color: var(--faint); }
</style>
