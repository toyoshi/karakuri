<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from './store.svelte';
  import { LEVELS } from './levels';
  import { t } from './i18n';
  import Editor from './Editor.svelte';
  import Palette from './Palette.svelte';
  import GoalPanel from './GoalPanel.svelte';
  import IntroModal from './IntroModal.svelte';
  import WinModal from './WinModal.svelte';
  import StageSelect from './StageSelect.svelte';

  let showIntro = $state(false);
  let showStages = $state(false);
  const lv = $derived(game.level);
  const clearedReal = $derived(LEVELS.filter(l => !l.demo && !l.sandbox && game.completed.has(l.id)).length);
  const totalReal = $derived(LEVELS.filter(l => !l.demo && !l.sandbox).length);

  onMount(() => {
    const fromHash = () => { const h = location.hash.slice(1); return LEVELS.findIndex(l => l.id === h); };
    const idx = fromHash();
    game.loadLevel(idx >= 0 ? idx : 0); // index 0 = the wordless "touch it" demo — the first thing you feel
    const onhash = () => { const i = fromHash(); if (i >= 0 && i !== game.levelIdx) game.loadLevel(i); };
    window.addEventListener('hashchange', onhash);
    return () => window.removeEventListener('hashchange', onhash);
  });

  const L = (ja: string, en: string) => (game.lang === 'ja' ? ja : en);
  function goHome() { game.loadLevel(game.levelIdx); location.hash = ''; } // save current work, then back to landing
  function go(i: number) { game.loadLevel(i); history.replaceState(null, '', '#' + LEVELS[i].id); }
  function prev() { if (game.levelIdx > 0) go(game.levelIdx - 1); }
  function nextLv() { if (game.levelIdx < game.totalLevels - 1) go(game.levelIdx + 1); }
  function closeIntro() { showIntro = false; try { localStorage.setItem('karakuri.seenIntro', '1'); } catch {} }
</script>

<header class="ghead">
  <button class="brand" onclick={goHome} title={L('トップページへ', 'Back to home')}>
    <svg viewBox="0 0 32 32" aria-hidden="true" width="28" height="28">
      <rect width="32" height="32" rx="7" fill="none" stroke="var(--brass)" stroke-width="1" opacity="0.5"/>
      <path d="M9 11h5a5 5 0 0 1 0 10H9z" fill="none" stroke="var(--signal)" stroke-width="2"/>
      <path d="M14 16h9M23 13v6" stroke="var(--brass)" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <b>{L('スイッチからCPU', 'Switch → CPU')}</b>
  </button>

  <div class="stepper">
    <button class="step" onclick={prev} disabled={game.levelIdx === 0} aria-label={L('前へ', 'Previous')}>‹</button>
    <button class="stagebtn" onclick={() => (showStages = true)} title={L('ステージ選択', 'Stage select')}>
      <span class="ch">{L(lv.chapter, lv.chapterEn)}</span>
      <span class="cur"><span class="g">{lv.glyph}</span><span class="nm">{L(lv.navName, lv.navNameEn ?? lv.navName)}</span></span>
      <span class="prog">{clearedReal}/{totalReal} ✓</span>
    </button>
    <button class="step" onclick={nextLv} disabled={game.levelIdx === game.totalLevels - 1} aria-label={L('次へ', 'Next')}>›</button>
  </div>

  <div class="right">
    <button class="introbtn" onclick={() => (showIntro = true)}>{L('NANDとは', 'About NAND')}</button>
    <div class="lang">
      <button class:on={game.lang === 'ja'} onclick={() => game.setLang('ja')}>日本語</button>
      <button class:on={game.lang === 'en'} onclick={() => game.setLang('en')}>EN</button>
    </div>
  </div>
</header>

{#if showStages}<StageSelect onpick={go} onclose={() => (showStages = false)} />{/if}

{#if showIntro}<IntroModal onclose={closeIntro} />{/if}
{#if game.showWin}<WinModal />{/if}

<main class="gbody">
  <aside class="rail rail--left"><Palette /></aside>
  <section class="stage"><Editor /></section>
  <aside class="rail rail--right"><GoalPanel /></aside>
</main>

<style>
  .ghead {
    display: flex; align-items: center; gap: var(--sp-3); height: 60px; padding-inline: var(--sp-4);
    border-bottom: 1px solid var(--line); background: var(--ink-850);
  }
  .brand { flex: none; display: flex; align-items: center; gap: 0.5em; font-family: var(--font-display); font-size: 1.2rem; color: var(--paper);
    background: none; border: none; padding: 0; cursor: pointer; transition: opacity 0.14s; }
  .brand:hover { opacity: 0.78; }
  .stepper { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .step { flex: none; width: 30px; height: 30px; border-radius: var(--r-full); border: 1px solid var(--line);
    background: var(--ink-700); color: var(--paper-2); cursor: pointer; font-size: 1.1rem; line-height: 1; transition: border-color 0.14s, color 0.14s; }
  .step:hover:not(:disabled) { border-color: var(--brass); color: var(--brass); }
  .step:disabled { opacity: 0.3; cursor: default; }
  .stagebtn { display: flex; align-items: center; gap: 12px; max-width: 360px; padding: 5px 14px; border-radius: var(--r-full);
    border: 1px solid var(--line-strong); background: var(--ink-700); color: var(--paper); cursor: pointer; font-family: inherit;
    transition: border-color 0.14s, background 0.14s; }
  .stagebtn:hover { border-color: var(--brass); background: var(--ink-600); }
  .stagebtn .ch { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .stagebtn .cur { display: flex; align-items: center; gap: 7px; }
  .stagebtn .cur .g { font-family: var(--font-mono); font-weight: 600; color: var(--brass-bright); }
  .stagebtn .cur .nm { font-size: var(--step--1); white-space: nowrap; }
  .stagebtn .prog { font-family: var(--font-mono); font-size: 0.62rem; color: var(--verdigris); }
  @media (max-width: 720px) { .stagebtn .ch, .stagebtn .prog { display: none; } }

  .right { flex: none; display: flex; align-items: center; gap: var(--sp-3); }
  .introbtn { background: transparent; border: 1px solid var(--line-strong); border-radius: var(--r-full); color: var(--paper-2); padding: 5px 12px; cursor: pointer; font-family: inherit; font-size: 0.72rem; }
  .introbtn:hover { border-color: var(--brass); color: var(--brass); }
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
