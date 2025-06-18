# デプロイメントガイド

## 📋 デプロイメント構成

- **フロントエンド**: Vercel (React + Vite)
- **バックエンド**: Railway (Node.js + Express)
- **データベース**: なし（ファイルベース）

## 🚀 デプロイ手順

### 1. GitHub リポジトリのセットアップ

```bash
# 1. GitHubで新しいリポジトリを作成
# リポジトリ名: responsive-coder

# 2. ローカルでGit初期化（まだしていない場合）
git init
git add .
git commit -m "Initial commit: Responsive Coder application"

# 3. リモートリポジトリと連携
git remote add origin https://github.com/YOUR_USERNAME/responsive-coder.git
git branch -M main
git push -u origin main
```

### 2. Railway（バックエンド）デプロイ

1. **Railway にアクセス**: https://railway.app
2. **新プロジェクト作成**: "New Project" → "Deploy from GitHub repo"
3. **リポジトリ選択**: responsive-coder を選択
4. **環境変数設定**:
   ```
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   NODE_ENV=production
   FRONTEND_URL=https://your-app.vercel.app
   PORT=3001
   ```
5. **デプロイ設定**: 自動的に `railway.json` と `Procfile` が使用される
6. **ドメイン確認**: デプロイ後にURLをメモ（例: `https://responsive-coder-production.up.railway.app`）

### 3. Vercel（フロントエンド）デプロイ

1. **Vercel にアクセス**: https://vercel.com
2. **プロジェクトインポート**: "Import Project" → GitHub リポジトリを選択
3. **設定**:
   - Framework Preset: **Vite**
   - Root Directory: `/` (デフォルト)
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **環境変数設定**:
   ```
   VITE_API_URL=https://your-railway-app.up.railway.app
   ```
5. **デプロイ実行**: "Deploy" ボタンをクリック

### 4. 最終設定

1. **Railway URL を Vercel に設定**:
   - Vercel の Environment Variables で `VITE_API_URL` を Railway の URL に更新
   
2. **Vercel URL を Railway に設定**:
   - Railway の Environment Variables で `FRONTEND_URL` を Vercel の URL に更新

3. **両サービスを再デプロイ**:
   - Vercel: Deployments → "Redeploy"
   - Railway: 自動的に再デプロイされる

## 🔧 トラブルシューティング

### よくある問題

1. **CORS エラー**:
   - Railway と Vercel の URL が環境変数に正しく設定されているか確認
   - URL の末尾に `/` がないか確認

2. **Puppeteer エラー（Railway）**:
   - 既に対応済み（`--no-sandbox` フラグ等）
   - メモリ不足の場合は Railway のプランアップグレードを検討

3. **ビルドエラー**:
   - 依存関係の問題: `npm ci --production` を実行
   - Node.js バージョン: Railway で Node 18+ を使用

4. **環境変数が読み込まれない**:
   - Vercel: ビルド時とランタイムで異なる変数名を使用（`VITE_` プレフィックス必要）
   - Railway: アプリケーション再起動が必要

### デバッグ方法

1. **Railway ログ確認**:
   ```bash
   # Railway CLI インストール後
   railway logs
   ```

2. **Vercel ログ確認**:
   - Vercel ダッシュボード → Functions → View Function Logs

3. **ローカルでプロダクションビルドテスト**:
   ```bash
   npm run build
   npm run preview
   ```

## 📁 デプロイ関連ファイル

- `vercel.json` - Vercel 設定
- `railway.json` - Railway 設定  
- `server/Procfile` - Railway プロセス定義
- `server/.env.example` - 環境変数テンプレート
- `.env.production` - Vercel 用環境変数
- `deploy.sh` - デプロイ準備スクリプト

## 🔐 セキュリティ注意事項

1. **API キーの管理**:
   - `.env` ファイルは絶対に Git にコミットしない
   - 本番環境では各サービスの環境変数機能を使用

2. **CORS 設定**:
   - 本番 URL のみ許可するよう設定済み
   - 開発環境では localhost も許可

3. **ファイルアップロード**:
   - 50MB のサイズ制限設定済み
   - 画像・PDF ファイルのみ許可

## 📊 コスト見積もり

- **Vercel**: 無料プラン（商用利用可能）
- **Railway**: 月額 $5-20（使用量による）
- **OpenAI API**: 使用量課金（Vision API: $10-20/1M tokens）

合計: 月額約 $15-40（使用量による）