# Google Gemini API セットアップガイド

## 🚀 Gemini APIキーの取得方法

### 1. Google AI Studioにアクセス
[Google AI Studio](https://aistudio.google.com/app/apikey) にアクセスします。

### 2. APIキーを作成
- 「Create API Key」をクリック
- 既存のGoogle Cloud Projectを選択、または新規作成
- APIキーが生成されます

### 3. APIキーをコピー
生成されたAPIキーをコピーします。形式は以下のような文字列です：
```
AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🔧 環境変数の設定

### ローカル開発環境
`server/.env` ファイルに以下を追加：
```env
GEMINI_API_KEY=AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Railway (本番環境)
1. Railwayダッシュボードにログイン
2. プロジェクトを選択
3. 「Variables」タブを開く
4. 「New Variable」をクリック
5. 以下を入力：
   - Name: `GEMINI_API_KEY`
   - Value: あなたのAPIキー

## ✅ 動作確認

サーバー起動時に以下のようなログが表示されれば成功です：

```
============================================================
🚀 Server running at http://localhost:3001
============================================================
📋 Configuration Status:
  - Gemini API: ✅ ENABLED (Primary)
  - Gemini Key: ✅ Set
============================================================
```

## 🎯 Gemini APIの利点

1. **高精度**: Googleの最新AI技術
2. **コスト効率**: OpenAIより安価
3. **高速**: レスポンスが速い
4. **多言語対応**: 日本語の理解が優秀

## ⚠️ 注意事項

- APIキーは絶対に公開しないでください
- GitHubにコミットしないよう注意
- 定期的にキーをローテーションすることを推奨

## 📚 参考リンク

- [Gemini API Documentation](https://ai.google.dev/docs)
- [料金情報](https://ai.google.dev/pricing)
- [利用制限](https://ai.google.dev/gemini-api/docs/quota)