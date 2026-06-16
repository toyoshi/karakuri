<script lang="ts">
  import { game } from './store.svelte';
  import { makeShareCard, dispatchShare } from './sharecard';
  import { recordClip, shareClip, clipSupported } from './clipanim';
  import { rankText } from './leaderboard';

  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);
  const data = game.cardData();      // snapshot at the moment of clearing
  const text = game.shareText();
  const rec = game.lastRecord;
  const circ = data.circuit;         // your actual circuit, as render data (CELL coords)
  const brand = L('スイッチからCPU', 'Switch → CPU');

  // the share image / clip are only generated when you actually share — the
  // on-screen result below is pure HTML/SVG, so it appears instantly.
  let blob: Blob | null = null;
  let sharing = $state(false);
  async function share() {
    if (sharing) return;
    sharing = true;
    if (!blob) blob = await makeShareCard(data);
    const r = await dispatchShare(blob, text, data.url);
    sharing = false;
    game.message = { text: r === 'shared' ? L('シェアしました', 'Shared!') : L('シェア画像を保存しました（SNSに貼れます）', 'Share image saved — post it anywhere'), kind: 'ok' };
  }
  const canClip = clipSupported();
  let recording = $state(false);
  async function shareVideo() {
    if (recording || !circ) return;
    recording = true;
    const clip = await recordClip(circ, `${data.title} · ${data.cost} ${data.unit} · ${brand}`);
    recording = false;
    if (!clip) { game.message = { text: L('この端末は動画書き出しに未対応。画像でどうぞ。', 'Video export not supported here — use the image.'), kind: 'err' }; return; }
    const r = await shareClip(clip, text, data.url);
    game.message = { text: r === 'shared' ? L('動画をシェアしました', 'Shared the clip!') : L('動画を保存しました（SNSに貼れます）', 'Clip saved — post it anywhere'), kind: 'ok' };
  }
  const isLast = $derived(game.levelIdx >= game.totalLevels - 1);
  function next() { game.loadLevel(game.levelIdx + 1); }
  function close() { game.showWin = false; }

  // smooth horizontal bezier between two pins, matching the editor's wire look
  function wirePath(w: { ax: number; ay: number; bx: number; by: number }): string {
    const dx = Math.max(26, Math.abs(w.bx - w.ax) * 0.5);
    return `M ${w.ax} ${w.ay} C ${w.ax + dx} ${w.ay} ${w.bx - dx} ${w.by} ${w.bx} ${w.by}`;
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={L('クリア', 'Solved')}>
  <div class="card">
    <button class="x" onclick={close} aria-label="close">✕</button>
    <div class="head">
      <span class="kicker">{L('課題クリア', 'SOLVED')}</span>
      <div class="tags">
        {#if rec?.optimal}<span class="tag star">★ {L('最小達成', 'optimal')}</span>{/if}
        {#if rec?.gate}<span class="tag best">🏆 {L('自己ベスト更新', 'new best')}</span>{/if}
      </div>
    </div>

    <!-- the result, rendered as HTML/SVG (no image) -->
    <div class="result">
      <div class="rtop">
        <h3 class="title">{data.title}</h3>
        <div class="metric">
          <b>{data.cost}</b><span class="unit">{data.unit}</span>
        </div>
      </div>
      <div class="rsub">
        {L('個で組み上げた', 'to build it')}
        {#if data.delay != null}<span class="dot">·</span>{L('遅延', 'delay')} {data.delay}{/if}
        <span class="dot">·</span>{L('目標', 'par')} {data.par}
        {#if data.optimal}<span class="ok">{L('（最小）', '(optimal)')}</span>{/if}
      </div>

      {#if circ && circ.nodes.length}
        <div class="canvas">
          <svg viewBox="0 0 {circ.w} {circ.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={L('組み上げた回路', 'your circuit')}>
            {#each circ.wires as w}
              <path class="wire" class:lit={w.lit} d={wirePath(w)} />
            {/each}
            {#each circ.nodes as n}
              <g class="node {n.kind}" class:on={n.on}>
                <rect x={n.x} y={n.y} width={n.cw} height={n.ch} rx="9" />
                <text x={n.x + n.cw / 2} y={n.y + n.ch / 2}>{n.label}</text>
              </g>
            {/each}
          </svg>
        </div>
      {/if}
    </div>

    {#if game.rank && game.rank.n > 1}
      <div class="rank">🌐 {rankText(game.rank, game.lang)}</div>
    {/if}

    <div class="totals">{L('通算', 'Total')} · NAND {data.totalNands} · ★{data.stars} · {data.cleared}</div>

    <div class="btns">
      <button class="btn" onclick={share} disabled={sharing}>{sharing ? '…' : '↗ ' + L('画像でシェア', 'Share image')}</button>
      {#if canClip}<button class="btn btn--ghost" onclick={shareVideo} disabled={recording}>{recording ? '…' : '🎬 ' + L('動画', 'Video')}</button>{/if}
      {#if !isLast}<button class="btn btn--ghost" onclick={next}>{L('次へ', 'Next')} →</button>{/if}
      <button class="btn btn--ghost" onclick={close}>{L('閉じる', 'Close')}</button>
    </div>
    <p class="hint">{L('「画像でシェア」で結果カードを保存してSNSに貼れます。友達に「何ゲートで作れた？」と挑戦しよう。', 'Hit "Share image" to save a result card and post it — challenge a friend to beat your gate count.')}</p>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: var(--sp-4);
    background: color-mix(in srgb, var(--ink-900) 80%, transparent); backdrop-filter: blur(6px); }
  .card { position: relative; width: min(620px, 100%); background: linear-gradient(180deg, var(--ink-700), var(--ink-800));
    border: 1px solid var(--ok); border-radius: var(--r-4); padding: var(--sp-5) var(--sp-5) var(--sp-4);
    box-shadow: var(--sh-3), 0 0 0 1px rgba(110,210,154,0.25); }
  .x { position: absolute; top: 14px; right: 14px; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1rem; }
  .x:hover { color: var(--paper); }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); flex-wrap: wrap; }
  .kicker { color: var(--ok); }
  .kicker::before { background: var(--ok); }
  .tags { display: flex; gap: 8px; }
  .tag { font-family: var(--font-mono); font-size: 0.7rem; padding: 3px 10px; border-radius: var(--r-full); border: 1px solid var(--line-strong); }
  .tag.star { color: var(--brass-bright); border-color: var(--brass-deep); }
  .tag.best { color: var(--ok); border-color: var(--verdigris-d); }

  .result { margin: var(--sp-4) 0; border: 1px solid var(--line); border-radius: var(--r-3);
    background: radial-gradient(700px 400px at 70% -20%, rgba(108,198,255,0.06), transparent 60%), var(--ink-900); padding: var(--sp-4); }
  .rtop { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); }
  .title { font-family: var(--font-display); font-size: var(--step-2); color: var(--paper); margin: 0; }
  .metric { flex: none; display: flex; align-items: baseline; gap: 6px; }
  .metric b { font-family: var(--font-mono); font-size: var(--step-4); color: var(--brass-bright); line-height: 1; }
  .metric .unit { font-family: var(--font-mono); font-size: var(--step-0); color: var(--muted); }
  .rsub { margin-top: 4px; font-size: 0.8rem; color: var(--muted); font-family: var(--font-mono); }
  .rsub .dot { margin: 0 6px; color: var(--faint); }
  .rsub .ok { color: var(--brass-bright); margin-left: 6px; }

  .canvas { margin-top: var(--sp-4); aspect-ratio: 16 / 9; max-height: 260px; }
  .canvas svg { width: 100%; height: 100%; }
  .wire { fill: none; stroke: var(--ink-500); stroke-width: 4; stroke-linecap: round; }
  .wire.lit { stroke: var(--signal); filter: drop-shadow(0 0 4px var(--signal-d)); }
  .node rect { fill: var(--ink-700); stroke: var(--line-strong); stroke-width: 1.5; }
  .node text { fill: var(--paper-2); font-family: var(--font-mono); font-size: 22px; font-weight: 600; text-anchor: middle; dominant-baseline: central; }
  .node.input rect, .node.output rect { fill: var(--ink-850); stroke: var(--brass-deep); }
  .node.input.on rect, .node.output.on rect { fill: color-mix(in srgb, var(--signal) 22%, var(--ink-850)); stroke: var(--signal); filter: drop-shadow(0 0 6px var(--signal-d)); }
  .node.chip rect { stroke: var(--verdigris-d); }
  .node.chip text { fill: var(--verdigris); font-size: 26px; }

  .rank { margin-top: -2px; margin-bottom: var(--sp-3); text-align: center; font-family: var(--font-mono); font-size: var(--step-0); color: var(--brass-bright); }
  .totals { text-align: center; font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); margin-bottom: var(--sp-3); }
  .btns { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
  .hint { margin-top: var(--sp-3); font-size: 0.74rem; color: var(--muted); line-height: 1.5; }
</style>
