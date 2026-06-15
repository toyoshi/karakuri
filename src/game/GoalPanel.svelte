<script lang="ts">
  import { game } from './store.svelte';
  import { t } from './i18n';
  import { truthTable } from '../sim/verify';
  import { Simulator, type Bit } from '../sim/netlist';
  import { buildSwitch, runSwitch } from '../sim/switchlevel';
  import { shareCard } from './sharecard';

  const lv = $derived(game.level);
  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);

  const rows = $derived(
    lv.sequential && lv.steps ? lv.steps.map(s => ({ in: s.in, expected: s.expected }))
      : lv.spec ? truthTable(lv.inputs.map(p => p.name), lv.spec) : []
  );
  const outNames = $derived(lv.outputs.map(p => p.name));
  const tableLabel = $derived(lv.sequential ? L('テスト手順（上から順に）', 'Test sequence (top to bottom)') : t('truthTable'));

  function rowIsCurrent(r: { in: Record<string, Bit> }) {
    if (lv.sequential) return false; // a time sequence, not a live row
    return lv.inputs.every(p => (game.inputs[p.name] ?? 0) === r.in[p.name]);
  }
  // pair verify results to rows by index (same enumeration order)
  const verifyRows = $derived(game.lastVerify?.rows ?? null);

  /** what the CURRENT circuit actually outputs for each row — live, so you see
      your circuit's truth table as you build (sequential uses post-verify got). */
  const actual = $derived.by((): (Record<string, Bit> | null)[] | null => {
    if (lv.sequential) return verifyRows ? verifyRows.map(r => r.got) : null;
    if (game.substrate === 'switch') {
      const net = buildSwitch(game.circuit, game.chipLib);
      return rows.map(r => { const res = runSwitch(net, r.in); return (res.shorted || res.floating) ? null : res.outputs; });
    }
    const { flat, errors } = game.compiled;
    if (errors.length) return null;
    const have = new Set(flat.inputs.map(i => i.name));
    const outsReady = outNames.every(n => flat.outputs.some(o => o.name === n));
    if (!outsReady) return null; // circuit's interface not present yet (transient during level load)
    const sim = new Simulator(flat);
    return rows.map(r => {
      sim.reset();
      for (const k in r.in) if (have.has(k)) sim.setInput(k, r.in[k]);
      const s = sim.settle();
      return s.settled ? sim.readOutputs() : null;
    });
  });
  const allMatch = $derived(actual && rows.length > 0 && rows.every((r, i) => {
    const a = actual![i]; return a && outNames.every(n => a[n] === r.expected[n]);
  }));

  const cost = $derived(game.cost);
  const costLabel = $derived(game.substrate === 'switch' ? (game.lang === 'ja' ? 'トランジスタ' : 'transistors') : (game.lang === 'ja' ? 'ゲート数' : 'gates'));
  const errs = $derived(game.substrate === 'switch' ? [] : game.compiled.errors);

  let sharing = $state(false);
  async function share() {
    if (sharing) return; sharing = true;
    try {
      const url = location.origin + location.pathname + '#' + lv.id;
      const n = game.best[lv.id] ?? cost;
      const unit = game.substrate === 'switch' ? (game.lang === 'ja' ? 'トランジスタ' : 'transistors') : 'NAND';
      const txt = L(
        `「${lv.title}」を ${unit} ${n}個で組み上げた！ — Karakuri（からくり）でCSをゼロから組む`,
        `Built "${lv.titleEn}" from ${n} ${unit} on Karakuri — build a computer from a single NAND.`
      );
      const table = (!lv.sequential && rows.length)
        ? { inputs: lv.inputs.map(p => p.name), outputs: outNames, rows: rows.map(r => ({ in: r.in, out: r.expected })) }
        : null;
      const res = await shareCard({
        title: L(lv.title, lv.titleEn), unit, cost: n, par: lv.par,
        delay: game.substrate === 'switch' ? null : (game.bestDelay[lv.id] ?? game.live.ticks),
        lang: game.lang, optimal: n <= lv.par,
        totalNands: game.totalNands, stars: game.starCount, cleared: `${game.clearedCount}/${game.totalLevels}`,
        table, url,
      }, txt);
      game.message = { text: res === 'shared' ? L('シェアしました', 'Shared!') : L('シェア画像を保存しました（SNSに貼れます）', 'Share image saved — post it anywhere'), kind: 'ok' };
    } catch {
      game.message = { text: L('シェアに失敗しました', 'Share failed'), kind: 'err' };
    } finally { sharing = false; }
  }
</script>

