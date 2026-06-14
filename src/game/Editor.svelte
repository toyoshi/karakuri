<script lang="ts">
  import { game } from './store.svelte';
  import { CELL, anchors, cellH, pinXY, pinKey } from './layout';
  import { gridPx } from './levels';
  import type { Instance, Wire, PinRef } from '../sim/circuit';

  let svgEl: SVGSVGElement;
  let mouse = $state({ x: 0, y: 0 });

  const lv = $derived(game.level);
  const px = $derived(gridPx(lv));
  const insts = $derived(game.circuit.instances);
  const byId = $derived(new Map(insts.map(i => [i.id, i])));

  function toSvg(e: PointerEvent | MouseEvent) {
    const p = svgEl.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const m = svgEl.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 } as DOMPoint;
  }
  function onMove(e: PointerEvent) { const p = toSvg(e); mouse = { x: p.x, y: p.y }; }
  function onBgClick(e: MouseEvent) {
    if (game.tool.type === 'place') {
      const p = toSvg(e);
      game.placeAt(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
    } else {
      game.clearWiring();
    }
  }

  function pinAbs(instId: string, pin: string) {
    const i = byId.get(instId);
    return i ? pinXY(i, game.chipLib, pin) : { x: 0, y: 0 };
  }
  function wirePath(w: Wire) {
    const a = pinAbs(w.a.inst, w.a.pin), b = pinAbs(w.b.inst, w.b.pin);
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} H ${mx} V ${b.y} H ${b.x}`;
  }
  function wireLit(w: Wire): boolean {
    const v = game.pinValue(w.a.inst, w.a.pin) ?? game.pinValue(w.b.inst, w.b.pin);
    return v === 1;
  }
  function onPin(e: MouseEvent, ref: PinRef, dir: 'in' | 'out') {
    e.stopPropagation();
    game.pinClicked(ref, dir);
  }
  function onInstClick(e: MouseEvent, inst: Instance) {
    e.stopPropagation();
    if (game.tool.type === 'delete') { game.deleteInstance(inst.id); return; }
    if (inst.kind === 'input') game.toggleInput(inst.name!);
  }
  function onInstContext(e: MouseEvent, inst: Instance) {
    e.preventDefault(); e.stopPropagation();
    game.deleteInstance(inst.id);
  }
</script>

<div class="editor-wrap">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {px.w} {px.h}"
    preserveAspectRatio="xMidYMid meet"
    onpointermove={onMove}
    onclick={onBgClick}
    role="application"
    aria-label="回路エディタ"
  >
    <!-- grid dots -->
    <g class="grid">
      {#each Array(lv.cols + 1) as _, c}
        <line x1={c * CELL} y1="0" x2={c * CELL} y2={px.h} />
      {/each}
      {#each Array(lv.rows + 1) as _, r}
        <line x1="0" y1={r * CELL} x2={px.w} y2={r * CELL} />
      {/each}
    </g>

    <!-- wires -->
    <g class="wires">
      {#each game.circuit.wires as w}
        <path class="wire" class:lit={wireLit(w)} d={wirePath(w)} />
        {#if wireLit(w)}<path class="wire-flow" d={wirePath(w)} />{/if}
      {/each}
    </g>

    <!-- in-progress wire -->
    {#if game.wiring}
      {@const wp = pinAbs(game.wiring.inst, game.wiring.pin)}
      <line class="wire-ghost" x1={wp.x} y1={wp.y} x2={mouse.x} y2={mouse.y} />
    {/if}

    <!-- components -->
    {#each insts as inst (inst.id)}
      {@const h = cellH(inst, game.chipLib)}
      {@const x = inst.x ?? 0}
      {@const y = inst.y ?? 0}
      {@const pad = 9}
      <g class="comp k-{inst.kind}" class:locked={inst.locked}
         oncontextmenu={(e) => onInstContext(e, inst)}>

        {#if inst.kind === 'input'}
          {@const on = game.pinValue(inst.id, 'y') === 1}
          <g class="node-btn" class:on role="button" tabindex="-1"
             onclick={(e) => onInstClick(e, inst)}>
            <rect x={x * CELL + pad} y={y * CELL + pad} width={CELL - pad * 2} height={CELL - pad * 2} rx="9" />
            <text class="lbl" x={(x + 0.5) * CELL} y={(y + 0.42) * CELL}>{inst.name}</text>
            <text class="bit" x={(x + 0.5) * CELL} y={(y + 0.68) * CELL}>{on ? 1 : 0}</text>
          </g>
        {:else if inst.kind === 'output'}
          {@const on = game.pinValue(inst.id, 'x') === 1}
          <g class="lamp" class:on>
            <circle cx={(x + 0.5) * CELL} cy={(y + 0.5) * CELL} r={CELL * 0.3} />
            <text class="lbl" x={(x + 0.5) * CELL} y={(y + 0.5) * CELL + 4}>{inst.name}</text>
          </g>
        {:else if inst.kind === 'high' || inst.kind === 'low'}
          <g onclick={(e) => onInstClick(e, inst)}>
            <rect x={x * CELL + pad} y={y * CELL + pad} width={CELL - pad * 2} height={CELL - pad * 2} rx="9" />
            <text class="lbl" x={(x + 0.5) * CELL} y={(y + 0.58) * CELL}>{inst.kind === 'high' ? '1' : '0'}</text>
          </g>
        {:else}
          <!-- nand / chip -->
          <g onclick={(e) => onInstClick(e, inst)}>
            <rect class="body" x={x * CELL + pad} y={y * CELL + pad}
                  width={CELL - pad * 2} height={h * CELL - pad * 2} rx="10" />
            <text class="glyph" x={(x + 0.5) * CELL} y={(y + h * 0.5) * CELL + 5}>
              {inst.kind === 'nand' ? 'NAND' : (game.chipLib.get(inst.chipId!)?.glyph ?? '?')}
            </text>
            {#if inst.kind === 'chip'}
              <text class="cname" x={(x + 0.5) * CELL} y={(y + h * 0.5) * CELL + 22}>
                {game.chipLib.get(inst.chipId!)?.name}
              </text>
            {/if}
          </g>
        {/if}

        <!-- pins -->
        {#each anchors(inst, game.chipLib) as p}
          {@const pos = pinXY(inst, game.chipLib, p.name)}
          {@const v = game.pinValue(inst.id, p.name)}
          <g class="pin p-{p.dir}" class:on={v === 1}
             class:active={game.wiring && game.wiring.inst === inst.id && game.wiring.pin === p.name}
             onclick={(e) => onPin(e, { inst: inst.id, pin: p.name }, p.dir)}
             role="button" tabindex="-1">
            <circle class="hit" cx={pos.x} cy={pos.y} r="11" />
            <circle class="dot" cx={pos.x} cy={pos.y} r="5" />
          </g>
        {/each}
      </g>
    {/each}
  </svg>
</div>

<style>
  .editor-wrap { width: 100%; height: 100%; display: grid; place-items: center; padding: var(--sp-4); overflow: auto; }
  svg { width: 100%; height: 100%; max-width: 100%; touch-action: none; }

  .grid line { stroke: var(--line); stroke-width: 1; }

  .wire { fill: none; stroke: var(--ink-500); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
  .wire.lit { stroke: var(--signal); filter: drop-shadow(0 0 4px var(--signal-d)); }
  .wire-flow {
    fill: none; stroke: var(--brass-bright); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 2 16; opacity: 0.9; animation: flow 0.6s linear infinite;
  }
  @keyframes flow { to { stroke-dashoffset: -18; } }
  .wire-ghost { stroke: var(--brass); stroke-width: 2.5; stroke-dasharray: 5 5; opacity: 0.8; }

  .comp text { font-family: var(--font-mono); text-anchor: middle; pointer-events: none; }
  .comp .body { fill: #1b2330; stroke: var(--line-strong); stroke-width: 1.5; transition: stroke 0.15s, fill 0.15s; }
  .k-nand .glyph { fill: var(--paper-2); font-size: 13px; font-weight: 600; }
  .k-chip .body { fill: #1a2030; stroke: var(--verdigris-d); }
  .k-chip .glyph { fill: var(--verdigris); font-size: 20px; }
  .k-chip .cname { fill: var(--muted); font-size: 9px; letter-spacing: 0.08em; }
  .comp:not(.locked) .body:hover { stroke: var(--brass); cursor: pointer; }

  .node-btn rect { fill: #221b10; stroke: var(--brass-deep); stroke-width: 1.5; cursor: pointer; transition: all 0.15s; }
  .node-btn.on rect { fill: var(--brass); stroke: var(--brass-bright); filter: drop-shadow(0 0 8px var(--brass-glow)); }
  .node-btn .lbl { fill: var(--brass-bright); font-size: 13px; font-weight: 600; }
  .node-btn .bit { fill: var(--muted); font-size: 12px; }
  .node-btn.on .lbl, .node-btn.on .bit { fill: #1a130a; }

  .lamp circle { fill: #16202b; stroke: var(--line-strong); stroke-width: 1.5; transition: all 0.18s; }
  .lamp.on circle { fill: var(--signal); stroke: var(--signal); filter: drop-shadow(0 0 10px var(--signal)); }
  .lamp .lbl { fill: var(--paper-2); font-size: 12px; }
  .lamp.on .lbl { fill: #04121d; font-weight: 600; }

  .pin .hit { fill: transparent; cursor: crosshair; }
  .pin .dot { fill: var(--ink-500); stroke: var(--ink-700); stroke-width: 1.5; transition: fill 0.15s; }
  .pin.on .dot { fill: var(--signal); }
  .pin:hover .dot { fill: var(--brass); }
  .pin.active .dot { fill: var(--brass-bright); stroke: var(--brass); }
  .p-out .dot { }
</style>
