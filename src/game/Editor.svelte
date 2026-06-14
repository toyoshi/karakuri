<script lang="ts">
  import { game } from './store.svelte';
  import { CELL, anchors, cellH, pinXY } from './layout';
  import { gridPx } from './levels';
  import { pinsOf } from '../sim/circuit';
  import type { Instance, Wire, PinRef } from '../sim/circuit';

  let svgEl: SVGSVGElement;
  let wrapEl: HTMLDivElement;
  let mouse = $state({ x: 0, y: 0, in: false });
  let cursor = $state({ cx: 0, cy: 0 });
  let hover = $state<string | null>(null);
  let drag = $state<null | { id: string; offx: number; offy: number; moved: boolean }>(null);
  let pending = $state<null | { ref: PinRef; x: number; y: number; dragging: boolean }>(null);

  const lv = $derived(game.level);
  const px = $derived(gridPx(lv));
  const insts = $derived(game.circuit.instances);
  const byId = $derived(new Map(insts.map(i => [i.id, i])));
  const movable = (k: string) => k === 'nand' || k === 'chip' || k === 'nmos' || k === 'pmos' || k === 'high' || k === 'low';
  const pkey = (r: PinRef) => r.inst + ':' + r.pin;
  const wkey = (w: Wire) => pkey(w.a) + '|' + pkey(w.b);
  const connected = $derived(new Set(game.circuit.wires.flatMap(w => [pkey(w.a), pkey(w.b)])));

  function toSvg(e: PointerEvent | MouseEvent) {
    const p = svgEl.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const m = svgEl.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : ({ x: 0, y: 0 } as DOMPoint);
  }
  const cellFree = (gx: number, gy: number, exceptId?: string) =>
    gx >= 0 && gy >= 0 && gx < lv.cols && gy < lv.rows &&
    !insts.some(i => i.id !== exceptId && i.x === gx && i.y === gy);

  /** nearest pin to a point, within snap radius */
  function nearestPin(x: number, y: number): PinRef | null {
    let best: PinRef | null = null, bd = (CELL * 0.5) ** 2;
    for (const inst of insts) for (const a of anchors(inst, game.chipLib)) {
      const p = pinXY(inst, game.chipLib, a.name);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = { inst: inst.id, pin: a.name }; }
    }
    return best;
  }

  function onMove(e: PointerEvent) {
    const p = toSvg(e);
    mouse = { x: p.x, y: p.y, in: p.x >= 0 && p.y >= 0 && p.x < px.w && p.y < px.h };
    if (wrapEl) { const r = wrapEl.getBoundingClientRect(); cursor = { cx: e.clientX - r.left, cy: e.clientY - r.top }; }
    if (pending) {
      if (!pending.dragging && (p.x - pending.x) ** 2 + (p.y - pending.y) ** 2 > 64) {
        pending.dragging = true; game.wiring = pending.ref;
      }
      return;
    }
    if (drag) {
      const inst = byId.get(drag.id); if (!inst) return;
      const gx = Math.round((p.x - drag.offx) / CELL), gy = Math.round((p.y - drag.offy) / CELL);
      if ((gx !== inst.x || gy !== inst.y) && cellFree(gx, gy, inst.id)) { inst.x = gx; inst.y = gy; drag.moved = true; }
    }
  }
  function onUp(e: PointerEvent) {
    try { svgEl.releasePointerCapture(e.pointerId); } catch {}
    if (pending) {
      const { ref, dragging } = pending; pending = null;
      if (dragging) {
        const tgt = nearestPin(mouse.x, mouse.y);
        if (tgt && pkey(tgt) !== pkey(ref)) game.addWire(ref, tgt);
        game.clearWiring();
      } else {
        // a click: start a wire, or finish one in progress
        game.pinClicked(ref, 'in');
      }
      return;
    }
    if (drag) {
      const d = drag; drag = null;
      if (!d.moved) { const inst = byId.get(d.id); if (inst && game.tool.type === 'delete') game.deleteInstance(inst.id); }
    }
  }
  function onBgClick(e: MouseEvent) {
    if (drag || pending) return;
    if (game.tool.type === 'place') {
      const p = toSvg(e);
      game.placeAt(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
    }
    // NOTE: do NOT clear an in-progress wire on a stray background click —
    // a near-miss should not destroy your work. Cancel with Esc or by
    // clicking the start pin again.
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { game.clearWiring(); pending = null; } }

  function bodyDown(e: PointerEvent, inst: Instance) {
    if (!movable(inst.kind)) return;
    if (game.tool.type === 'place') return;
    e.stopPropagation();
    const p = toSvg(e);
    drag = { id: inst.id, offx: p.x - (inst.x ?? 0) * CELL, offy: p.y - (inst.y ?? 0) * CELL, moved: false };
    try { svgEl.setPointerCapture(e.pointerId); } catch {}
  }
  function pinDown(e: PointerEvent, ref: PinRef) {
    e.stopPropagation();
    const p = toSvg(e);
    pending = { ref, x: p.x, y: p.y, dragging: false };
    try { svgEl.setPointerCapture(e.pointerId); } catch {}
  }

  function pinAbs(instId: string, pin: string) {
    const i = byId.get(instId); return i ? pinXY(i, game.chipLib, pin) : { x: 0, y: 0 };
  }
  function pinDir(instId: string, pin: string): 'in' | 'out' | 'io' {
    const i = byId.get(instId); if (!i) return 'io';
    return pinsOf(i, game.chipLib).find(p => p.name === pin)?.dir ?? 'io';
  }
  function orient(w: Wire): [PinRef, PinRef] {
    const da = pinDir(w.a.inst, w.a.pin), db = pinDir(w.b.inst, w.b.pin);
    if (da === 'out') return [w.a, w.b];
    if (db === 'out') return [w.b, w.a];
    if (da === 'in') return [w.b, w.a];
    return [w.a, w.b];
  }
  function wirePath(w: Wire) {
    const [fa, fb] = orient(w);
    const a = pinAbs(fa.inst, fa.pin), b = pinAbs(fb.inst, fb.pin);
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} H ${mx} V ${b.y} H ${b.x}`;
  }
  const wireLit = (w: Wire) => (game.pinValue(w.a.inst, w.a.pin) ?? game.pinValue(w.b.inst, w.b.pin)) === 1;

  const CHIP_DESC: Record<string, { ja: string; en: string }> = {
    NOT: { ja: '入力を反転する', en: 'inverts its input' },
    AND: { ja: '両方が1のとき1', en: '1 when both are 1' },
    OR: { ja: 'どちらかが1なら1', en: '1 if either is 1' },
    XOR: { ja: '入力が違うとき1', en: '1 when inputs differ' },
    HADD: { ja: '1ビット加算：和Sと繰り上がりC', en: '1-bit add: sum S, carry C' },
    FADD: { ja: '繰り上がり込みの加算', en: 'add with carry-in' },
  };
  function describe(inst: Instance): { t: string; d: string; pins?: string } {
    const ja = game.lang === 'ja';
    switch (inst.kind) {
      case 'nand': return { t: 'NAND', d: ja ? '両方が1のときだけ0、それ以外は1' : '0 only when both are 1', pins: 'A,B → Y' };
      case 'input': return { t: (ja ? '入力 ' : 'Input ') + inst.name, d: ja ? 'クリックで 0/1 を切り替え' : 'click to toggle 0/1' };
      case 'output': return { t: (ja ? '出力 ' : 'Output ') + inst.name, d: ja ? 'ここに正しい値を導く' : 'drive the correct value here' };
      case 'high': return { t: ja ? '電源' : 'Power', d: ja ? '常に 1' : 'always 1' };
      case 'low': return { t: ja ? '接地' : 'Ground', d: ja ? '常に 0' : 'always 0' };
      case 'nmos': return { t: 'NMOS', d: ja ? 'ゲートが1のとき導通' : 'conducts when gate is 1' };
      case 'pmos': return { t: 'PMOS', d: ja ? 'ゲートが0のとき導通' : 'conducts when gate is 0' };
      case 'chip': {
        const def = game.chipLib.get(inst.chipId!);
        const desc = CHIP_DESC[inst.chipId!];
        return { t: def?.name ?? inst.chipId ?? '?', d: desc ? (ja ? desc.ja : desc.en) : (ja ? '自分で作ったチップ' : 'a chip you built'), pins: def ? def.inputs.join(',') + ' → ' + def.outputs.join(',') : undefined };
      }
    }
  }

  const ghostCell = $derived(mouse.in ? { x: Math.floor(mouse.x / CELL), y: Math.floor(mouse.y / CELL) } : null);
  function ghostGlyph() {
    const tl = game.tool; if (tl.type !== 'place') return '';
    const k = tl.item.kind;
    if (k === 'nand') return 'NAND'; if (k === 'high') return '1'; if (k === 'low') return '0';
    if (k === 'nmos') return 'N'; if (k === 'pmos') return 'P';
    return game.chipLib.get(tl.item.chipId!)?.glyph ?? '?';
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="editor-wrap" bind:this={wrapEl}>
  <svg bind:this={svgEl} viewBox="0 0 {px.w} {px.h}" preserveAspectRatio="xMidYMid meet"
       onpointermove={onMove} onpointerup={onUp} onclick={onBgClick}
       class:placing={game.tool.type === 'place'} class:deleting={game.tool.type === 'delete'}
       role="application" aria-label="回路エディタ">
    <g class="grid">
      {#each Array(lv.cols + 1) as _, c}<line x1={c * CELL} y1="0" x2={c * CELL} y2={px.h} />{/each}
      {#each Array(lv.rows + 1) as _, r}<line x1="0" y1={r * CELL} x2={px.w} y2={r * CELL} />{/each}
    </g>

    <!-- wires (keyed so the flow animation stays continuous across edits) -->
    <g class="wires">
      {#each game.circuit.wires as w (wkey(w))}
        {@const d = wirePath(w)}
        {@const lit = wireLit(w)}
        <path class="wire" class:lit d={d} />
        <path class="wire-flow" class:lit d={d} />
        <path class="wire-hit" d={d}
              onclick={(e) => { e.stopPropagation(); if (game.tool.type === 'delete') game.removeWire(w); }}
              role="button" tabindex="-1" aria-label="配線" />
      {/each}
    </g>

    {#if game.wiring}
      {@const wp = pinAbs(game.wiring.inst, game.wiring.pin)}
      <line class="wire-ghost" x1={wp.x} y1={wp.y} x2={mouse.x} y2={mouse.y} />
    {/if}

    {#if game.tool.type === 'place' && ghostCell}
      <g class="ghost" class:blocked={!cellFree(ghostCell.x, ghostCell.y)}>
        <rect x={ghostCell.x * CELL + 9} y={ghostCell.y * CELL + 9} width={CELL - 18} height={CELL - 18} rx="10" />
        <text x={(ghostCell.x + 0.5) * CELL} y={(ghostCell.y + 0.5) * CELL + 5}>{ghostGlyph()}</text>
      </g>
    {/if}

    {#each insts as inst (inst.id)}
      {@const h = cellH(inst, game.chipLib)}
      {@const x = inst.x ?? 0}{@const y = inst.y ?? 0}{@const pad = 9}
      <g class="comp k-{inst.kind}" class:locked={inst.locked} class:dragging={drag?.id === inst.id}
         onpointerdown={(e) => bodyDown(e, inst)}
         onpointerenter={() => (hover = inst.id)}
         onpointerleave={() => { if (hover === inst.id) hover = null; }}
         oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); game.deleteInstance(inst.id); }}
         role="button" tabindex="-1">

        {#if inst.kind === 'input'}
          {@const on = game.pinValue(inst.id, 'y') === 1}
          <g class="node-btn" class:on onclick={(e) => { e.stopPropagation(); game.toggleInput(inst.name!); }} role="button" tabindex="-1">
            <rect x={x * CELL + pad} y={y * CELL + pad} width={CELL - pad * 2} height={CELL - pad * 2} rx="9" />
            <text class="lbl" x={(x + 0.5) * CELL} y={(y + 0.42) * CELL}>{inst.name}</text>
            <text class="bit" x={(x + 0.5) * CELL} y={(y + 0.7) * CELL}>{on ? 1 : 0}</text>
          </g>
        {:else if inst.kind === 'output'}
          {@const on = game.pinValue(inst.id, 'x') === 1}
          <g class="lamp" class:on>
            <circle cx={(x + 0.5) * CELL} cy={(y + 0.5) * CELL} r={CELL * 0.3} />
            <text class="lbl" x={(x + 0.5) * CELL} y={(y + 0.5) * CELL + 4}>{inst.name}</text>
          </g>
        {:else if inst.kind === 'high' || inst.kind === 'low'}
          <rect class="rail r-{inst.kind}" x={x * CELL + pad} y={y * CELL + pad} width={CELL - pad * 2} height={CELL - pad * 2} rx="9" />
          <text class="rlbl" x={(x + 0.5) * CELL} y={(y + 0.58) * CELL}>{inst.kind === 'high' ? '1' : '0'}</text>
        {:else if inst.kind === 'nmos' || inst.kind === 'pmos'}
          <rect class="tr t-{inst.kind}" x={x * CELL + pad} y={y * CELL + pad} width={CELL - pad * 2} height={h * CELL - pad * 2} rx="8" />
          <text class="trlbl" x={(x + 0.5) * CELL} y={(y + 0.5) * CELL + 5}>{inst.kind === 'nmos' ? 'N' : 'P'}</text>
        {:else}
          <rect class="body" x={x * CELL + pad} y={y * CELL + pad} width={CELL - pad * 2} height={h * CELL - pad * 2} rx="10" />
          <text class="glyph" x={(x + 0.5) * CELL} y={(y + h * 0.5) * CELL + (inst.kind === 'chip' ? 0 : 5)}>
            {inst.kind === 'nand' ? 'NAND' : (game.chipLib.get(inst.chipId!)?.glyph ?? '?')}
          </text>
          {#if inst.kind === 'chip'}<text class="cname" x={(x + 0.5) * CELL} y={(y + h * 0.5) * CELL + 20}>{game.chipLib.get(inst.chipId!)?.name}</text>{/if}
        {/if}

        {#each anchors(inst, game.chipLib) as p}
          {@const pos = pinXY(inst, game.chipLib, p.name)}
          {@const v = game.pinValue(inst.id, p.name)}
          {@const unwired = p.dir !== 'out' && !connected.has(pkey({ inst: inst.id, pin: p.name }))}
          <g class="pin p-{p.dir}" class:on={v === 1} class:unwired
             class:active={game.wiring && game.wiring.inst === inst.id && game.wiring.pin === p.name}
             onpointerdown={(e) => pinDown(e, { inst: inst.id, pin: p.name })}
             onclick={(e) => e.stopPropagation()} role="button" tabindex="-1">
            <circle class="hit" cx={pos.x} cy={pos.y} r="14" />
            <circle class="dot" cx={pos.x} cy={pos.y} r="5" />
          </g>
        {/each}
      </g>
    {/each}
  </svg>

  {#if hover && !drag && !pending}
    {@const inst = byId.get(hover)}
    {#if inst}
      {@const info = describe(inst)}
      <div class="tooltip" style="left:{cursor.cx + 16}px; top:{cursor.cy + 16}px">
        <b>{info.t}</b>
        {#if info.d}<span>{info.d}</span>{/if}
        {#if info.pins}<code>{info.pins}</code>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .editor-wrap { position: relative; width: 100%; height: 100%; display: grid; place-items: center; padding: var(--sp-4); overflow: auto; }
  .tooltip { position: absolute; z-index: 5; pointer-events: none; max-width: 220px;
    background: var(--ink-700); border: 1px solid var(--line-strong); border-radius: var(--r-2);
    padding: 8px 11px; box-shadow: var(--sh-2); display: flex; flex-direction: column; gap: 3px; }
  .tooltip b { color: var(--paper); font-size: var(--step--1); }
  .tooltip span { color: var(--paper-2); font-size: 0.74rem; line-height: 1.4; }
  .tooltip code { color: var(--brass); font-family: var(--font-mono); font-size: 0.7rem; }
  svg { width: 100%; height: 100%; touch-action: none; }
  svg.placing { cursor: copy; }
  svg.deleting { cursor: not-allowed; }

  .grid line { stroke: var(--line); stroke-width: 1; }

  .wire { fill: none; stroke: var(--ink-500); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
  .wire.lit { stroke: var(--signal); filter: drop-shadow(0 0 4px var(--signal-d)); }
  /* persistent overlay: only visible/animated when lit, so the flow never gets recreated */
  .wire-flow { fill: none; stroke: var(--brass-bright); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 2 16; opacity: 0; }
  .wire-flow.lit { opacity: 0.9; animation: flow 0.6s linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -18; } }
  .wire-ghost { stroke: var(--brass); stroke-width: 2.5; stroke-dasharray: 5 5; opacity: 0.85; }
  .wire-hit { stroke: transparent; stroke-width: 16; fill: none; pointer-events: none; }
  svg.deleting .wire-hit { pointer-events: stroke; cursor: pointer; }
  svg.deleting .wire-hit:hover { stroke: rgba(240,106,106,0.25); }

  .ghost rect { fill: rgba(216,166,87,0.12); stroke: var(--brass); stroke-width: 1.5; stroke-dasharray: 4 4; }
  .ghost text { fill: var(--brass); font-family: var(--font-mono); font-size: 12px; text-anchor: middle; pointer-events: none; }
  .ghost.blocked rect { fill: rgba(240,106,106,0.12); stroke: var(--err); }

  .comp text { font-family: var(--font-mono); text-anchor: middle; pointer-events: none; }
  .comp:not(.locked) { cursor: grab; }
  .comp.dragging { cursor: grabbing; }
  .comp .body { fill: #1b2330; stroke: var(--line-strong); stroke-width: 1.5; }
  .k-nand .glyph { fill: var(--paper-2); font-size: 13px; font-weight: 600; }
  .k-chip .body { fill: #1a2030; stroke: var(--verdigris-d); }
  .k-chip .glyph { fill: var(--verdigris); font-size: 20px; }
  .k-chip .cname { fill: var(--muted); font-size: 9px; letter-spacing: 0.06em; }
  .comp:not(.locked):hover .body { stroke: var(--brass); }

  .tr { stroke-width: 1.6; }
  .t-nmos { fill: #11212c; stroke: var(--signal-d); }
  .t-pmos { fill: #241a12; stroke: var(--copper); }
  .trlbl { font-size: 15px; font-weight: 700; }
  .k-nmos .trlbl { fill: var(--signal); } .k-pmos .trlbl { fill: var(--copper); }

  .rail { stroke-width: 1.6; }
  .r-high { fill: #2a2110; stroke: var(--brass); } .r-low { fill: #16202b; stroke: var(--signal-d); }
  .rlbl { fill: var(--paper); font-size: 16px; font-weight: 700; }

  .node-btn rect { fill: #221b10; stroke: var(--brass-deep); stroke-width: 1.5; cursor: pointer; transition: fill .14s, stroke .14s; }
  .node-btn.on rect { fill: var(--brass); stroke: var(--brass-bright); filter: drop-shadow(0 0 8px var(--brass-glow)); }
  .node-btn .lbl { fill: var(--brass-bright); font-size: 13px; font-weight: 600; }
  .node-btn .bit { fill: var(--muted); font-size: 11px; }
  .node-btn.on .lbl, .node-btn.on .bit { fill: #1a130a; }

  .lamp circle { fill: #16202b; stroke: var(--line-strong); stroke-width: 1.5; transition: fill .18s, stroke .18s; }
  .lamp.on circle { fill: var(--signal); stroke: var(--signal); filter: drop-shadow(0 0 10px var(--signal)); }
  .lamp .lbl { fill: var(--paper-2); font-size: 12px; }
  .lamp.on .lbl { fill: #04121d; font-weight: 600; }

  .pin .hit { fill: transparent; cursor: crosshair; }
  .pin .dot { fill: var(--ink-500); stroke: var(--ink-700); stroke-width: 1.5; transition: fill .14s; }
  .pin.on .dot { fill: var(--signal); }
  .pin:hover .dot { fill: var(--brass); }
  .pin.active .dot { fill: var(--brass-bright); stroke: var(--brass); }
  /* unconnected inputs are obvious: dashed red ring (so a floating gate isn't mistaken for "signal from nowhere") */
  .pin.unwired .dot { fill: var(--ink-700); stroke: var(--err); stroke-dasharray: 2 2; }
</style>
