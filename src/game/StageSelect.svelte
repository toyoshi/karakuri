<script lang="ts">
  import { game } from './store.svelte';
  import { LEVELS, type Level } from './levels';
  import { exportProgress, importProgress } from './progress';

  let { onpick, onclose }: { onpick: (i: number) => void; onclose: () => void } = $props();
  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);

  // ---- progress backup (export / import) — quiet footer affordance ----
  let fileInput: HTMLInputElement;
  let busy = $state(false);
  let note = $state<{ text: string; ok: boolean } | null>(null);

  function doExport() { exportProgress(new Date().toISOString()); }
  function pickImport() { note = null; fileInput?.click(); }
  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                       // allow re-picking the same file later
    if (!file) return;
    if (!confirm(L('現在の進捗を、選んだファイルの内容で置き換えます。よろしいですか？', 'This replaces your current progress with the file. Continue?'))) return;
    busy = true;
    try {
      const { keys } = await importProgress(file);
      note = { text: L(`読み込みました（${keys}項目）。再読み込みします…`, `Imported ${keys} items. Reloading…`), ok: true };
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      note = { text: L('読み込みに失敗：', 'Import failed: ') + (err instanceof Error ? err.message : ''), ok: false };
      busy = false;
    }
  }

  function pick(i: number) { onpick(i); onclose(); }

  /* ---- tech tree: derive prerequisites from produces ↔ palette chips ---- */
  const NW = 150, NH = 60, GX = 76, GY = 18;
  const inTree = (l: Level) => !l.demo && !l.sandbox && l.substrate !== 'switch';

  // chipId -> index of the level that produces it
  const producerOf: Record<string, number> = {};
  LEVELS.forEach((l, i) => { if (l.produces) producerOf[l.produces.id] = i; });
  // the level indices a level depends on (its palette chips that something produces)
  const reqIdx = (l: Level): number[] =>
    [...new Set(l.palette.filter(p => p.kind === 'chip' && p.chipId).map(p => p.chipId!))]
      .map(id => producerOf[id]).filter((v): v is number => v != null);

  const tierCache = new Map<number, number>();
  function tier(i: number): number {
    if (tierCache.has(i)) return tierCache.get(i)!;
    const reqs = reqIdx(LEVELS[i]);
    const t = reqs.length ? 1 + Math.max(...reqs.map(tier)) : 0;
    tierCache.set(i, t); return t;
  }

  type Node = { lv: Level; i: number; x: number; y: number };
  const treeNodes: Node[] = [];
  const posOf = new Map<number, { x: number; y: number }>();
  let treeW = 0, treeH = 0;
  {
    const idxs = LEVELS.map((l, i) => i).filter(i => inTree(LEVELS[i]));
    const maxTier = Math.max(0, ...idxs.map(tier));
    const colCount: number[] = Array(maxTier + 1).fill(0);
    // keep ladder order within each tier column
    for (const i of idxs) {
      const t = tier(i), row = colCount[t]++;
      const x = t * (NW + GX), y = row * (NH + GY);
      posOf.set(i, { x, y });
      treeNodes.push({ lv: LEVELS[i], i, x, y });
    }
    treeW = (maxTier + 1) * (NW + GX) - GX;
    treeH = Math.max(...colCount) * (NH + GY) - GY;
  }
  const edges = treeNodes.flatMap(n =>
    reqIdx(n.lv).filter(pi => posOf.has(pi)).map(pi => {
      const a = posOf.get(pi)!, b = posOf.get(n.i)!;
      return { x1: a.x + NW, y1: a.y + NH / 2, x2: b.x, y2: b.y + NH / 2, derived: !!n.lv.derived };
    }));
  const edgePath = (e: { x1: number; y1: number; x2: number; y2: number }) => {
    const dx = Math.max(30, (e.x2 - e.x1) / 2);
    return `M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1} ${e.x2 - dx} ${e.y2} ${e.x2} ${e.y2}`;
  };

  // everything outside the dependency spine: the intro, the transistor bonus, the sandbox
  const extras = LEVELS.map((lv, i) => ({ lv, i })).filter(x => !inTree(x.lv));
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
      <p class="legend">{L('左 → 右：作った部品が、次の課題の材料になる。破線は「派生課題」——先には進まないが、部品の意味が分かる応用。', 'Left → right: each part you build becomes material for the next. Dashed = side-quests — they don\'t advance the spine, but show what your part is for.')}</p>

      <div class="treewrap">
        <div class="tree" style="width:{treeW}px; height:{treeH}px">
          <svg class="edges" width={treeW} height={treeH} aria-hidden="true">
            {#each edges as e}<path d={edgePath(e)} class="edge" class:derived={e.derived} />{/each}
          </svg>
          {#each treeNodes as n}
            {@const done = game.completed.has(n.lv.id)}
            {@const optimal = game.isOptimal(n.lv.id)}
            <button class="node" class:on={n.i === game.levelIdx} class:done class:derived={n.lv.derived}
                    style="left:{n.x}px; top:{n.y}px; width:{NW}px; height:{NH}px"
                    onclick={() => pick(n.i)} title={L(n.lv.title, n.lv.titleEn)}>
              <span class="g">{n.lv.glyph}</span>
              <span class="nm">{L(n.lv.navName, n.lv.navNameEn ?? n.lv.navName)}</span>
              <span class="state">{#if optimal}<span class="star">★</span>{:else if done}<span class="check">✓</span>{/if}</span>
              {#if n.lv.derived}<span class="branch">{L('派生', 'side')}</span>{/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="extras">
        <span class="extras-label">{L('その他', 'Extras')}</span>
        {#each extras as { lv, i }}
          {@const done = game.completed.has(lv.id)}
          <button class="echip" class:on={i === game.levelIdx} class:done
                  onclick={() => pick(i)} title={L(lv.title, lv.titleEn)}>
            <span class="g">{lv.glyph}</span><span class="nm">{L(lv.navName, lv.navNameEn ?? lv.navName)}</span>
          </button>
        {/each}
      </div>

      <footer class="sfoot">
        <div class="sfoot-actions">
          <button class="lnk" onclick={doExport}>↧ {L('エクスポート', 'Export')}</button>
          <span class="sep">·</span>
          <button class="lnk" onclick={pickImport} disabled={busy}>↥ {L('インポート', 'Import')}</button>
          <input bind:this={fileInput} type="file" accept="application/json,.json" onchange={onFile} hidden />
        </div>
        <p class="sfoot-note" class:err={note && !note.ok} class:ok={note?.ok}>
          {note ? note.text : L('進捗（作った部品・記録・回路）をファイルに保存／復元できます。', 'Back up or restore your progress (chips, records, circuits) as a file.')}
        </p>
      </footer>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 90; display: grid; place-items: start center; padding: var(--sp-5) var(--sp-4);
    background: color-mix(in srgb, var(--ink-900) 82%, transparent); backdrop-filter: blur(6px); overflow-y: auto; }
  .sheet { width: min(960px, 100%); background: linear-gradient(180deg, var(--ink-700), var(--ink-800));
    border: 1px solid var(--line-strong); border-radius: var(--r-4); box-shadow: var(--sh-3); overflow: hidden; }
  .shead { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-4) var(--sp-5);
    border-bottom: 1px solid var(--line); position: sticky; top: 0; background: var(--ink-800); }
  .shead h2 { font-family: var(--font-display); font-size: var(--step-2); color: var(--paper); margin: 0; }
  .x { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.05rem; }
  .x:hover { color: var(--paper); }

  .scroll { padding: var(--sp-4) var(--sp-5) var(--sp-5); }
  .legend { font-size: 0.72rem; color: var(--muted); line-height: 1.55; margin: 0 0 var(--sp-4); }

  .treewrap { overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin; }
  .tree { position: relative; min-width: 100%; }
  .edges { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
  .edge { fill: none; stroke: var(--line-strong); stroke-width: 2; }
  .edge.derived { stroke: var(--brass-deep); stroke-dasharray: 4 5; opacity: 0.85; }

  .node { position: absolute; display: flex; align-items: center; gap: 9px; padding: 0 12px;
    border: 1px solid var(--line); border-radius: var(--r-2); background: var(--ink-850); color: var(--paper-2);
    cursor: pointer; font-family: inherit; text-align: left; transition: border-color 0.14s, background 0.14s; }
  .node:hover { border-color: var(--line-strong); background: var(--ink-700); }
  .node.on { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 10%, var(--ink-850)); }
  .node.done { border-color: var(--verdigris-d); }
  .node.derived { border-style: dashed; background: color-mix(in srgb, var(--brass) 5%, var(--ink-850)); }
  .node .g { flex: none; width: 26px; text-align: center; font-family: var(--font-mono); font-weight: 600; font-size: 1.3rem; color: var(--paper); }
  .node.on .g { color: var(--brass-bright); }
  .node .nm { font-size: 0.8rem; line-height: 1.15; }
  .node .state { position: absolute; top: 5px; right: 8px; font-size: 0.7rem; }
  .node .star { color: var(--brass-bright); }
  .node .check { color: var(--verdigris); }
  .node .branch { position: absolute; bottom: 4px; right: 8px; font-family: var(--font-mono); font-size: 0.52rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brass); }

  .extras { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: var(--sp-5); padding-top: var(--sp-4); border-top: 1px solid var(--line); }
  .extras-label { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); margin-right: 4px; }
  .echip { display: flex; align-items: center; gap: 7px; padding: 7px 13px; border: 1px solid var(--line); border-radius: var(--r-full);
    background: var(--ink-850); color: var(--paper-2); cursor: pointer; font-family: inherit; font-size: 0.76rem; transition: border-color 0.14s, color 0.14s; }
  .echip:hover { border-color: var(--line-strong); }
  .echip.on { border-color: var(--brass); color: var(--brass); }
  .echip.done .g { color: var(--verdigris); }
  .echip .g { font-family: var(--font-mono); font-weight: 600; }

  .sfoot { margin-top: var(--sp-5); padding-top: var(--sp-4); border-top: 1px solid var(--line); }
  .sfoot-actions { display: flex; align-items: center; gap: 10px; }
  .sfoot-actions .sep { color: var(--faint); }
  .lnk { background: none; border: none; padding: 0; cursor: pointer; font-family: var(--font-mono); font-size: 0.74rem; color: var(--muted); transition: color 0.14s; }
  .lnk:hover:not(:disabled) { color: var(--brass); }
  .lnk:disabled { opacity: 0.5; cursor: default; }
  .sfoot-note { margin-top: 7px; font-size: 0.68rem; color: var(--faint); line-height: 1.5; }
  .sfoot-note.ok { color: var(--ok); }
  .sfoot-note.err { color: var(--err); }
</style>
