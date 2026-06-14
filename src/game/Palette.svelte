<script lang="ts">
  import { game } from './store.svelte';
  import { t } from './i18n';

  const lv = $derived(game.level);
  function isActive(kind: string, chipId?: string) {
    const tl = game.tool;
    return tl.type === 'place' && tl.item.kind === kind && tl.item.chipId === chipId;
  }
  function glyphOf(kind: string, chipId?: string) {
    if (kind === 'nand') return 'NAND';
    if (kind === 'high') return '1';
    if (kind === 'low') return '0';
    return game.chipLib.get(chipId!)?.glyph ?? '?';
  }
  function nameOf(kind: string, chipId?: string) {
    if (kind === 'nand') return 'NAND';
    if (kind === 'high') return t('power');
    if (kind === 'low') return t('ground');
    return game.chipLib.get(chipId!)?.name ?? chipId;
  }
  // only show chips that have actually been earned
  const items = $derived(lv.palette.filter(it => it.kind !== 'chip' || game.chipLib.has(it.chipId!)));
</script>

<div class="palette">
  <div class="rail-label">{t('parts')}</div>
  <div class="tools">
    {#each items as it}
      <button class="part" class:active={isActive(it.kind, it.chipId)} data-kind={it.kind}
              onclick={() => game.tool = { type: 'place', item: it }}>
        <span class="g">{glyphOf(it.kind, it.chipId)}</span>
        <span class="n">{nameOf(it.kind, it.chipId)}</span>
      </button>
    {/each}
  </div>

  <div class="rail-label">{t('tools')}</div>
  <div class="tools">
    <button class="tool" class:active={game.tool.type === 'wire'} onclick={() => { game.tool = { type: 'wire' }; }}>
      <span class="ti">／</span>{t('wire')}
    </button>
    <button class="tool" class:active={game.tool.type === 'delete'} onclick={() => { game.tool = { type: 'delete' }; }}>
      <span class="ti">⌫</span>{t('erase')}
    </button>
  </div>

  <p class="tip">{t('wireTip')}</p>
</div>

<style>
  .palette { display: flex; flex-direction: column; gap: var(--sp-3); }
  .rail-label { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-top: var(--sp-2); }
  .tools { display: flex; flex-direction: column; gap: 6px; }
  .part, .tool {
    display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
    padding: 8px 10px; border-radius: var(--r-2); border: 1px solid var(--line);
    background: var(--ink-700); color: var(--paper-2); cursor: pointer; font-family: inherit; font-size: var(--step--1);
    transition: border-color 0.14s, background 0.14s;
  }
  .part:hover, .tool:hover { border-color: var(--line-strong); background: var(--ink-600); }
  .part.active, .tool.active { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 12%, var(--ink-700)); box-shadow: 0 0 0 1px var(--brass-glow); }
  .part .g {
    flex: none; width: 40px; height: 30px; display: grid; place-items: center; border-radius: 6px;
    font-family: var(--font-mono); font-weight: 600; font-size: 11px;
    background: var(--ink-850); border: 1px solid var(--line-strong); color: var(--paper);
  }
  .part[data-kind="chip"] .g { color: var(--verdigris); border-color: var(--verdigris-d); font-size: 16px; }
  .part .n { font-weight: 500; color: var(--paper); }
  .tool .ti { font-family: var(--font-mono); width: 20px; text-align: center; color: var(--brass); }
  .tip { font-size: 0.72rem; color: var(--muted); line-height: 1.5; margin-top: var(--sp-2); }
</style>
