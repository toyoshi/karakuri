<script lang="ts">
  import { game } from './store.svelte';
  import { LEVELS } from './levels';
  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);
  function start() { location.hash = '#play'; }
  const ladder = [
    { g: '⎓', ja: 'トランジスタ', en: 'Transistor' },
    { g: 'NAND', ja: '論理ゲート', en: 'Logic gate' },
    { g: '＋', ja: '加算器', en: 'Adder' },
    { g: '▭', ja: '記憶', en: 'Memory' },
    { g: '▣', ja: 'CPU', en: 'CPU' },
  ];
</script>

<header class="lhead wrap">
  <div class="brand">
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="none" stroke="var(--brass)" stroke-width="1" opacity="0.5"/>
      <path d="M9 11h5a5 5 0 0 1 0 10H9z" fill="none" stroke="var(--signal)" stroke-width="2"/>
      <path d="M14 16h9M23 13v6" stroke="var(--brass)" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <b>{L('スイッチからCPU', 'Switch → CPU')}</b>
  </div>
  <div class="lnav">
    <div class="lang">
      <button class:on={game.lang === 'ja'} onclick={() => game.setLang('ja')}>日本語</button>
      <button class:on={game.lang === 'en'} onclick={() => game.setLang('en')}>EN</button>
    </div>
    <button class="btn" onclick={start}>{L('始める', 'Start')}</button>
  </div>
</header>

