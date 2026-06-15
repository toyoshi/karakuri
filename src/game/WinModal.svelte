<script lang="ts">
  import { game } from './store.svelte';
  import { makeShareCard, dispatchShare } from './sharecard';
  import { recordClip, shareClip, clipSupported } from './clipanim';
  import { rankText } from './leaderboard';

  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);
  const data = game.cardData();      // snapshot at the moment of clearing
  const text = game.shareText();
  const rec = game.lastRecord;

  let imgUrl = $state('');
  let blob: Blob | null = null;
  let sharing = $state(false);

  $effect(() => {
    let dead = false;
    makeShareCard(data).then(b => { if (dead) return; blob = b; imgUrl = URL.createObjectURL(b); });
    return () => { dead = true; if (imgUrl) URL.revokeObjectURL(imgUrl); };
  });

  async function share() {
    if (!blob || sharing) return;
    sharing = true;
    const r = await dispatchShare(blob, text, data.url);
    sharing = false;
    game.message = { text: r === 'shared' ? L('シェアしました', 'Shared!') : L('シェア画像を保存しました（SNSに貼れます）', 'Share image saved — post it anywhere'), kind: 'ok' };
  }
  const canClip = clipSupported();
  let recording = $state(false);
  async function shareVideo() {
    if (recording || !data.circuit) return;
    recording = true;
    const blob = await recordClip(data.circuit, `${data.title} · ${data.cost} ${data.unit} · Karakuri`);
    recording = false;
    if (!blob) { game.message = { text: L('この端末は動画書き出しに未対応。画像でどうぞ。', 'Video export not supported here — use the image.'), kind: 'err' }; return; }
    const r = await shareClip(blob, text, data.url);
    game.message = { text: r === 'shared' ? L('動画をシェアしました', 'Shared the clip!') : L('動画を保存しました（SNSに貼れます）', 'Clip saved — post it anywhere'), kind: 'ok' };
  }
  const isLast = $derived(game.levelIdx >= game.totalLevels - 1);
  function next() { game.loadLevel(game.levelIdx + 1); }
  function close() { game.showWin = false; }
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

    <div class="preview">
      {#if imgUrl}<img src={imgUrl} alt={L('シェアカード', 'share card')} />{:else}<div class="loading">…</div>{/if}
    </div>

    {#if game.rank && game.rank.n > 1}
      <div class="rank">🌐 {rankText(game.rank, game.lang)}</div>
    {/if}

    <div class="btns">
      <button class="btn" onclick={share} disabled={!imgUrl || sharing}>↗ {L('画像', 'Image')}</button>
      {#if canClip}<button class="btn" onclick={shareVideo} disabled={recording}>{recording ? '…' : '🎬 ' + L('動画', 'Video')}</button>{/if}
      {#if !isLast}<button class="btn btn--ghost" onclick={next}>{L('次へ', 'Next')} →</button>{/if}
      <button class="btn btn--ghost" onclick={close}>{L('閉じる', 'Close')}</button>
    </div>
    <p class="hint">{L('画像を保存してSNSに貼れます。友達に「何ゲートで作れた？」と挑戦しよう。', 'Save the image and post it — challenge a friend to beat your gate count.')}</p>
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

  .preview { margin: var(--sp-4) 0; border-radius: var(--r-3); overflow: hidden; border: 1px solid var(--line); aspect-ratio: 1200 / 630; background: var(--ink-900); }
  .preview img { width: 100%; height: 100%; display: block; }
  .loading { width: 100%; height: 100%; display: grid; place-items: center; color: var(--muted); font-family: var(--font-mono); }

  .rank { margin-top: -4px; margin-bottom: var(--sp-3); text-align: center; font-family: var(--font-mono); font-size: var(--step-0); color: var(--brass-bright); }
  .btns { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
  .hint { margin-top: var(--sp-3); font-size: 0.74rem; color: var(--muted); line-height: 1.5; }
</style>