<div class="goalpanel">
  <div>
    <div class="chap">{L(lv.chapter, lv.chapterEn)} · {L(lv.concept, lv.conceptEn)}</div>
    <h1>{L(lv.title, lv.titleEn)}</h1>
  </div>

  <p class="goal">{L(lv.goal, lv.goalEn)}</p>

  <div class="idea">
    <b>{t('idea')}</b>
    <span>{L(lv.idea, lv.ideaEn)}</span>
  </div>

  {#if rows.length}
    <div>
      <div class="rail-label">{tableLabel}</div>
      <table class="tt">
        <thead>
          <tr class="grp">
            <th colspan={lv.inputs.length}></th>
            <th class="sep"></th>
            <th colspan={outNames.length}>{L('目標', 'target')}</th>
            {#if actual}<th class="sep2"></th><th colspan={outNames.length} class:okgrp={allMatch}>{L('今の回路', 'yours')}</th>{/if}
          </tr>
          <tr>
            {#each lv.inputs as p}<th>{p.name}</th>{/each}
            <th class="sep">→</th>
            {#each outNames as n}<th>{n}</th>{/each}
            {#if actual}<th class="sep2"></th>{#each outNames as n}<th>{n}</th>{/each}{/if}
          </tr>
        </thead>
        <tbody>
          {#each rows as r, i}
            <tr class:cur={rowIsCurrent(r)}
                class:bad={actual && actual[i] && outNames.some(n => actual[i]![n] !== r.expected[n])}>
              {#each lv.inputs as p}<td class="bit b{r.in[p.name]}">{r.in[p.name]}</td>{/each}
              <td class="sep"></td>
              {#each outNames as n}<td class="bit b{r.expected[n]}">{r.expected[n]}</td>{/each}
              {#if actual}
                <td class="sep2"></td>
                {#each outNames as n}
                  {@const a = actual[i]}
                  <td class="got {a == null ? 'na' : (a[n] === r.expected[n] ? 'ok' : 'no')}">{a == null ? '?' : a[n]}</td>
                {/each}
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="legend">
        <span><i class="lit"></i>{L('明るく流れる＝値が 1（オン）', 'bright, flowing = value 1 (on)')}</span>
        <span><i class="dim"></i>{L('暗い＝値が 0（オフ）', 'dim = value 0 (off)')}</span>
      </div>
    </div>
  {/if}

  {#if errs.length}
    <div class="msg err">{errs.join(' / ')}</div>
  {:else if game.message}
    <div class="msg {game.message.kind}">{game.message.text}</div>
  {/if}

  <div class="score">
    <span>{costLabel} <b>{cost}</b></span>
    {#if !lv.sandbox}
      <span>{t('par')} <b>{lv.par}</b></span>
      {#if cost <= lv.par}<span class="star">★ {L('最小', 'optimal')}</span>{/if}
      {#if game.best[lv.id] !== undefined}<span>{t('best')} <b>{game.best[lv.id]}</b></span>{/if}
    {/if}
    {#if game.substrate !== 'switch'}<span>{t('delay')} <b>{game.live.ticks}</b>{#if !lv.sandbox && game.bestDelay[lv.id] !== undefined}<i class="bd">(best {game.bestDelay[lv.id]})</i>{/if}</span>{/if}
  </div>
  <div class="totals">{L('通算', 'Total')}: NAND <b>{game.totalNands}</b> · ★ <b>{game.starCount}</b> · {L('クリア', 'cleared')} <b>{game.clearedCount}/{game.totalLevels}</b></div>

  <div class="actions">
    {#if lv.sandbox}
      <button class="btn btn--ghost" onclick={() => game.clearCircuit()}>{L('全部消す', 'Clear all')}</button>
    {:else if !game.solved}
      <button class="btn" onclick={() => game.verify()}>{t('verify')}</button>
    {:else}
      <button class="btn" onclick={share}>↗ {t('share')}</button>
      {#if game.levelIdx < game.totalLevels - 1}
        <button class="btn btn--ghost" onclick={() => game.loadLevel(game.levelIdx + 1)}>{t('next')} →</button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .goalpanel { display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-5); overflow-y: auto; height: 100%; }
  .chap { font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.12em; color: var(--brass); text-transform: uppercase; }
  h1 { font-size: var(--step-2); margin-top: 0.2em; }
  .goal { color: var(--paper); font-size: var(--step-0); line-height: 1.6; }
  .idea { border-left: 2px solid var(--verdigris); padding: 0.1em 0 0.1em var(--sp-4); background: linear-gradient(90deg, rgba(87,176,154,0.08), transparent); }
  .idea b { display: block; font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--verdigris); margin-bottom: 0.3em; }
  .idea span { color: var(--paper-2); font-size: var(--step--1); line-height: 1.6; }
  .rail-label { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }

  .tt { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.82rem; }
  .tt th { color: var(--muted); font-weight: 500; padding: 3px 6px; font-size: 0.72rem; }
  .tt td { text-align: center; padding: 3px 6px; color: var(--paper-2); }
  .tt .sep { color: var(--faint); width: 1.4em; }
  .tt .bit.b1 { color: var(--signal); }
  .tt .bit.b0 { color: var(--faint); }
  .tt tr.cur { background: color-mix(in srgb, var(--brass) 14%, transparent); }
  .tt tr.bad { background: color-mix(in srgb, var(--err) 13%, transparent); }
  .tt .grp th { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); padding-bottom: 0; }
  .tt .grp th.okgrp { color: var(--ok); }
  .tt .sep2 { width: 1.2em; color: var(--faint); }
  .tt .got { font-weight: 600; }
  .tt .got.ok { color: var(--ok); }
  .tt .got.no { color: var(--err); }
  .tt .got.na { color: var(--faint); }

  .legend { display: flex; gap: var(--sp-4); margin-top: 8px; font-size: 0.68rem; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 18px; height: 3px; border-radius: 2px; display: inline-block; }
  .legend i.lit { background: var(--signal); box-shadow: 0 0 4px var(--signal-d); }
  .legend i.dim { background: var(--ink-500); }

  .msg { padding: 8px 12px; border-radius: var(--r-2); font-size: var(--step--1); }
  .msg.ok { background: rgba(110,210,154,0.14); color: var(--ok); }
  .msg.err { background: rgba(240,106,106,0.14); color: var(--err); }
  .msg.info { background: var(--glass); color: var(--paper-2); }

  .score { display: flex; gap: var(--sp-4); flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.74rem; color: var(--muted); }
  .score b { color: var(--paper); }
  .score .star { color: var(--brass-bright); }
  .score .bd { color: var(--faint); font-style: normal; margin-left: 3px; }
  .totals { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); }
  .totals b { color: var(--verdigris); }
  .actions { display: flex; gap: var(--sp-3); margin-top: auto; padding-top: var(--sp-3); }
</style>
