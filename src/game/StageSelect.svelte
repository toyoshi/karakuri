<script lang="ts">
  import { game } from './store.svelte';
  import { LEVELS, type Level } from './levels';

  let { onpick, onclose }: { onpick: (i: number) => void; onclose: () => void } = $props();
  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);

  // group consecutive levels by chapter, keeping ladder order
  type Group = { chapter: string; chapterEn: string; items: { lv: Level; i: number }[] };
  const groups: Group[] = (() => {
    const gs: Group[] = [];
    LEVELS.forEach((lv, i) => {
      const last = gs[gs.length - 1];
      if (!last || last.chapter !== lv.chapter) gs.push({ chapter: lv.chapter, chapterEn: lv.chapterEn, items: [] });
      gs[gs.length - 1].items.push({ lv, i });
    });
    return gs;
  })();

  function pick(i: number) { onpick(i); onclose(); }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={L('ステージ選択', 'Stage select')}
     onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="sheet" onclick={(e) => e.stopPropagation()}>
    <header class="shead">
      <h2>{L('ステージ選択', 'Stages')}</h2>
      <button class="x" onclick={onclose} aria-label="close">✕</button>
    </header>

    <div class="scroll">
      {#each groups as g}
        <section class="chapter">
          <h3>{L(g.chapter, g.chapterEn)}</h3>
          <div class="grid">
            {#each g.items as { lv, i }}
              {@const done = game.completed.has(lv.id)}
              {@const optimal = game.isOptimal(lv.id)}
              <button class="cell" class:on={i === game.levelIdx} class:done
                      onclick={() => pick(i)} title={L(lv.title, lv.titleEn)}>
                <span class="g">{lv.glyph}</span>
                <span class="nm">{L(lv.navName, lv.navNameEn ?? lv.navName)}</span>
                <span class="state">
                  {#if optimal}<span class="star">★</span>{:else if done}<span class="check">✓</span>{/if}
                </span>
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 90; display: grid; place-items: start center; padding: var(--sp-5) var(--sp-4);
    background: color-mix(in srgb, var(--ink-900) 82%, transparent); backdrop-filter: blur(6px); overflow-y: auto; }
  .sheet { width: min(820px, 100%); background: linear-gradient(180deg, var(--ink-700), var(--ink-800));
    border: 1px solid var(--line-strong); border-radius: var(--r-4); box-shadow: var(--sh-3); overflow: hidden; }
  .shead { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4) var(--sp-5);
    border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--ink-800); }
  .shead h2 { font-family: var(--font-display); font-size: var(--step-2); color: var(--paper); margin: 0; }
  .x { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.05rem; }
  .x:hover { color: var(--paper); }

  .scroll { padding: var(--sp-4) var(--sp-5) var(--sp-5); }
  .chapter { margin-top: var(--sp-4); }
  .chapter:first-child { margin-top: 0; }
  .chapter h3 { font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--brass); margin: 0 0 var(--sp-3); padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }

  .cell { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 10px;
    border: 1px solid var(--line); border-radius: var(--r-2); background: var(--ink-850); color: var(--paper-2);
    cursor: pointer; font-family: inherit; transition: border-color 0.14s, background 0.14s, transform 0.1s; }
  .cell:hover { border-color: var(--line-strong); background: var(--ink-700); transform: translateY(-1px); }
  .cell.on { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 10%, var(--ink-850)); }
  .cell.done { border-color: var(--verdigris-d); }
  .cell .g { font-family: var(--font-mono); font-weight: 600; font-size: 1.4rem; color: var(--paper); }
  .cell.on .g { color: var(--brass-bright); }
  .cell .nm { font-size: 0.74rem; text-align: center; line-height: 1.2; }
  .cell .state { position: absolute; top: 6px; right: 8px; font-size: 0.7rem; }
  .cell .star { color: var(--brass-bright); }
  .cell .check { color: var(--verdigris); }
</style>
