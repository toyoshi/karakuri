<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from './store.svelte';
  import { LEVELS } from './levels';
  import { t } from './i18n';
  import Editor from './Editor.svelte';
  import Palette from './Palette.svelte';
  import GoalPanel from './GoalPanel.svelte';

  onMount(() => {
    const h = location.hash.slice(1);
    const idx = LEVELS.findIndex(l => l.id === h);
    game.loadLevel(idx >= 0 ? idx : 0);
  });

  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);
  function go(i: number) { game.loadLevel(i); history.replaceState(null, '', '#' + LEVELS[i].id); }
</script>

<header class="ghead">
  <div class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true" width="28" height="28">
      <rect width="32" height="32" rx="7" fill="none" stroke="var(--brass)" stroke-width="1" opacity="0.5"/>
      <path d="M9 11h5a5 5 0 0 1 0 10H9z" fill="none" stroke="var(--signal)" stroke-width="2"/>
      <path d="M14 16h9M23 13v6" stroke="var(--brass)" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <b>Karakuri</b>
  </div>

  <nav class="levelnav">
    {#each LEVELS as l, i}
      <button class="lvl" class:on={i === game.levelIdx} class:done={game.completed.has(l.id)}
              onclick={() => go(i)} title={L(l.title, l.titleEn)}>
        <span class="g">{l.produces.glyph}</span>
        <span class="nm">{l.produces.name}</span>
      </button>
    {/each}
  </nav>

  <div class="right">
    <div class="lang">
      <button class:on={game.lang === 'ja'} onclick={() => game.setLang('ja')}>日本語</button>
      <button class:on={game.lang === 'en'} onclick={() => game.setLang('en')}>EN</button>
    </div>
  </div>
</header>

<main class="gbody">
  <aside class="rail rail--left"><Palette /></aside>
  <section class="stage"><Editor /></section>
  <aside class="rail rail--right"><GoalPanel /></aside>
</main>

<style>
  .ghead {
    display: flex; align-items: center; gap: var(--sp-5); height: 60px; padding-inline: var(--sp-5);
    border-bottom: 1px solid var(--line); background: var(--ink-850);
  }
  .brand { display: flex; align-items: center; gap: 0.5em; font-family: var(--font-display); font-size: 1.2rem; color: var(--paper); }
  .levelnav { display: flex; gap: 6px; margin-inline: auto; }
  .lvl {
    display: flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: var(--r-full);
    border: 1px solid var(--line); background: var(--ink-700); color: var(--muted); cursor: pointer;
    font-family: inherit; font-size: var(--step--1); transition: all 0.15s;
  }
  .lvl:hover { border-color: var(--line-strong); color: var(--paper-2); }
  .lvl.on { border-color: var(--brass); color: var(--brass); background: color-mix(in srgb, var(--brass) 10%, var(--ink-700)); }
  .lvl.done .g { color: var(--verdigris); }
  .lvl .g { font-family: var(--font-mono); font-weight: 600; }
  .lvl .nm { font-size: 0.78rem; }
  @media (max-width: 720px) { .lvl .nm { display: none; } }

  .lang { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r-full); overflow: hidden; }
  .lang button { background: transparent; color: var(--muted); border: none; padding: 5px 11px; cursor: pointer; font-family: inherit; font-size: 0.72rem; }
  .lang button.on { background: var(--brass); color: #1a130a; }

  .gbody { display: grid; grid-template-columns: 220px 1fr 350px; height: calc(100vh - 60px); }
  .rail { background: var(--ink-850); overflow-y: auto; }
  .rail--left { border-right: 1px solid var(--line); padding: var(--sp-4); }
  .rail--right { border-left: 1px solid var(--line); }
  .stage { min-width: 0; background:
    radial-gradient(1000px 700px at 60% -10%, rgba(108,198,255,0.06), transparent 60%), var(--ink-900); }

  @media (max-width: 900px) {
    .gbody { grid-template-columns: 1fr; height: auto; grid-auto-rows: min-content; }
    .stage { height: 56vh; }
    .rail { max-height: none; }
  }
</style>
