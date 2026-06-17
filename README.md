# AI Usage Log

Claude Code・ChatGPTなど、AIツールを実際の開発・作業に使った事例を記録する個人サイトです。
自分用のログとして残しつつ、外部公開して活用パターンを共有することを目的としています。

## 技術スタック

- [Astro](https://astro.build/)（Content Layer API / Content Collections）
- TypeScript（strict）
- vanilla JS（タグフィルタ。フレームワーク不使用）
- GitHub Pages + GitHub Actions（CI/CD）

## ディレクトリ構成

```
src/
├── content/cases/*.md     事例データ（Markdown + frontmatter）
├── content.config.ts      Content Collectionsスキーマ
├── lib/cases.ts            公開事例取得・日付フォーマット用ユーティリティ
├── components/             Header, Footer, CaseCard, TagFilter, Badge
├── layouts/Layout.astro    共通レイアウト
├── pages/                  index, about, 404, cases/index, cases/[id]
└── styles/global.css       デザイントークン・グローバルスタイル
```

## コマンド

| Command           | Action                                  |
| :----------------- | :--------------------------------------- |
| `npm install`      | 依存パッケージのインストール               |
| `npm run dev`       | ローカル開発サーバー起動（`localhost:4321`）|
| `npm run check`     | `astro check` で型チェック                 |
| `npm run build`     | 本番ビルドを `./dist/` に出力              |
| `npm run preview`   | ビルド結果をローカルでプレビュー           |

## 事例の追加方法

`src/content/cases/` に Markdown ファイルを追加してください。frontmatterのスキーマは `src/content.config.ts` を参照してください。

## デプロイ

`main` ブランチへの push で GitHub Actions（`.github/workflows/deploy.yml`）が自動的にビルド・デプロイします。

GitHub上でのリポジトリ設定として、**Settings → Pages → Source を「GitHub Actions」に変更してください**（初回のみ必要）。

公開URL: `https://takumi19950828.github.io/Claude-code-AI-usage-log/`
