<script lang="ts">
  import { game } from './store.svelte';
  import { t } from './i18n';
  import { truthTable } from '../sim/verify';
  import type { Bit } from '../sim/netlist';

  const lv = $derived(game.level);
  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);

  const rows = $derived(
    lv.spec ? truthTable(lv.inputs.map(p => p.name), lv.spec) : []
  );
  const outNames = $derived(lv.outputs.map(p => p.name));

  function rowIsCurrent(r: { in: Record<string, Bit> }) {
    return lv.inputs.every(p => (game.inputs[p.name] ?? 0) === r.in[p.name]);
  }
  // pair verify results to rows by index (same enumeration order)
  const verifyRows = $derived(game.lastVerify?.rows ?? null);

  const gates = $derived(game.compiled.gateCount);
  const errs = $derived(game.compiled.errors);

  function share() {
    const url = location.origin + location.pathname + '#' + lv.id;
    const txt = L(
      `「${lv.title}」を NAND ${game.best[lv.id] ?? gates} 個で組み上げた！ — Karakuri（からくり）でCSをゼロから組む`,
      `Built "${lv.titleEn}" from ${game.best[lv.id] ?? gates} NANDs on Karakuri — build CS from the ground up.`
    );
    if (navigator.share) navigator.share({ title: 'Karakuri', text: txt, url }).catch(() => {});
    else { navigator.clipboard?.writeText(txt + ' ' + url); game.message = { text: L('コピーしました', 'Copied to clipboard'), kind: 'info' }; }
  }
</script>

<div class="goalpanel">
  <div>
    <div class="chap">{lv.chapter} · {L(lv.concept, lv.conceptEn)}</div>
    <h1>{L(lv.title, lv.titleEn)}</h1>
  </div>

  <p class="goal">{L(lv.goal, lv.goalEn)}</p>

  <div class="idea">
    <b>{t('idea')}</b>
    <span>{L(lv.idea, lv.ideaEn)}</span>
  </div>

  {#if rows.length}
    <div>
      <div class="rail-label">{t('truthTable')}</div>
      <table class="tt">
        <thead>
          <tr>
            {#each lv.inputs as p}<th>{p.name}</th>{/each}
            <th class="sep">→</th>
            {#each outNames as n}<th>{n}</th>{/each}
            {#if verifyRows}<th></th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each rows as r, i}
            <tr class:cur={rowIsCurrent(r)} class:bad={verifyRows && !verifyRows[i].pass}>
              {#each lv.inputs as p}<td class="bit b{r.in[p.name]}">{r.in[p.name]}</td>{/each}
              <td class="sep"></td>
              {#each outNames as n}<td class="bit b{r.expected[n]}">{r.expected[n]}</td>{/each}
              {#if verifyRows}<td class="mark">{verifyRows[i].pass ? '✓' : '✕'}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if errs.length}
    <div class="msg err">{errs.join(' / ')}</div>
  {:else if game.message}
    <div class="msg {game.message.kind}">{game.message.text}</div>
  {/if}

  <div class="score">
    <span>{t('gates')} <b>{gates}</b></span>
    <span>{t('par')} <b>{lv.par}</b></span>
    {#if game.best[lv.id] !== undefined}<span>{t('best')} <b>{game.best[lv.id]}</b></span>{/if}
    <span>{t('delay')} <b>{game.live.ticks}</b></span>
  </div>

  <div class="actions">
    {#if !game.solved}
      <button class="btn" onclick={() => game.verify()}>{t('verify')}</button>
    {:else}
      <button class="btn" onclick={share}>↗ {t('share')}</button>
      {#if game.levelIdx < 3}
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
  .tt tr.cur { background: color-mix(in srgb, var(--brass) 14%, transparent); border-radius: 4px; }
  .tt tr.bad { background: color-mix(in srgb, var(--err) 16%, transparent); }
  .tt .mark { font-weight: 700; }
  .tt tr.bad .mark { color: var(--err); }
  .tt tr:not(.bad) .mark { color: var(--ok); }

  .msg { padding: 8px 12px; border-radius: var(--r-2); font-size: var(--step--1); }
  .msg.ok { background: rgba(110,210,154,0.14); color: var(--ok); }
  .msg.err { background: rgba(240,106,106,0.14); color: var(--err); }
  .msg.info { background: var(--glass); color: var(--paper-2); }

  .score { display: flex; gap: var(--sp-4); flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.74rem; color: var(--muted); }
  .score b { color: var(--paper); }
  .actions { display: flex; gap: var(--sp-3); margin-top: auto; padding-top: var(--sp-3); }
</style>
