# 自動レスポンシブコーディング

PCとSPのデザイン画像をアップロードすると、自動的にレスポンシブなHTML/CSSコードを生成するWebアプリケーションです。

## 機能

- **マルチファイル対応**: 画像（PNG、JPG、GIF）およびPDFファイルのアップロード
- **PDFページ選択**: 複数ページPDFの任意のページを選択可能
- **高品質変換**: PDFを300DPIで画像変換
- **ドラッグ&ドロップ対応**: 直感的なファイルアップロード
- **AI解析**: OpenAI Vision APIを使用したデザイン解析
- **自動コード生成**: レスポンシブHTML/CSSの自動生成
- **スクリーンショット機能**: Puppeteerによる自動プレビュー生成
- **自動イテレーション**: 目標デザインとの差分を自動改善
- **リアルタイムプレビュー**: Desktop/Tablet/Mobile表示切り替え
- **コードエクスポート**: コピー・ダウンロード機能

## 必要な環境

- Node.js 18以上
- OpenAI APIキー

## セットアップ

### 開発環境

1. 依存関係のインストール

```bash
# ルートディレクトリで
npm install

# サーバーディレクトリで
cd server
npm install
```

2. 環境変数の設定

```bash
# サーバー側
cd server
cp .env.example .env
```

`.env`ファイルを編集:
```
OPENAI_API_KEY=your_actual_api_key_here
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

3. アプリケーションの起動

```bash
# ターミナル1: サーバーを起動
cd server
npm run dev

# ターミナル2: フロントエンドを起動
npm run dev
```

4. ブラウザで `http://localhost:5173` にアクセス

### プロダクション環境 (Vercel + Railway)

1. **デプロイ準備**

```bash
# デプロイスクリプトを実行
./deploy.sh
```

2. **Railway（バックエンド）デプロイ**

- https://railway.app にアクセス
- "New Project" → "Deploy from GitHub repo"
- リポジトリを選択
- 環境変数を設定:
  ```
  OPENAI_API_KEY=your_actual_api_key_here
  NODE_ENV=production
  FRONTEND_URL=https://your-app.vercel.app
  ```

3. **Vercel（フロントエンド）デプロイ**

- https://vercel.com にアクセス
- "Import Project" → GitHubリポジトリを選択
- Framework: Vite を選択
- 環境変数を設定:
  ```
  VITE_API_URL=https://your-app.up.railway.app
  ```

4. **最終設定**

- Railway のURLをVercelの`VITE_API_URL`に設定
- Vercelを再デプロイ

## 使い方

1. **ファイルアップロード**: 
   - 画像モード: PNG、JPG、GIFファイルをドラッグ&ドロップ
   - PDFモード: PDFファイルをアップロードし、表示ページを選択
2. **PCデザインとSPデザイン**を両方アップロード
3. **「コードを生成」**ボタンをクリック
4. 生成されたHTML/CSSコードを確認
5. **プレビュー機能**でDesktop/Tablet/Mobile表示を確認
6. **「イテレーション開始」**で自動改善プロセスを実行（オプション）
7. 最適な結果のコードをコピーまたはダウンロード

## 技術スタック

- **フロントエンド**: React, Vite
- **バックエンド**: Express.js
- **AI**: OpenAI Vision API (GPT-4)
- **画像処理**: Sharp
- **スタイリング**: CSS Modules

## 注意事項

- OpenAI APIの利用には料金が発生します
- アップロードできるファイルは最大50MBまでです
- 対応ファイル形式: PNG、JPG、GIF、PDF
- PDFは自動的に画像に変換されます（300DPI）
- 長いデザインのPDFでも適切に処理されます