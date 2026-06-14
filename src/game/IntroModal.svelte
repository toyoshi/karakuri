<script lang="ts">
  import { game } from './store.svelte';
  import { buildSwitch, runSwitch } from '../sim/switchlevel';
  import type { Bit } from '../sim/netlist';

  let { onclose }: { onclose: () => void } = $props();
  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);

  let i = $state(0);
  // interactive CMOS NAND (slide 4)
  let A = $state<Bit>(1), B = $state<Bit>(1);
  const w = (ai: string, ap: string, bi: string, bp: string) => ({ a: { inst: ai, pin: ap }, b: { inst: bi, pin: bp } });
  const nandCircuit = {
    instances: [
      { id: 'A', kind: 'input', name: 'A' }, { id: 'B', kind: 'input', name: 'B' }, { id: 'Y', kind: 'output', name: 'Y' },
      { id: 'P', kind: 'high' }, { id: 'G', kind: 'low' },
      { id: 'p1', kind: 'pmos' }, { id: 'p2', kind: 'pmos' }, { id: 'n1', kind: 'nmos' }, { id: 'n2', kind: 'nmos' },
    ] as any,
    wires: [
      w('A', 'y', 'p1', 'g'), w('A', 'y', 'n1', 'g'), w('B', 'y', 'p2', 'g'), w('B', 'y', 'n2', 'g'),
      w('P', 'y', 'p1', 's'), w('P', 'y', 'p2', 's'), w('p1', 'd', 'Y', 'x'), w('p2', 'd', 'Y', 'x'),
      w('Y', 'x', 'n1', 's'), w('n1', 'd', 'n2', 's'), w('n2', 'd', 'G', 'y'),
    ],
  };
  const net = buildSwitch(nandCircuit as any);
  const sim = $derived(runSwitch(net, { A, B }));
  const Y = $derived(sim.outputs.Y);
  const trOn = (id: string, type: 'n' | 'p') => (type === 'n' ? (id === 'n1' ? A : B) === 1 : (id === 'p1' ? A : B) === 0);

  const slides = [
    {
      k: 'power',
      title: L('NANDは、たった一種類で万能。', 'NAND alone is universal.'),
      body: L('NANDは「極小完全」な論理ゲート。これ一種類さえあれば、NOT・AND・OR・XOR はもちろん、加算器・デコーダ・エンコーダ…あらゆる組み合わせ回路が作れる。だからこのゲームは、NAND から始まる。', 'NAND is functionally complete: with this one gate you can build NOT, AND, OR, XOR — and adders, decoders, encoders, any combinational circuit at all. That is why this game begins at NAND.'),
    },
    {
      k: 'opening',
      title: L('ずっと昔、ひとつのスイッチから。', 'Long ago, from a single switch.'),
      body: L('では、その万能の NAND 自体は何でできている？ コンピュータの最小部品は「スイッチ」。電気を通すか、止めるか——たったそれだけだ。', 'But what is that all-powerful NAND itself made of? The smallest part of a computer is a switch: let current through, or stop it. Only that.'),
    },
    {
      k: 'transistor',
      title: L('トランジスタ＝電圧で開くスイッチ', 'A transistor is a voltage-controlled switch'),
      body: L('ゲートに電圧をかけると道がつながる。NMOS は入力が 1 のとき導通、PMOS は 0 のとき導通する。逆向きの双子だ。', 'Apply voltage to the gate and the path connects. NMOS conducts on 1; PMOS conducts on 0 — mirror twins.'),
    },
    {
      k: 'inverter',
      title: L('上下に組むと「反転(NOT)」', 'Stack them: an inverter (NOT)'),
      body: L('電源(1)と接地(0)の間に、PMOS を上・NMOS を下に。入力が 1 なら下がつながり 0 へ、0 なら上がつながり 1 へ。入力を反転する。', 'Between power(1) and ground(0): PMOS on top, NMOS below. Input 1 drains to 0; input 0 pulls up to 1. It inverts.'),
    },
    {
      k: 'nand',
      title: L('PMOS2・NMOS2 で「NAND」', 'NAND, from 2 PMOS + 2 NMOS'),
      body: L('上を並列、下を直列に。両方が 1 のときだけ下の道がつながり 0 になる。下のスイッチを触って確かめてみて。', 'Parallel on top, series below. Only when both are 1 does the bottom path close to 0. Toggle the switches below.'),
      interactive: true,
    },
    {
      k: 'finale',
      title: L('——というわけで、NAND は生まれた。', '…and so, the NAND was born.'),
      body: L('この一種類さえあれば、AND も OR も、加算器も、記憶も、CPU も、すべて組み上がる。下より上は物理の領域。ここから先は、君の番だ。', 'With just this one gate you can build AND, OR, adders, memory, a CPU — everything. Below this is physics. From here, it is your turn.'),
    },
  ];
  const s = $derived(slides[i]);
  const last = $derived(i === slides.length - 1);
  function next() { if (last) onclose(); else i++; }
  function prev() { if (i > 0) i--; }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={L('NANDの作り方', 'How NAND is made')}>
  <div class="card">
    <button class="x" onclick={onclose} aria-label="close">✕</button>
    <div class="eyebrow">{L('NANDの話', 'About NAND')} · {i + 1}/{slides.length}</div>

    <div class="stage k-{s.k}">
      {#if s.k === 'power'}
        <svg viewBox="0 0 260 150" class="art fanout">
          <rect class="nandbox" x="100" y="14" width="60" height="30" rx="6"/><text x="130" y="33" class="big">NAND</text>
          {#each ['NOT', 'AND', 'OR', 'XOR', '＋', '▣'] as g, k}
            {@const cx = 26 + k * 42}
            <line class="wire lit" x1="130" y1="44" x2={cx} y2="96"/>
            <rect x={cx - 18} y="96" width="36" height="26" rx="5"/><text x={cx} y="113">{g}</text>
          {/each}
          <text class="cap" x="130" y="140">{L('すべて NAND から', 'all from NAND')}</text>
        </svg>
      {:else if s.k === 'opening'}
        <svg viewBox="0 0 120 90" class="art"><g class="sw"><line class="wire lit" x1="10" y1="45" x2="45" y2="45"/><rect x="45" y="33" width="30" height="24" rx="4"/><text x="60" y="49">SW</text><line class="wire" x1="75" y1="45" x2="110" y2="45"/></g></svg>
      {:else if s.k === 'transistor'}
        <svg viewBox="0 0 220 90" class="art">
          <g class="tr on"><rect x="20" y="25" width="60" height="40" rx="6"/><text x="50" y="42">NMOS</text><text class="sub" x="50" y="56">1で導通</text></g>
          <g class="tr"><rect x="140" y="25" width="60" height="40" rx="6" class="p"/><text x="170" y="42">PMOS</text><text class="sub" x="170" y="56">0で導通</text></g>
        </svg>
      {:else if s.k === 'inverter'}
        <svg viewBox="0 0 160 150" class="art">
          <text class="rail" x="80" y="14">1</text><line class="wire" x1="80" y1="20" x2="80" y2="40"/>
          <rect class="p" x="55" y="40" width="50" height="28" rx="5"/><text x="80" y="58">PMOS</text>
          <line class="wire lit" x1="80" y1="68" x2="80" y2="82"/><circle class="node" cx="120" cy="75" r="6"/><line class="wire" x1="80" y1="75" x2="114" y2="75"/><text class="o" x="135" y="79">Y</text>
          <rect x="55" y="82" width="50" height="28" rx="5"/><text x="80" y="100">NMOS</text>
          <line class="wire" x1="80" y1="110" x2="80" y2="130"/><text class="rail" x="80" y="144">0</text>
          <text class="in" x="30" y="79">X</text><line class="wire" x1="38" y1="75" x2="55" y2="54"/><line class="wire" x1="38" y1="75" x2="55" y2="96"/>
        </svg>
      {:else if s.interactive}
        <svg viewBox="0 0 240 170" class="art nand">
          <text class="rail" x="120" y="12">1</text>
          <line class="wire" class:lit={true} x1="120" y1="16" x2="120" y2="28"/>
          <line class="wire lit" x1="60" y1="28" x2="180" y2="28"/>
          <rect class="p" class:on={trOn('p1','p')} x="40" y="28" width="44" height="26" rx="5"/><text x="62" y="45">P</text>
          <rect class="p" class:on={trOn('p2','p')} x="156" y="28" width="44" height="26" rx="5"/><text x="178" y="45">P</text>
          <line class="wire" class:lit={Y === 1} x1="62" y1="54" x2="62" y2="80"/>
          <line class="wire" class:lit={Y === 1} x1="178" y1="54" x2="178" y2="80"/>
          <line class="wire" class:lit={Y === 1} x1="62" y1="80" x2="178" y2="80"/>
          <circle class="node" class:on={Y === 1} cx="120" cy="80" r="5"/>
          <line class="wire" class:lit={Y === 1} x1="120" y1="80" x2="120" y2="92"/>
          <rect class="n" class:on={trOn('n1','n')} x="98" y="92" width="44" height="24" rx="5"/><text x="120" y="108">N</text>
          <rect class="n" class:on={trOn('n2','n')} x="98" y="120" width="44" height="24" rx="5"/><text x="120" y="136">N</text>
          <line class="wire" x1="120" y1="144" x2="120" y2="156"/><text class="rail" x="120" y="168">0</text>
          <circle class="lamp" class:on={Y === 1} cx="216" cy="80" r="10"/><line class="wire" class:lit={Y===1} x1="178" y1="80" x2="206" y2="80"/><text class="o" x="216" y="84">{Y}</text>
        </svg>
        <div class="toggles">
          <button class="tog" class:on={A === 1} onclick={() => A = (A ? 0 : 1)}>A = {A}</button>
          <button class="tog" class:on={B === 1} onclick={() => B = (B ? 0 : 1)}>B = {B}</button>
          <span class="eq">→ Y = <b class:on={Y === 1}>{Y}</b></span>
        </div>
      {:else}
        <svg viewBox="0 0 300 60" class="art ladder">
          {#each ['⎓', 'NAND', '∧∨', '＋', '▭', '▣'] as g, k}
            <g><rect x={6 + k * 49} y="16" width="42" height="28" rx="5"/><text x={27 + k * 49} y="34">{g}</text></g>
            {#if k < 5}<text class="arr" x={52 + k * 49} y="34">→</text>{/if}
          {/each}
        </svg>
      {/if}
    </div>

    <h2>{s.title}</h2>
    <p>{s.body}</p>

    <div class="nav">
      <div class="dots">{#each slides as _, k}<span class="dot" class:on={k === i}></span>{/each}</div>
      <div class="btns">
        {#if i > 0}<button class="btn btn--ghost" onclick={prev}>{L('戻る', 'Back')}</button>{/if}
        <button class="btn" onclick={next}>{last ? L('はじめる', 'Start') : L('次へ', 'Next')}</button>
      </div>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: var(--sp-4);
    background: color-mix(in srgb, var(--ink-900) 80%, transparent); backdrop-filter: blur(6px); }
  .card { position: relative; width: min(560px, 100%); background: linear-gradient(180deg, var(--ink-700), var(--ink-800));
    border: 1px solid var(--line-strong); border-radius: var(--r-4); padding: var(--sp-6); box-shadow: var(--sh-3); }
  .x { position: absolute; top: 14px; right: 14px; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1rem; }
  .x:hover { color: var(--paper); }
  .eyebrow { font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--brass); }
  .stage { display: grid; place-items: center; min-height: 190px; margin: var(--sp-4) 0; }
  .art { width: 100%; max-height: 200px; }
  h2 { font-size: var(--step-2); margin-top: var(--sp-2); }
  p { color: var(--paper-2); margin-top: var(--sp-3); line-height: 1.65; min-height: 4.5em; }

  /* shared schematic styling */
  .art text { font-family: var(--font-mono); font-size: 9px; text-anchor: middle; fill: var(--paper-2); }
  .art .sub { font-size: 6px; fill: var(--muted); }
  .art .rail { fill: var(--brass); font-size: 11px; font-weight: 700; }
  .art .o { fill: var(--signal); } .art .in { fill: var(--brass); }
  .art .arr { fill: var(--faint); font-size: 12px; }
  .wire { stroke: var(--ink-500); stroke-width: 2.5; fill: none; }
  .wire.lit { stroke: var(--signal); filter: drop-shadow(0 0 3px var(--signal-d)); }
  .art rect { fill: #1b2330; stroke: var(--line-strong); stroke-width: 1.4; }
  .art rect.p { fill: #241a12; stroke: var(--copper); }
  .art rect.n { fill: #11212c; stroke: var(--signal-d); }
  .tr.on rect, .nand rect.on { stroke-width: 2.4; filter: drop-shadow(0 0 5px currentColor); }
  .nand rect.p.on { stroke: var(--brass-bright); } .nand rect.n.on { stroke: var(--signal); }
  .node { fill: var(--ink-500); } .node.on { fill: var(--signal); }
  .fanout .nandbox { fill: #1a2030; stroke: var(--verdigris-d); stroke-width: 1.6; }
  .fanout .big { fill: var(--verdigris); font-size: 12px; font-weight: 600; }
  .fanout .cap { fill: var(--muted); font-size: 8px; }
  .lamp { fill: #16202b; stroke: var(--line-strong); stroke-width: 1.5; } .lamp.on { fill: var(--signal); stroke: var(--signal); filter: drop-shadow(0 0 8px var(--signal)); }

  .toggles { display: flex; align-items: center; gap: var(--sp-3); margin-top: var(--sp-3); }
  .tog { font-family: var(--font-mono); padding: 6px 14px; border-radius: var(--r-full); border: 1px solid var(--brass-deep); background: #221b10; color: var(--brass-bright); cursor: pointer; }
  .tog.on { background: var(--brass); color: #1a130a; }
  .eq { font-family: var(--font-mono); color: var(--paper-2); } .eq b { color: var(--faint); } .eq b.on { color: var(--signal); }

  .nav { display: flex; align-items: center; justify-content: space-between; margin-top: var(--sp-5); }
  .dots { display: flex; gap: 6px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-500); }
  .dot.on { background: var(--brass); }
  .btns { display: flex; gap: var(--sp-2); }
</style>
