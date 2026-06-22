# 支出チェック

毎月の家計支出を入力して、**予算との比較・支出内訳・将来予測**をその場で
チェックできる家計シミュレーターです。デザインは金融庁の
「NISAつみたてシミュレーター」のような明るくグラフ中心のUIで統一しています。

## 主な機能

- **月次支出の入力** … カテゴリ別の数値入力＋スライダー（双方向同期）
- **予算との比較** … 使用率ゲージ・予算残・色＋数値＋アイコンで状態表示
- **支出内訳グラフ** … インラインSVGのドーナツ＋凡例
- **将来予測** … このペースで続けた場合の累計支出（期間スライダー）

入力データはブラウザの `localStorage` にのみ保存され、外部送信されません。

## 技術スタック

- [Astro](https://astro.build/) v6 + TypeScript（strict）
- 依存ゼロの vanilla TS（インラインSVGチャート・状態管理）
- デザイントークンは `src/styles/global.css`（NISA風ライトテーマ）

## ディレクトリ構成

```
expense-check/
├── src/
│   ├── lib/calc.ts          純粋計算ロジック・カテゴリ定義（テスト対象）
│   ├── scripts/expense.ts   状態管理・描画（単一state＋一方向フロー）
│   ├── components/          Header/Footer/CategoryInput/SummaryCard
│   ├── layouts/Layout.astro
│   ├── pages/               index（シミュレーター）/ about / 404
│   └── styles/global.css    デザイントークン
└── test/calc.test.ts        計算ロジックの単体テスト
```

## コマンド

| Command           | Action                              |
| :---------------- | :---------------------------------- |
| `npm install`     | 依存パッケージのインストール        |
| `npm run dev`     | 開発サーバー起動（`localhost:4321`）|
| `npm run check`   | `astro check` で型チェック          |
| `npm test`        | 計算ロジックの単体テスト            |
| `npm run build`   | 本番ビルドを `./dist/` に出力        |
| `npm run preview` | ビルド結果をプレビュー              |

## デザインの方針

- 緑/アンバー/丹色は**塗り専用**。テキストには `--color-*-text`（白背景4.5:1超）を使用
- 状態は色だけに頼らず**数値ラベル＋アイコン**で多重符号化（WCAG 1.4.1）
- グラフは `role="img"` + 視覚非表示の数値テーブルで代替提供