<main>
  <section class="hero wrap">
    <div class="hero__copy">
      <span class="kicker">{L('無料 · オープン · ブラウザだけ', 'Free · open · browser-only')}</span>
      <h1>{L('スイッチひとつから、', 'From a single switch,')}<br><em>{L('CPUの全部を。', 'a whole CPU.')}</em></h1>
      <p class="lede">{L(
        'トランジスタから論理ゲート、加算器、記憶、そしてCPUまで。部品を一段ずつ自分の手で組み、作ったものを次の部品として使う。気づけば、コンピュータの“なぜ動くのか”が手の中にある。',
        'Transistor → logic gates → adder → memory → a working CPU. Build each layer by hand, then use what you built as the next part. Piece by piece, how a computer works ends up in your hands.'
      )}</p>
      <div class="cta">
        <button class="btn btn--lg" onclick={start}>{L('組みはじめる', 'Start building')}</button>
        <a class="btn btn--ghost btn--lg" href="#play" onclick={start}>{L('最初の課題：NOTを作る', 'First task: build NOT')}</a>
      </div>
      <div class="ladder">
        {#each ladder as s, i}
          <div class="rung"><span class="g">{s.g}</span><span class="t">{L(s.ja, s.en)}</span></div>
          {#if i < ladder.length - 1}<span class="arr">→</span>{/if}
        {/each}
      </div>
    </div>

    <div class="hero__art" aria-hidden="true">
      <svg viewBox="0 0 330 300">
        <g class="w">
          <!-- inputs → NANDs -->
          <path class="wire lit" d="M44 100 H96" /><path class="flow" d="M44 100 H96" />
          <path class="wire lit" d="M44 200 H96" /><path class="flow" d="M44 200 H96" />
          <!-- NAND outputs → XOR inputs -->
          <path class="wire lit" d="M164 100 H189 V138 H214" /><path class="flow" d="M164 100 H189 V138 H214" />
          <path class="wire lit" d="M164 200 H189 V162 H214" /><path class="flow" d="M164 200 H189 V162 H214" />
          <!-- XOR → lamp -->
          <path class="wire lit" d="M278 150 H301" /><path class="flow" d="M278 150 H301" />
        </g>
        <g class="gate"><rect x="96" y="78" width="68" height="44" rx="9"/><text x="130" y="105">NAND</text></g>
        <g class="gate"><rect x="96" y="178" width="68" height="44" rx="9"/><text x="130" y="205">NAND</text></g>
        <g class="gate big"><rect x="214" y="122" width="64" height="56" rx="9"/><text x="246" y="158">⊕</text></g>
        <circle class="src on" cx="44" cy="100" r="9"/>
        <circle class="src on" cx="44" cy="200" r="9"/>
        <circle class="lamp on" cx="312" cy="150" r="11"/>
      </svg>
      <span class="live">live · 信号が流れています</span>
    </div>
  </section>

  <section class="manifesto wrap">
    <div>
      <span class="kicker">{L('なぜ無料で', 'Why free')}</span>
      <p class="q">{L('学びの入口に、', 'No price tag')}<span>{L('値札を貼らない。', 'on the door to learning.')}</span></p>
    </div>
    <div class="mbody">
      <p>{L(
        'プログラミング教育の多くは、月額やコース料金で組まれている。本来いちばん安く配れるはずの知識が、ビジネスの都合で高く売られている。',
        'Most programming education is built on subscriptions and course fees — knowledge, the cheapest thing to copy, sold dear for business reasons.'
      )}</p>
      <p>{L(
        'このサイトはその逆を行く。広告も課金も登録もない。ソースは公開、すべてブラウザの中で動く。そして無料でも陳腐ではない——扱う中身は、本物のコンピュータサイエンスそのものだ。',
        "This project does the opposite. No ads, no paywall, no signup. Open source, all in your browser. And free doesn't mean shallow — what you build here is real computer science."
      )}</p>
    </div>
  </section>

  <section class="closer wrap">
    <h2>{L('最初のNANDを、置いてみる。', 'Place your first NAND.')}</h2>
    <button class="btn btn--lg" onclick={start}>{L('工房へ入る', 'Enter the workshop')}</button>
  </section>
</main>

<footer class="lfoot wrap">
  <span>© {new Date().getFullYear()} {L('スイッチからCPU', 'Switch → CPU')} — {L('オープンな教育プロジェクト', 'an open education project')}</span>
</footer>

<style>
  .lhead { display: flex; align-items: center; justify-content: space-between; height: 64px; }
  .brand { display: flex; align-items: center; gap: 0.5em; font-family: var(--font-display); font-size: 1.3rem; color: var(--paper); }
  .lnav { display: flex; align-items: center; gap: var(--sp-4); }
  .lang { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r-full); overflow: hidden; }
  .lang button { background: transparent; color: var(--muted); border: none; padding: 6px 12px; cursor: pointer; font-family: inherit; font-size: 0.72rem; }
  .lang button.on { background: var(--brass); color: #1a130a; }

  .hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: clamp(1.5rem, 5vw, 4rem); align-items: center; padding-block: clamp(2.5rem, 8vw, 6rem); }
  @media (max-width: 880px) { .hero { grid-template-columns: 1fr; } }
  h1 { font-size: var(--step-5); letter-spacing: -0.02em; margin-top: var(--sp-4); }
  h1 em { font-style: normal; color: var(--signal); }
  .lede { font-size: var(--step-1); color: var(--paper-2); max-width: 42ch; margin-top: var(--sp-5); }
  .cta { display: flex; gap: var(--sp-3); flex-wrap: wrap; margin-top: var(--sp-6); }
  .ladder { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: var(--sp-6); }
  .rung { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 12px; border: 1px solid var(--line); border-radius: var(--r-2); background: var(--ink-800); }
  .rung .g { font-family: var(--font-mono); font-size: 0.8rem; color: var(--brass); font-weight: 600; }
  .rung .t { font-size: 0.66rem; color: var(--muted); }
  .ladder .arr { color: var(--faint); }

  .hero__art { position: relative; border: 1px solid var(--line-strong); border-radius: var(--r-4); background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent 30%), var(--ink-850); aspect-ratio: 1; box-shadow: var(--sh-3); overflow: hidden; }
  .hero__art svg { width: 100%; height: 100%; }
  .wire { fill: none; stroke: var(--ink-500); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
  .wire.lit { stroke: var(--signal); filter: drop-shadow(0 0 4px var(--signal-d)); }
  .flow { fill: none; stroke: var(--brass-bright); stroke-width: 3.5; stroke-dasharray: 2 16; stroke-linecap: round; animation: flow 0.6s linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -18; } }
  .gate rect { fill: #1b2330; stroke: var(--line-strong); stroke-width: 1.5; }
  .gate.big rect { stroke: var(--verdigris-d); }
  .gate text { fill: var(--paper-2); font-family: var(--font-mono); font-size: 12px; text-anchor: middle; }
  .gate.big text { fill: var(--verdigris); font-size: 20px; }
  .src { fill: #221b10; stroke: var(--brass-deep); stroke-width: 1.5; }
  .src.on { fill: var(--brass); filter: drop-shadow(0 0 6px var(--brass-glow)); }
  .lamp { fill: #16202b; stroke: var(--line-strong); stroke-width: 1.5; }
  .lamp.on { fill: var(--signal); filter: drop-shadow(0 0 12px var(--signal)); }
  .live { position: absolute; bottom: 12px; left: 14px; font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.1em; color: var(--brass); text-transform: uppercase; }

  .manifesto { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1.5rem,5vw,4rem); padding-block: clamp(2.5rem,7vw,5rem); border-top: 1px solid var(--line); }
  @media (max-width: 820px) { .manifesto { grid-template-columns: 1fr; } }
  .q { font-family: var(--font-display); font-size: var(--step-3); line-height: 1.25; color: var(--paper); max-width: 16ch; }
  .q span { color: var(--brass); }
  .mbody p { color: var(--paper-2); }
  .mbody p + p { margin-top: var(--sp-4); }

  .closer { text-align: center; padding-block: clamp(3rem,8vw,6rem); border-top: 1px solid var(--line); }
  .closer h2 { font-size: var(--step-4); max-width: 18ch; margin: 0 auto var(--sp-5); }
  .lfoot { padding-block: var(--sp-6); border-top: 1px solid var(--line); color: var(--faint); font-size: var(--step--1); }
</style>
