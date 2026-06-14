# Karakuri — 計算を、からくりとして学ぶ

**From a single NAND, build the whole computer.**
NANDひとつから、論理ゲート → 加算器 → 記憶 → CPU までを、自分の手で組み上げる無料のCS学習所。

- 完全無料・登録不要・広告なし。すべてブラウザの中で動きます。
- 「現代版 nandgame」: トランジスタ → CMOS NAND → 論理ゲート → 算術 → 記憶 …の抽象のはしごを、回路を配線しながら登ります。
- 自分で組んだ回路は**チップとして封入**でき、次の課題の部品になります（＝抽象化）。
- 真理値表／順序回路の自動検証、最適化スコア（ゲート数・遅延）、日本語/English 切替。

## 遊ぶ
公開URL（GitHub Pages）: デプロイ後に `https://<user>.github.io/karakuri/`

## 開発
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/ (GitHub Pages へ自動デプロイ)
```

- スタック: Vite + Svelte 5 + TypeScript（ビルドは静的、サーバー不要）
- 論理シミュレータ（`src/sim/`）: 同期・単位遅延のゲートレベル sim ＋ スイッチレベル（トランジスタ）sim。組み合わせ／順序回路・階層チップ展開に対応。
- `main` への push で GitHub Actions が `dist/` を Pages へ公開します。

## ライセンス
教育目的のオープンプロジェクト。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
