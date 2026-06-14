/* ============================================================
   KARAKURI — minimal reactive i18n. t(key) reads game.lang, so
   any template using it re-renders when the language toggles.
   ============================================================ */
import { game } from './store.svelte';

type Dict = Record<string, { ja: string; en: string }>;

const D: Dict = {
  parts: { ja: '部品', en: 'Parts' },
  tools: { ja: '道具', en: 'Tools' },
  wire: { ja: '配線', en: 'Wire' },
  erase: { ja: '消す', en: 'Erase' },
  power: { ja: '電源(1)', en: 'Power (1)' },
  ground: { ja: '接地(0)', en: 'Ground (0)' },
  wireTip: {
    ja: 'ピンをクリック→別のピンをクリックで配線。部品は中央をクリックで置く。入力ボックスを押すと 0/1 が切り替わる。',
    en: 'Click a pin, then another pin, to wire. Click the grid to drop a part. Click an input box to toggle 0/1.',
  },
  verify: { ja: '検証する', en: 'Verify' },
  next: { ja: '次へ', en: 'Next' },
  goal: { ja: '目標', en: 'Goal' },
  idea: { ja: '考え方', en: 'Idea' },
  truthTable: { ja: '真理値表', en: 'Truth table' },
  expected: { ja: '期待', en: 'want' },
  got: { ja: '結果', en: 'got' },
  gates: { ja: 'ゲート数', en: 'gates' },
  par: { ja: '目標', en: 'par' },
  best: { ja: '自己best', en: 'best' },
  delay: { ja: '遅延', en: 'delay' },
  chapter: { ja: '章', en: 'Chapter' },
  toolbox: { ja: '道具箱', en: 'Toolbox' },
  earned: { ja: '作ったチップ', en: 'Chips you built' },
  solvedTitle: { ja: '組み上がった！', en: 'It works!' },
  share: { ja: 'シェア', en: 'Share' },
  reset: { ja: '進捗をリセット', en: 'Reset progress' },
};

export function t(key: keyof typeof D | string): string {
  const e = D[key as string];
  if (!e) return key as string;
  return game.lang === 'ja' ? e.ja : e.en;
}

/** chip display name in the current language */
export function chipName(def: { name: string; nameEn?: string } | undefined): string {
  if (!def) return '';
  return game.lang === 'ja' ? def.name : (def.nameEn ?? def.name);
}
