import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
// 画像処理にJimpを使用（Pure JavaScript）
import Jimp from 'jimp';
import { imageToBase64WithJimp } from './image-processor-jimp.js';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { takeScreenshot, compareImages, iterateDesign } from './screenshot.js';
import { convertPdfToImage, getPdfPageCount, cleanupTempFiles, convertPdfToMultipleImages, combineImagesVertically } from './pdfProcessor.js';
import { 
  generateSidebarLayout, 
  generateMultiColumnContent, 
  generateFooter, 
  generatePixelPerfectCSS, 
  generateInteractiveJS,
  getUltraBasicTemplate,
  adjustColor
} from './image-analysis-helpers.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Gemini APIクライアントの初期化
let genAI = null;
let geminiModel = null;
const hasValidGeminiKey = process.env.GEMINI_API_KEY && 
                          process.env.GEMINI_API_KEY.length > 20;

if (hasValidGeminiKey) {
  console.log('✅ Gemini API key detected, initializing client...');
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
} else {
  console.log('⚠️ WARNING: Gemini API key not configured!');
  console.log('  - Key exists:', !!process.env.GEMINI_API_KEY);
  console.log('  - Please set GEMINI_API_KEY in environment variables');
}

// OpenAI APIクライアント（フォールバック用）
let openai = null;
const hasValidOpenAIKey = process.env.OPENAI_API_KEY && 
                          process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
                          process.env.OPENAI_API_KEY.startsWith('sk-');

if (hasValidOpenAIKey && !geminiModel) {
  console.log('📌 OpenAI API key detected as fallback...');
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// CORS設定 - より柔軟で強力な設定
const corsOptions = {
  origin: true, // 本番環境では全てのオリジンを許可（一時的な解決策）
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept',
    'Origin',
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
};

// ミドルウェア
app.use(cors(corsOptions));

// 追加のCORSヘッダー設定（強制的に設定）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // すべてのOPTIONSリクエストを最優先で処理
  if (req.method === 'OPTIONS') {
    console.log('🔵 OPTIONS request received for:', req.path);
    return res.status(200).end();
  } else {
    next();
  }
});

// 全てのルートに対するOPTIONSハンドラー（フォールバック）
app.options('*', (req, res) => {
  console.log('🟢 Wildcard OPTIONS handler for:', req.path);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

app.use(express.json());

// CORSテスト用シンプルエンドポイント
app.get('/api/test-cors', (req, res) => {
  console.log('🔍 CORS Test endpoint hit from origin:', req.get('Origin'));
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.json({ 
    message: 'CORS test successful!', 
    timestamp: new Date().toISOString(),
    origin: req.get('Origin') || 'No origin header'
  });
});

app.options('/api/test-cors', (req, res) => {
  console.log('🔍 CORS Test OPTIONS from origin:', req.get('Origin'));
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

// マルチパートフォームデータ処理用の設定
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB制限（PDF対応）
  },
  fileFilter: (req, file, cb) => {
    // 画像またはPDFファイルのみ許可
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルまたはPDFファイルのみアップロード可能です'));
    }
  }
});


// 画像を解析してHTML/CSSを生成
async function generateCodeFromDesigns(pcImage, spImage, referenceUrl = null) {
  try {
    // Gemini APIを優先的に使用
    if (geminiModel) {
      console.log('🌟 Using Gemini Pro Vision for image analysis...');
      const rawResult = await generateWithGemini(pcImage, spImage, referenceUrl);
      
      // デバッグ: サニタイズを一時的に無効化
      console.log('🔍 DEBUGGING: Sanitization temporarily disabled');
      console.log('Raw result preview:', {
        htmlLength: rawResult.html?.length || 0,
        cssLength: rawResult.css?.length || 0,
        htmlPreview: rawResult.html?.substring(0, 200) || 'empty'
      });
      
      return rawResult; // サニタイズなしで返す
      
      // 生成されたコードをサニタイズ
      // const sanitizedResult = sanitizeGeneratedCode(rawResult);
      // console.log('🧹 Code sanitization completed');
      // return sanitizedResult;
    }
    
    // OpenAI APIをフォールバックとして使用
    if (openai) {
      console.log('🔄 Falling back to OpenAI GPT-4o...');
      const rawResult = await generateWithOpenAI(pcImage, spImage, referenceUrl);
      
      // デバッグ: サニタイズを一時的に無効化
      console.log('🔍 DEBUGGING: Sanitization temporarily disabled');
      console.log('Raw result preview:', {
        htmlLength: rawResult.html?.length || 0,
        cssLength: rawResult.css?.length || 0,
        htmlPreview: rawResult.html?.substring(0, 200) || 'empty'
      });
      
      return rawResult; // サニタイズなしで返す
      
      // 生成されたコードをサニタイズ
      // const sanitizedResult = sanitizeGeneratedCode(rawResult);
      // console.log('🧹 Code sanitization completed');
      // return sanitizedResult;
    }
    
    // どちらのAPIも利用できない場合
    console.error('❌ CRITICAL ERROR: No Vision API configured!');
    return {
      html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>APIキーエラー</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
    <h1 style="color: #e74c3c;">❌ Vision APIキーが設定されていません</h1>
    <p>以下のいずれかのAPIキーを環境変数に設定してください：</p>
    <div style="background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <strong>推奨: Google Gemini API</strong><br>
        <code>GEMINI_API_KEY=your-gemini-api-key</code>
    </div>
    <div style="background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <strong>代替: OpenAI API</strong><br>
        <code>OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx</code>
    </div>
    <p>設定後、Railwayを再デプロイしてください。</p>
</body>
</html>`,
      css: '',
      js: ''
    };
  } catch (error) {
    console.error('Unexpected error in generateCodeFromDesigns:', error);
    throw error;
  }
}

// Gemini APIを使用したコード生成
async function generateWithGemini(pcImage, spImage, referenceUrl) {
  try {
    // 画像サイズをチェック
    const pcSize = pcImage.length / 1024 / 1024;
    const spSize = spImage.length / 1024 / 1024;
    const totalSize = pcSize + spSize;
    
    console.log(`📊 Image sizes - PC: ${pcSize.toFixed(2)}MB, SP: ${spSize.toFixed(2)}MB, Total: ${totalSize.toFixed(2)}MB`);
    
    // 非常に大きな画像の場合はOpenAIに自動フォールバック
    if (totalSize > 15 && openai) {
      console.log('📈 Images too large, automatically falling back to OpenAI...');
      return await generateWithOpenAI(pcImage, spImage, referenceUrl);
    }
    
    // 画像をBase64に変換（自動圧縮付き）
    const pcBase64 = await imageToBase64WithJimp(pcImage);
    const spBase64 = await imageToBase64WithJimp(spImage);
    
    // Base64データを直接使用（既にプレフィックスなし）
    const pcImageData = pcBase64.includes(',') ? pcBase64.split(',')[1] : pcBase64;
    const spImageData = spBase64.includes(',') ? spBase64.split(',')[1] : spBase64;
    
    console.log('🔍 Image data lengths:', {
      pcImageData: pcImageData.length,
      spImageData: spImageData.length,
      pcSample: pcImageData.substring(0, 50),
      spSample: spImageData.substring(0, 50)
    });
    
    // プロンプトの構築
    const prompt = `あなたは世界最高レベルのUI/UXデザイナー兼フロントエンドエンジニアです。

**最重要ミッション**: 提供された画像デザインを100%忠実に再現すること

提供された2つの画像（PC版とスマートフォン版）を詳細に分析し、**ピクセル単位で完全に一致する**HTML/CSS/JavaScriptコードを生成してください。

## 絶対的な要求事項（MUST）:

### 1. デザインの完全な忠実性 - これが最優先
- **テキスト**: 画像内のすべてのテキストを正確に読み取り、一字一句同じように再現
- **配色**: 画像内のすべての色を正確に抽出し、完全に同一の色コードを使用
- **レイアウト**: 各要素の位置、サイズ、間隔を画像と完全に一致させる
- **フォント**: 画像内のフォントサイズ、太さ、行間を正確に測定して再現
- **構造**: セクションの順序、要素の配置を画像通りに再現

### 2. 画像の処理 - ブランクは絶対禁止
画像内に写真や画像要素がある場合:
- 元の画像の内容を詳細に説明し、適切な代替画像URLを使用
- 例: 人物写真 → "https://images.unsplash.com/photo-1234567890/sample.jpg" 
- 例: 製品画像 → "https://via.placeholder.com/400x300/cccccc/ffffff?text=ProductName"
- 例: アイコン → Font AwesomeやMaterial Iconsから最も近いものを選択
- **決して空白のimg要素やbackground-imageを残さない**

### 2.5. 色コードの適切な処理 - DNS解決エラーの防止（重要）
**絶対に守ること:**
- **色コードは必ず#記号付きで記述**: color: #ffffff; background: #333333;
- **URLとして解釈される記述を避ける**: url(#ffffff) は絶対禁止
- **href属性に色コードを使用しない**: href="#ffffff" は絶対禁止
- **class/id名に色コードを使用しない**: class="333333" は禁止
- **JavaScriptでの色コード処理**: 必ず文字列として扱う "#ffffff"
- **data属性に色コードを使用しない**: data-color="ffffff" は禁止
- **CSSセレクタに色コードを使用しない**: .ffffff {} は禁止

**正しい例:**
- CSS: color: #ffffff; background-color: #333333;
- JS: const color = "#ffffff"; element.style.color = "#333333";
- HTML: style="color: #ffffff; background: #333333;"

### 3. 詳細な測定と再現
- 各要素のサイズをピクセル単位で測定
- マージンとパディングを正確に計算
- 影、境界線、角丸の値を正確に抽出
- グラデーションがある場合は開始色と終了色を正確に特定

### 4. レスポンシブ実装
- PC版: 提供された画像の幅（通常1200px以上）で完璧に表示
- SP版: 提供された画像の幅（通常375px前後）で完璧に表示
- 中間サイズ: 両者の間を自然に補間

### 5. コード品質
- セマンティックHTML5を使用
- モダンCSS（Grid、Flexbox、カスタムプロパティ）を活用
- 必要に応じてスムーズなアニメーションやインタラクションを追加

${referenceUrl ? `参考URL: ${referenceUrl} - このサイトの技術的実装も参考にしてください。` : ''}

**分析手順**:
1. まず画像内のすべてのテキストを読み取る
2. 使用されているすべての色を特定（背景色、テキスト色、ボーダー色など）
3. レイアウト構造を完全に理解（グリッド、カラム数、セクション分割）
4. 各要素の正確なサイズと位置を測定
5. 画像要素の内容を理解し、適切な代替を用意

以下のJSON形式で回答してください：
{
  "html": "完全なHTMLコード（DOCTYPE含む、画像URLは実際のURLを使用）",
  "css": "完全なCSSコード（抽出した正確な色とサイズを使用）",
  "js": "JavaScriptコード（必要な場合）"
}`;

    // Gemini APIを呼び出し
    const result = await geminiModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: pcImageData
        }
      },
      `📱 PC版デザイン分析要求:
- 画像内のすべてのテキストを読み取り、完全に同じ文言で再現してください
- すべての色を正確に抽出し、16進数カラーコードで再現してください  
- レイアウトの寸法、間隔、位置を正確に測定してください
- 画像要素がある場合は内容を説明し、適切な代替画像URLを提供してください`,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: spImageData
        }
      },
      `📱 スマートフォン版デザイン分析要求:
- PC版と同様に、すべての要素を完全に忠実に再現してください
- レスポンシブ変化点での表示の違いを正確に把握してください
- 画像とテキストの配置変更を正確に反映してください

🎯 最終要求: 提供された2つの画像を100%忠実に再現するHTML/CSS/JSコードを生成してください。オリジナリティではなく、完全な模倣が求められています。`
    ]);
    
    const response = await result.response;
    const text = response.text();
    console.log('📊 Gemini response length:', text.length);
    
    // JSONを抽出（より柔軟なアプローチ）
    let parsedResult;
    
    try {
      // まず、コードブロック内のJSONを探す
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                       text.match(/```\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch) {
        const jsonContent = jsonMatch[1].trim();
        console.log('📄 Extracted JSON from code block:', jsonContent.substring(0, 200));
        parsedResult = JSON.parse(jsonContent);
      } else {
        // コードブロックがない場合、全文からJSONを探す
        const cleanText = text.trim();
        console.log('📄 Attempting to parse full response as JSON:', cleanText.substring(0, 200));
        parsedResult = JSON.parse(cleanText);
      }
    } catch (firstParseError) {
      console.warn('⚠️ First JSON parse failed:', firstParseError.message);
      
      // バックアップ：レスポンスからHTML/CSSを正規表現で抽出
      try {
        const htmlMatch = text.match(/(?:\"html\":\s*\")([\s\S]*?)(?:\",?\s*\"css\")/i) ||
                         text.match(/(?:html[\":\s]*)([\s\S]*?)(?:css)/i);
        const cssMatch = text.match(/(?:\"css\":\s*\")([\s\S]*?)(?:\",?\s*(?:\"js\"|\\}|$))/i) ||
                        text.match(/(?:css[\":\s]*)([\s\S]*?)(?:js|\\}|$)/i);
        
        if (htmlMatch && cssMatch) {
          // エスケープされた文字を戻す
          const html = htmlMatch[1].replace(/\\n/g, '\\n').replace(/\\\"/g, '\"').replace(/\\\\/g, '\\\\');
          const css = cssMatch[1].replace(/\\n/g, '\\n').replace(/\\\"/g, '\"').replace(/\\\\/g, '\\\\');
          
          parsedResult = {
            html: html,
            css: css,
            js: ''
          };
          console.log('🔧 Recovered code using regex extraction');
        } else {
          throw new Error('Could not extract HTML/CSS from malformed response');
        }
      } catch (regexError) {
        console.error('❌ Regex extraction also failed:', regexError.message);
        throw new Error(`Failed to parse Gemini response: ${firstParseError.message}`);
      }
    }
    
    if (!parsedResult.html || !parsedResult.css) {
      throw new Error('Invalid response format from Gemini');
    }
    
    return {
      html: parsedResult.html,
      css: parsedResult.css,
      js: parsedResult.js || ''
    };
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

// OpenAI APIを使用したコード生成（既存のコードを関数化）
async function generateWithOpenAI(pcImage, spImage, referenceUrl) {
  try {
    // 画像をBase64に変換
    const pcBase64 = await imageToBase64WithJimp(pcImage);
    const spBase64 = await imageToBase64WithJimp(spImage);

    console.log('🎨 Starting detailed design analysis with GPT-4o...');
    
    // OpenAI Vision APIを使用してデザインを解析（最新のgpt-4oモデル使用）
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `あなたは世界最高レベルのUI/UXデザイナー兼フロントエンドエンジニアです。

提供された画像デザインを「ピクセル単位で正確に」分析し、視覚的に完全に一致するHTML/CSSコードを生成してください。

## 🔍 画像分析の重要なポイント：
1. **レイアウト構造**: ヘッダー、ナビ、メインコンテンツ、サイドバー、フッターの配置
2. **色彩情報**: 背景色、テキスト色、ボタン色、境界線色を正確に抽出
3. **タイポグラフィ**: フォントサイズ、太さ、行間、文字間隔
4. **要素サイズ**: ボタン、画像、余白、パディングの正確な数値
5. **視覚効果**: 影、グラデーション、角丸、透明度
6. **アイコン・画像**: SVGアイコンまたはプレースホルダー画像として再現

## 💻 技術要件：
- セマンティックHTML5（適切なheader、nav、main、section、article使用）
- CSS Grid + Flexboxの効果的な組み合わせ
- レスポンシブデザイン（モバイルファースト）
- モダンCSS（カスタムプロパティ、論理プロパティ活用）
- アクセシビリティ対応（ARIA属性、セマンティック要素）
- 実際のプロダクトレベルのコード品質

## 📱 レスポンシブ対応：
- PC版（1200px以上）: 提供されたPCデザインに完全一致
- タブレット版（768px-1199px）: 適切な中間レイアウト
- モバイル版（767px以下）: 提供されたSPデザインに完全一致

## 🎯 出力フォーマット：
必ず以下のJSON形式で返答してください（JSONのみ、追加説明は不要）：
{
  "html": "完全なHTMLコード（DOCTYPE、meta、title含む）",
  "css": "完全なCSSコード（レスポンシブメディアクエリ含む）",
  "js": "必要に応じたJavaScriptコード（インタラクション等）",
  "analysis": "画像分析結果の詳細な説明"
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `🖥️ **PCデザイン分析開始**

以下のPCデザイン画像を詳細に分析してください：
- レイアウト構造（グリッド、フレックス配置）
- カラーパレット（背景、テキスト、アクセント色）
- コンポーネント（ボタン、カード、ナビゲーション）
- タイポグラフィ（見出し、本文、サイズ階層）
- 余白・間隔（マージン、パディング）
- 視覚的装飾（影、境界線、角丸など）`
            },
            {
              type: "image_url",
              image_url: {
                url: pcBase64,
                detail: "high"
              }
            },
            {
              type: "text",
              text: `📱 **SPデザイン分析開始**

以下のSPデザイン画像を詳細に分析してください：
- モバイル向けレイアウト調整
- コンテンツの積み重ね構造
- ナビゲーションの変更（ハンバーガーメニューなど）
- タッチフレンドリーなボタンサイズ
- モバイル最適化された余白

**重要**: 両画像のデザインを正確に再現し、完全に一致するコードを生成してください。`
            },
            {
              type: "image_url", 
              image_url: {
                url: spBase64,
                detail: "high"
              }
            },
            referenceUrl ? {
              type: "text",
              text: `🔗 **CRITICAL: 参考URL徹底活用**
              
**URL**: ${referenceUrl}

**📋 URL分析タスク:**
1. **構造分析**: このサイトのHTML構造、CSS設計パターンを研究
2. **UI/UXパターン**: ナビゲーション、ボタン、カードデザインの実装方式
3. **レスポンシブ手法**: メディアクエリ、ブレークポイントの設定方法
4. **アニメーション・インタラクション**: ホバー効果、トランジション
5. **タイポグラフィ**: フォント選択、サイズ階層、行間設定
6. **色彩設計**: カラーパレット、コントラスト、配色理論

**⚡ 重要指示:**
- 提供された画像デザインを「主軸」として、参考URLの技術的な実装手法を「補完」に使用
- 参考URLからは最新のベストプラクティスを抽出し、提供画像のデザインに適用
- モダンなCSS手法（CSS Grid、Flexbox、カスタムプロパティ）を積極的に採用
- 参考サイトのアクセシビリティ対応やSEO最適化も参考にする

**🎯 最終目標:** 参考URLレベルの技術的完成度で、提供画像デザインを完璧再現`
            } : null
          ].filter(Boolean)
        }
      ],
      max_tokens: 6000,
      temperature: 0.1, // より一貫した結果のため低い値に設定
    });

    const content = response.choices[0].message.content;
    console.log('🤖 OpenAI Response length:', content.length);
    
    // JSONレスポンスの抽出とパース（より堅牢な処理）
    let result;
    try {
      // コードブロック内のJSONを抽出
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, content];
      
      const jsonContent = jsonMatch[1] || content;
      result = JSON.parse(jsonContent.trim());
      
      // 必要なフィールドが存在するかチェック
      if (!result.html || !result.css) {
        throw new Error('Required fields (html, css) are missing from OpenAI response');
      }
      
      // JavaScriptフィールドがない場合は空文字列を設定
      if (!result.js) {
        result.js = '';
      }
      
      console.log('✅ Successfully parsed OpenAI response');
      console.log('📊 Generated code stats:', {
        htmlLength: result.html.length,
        cssLength: result.css.length,
        jsLength: result.js.length,
        hasAnalysis: !!result.analysis
      });
      
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      console.log('🔍 Raw content sample:', content.substring(0, 500));
      
      // フォールバック: レスポンスからHTML/CSSを正規表現で抽出を試行
      const htmlMatch = content.match(/(?:```html\s*|\bhtml["\s]*:\s*["\s]*)([\s\S]*?)(?:```|",?\s*\bcss)/i);
      const cssMatch = content.match(/(?:```css\s*|\bcss["\s]*:\s*["\s]*)([\s\S]*?)(?:```|",?\s*(?:\bjs|\}|$))/i);
      
      if (htmlMatch && cssMatch) {
        result = {
          html: htmlMatch[1].trim().replace(/^["'`]|["'`]$/g, ''),
          css: cssMatch[1].trim().replace(/^["'`]|["'`]$/g, ''),
          js: '',
          analysis: 'Extracted from malformed JSON response'
        };
        console.log('🔧 Recovered code using regex extraction');
      } else {
        throw new Error('Failed to parse OpenAI response and fallback extraction failed');
      }
    }
    
    return result;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    console.error('Error details:', error.message);
    
    // APIエラーの詳細を返す
    return {
      html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>APIエラー</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
    <h1 style="color: #e74c3c;">⚠️ OpenAI API エラー</h1>
    <p>コード生成中にエラーが発生しました。</p>
    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>エラー内容:</strong></p>
        <code style="color: #e74c3c;">${error.message}</code>
    </div>
    <p>考えられる原因:</p>
    <ul>
        <li>APIキーが無効</li>
        <li>APIの利用上限に到達</li>
        <li>ネットワークエラー</li>
    </ul>
    <p>Railway のログを確認してください。</p>
</body>
</html>`,
      css: '',
      js: '',
      error: error.message
    };
  }
}

// 深層画像解析（OpenAI API不使用時の究極フォールバック）
async function performDeepImageAnalysis(pcImage, spImage, referenceUrl) {
  console.log('🔬 Starting ULTRA-ENHANCED image analysis...');
  
  try {
    // PC画像の超詳細分析
    const pcAnalysis = await analyzeImageUltraDetailed(pcImage);
    // SP画像の超詳細分析
    const spAnalysis = await analyzeImageUltraDetailed(spImage);
    
    // 参考URLの分析
    let referenceData = null;
    if (referenceUrl) {
      referenceData = await analyzeReferenceUrl(referenceUrl);
    }
    
    // 画像の視覚的特徴から具体的なHTMLを生成
    return generatePixelPerfectCode(pcAnalysis, spAnalysis, referenceData);
    
  } catch (error) {
    console.error('Deep analysis error:', error);
    // 最終フォールバック
    return getUltraBasicTemplate();
  }
}

// 超詳細画像分析（強化版）
async function analyzeImageUltraDetailed(imageBuffer) {
  try {
    console.log('🔍 Performing ENHANCED image analysis...');
    
    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    // 色抽出の強化
    const dominantColors = await extractDominantColors(image);
    const backgroundColors = await extractBackgroundColors(image);
    const textColors = await extractTextColors(image);
    
    // レイアウト分析の強化
    const layoutAnalysis = await analyzeLayoutStructure(image);
    const textAnalysis = await analyzeTextElements(image);
    
    return {
      width,
      height,
      aspect: width / height,
      // 強化された色情報
      dominantColors: dominantColors,
      backgroundColors: backgroundColors,
      textColors: textColors,
      colorPalette: [...new Set([...dominantColors, ...backgroundColors, ...textColors])],
      
      // 強化されたレイアウト情報
      layout: {
        ...layoutAnalysis,
        hasHeader: height > 200 && layoutAnalysis.topSectionHeight > 60,
        hasFooter: layoutAnalysis.bottomSectionHeight > 40,
        columnCount: layoutAnalysis.estimatedColumns,
        isSidebar: layoutAnalysis.hasSidebar,
        gridStructure: layoutAnalysis.gridType
      },
      
      // テキスト分析情報
      text: textAnalysis,
      
      // 視覚的特徴
      brightness: calculateImageBrightness(image),
      contrast: calculateImageContrast(image),
      visualComplexity: layoutAnalysis.complexity
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      width: 1200,
      height: 800,
      dominantColors: ['#ffffff', '#000000'],
      layout: { hasHeader: true, hasFooter: true, columnCount: 1, isSidebar: false },
      brightness: 0.5
    };
  }
}

// 強化された色抽出関数
async function extractDominantColors(image) {
  const colors = [];
  const step = Math.max(1, Math.floor(image.bitmap.width / 50));
  
  for (let x = 0; x < image.bitmap.width; x += step) {
    for (let y = 0; y < image.bitmap.height; y += step) {
      const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
      colors.push(`rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`);
    }
  }
  
  // 色の出現頻度を計算し、主要な5色を返す
  const colorCounts = {};
  colors.forEach(color => {
    colorCounts[color] = (colorCounts[color] || 0) + 1;
  });
  
  return Object.entries(colorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([color]) => color);
}

async function extractBackgroundColors(image) {
  // 画像の四隅と中央を採取して背景色を推定
  const corners = [
    { x: 0, y: 0 },
    { x: image.bitmap.width - 1, y: 0 },
    { x: 0, y: image.bitmap.height - 1 },
    { x: image.bitmap.width - 1, y: image.bitmap.height - 1 },
    { x: Math.floor(image.bitmap.width / 2), y: Math.floor(image.bitmap.height / 2) }
  ];
  
  return corners.map(point => {
    const rgba = Jimp.intToRGBA(image.getPixelColor(point.x, point.y));
    return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
  });
}

async function extractTextColors(image) {
  // 画像の中央部分をサンプリングしてテキスト色を推定
  const textColors = [];
  const centerX = Math.floor(image.bitmap.width / 2);
  const centerY = Math.floor(image.bitmap.height / 2);
  const sampleRadius = Math.min(centerX, centerY) / 2;
  
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const x = Math.floor(centerX + Math.cos(angle) * sampleRadius);
    const y = Math.floor(centerY + Math.sin(angle) * sampleRadius);
    
    if (x >= 0 && x < image.bitmap.width && y >= 0 && y < image.bitmap.height) {
      const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
      textColors.push(`rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`);
    }
  }
  
  return [...new Set(textColors)].slice(0, 3);
}

async function analyzeLayoutStructure(image) {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  return {
    topSectionHeight: Math.floor(height * 0.15),
    bottomSectionHeight: Math.floor(height * 0.1),
    estimatedColumns: width > 1000 ? 3 : width > 600 ? 2 : 1,
    hasSidebar: width > 900,
    gridType: width > 1200 ? 'complex-grid' : 'simple-grid',
    complexity: calculateLayoutComplexity(width, height)
  };
}

async function analyzeTextElements(image) {
  return {
    estimatedHeadingCount: 3,
    estimatedParagraphCount: 5,
    hasLargeTitle: true,
    hasSubtitles: true,
    hasBodyText: true
  };
}

function calculateImageBrightness(image) {
  let totalBrightness = 0;
  let pixelCount = 0;
  
  for (let x = 0; x < image.bitmap.width; x += 10) {
    for (let y = 0; y < image.bitmap.height; y += 10) {
      const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
      const brightness = (rgba.r + rgba.g + rgba.b) / 3;
      totalBrightness += brightness;
      pixelCount++;
    }
  }
  
  return totalBrightness / pixelCount / 255;
}

function calculateImageContrast(image) {
  // 簡易的なコントラスト計算
  return 0.5; // 暫定値
}

function calculateLayoutComplexity(width, height) {
  const aspectRatio = width / height;
  if (aspectRatio > 2) return 'high';
  if (aspectRatio > 1.5) return 'medium';
  return 'low';
}

// 色の均一性をチェック
function checkUniformColor(section) {
  if (!section || section.length === 0) return false;
  
  const firstColor = section[0][0];
  const threshold = 30; // RGB値の差の閾値
  
  return section.every(row => 
    row.every(cell => 
      Math.abs(cell.r - firstColor.r) < threshold &&
      Math.abs(cell.g - firstColor.g) < threshold &&
      Math.abs(cell.b - firstColor.b) < threshold
    )
  );
}

// カラム数を検出
function detectColumns(section) {
  if (!section || section.length === 0) return 1;
  
  // 垂直方向の色の変化を検出
  const verticalChanges = [];
  for (let x = 1; x < section[0].length; x++) {
    let changeCount = 0;
    for (let y = 0; y < section.length; y++) {
      const prev = section[y][x - 1];
      const curr = section[y][x];
      const diff = Math.abs(prev.r - curr.r) + Math.abs(prev.g - curr.g) + Math.abs(prev.b - curr.b);
      if (diff > 100) changeCount++;
    }
    verticalChanges.push(changeCount);
  }
  
  // 大きな変化の数からカラム数を推定
  const significantChanges = verticalChanges.filter(c => c > section.length / 2).length;
  return Math.min(significantChanges + 1, 4); // 最大4カラム
}


// ピクセルパーフェクトなコード生成
function generatePixelPerfectCode(pcAnalysis, spAnalysis, referenceData) {
  const { dominantColors, layout } = pcAnalysis;
  const backgroundColor = dominantColors.isDark ? '#0a0a0a' : '#ffffff';
  const textColor = dominantColors.isDark ? '#ffffff' : '#1a1a1a';
  const primaryColor = dominantColors.primary;
  
  // レイアウトに基づいたHTML構造
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${referenceData?.title || 'Pixel Perfect Design'}</title>
    <meta name="description" content="${referenceData?.description || 'アップロードされた画像に基づいて生成されたWebサイト'}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
    ${layout.hasHeader ? generateHeader(primaryColor, textColor) : ''}
    
    <main class="main-content">
        ${generateMainContent(layout, pcAnalysis, textColor)}
    </main>
    
    ${layout.hasFooter ? generateFooter(primaryColor, textColor) : ''}
    
    <script src="script.js"></script>
</body>
</html>`;

  const css = generatePixelPerfectCSS(pcAnalysis, spAnalysis, backgroundColor, textColor, primaryColor);
  
  const js = generateInteractiveJS();
  
  return { html, css, js };
}

// ヘッダー生成
function generateHeader(bgColor, textColor) {
  return `
    <header class="site-header">
        <div class="header-container">
            <div class="logo">
                <h1>Your Brand</h1>
            </div>
            <nav class="main-nav">
                <ul>
                    <li><a href="#home">ホーム</a></li>
                    <li><a href="#about">サービス</a></li>
                    <li><a href="#services">機能</a></li>
                    <li><a href="#contact">お問い合わせ</a></li>
                </ul>
            </nav>
            <button class="mobile-menu-toggle" aria-label="メニュー">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </div>
    </header>`;
}

// メインコンテンツ生成
function generateMainContent(layout, analysis, textColor) {
  if (layout.columnCount === 1) {
    return generateSingleColumnContent();
  } else if (layout.isSidebar) {
    return generateSidebarLayout();
  } else {
    return generateMultiColumnContent(layout.columnCount);
  }
}

// シングルカラムコンテンツ
function generateSingleColumnContent() {
  return `
        <section class="hero-section">
            <div class="container">
                <h2 class="hero-title">美しいデザインを実現</h2>
                <p class="hero-description">アップロードされた画像に基づいて、ピクセルパーフェクトなWebサイトを生成します</p>
                <div class="cta-group">
                    <button class="cta-button primary">始めてみる</button>
                    <button class="cta-button secondary">詳細を見る</button>
                </div>
            </div>
        </section>
        
        <section class="features-section">
            <div class="container">
                <h3 class="section-title">主な特徴</h3>
                <div class="features-grid">
                    <div class="feature-card">
                        <div class="feature-icon">🎨</div>
                        <h4>ピクセルパーフェクト</h4>
                        <p>画像の細部まで正確に再現します</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">📱</div>
                        <h4>レスポンシブ対応</h4>
                        <p>すべてのデバイスで美しく表示</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">⚡</div>
                        <h4>高速パフォーマンス</h4>
                        <p>最適化されたコードで高速動作</p>
                    </div>
                </div>
            </div>
        </section>`;
}

// 画像から詳細情報を抽出（Jimp使用）
async function analyzeImageBasics(imageBuffer) {
  try {
    console.log('🔍 Analyzing image with Jimp...');
    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    // 基本的な色分析（簡略版）
    const dominantColor = '#333333'; // デフォルト色
    const colorComplexity = 0.5; // 中程度の複雑さとして仮定
    
    // レイアウト推定（横縦比から）
    const aspect = width / height;
    const layoutType = determineLayoutType(aspect, colorComplexity);
    
    // コンテンツタイプの推定
    const contentType = estimateContentType(colorComplexity, width, height);
    
    return {
      width,
      height,
      aspect,
      dominantColor,
      isLandscape: width > height,
      size: width > 1000 ? 'large' : width > 600 ? 'medium' : 'small',
      colorComplexity,
      layoutType,
      contentType,
      hasHeader: colorComplexity > 0.3 && height > 400,
      hasMultipleColumns: width > 800 && colorComplexity > 0.4,
      brightness: 0.5 // 中程度の明度として仮定
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    return null;
  }
}

// レイアウトタイプを決定
function determineLayoutType(aspect, complexity) {
  if (aspect > 1.5) {
    return complexity > 0.4 ? 'multi-column' : 'hero-banner';
  } else if (aspect > 0.7) {
    return complexity > 0.5 ? 'grid-layout' : 'card-layout';
  } else {
    return 'mobile-vertical';
  }
}

// コンテンツタイプを推定
function estimateContentType(complexity, width, height) {
  if (complexity < 0.2) return 'minimal';
  if (complexity > 0.6) return 'rich-content';
  if (width > height) return 'landing-page';
  return 'content-page';
}

// 高度なフォールバックテンプレート生成
async function getAdvancedFallbackTemplate(pcImage, spImage, referenceUrl = null) {
  let pcAnalysis = null;
  let spAnalysis = null;
  let referenceContent = '';
  
  try {
    // 画像分析
    if (pcImage) pcAnalysis = await analyzeImageBasics(pcImage);
    if (spImage) spAnalysis = await analyzeImageBasics(spImage);
    
    // URL参照機能
    if (referenceUrl) {
      referenceContent = await analyzeReferenceUrl(referenceUrl);
    }
  } catch (error) {
    console.error('Analysis error:', error);
  }

  // 分析結果に基づいたテンプレート生成
  const template = generateCustomTemplate(pcAnalysis, spAnalysis, referenceContent);
  return template;
}

// URL参照分析機能
async function analyzeReferenceUrl(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // 基本的なHTML解析
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'ページタイトル';
    
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    const description = descMatch ? descMatch[1] : 'ページの説明';
    
    return { title, description, hasReference: true };
  } catch (error) {
    console.error('URL analysis error:', error);
    return { title: 'ページタイトル', description: 'ページの説明', hasReference: false };
  }
}

// カスタムテンプレート生成
function generateCustomTemplate(pcAnalysis, spAnalysis, referenceContent) {
  const primaryColor = pcAnalysis?.dominantColor || '#667eea';
  const title = referenceContent?.title || 'レスポンシブページ';
  const description = referenceContent?.description || 'モダンで美しいWebサイト';
  
  // 分析結果に基づいたレイアウト決定
  const layoutType = pcAnalysis?.layoutType || 'hero-banner';
  const contentType = pcAnalysis?.contentType || 'landing-page';
  const hasMultipleColumns = pcAnalysis?.hasMultipleColumns || false;
  const brightness = pcAnalysis?.brightness || 0.5;
  
  console.log('Generating template with analysis:', {
    layoutType,
    contentType,
    hasMultipleColumns,
    brightness,
    primaryColor
  });
  
  // レイアウトタイプに応じたHTMLとCSSを生成
  const template = generateLayoutBasedTemplate(layoutType, contentType, {
    primaryColor,
    title,
    description,
    hasMultipleColumns,
    brightness
  });
  
  return template;
}

// レイアウトタイプに基づいたテンプレート生成
function generateLayoutBasedTemplate(layoutType, contentType, options) {
  const { primaryColor, title, description, hasMultipleColumns, brightness } = options;
  
  // 明度に基づく背景色の決定
  const isDark = brightness < 0.4;
  const backgroundColor = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#333333';
  const cardBg = isDark ? '#2a2a2a' : '#f8f9fa';
  
  let htmlContent;
  let cssContent;
  
  switch (layoutType) {
    case 'multi-column':
      htmlContent = generateMultiColumnHTML(title, description);
      cssContent = generateMultiColumnCSS(primaryColor, backgroundColor, textColor, cardBg);
      break;
    case 'grid-layout':
      htmlContent = generateGridLayoutHTML(title, description);
      cssContent = generateGridLayoutCSS(primaryColor, backgroundColor, textColor, cardBg);
      break;
    case 'card-layout':
      htmlContent = generateCardLayoutHTML(title, description);
      cssContent = generateCardLayoutCSS(primaryColor, backgroundColor, textColor, cardBg);
      break;
    case 'mobile-vertical':
      htmlContent = generateMobileVerticalHTML(title, description);
      cssContent = generateMobileVerticalCSS(primaryColor, backgroundColor, textColor, cardBg);
      break;
    default: // hero-banner
      htmlContent = generateHeroBannerHTML(title, description);
      cssContent = generateHeroBannerCSS(primaryColor, backgroundColor, textColor, cardBg);
  }
  
  return {
    html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
</head>
${htmlContent}
</html>`,
    css: cssContent,
    js: `
// インタラクティブ機能
document.addEventListener('DOMContentLoaded', function() {
    // スムーススクロール
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // スクロールアニメーション
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // アニメーション対象要素を監視
    document.querySelectorAll('.feature-card, .hero-title, .hero-description').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
    
    // ボタンホバーエフェクト
    document.querySelectorAll('.cta-button').forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.05)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
});`
  };
}
// シンプルなフォールバック（従来版）
function getFallbackTemplate() {
  return generateCustomTemplate(null, null, null);
}


// ファイルをアップロードして処理
async function processUploadedFile(file, targetWidth = 1200) {
  if (!file) {
    throw new Error("ファイルが選択されていません");
  }

  try {
    // PDFファイルの場合
    if (file.mimetype === "application/pdf") {
      return await convertPdfToImage(file.buffer, {
        page: 1,
        width: targetWidth
      });
    }

    // 画像ファイルの場合はJimpでリサイズ
    const image = await Jimp.read(file.buffer);
    
    // 必要に応じてリサイズ
    if (image.bitmap.width > targetWidth) {
      image.scaleToFit(targetWidth, Jimp.AUTO);
    }
    
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    console.error("File processing error:", error);
    throw new Error("ファイル処理中にエラーが発生しました");
  }
}

// PDF情報取得エンドポイント
app.post("/api/pdf-info", upload.single("pdfFile"), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "PDFファイルが必要です" });
    }

    const pageCount = await getPdfPageCount(req.file.buffer);

    res.json({
      pageCount,
      fileSize: req.file.size,
      fileName: req.file.originalname
    });
  } catch (error) {
    console.error("PDF info error:", error);
    res.status(500).json({ error: "PDF情報の取得に失敗しました" });
  }
});

// PDF特定ページ変換エンドポイント
app.post("/api/convert-pdf-page", upload.single("pdfFile"), async (req, res) => {
  try {
    const { page = 1, density = 300 } = req.body;

    if (!req.file || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "PDFファイルが必要です" });
    }

    const imageBuffer = await convertPdfToImage(req.file.buffer, {
      page: parseInt(page),
      density: parseInt(density)
    });

    const base64 = imageBuffer.toString("base64");

    res.json({
      image: `data:image/png;base64,${base64}`,
      page: parseInt(page)
    });
  } catch (error) {
    console.error("PDF conversion error:", error);
    res.status(500).json({ error: "PDF変換に失敗しました" });
  }
});

// 複数ページPDF一括変換エンドポイント
app.post("/api/convert-pdf-all", upload.single("pdfFile"), async (req, res) => {
  try {
    const { combine = false } = req.body;

    if (!req.file || req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "PDFファイルが必要です" });
    }

    // 全ページを画像に変換
    const images = await convertPdfToMultipleImages(req.file.buffer);

    if (combine && images.length > 1) {
      // 画像を結合
      const imageBuffers = images.map(img => img.buffer);
      const combinedBuffer = await combineImagesVertically(imageBuffers);
      const base64 = combinedBuffer.toString("base64");

      res.json({
        image: `data:image/png;base64,${base64}`,
        pageCount: images.length,
        combined: true
      });
    } else {
      // 個別画像として返す
      res.json({
        images: images.map(img => ({
          page: img.page,
          image: img.dataUrl
        })),
        pageCount: images.length,
        combined: false
      });
    }
  } catch (error) {
    console.error("PDF conversion error:", error);
    res.status(500).json({ error: "PDF変換に失敗しました" });
  }
});

// OPTIONSリクエスト対応（プリフライト）
app.options("/api/generate-code", (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400'); // 24時間キャッシュ
  res.sendStatus(200);
});

// コード生成エンドポイント
app.post("/api/generate-code", upload.any(), async (req, res) => {
  try {
    console.log('📝 Request received:', { 
      mode: req.body.mode, 
      filesCount: req.files ? req.files.length : 0,
      fieldNames: req.files ? req.files.map(f => f.fieldname) : []
    });
    
    // req.filesが存在しない場合のエラーハンドリング
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: "画像ファイルがアップロードされていません",
        details: "PC/SP両方のデザイン画像をアップロードしてください"
      });
    }
    
    const mode = req.body.mode || "single";
    const referenceUrl = req.body.referenceUrl || null;

    if (mode === "multi") {
      // マルチ画像モード
      const pcCount = parseInt(req.body.pcCount) || 0;
      const spCount = parseInt(req.body.spCount) || 0;

      if (pcCount === 0 || spCount === 0) {
        return res.status(400).json({ error: "両方のデザインファイルが必要です" });
      }

      // PC画像を収集・処理
      const pcFiles = [];
      const spFiles = [];

      req.files.forEach(file => {
        if (file.fieldname.startsWith("pcDesign_")) {
          pcFiles.push(file);
        } else if (file.fieldname.startsWith("spDesign_")) {
          spFiles.push(file);
        }
      });

      // 各ファイルを処理
      const processedPcImages = await Promise.all(
        pcFiles.map(file => processUploadedFile(file, 1200))
      );
      const processedSpImages = await Promise.all(
        spFiles.map(file => processUploadedFile(file, 600))
      );

      // 画像を結合
      const combinedPc = await combineImagesVertically(processedPcImages);
      const combinedSp = await combineImagesVertically(processedSpImages);

      // コード生成
      const generatedCode = await generateCodeFromDesigns(combinedPc, combinedSp, referenceUrl);
      res.json(generatedCode);
    } else {
      // シングル画像モード（従来の処理）
      const pcFile = req.files.find(f => f.fieldname === "pcDesign" || f.fieldname === "pcImage");
      const spFile = req.files.find(f => f.fieldname === "spDesign" || f.fieldname === "spImage");

      console.log('🔍 File search results:', {
        pcFile: pcFile ? pcFile.fieldname : 'not found',
        spFile: spFile ? spFile.fieldname : 'not found',
        allFields: req.files.map(f => f.fieldname)
      });

      if (!pcFile || !spFile) {
        return res.status(400).json({ error: "両方のデザインファイルが必要です" });
      }

      const processedPc = await processUploadedFile(pcFile, 1200);
      const processedSp = await processUploadedFile(spFile, 600);

      const generatedCode = await generateCodeFromDesigns(processedPc, processedSp, referenceUrl);
      res.json(generatedCode);
    }
  } catch (error) {
    console.error("Error generating code:", error);
    console.error('Error stack:', error.stack);
    const errorMessage = error.message || 'Unknown error';
    res.status(500).json({ 
      error: "コード生成中にエラーが発生しました",
      details: errorMessage
    });
  }
});

// スクリーンショット取得エンドポイント
app.post("/api/screenshot", express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const { html, css, device = "desktop" } = req.body;

    if (!html || !css) {
      return res.status(400).json({ error: "HTMLとCSSが必要です" });
    }

    const screenshot = await takeScreenshot(html, css, device);
    const base64 = screenshot.toString("base64");

    res.json({
      screenshot: `data:image/png;base64,${base64}`,
      device
    });
  } catch (error) {
    console.error("Screenshot error:", error);
    console.error("Error details:", error.message);
    console.error("Stack trace:", error.stack);
    
    // フォールバック: 基本的なプレビュー画像を返す
    try {
      const fallbackImage = await generateFallbackPreview(device);
      const base64 = fallbackImage.toString("base64");
      
      res.json({
        screenshot: `data:image/png;base64,${base64}`,
        device,
        fallback: true,
        message: "スクリーンショット生成でエラーが発生しましたが、フォールバック画像を生成しました"
      });
    } catch (fallbackError) {
      console.error("Fallback screenshot failed:", fallbackError);
      res.status(500).json({ 
        error: "スクリーンショットの生成に失敗しました",
        details: error.message
      });
    }
  }
});

// 画像比較エンドポイント
app.post("/api/compare", upload.fields([
  { name: "original", maxCount: 1 },
  { name: "generated", maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files.original || !req.files.generated) {
      return res.status(400).json({ error: "両方の画像が必要です" });
    }

    const originalBuffer = req.files.original[0].buffer;
    const generatedBuffer = req.files.generated[0].buffer;

    const comparison = await compareImages(originalBuffer, generatedBuffer);

    res.json({
      diffPercentage: comparison.diffPercentage,
      diffImage: `data:image/png;base64,${comparison.diffImage.toString("base64")}`,
      numDiffPixels: comparison.numDiffPixels,
      totalPixels: comparison.totalPixels
    });
  } catch (error) {
    console.error("Comparison error:", error);
    res.status(500).json({ error: "画像比較に失敗しました" });
  }
});

// 自動イテレーションエンドポイント
app.post("/api/iterate", upload.single("targetImage"), async (req, res) => {
  try {
    console.log("Iteration request received:", {
      hasFile: !!req.file,
      bodyKeys: Object.keys(req.body),
      fileSize: req.file?.size
    });
    
    const { html, css, maxIterations = 5 } = req.body;
    const targetImage = req.file?.buffer;

    console.log("Iteration parameters:", {
      hasTargetImage: !!targetImage,
      hasHtml: !!html,
      hasCss: !!css,
      maxIterations
    });

    if (!targetImage || !html || !css) {
      console.log("Missing parameters for iteration");
      return res.status(400).json({ 
        error: "必要なパラメータが不足しています",
        missing: {
          targetImage: !targetImage,
          html: !html,
          css: !css
        }
      });
    }

    console.log("Starting iteration design process...");
    // イテレーション処理を実行
    const iterations = await iterateDesign(targetImage, html, css, maxIterations);
    console.log(`Iteration completed with ${iterations.length} iterations`);

    // 結果を返す（Base64エンコード）
    const results = iterations.map(iter => ({
      iteration: iter.iteration,
      html: iter.html,
      css: iter.css,
      screenshot: `data:image/png;base64,${iter.screenshot.toString("base64")}`,
      diffPercentage: iter.diffPercentage,
      diffImage: `data:image/png;base64,${iter.diffImage.toString("base64")}`
    }));

    res.json({ iterations: results });
  } catch (error) {
    console.error("Iteration error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // エラーの種類に応じた対応
    let errorMessage = "イテレーション処理に失敗しました";
    let statusCode = 500;
    
    if (error.message.includes("unrecognised content")) {
      errorMessage = "画像データの処理中にエラーが発生しました";
      console.log("Stream processing error detected, likely image data corruption");
    } else if (error.message.includes("timeout")) {
      errorMessage = "処理がタイムアウトしました";
      statusCode = 408;
    } else if (error.message.includes("ENOTFOUND")) {
      errorMessage = "ネットワーク接続エラーが発生しました";
      statusCode = 503;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message,
      type: error.name || "UnknownError"
    });
  }
});

// ヘルスチェック
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 生成されたコードのサニタイズ機能
function sanitizeGeneratedCode(codeObject) {
  console.log('🧹 Starting code sanitization...');
  console.log('Pre-sanitization stats:', {
    htmlLength: (codeObject.html || '').length,
    cssLength: (codeObject.css || '').length,
    jsLength: (codeObject.js || '').length
  });
  
  const result = {
    html: sanitizeHTML(codeObject.html || ''),
    css: sanitizeCSS(codeObject.css || ''),
    js: sanitizeJS(codeObject.js || '')
  };
  
  console.log('Post-sanitization stats:', {
    htmlLength: result.html.length,
    cssLength: result.css.length,
    jsLength: result.js.length
  });
  
  // 内容が極端に短くなっている場合は警告
  if (codeObject.html && result.html.length < codeObject.html.length * 0.5) {
    console.warn('⚠️ HTML content reduced significantly during sanitization');
    console.log('Original HTML preview:', codeObject.html.substring(0, 500));
    console.log('Sanitized HTML preview:', result.html.substring(0, 500));
  }
  
  if (codeObject.css && result.css.length < codeObject.css.length * 0.5) {
    console.warn('⚠️ CSS content reduced significantly during sanitization');
    console.log('Original CSS preview:', codeObject.css.substring(0, 500));
    console.log('Sanitized CSS preview:', result.css.substring(0, 500));
  }
  
  return result;
}

function sanitizeHTML(html) {
  if (!html || html.trim() === '') {
    console.warn('⚠️ Empty HTML provided to sanitizer');
    return html;
  }
  
  let sanitized = html;
  let changesCount = 0;
  
  // 1. 不正なhref属性を修正（色コード）- より慎重なマッチング
  const hrefPattern1 = /href\s*=\s*["']\s*#?([0-9a-fA-F]{6})\s*["']/g;
  sanitized = sanitized.replace(hrefPattern1, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed href color code: ${match} -> href="#"`);
    return 'href="#"';
  });
  
  // 2. 色コードが直接src属性として使用されている場合のみ修正
  const srcPattern = /src\s*=\s*["']\s*#?([0-9a-fA-F]{6})\s*["']/g;
  sanitized = sanitized.replace(srcPattern, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed src color code: ${match}`);
    return 'src="https://via.placeholder.com/300x200/cccccc/ffffff?text=Image"';
  });
  
  // 3. 色コードがclass名/id名として使用されている場合のみ修正
  const classPattern = /class\s*=\s*["']\s*([0-9a-fA-F]{6})\s*["']/g;
  sanitized = sanitized.replace(classPattern, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed class color code: ${match}`);
    return 'class="generated-element"';
  });
  
  const idPattern = /id\s*=\s*["']\s*([0-9a-fA-F]{6})\s*["']/g;
  sanitized = sanitized.replace(idPattern, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed id color code: ${match}`);
    return 'id="generated-element"';
  });
  
  // 4. style属性内の色コード修正（#を追加）
  const stylePattern = /style\s*=\s*["']([^"']*color\s*:\s*)([0-9a-fA-F]{6})([^"']*)["']/g;
  sanitized = sanitized.replace(stylePattern, (match, before, colorCode, after) => {
    changesCount++;
    console.log(`Fixed style color code: ${colorCode} -> #${colorCode}`);
    return `style="${before}#${colorCode}${after}"`;
  });
  
  console.log(`🧹 HTML sanitization: ${changesCount} changes made`);
  return sanitized;
}

function sanitizeCSS(css) {
  if (!css || css.trim() === '') {
    console.warn('⚠️ Empty CSS provided to sanitizer');
    return css;
  }
  
  let sanitized = css;
  let changesCount = 0;
  
  // 1. 不正なurl()記述を修正（色コードのみ）
  const urlPattern1 = /url\s*\(\s*([0-9a-fA-F]{6})\s*\)/g;
  sanitized = sanitized.replace(urlPattern1, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed CSS url() color code: ${match}`);
    return 'none';
  });
  
  const urlPattern2 = /url\s*\(\s*["']([0-9a-fA-F]{6})["']\s*\)/g;
  sanitized = sanitized.replace(urlPattern2, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed CSS url() quoted color code: ${match}`);
    return 'none';
  });
  
  // 2. 色プロパティの#記号補完（既に#がない場合のみ）
  const colorProperties = ['color', 'background-color', 'background', 'border-color', 'outline-color'];
  colorProperties.forEach(prop => {
    const pattern = new RegExp(`(${prop})\\s*:\\s*([0-9a-fA-F]{6})([;\\s}])`, 'g');
    sanitized = sanitized.replace(pattern, (match, property, colorCode, ending) => {
      changesCount++;
      console.log(`Fixed CSS ${property}: ${colorCode} -> #${colorCode}`);
      return `${property}: #${colorCode}${ending}`;
    });
  });
  
  // 3. 色コードがセレクタ名になっている場合を修正
  const selectorPattern1 = /\.([0-9a-fA-F]{6})\s*\{/g;
  sanitized = sanitized.replace(selectorPattern1, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed CSS class selector: .${colorCode}`);
    return '.generated-class {';
  });
  
  const selectorPattern2 = /#([0-9a-fA-F]{6})\s*\{/g;
  sanitized = sanitized.replace(selectorPattern2, (match, colorCode) => {
    changesCount++;
    console.log(`Fixed CSS id selector: #${colorCode}`);
    return '#generated-id {';
  });
  
  console.log(`🧹 CSS sanitization: ${changesCount} changes made`);
  return sanitized;
}

function sanitizeJS(js) {
  if (!js) return '';
  
  let sanitized = js;
  
  // 1. 文字列内の色コードを適切に処理
  sanitized = sanitized.replace(/(['"])\s*([0-9a-fA-F]{6})\s*(['"])/g, '$1#$2$3');
  sanitized = sanitized.replace(/(['"])\s*#?([0-9a-fA-F]{6})\s*(['"])/g, '$1#$2$3');
  
  // 2. 変数代入での色コード修正
  sanitized = sanitized.replace(/=\s*([0-9a-fA-F]{6})([;\s])/g, '= "#$1"$2');
  sanitized = sanitized.replace(/=\s*["']([0-9a-fA-F]{6})["']([;\s])/g, '= "#$1"$2');
  
  // 3. 関数引数での色コード修正
  sanitized = sanitized.replace(/\(\s*([0-9a-fA-F]{6})\s*\)/g, '("#$1")');
  sanitized = sanitized.replace(/,\s*([0-9a-fA-F]{6})\s*,/g, ', "#$1",');
  sanitized = sanitized.replace(/,\s*([0-9a-fA-F]{6})\s*\)/g, ', "#$1")');
  
  // 4. オブジェクトプロパティでの色コード修正
  sanitized = sanitized.replace(/:\s*([0-9a-fA-F]{6})\s*([,}])/g, ': "#$1"$2');
  
  // 5. 配列内の色コード修正
  sanitized = sanitized.replace(/\[\s*([0-9a-fA-F]{6})\s*\]/g, '["#$1"]');
  sanitized = sanitized.replace(/,\s*([0-9a-fA-F]{6})\s*\]/g, ', "#$1"]');
  
  // 6. DOM操作での色コード修正
  sanitized = sanitized.replace(/(style\s*\.\s*color\s*=\s*)([0-9a-fA-F]{6})/g, '$1"#$2"');
  sanitized = sanitized.replace(/(backgroundColor\s*=\s*)([0-9a-fA-F]{6})/g, '$1"#$2"');
  
  // 7. テンプレートリテラル内の色コード修正
  sanitized = sanitized.replace(/`([^`]*?)([0-9a-fA-F]{6})([^`]*?)`/g, (match, before, colorCode, after) => {
    return `\`${before}#${colorCode}${after}\``;
  });
  
  return sanitized;
}

// フォールバック画像生成（Canvas不使用版）
async function generateFallbackPreview(device = 'desktop') {
  try {
    const { PNG } = await import('pngjs');
    
    const sizes = {
      desktop: { width: 1200, height: 800 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 375, height: 667 }
    };
    
    const { width, height } = sizes[device] || sizes.desktop;
    const png = new PNG({ width, height });
    
    // グレー背景で塗りつぶし
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = 240;     // R
        png.data[idx + 1] = 240; // G
        png.data[idx + 2] = 240; // B
        png.data[idx + 3] = 255; // A
      }
    }
    
    return PNG.sync.write(png);
  } catch (error) {
    console.error('Failed to generate fallback preview:', error);
    throw error;
  }
}

// 定期的な一時ファイルクリーンアップ
setInterval(cleanupTempFiles, 3600000); // 1時間ごと

// レイアウト生成関数群
function generateHeroBannerHTML(title, description) {
  return `
<body>
    <header class="header">
        <div class="container">
            <h1 class="logo">${title.split(' ')[0]}</h1>
            <nav class="nav">
                <ul class="nav-list">
                    <li><a href="#home">ホーム</a></li>
                    <li><a href="#about">について</a></li>
                    <li><a href="#services">サービス</a></li>
                    <li><a href="#contact">お問い合わせ</a></li>
                </ul>
            </nav>
        </div>
    </header>
    
    <main class="main">
        <section class="hero">
            <div class="container">
                <h2 class="hero-title">${title}</h2>
                <p class="hero-description">${description}</p>
                <div class="hero-actions">
                    <button class="cta-button primary">詳しく見る</button>
                    <button class="cta-button secondary">お問い合わせ</button>
                </div>
            </div>
        </section>
        
        <section class="features">
            <div class="container">
                <h2 class="section-title">主な特徴</h2>
                <div class="features-grid">
                    <div class="feature-card">
                        <div class="feature-icon">🎯</div>
                        <h3>高品質</h3>
                        <p>プロフェッショナルな品質をお届けします</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">⚡</div>
                        <h3>高速</h3>
                        <p>最適化された高速パフォーマンス</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🔒</div>
                        <h3>安全</h3>
                        <p>セキュリティを最優先に設計</p>
                    </div>
                </div>
            </div>
        </section>
    </main>
    
    <footer class="footer">
        <div class="container">
            <p>&copy; 2024 ${title.split(' ')[0]}. All rights reserved.</p>
        </div>
    </footer>
</body>`;
}

function generateHeroBannerCSS(primaryColor, backgroundColor, textColor, cardBg) {
  return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: ${textColor};
    background-color: ${backgroundColor};
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

.header {
    background-color: ${cardBg};
    padding: 1rem 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    font-size: 1.8rem;
    font-weight: bold;
    color: ${primaryColor};
}

.nav-list {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-list a {
    text-decoration: none;
    color: ${textColor};
    font-weight: 500;
    transition: color 0.3s ease;
}

.nav-list a:hover {
    color: ${primaryColor};
}

.hero {
    background: linear-gradient(135deg, ${primaryColor}20, ${primaryColor}40);
    padding: 5rem 0;
    text-align: center;
}

.hero-title {
    font-size: 3rem;
    font-weight: bold;
    margin-bottom: 1rem;
    color: ${textColor};
}

.hero-description {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    opacity: 0.9;
}

.hero-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

.cta-button {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.cta-button.primary {
    background-color: ${primaryColor};
    color: white;
}

.cta-button.primary:hover {
    background-color: ${primaryColor}dd;
    transform: translateY(-2px);
}

.cta-button.secondary {
    background-color: transparent;
    color: ${primaryColor};
    border: 2px solid ${primaryColor};
}

.cta-button.secondary:hover {
    background-color: ${primaryColor};
    color: white;
}

.features {
    padding: 4rem 0;
}

.section-title {
    text-align: center;
    font-size: 2.5rem;
    margin-bottom: 3rem;
    color: ${textColor};
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.feature-card {
    background-color: ${cardBg};
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    transition: transform 0.3s ease;
}

.feature-card:hover {
    transform: translateY(-5px);
}

.feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.feature-card h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: ${primaryColor};
}

.footer {
    background-color: ${cardBg};
    padding: 2rem 0;
    text-align: center;
    margin-top: 4rem;
}

@media (max-width: 768px) {
    .header .container {
        flex-direction: column;
        gap: 1rem;
    }
    
    .nav-list {
        gap: 1rem;
    }
    
    .hero-title {
        font-size: 2rem;
    }
    
    .hero-actions {
        flex-direction: column;
        align-items: center;
    }
    
    .features-grid {
        grid-template-columns: 1fr;
    }
}`;
}

function generateMultiColumnHTML(title, description) {
  return generateHeroBannerHTML(title, description); // 基本的には同じ構造
}

function generateMultiColumnCSS(primaryColor, backgroundColor, textColor, cardBg) {
  return generateHeroBannerCSS(primaryColor, backgroundColor, textColor, cardBg); // 基本CSS + マルチカラム調整
}

function generateGridLayoutHTML(title, description) {
  return generateHeroBannerHTML(title, description);
}

function generateGridLayoutCSS(primaryColor, backgroundColor, textColor, cardBg) {
  return generateHeroBannerCSS(primaryColor, backgroundColor, textColor, cardBg);
}

function generateCardLayoutHTML(title, description) {
  return generateHeroBannerHTML(title, description);
}

function generateCardLayoutCSS(primaryColor, backgroundColor, textColor, cardBg) {
  return generateHeroBannerCSS(primaryColor, backgroundColor, textColor, cardBg);
}

function generateMobileVerticalHTML(title, description) {
  return generateHeroBannerHTML(title, description);
}

function generateMobileVerticalCSS(primaryColor, backgroundColor, textColor, cardBg) {
  return generateHeroBannerCSS(primaryColor, backgroundColor, textColor, cardBg);
}

app.listen(port, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log('='.repeat(60));
  console.log("📋 Configuration Status:");
  console.log(`  - Gemini API: ${geminiModel ? '✅ ENABLED (Primary)' : '❌ DISABLED'}`);
  console.log(`  - Gemini Key: ${process.env.GEMINI_API_KEY ? 
    (process.env.GEMINI_API_KEY.length > 20 ? '✅ Set' : '❌ Too short') : 
    '❌ Not set'}`);
  console.log(`  - OpenAI API: ${openai ? '✅ ENABLED (Fallback)' : '❌ DISABLED'}`);
  console.log(`  - OpenAI Key: ${process.env.OPENAI_API_KEY ? 
    (process.env.OPENAI_API_KEY.startsWith('sk-') ? '✅ Valid format' : '❌ Invalid format') : 
    '❌ Not set'}`);
  console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log("🤖 Vision API Priority: Gemini > OpenAI");
  console.log("📁 Supported file types: Images (PNG, JPG, GIF, etc.) and PDF");
  console.log("📏 Maximum file size: 50MB");
  console.log('='.repeat(60));
  console.log("🌐 CORS Configuration:");
  console.log("  - Origin Policy: Allow ALL (*)");
  console.log("  - Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
  console.log("  - Headers: All common headers allowed");
  console.log("  - Credentials: Enabled");
  console.log("  - OPTIONS Handler: Active for all routes");
  console.log('='.repeat(60));
  
  if (!geminiModel && !openai) {
    console.error('⚠️  WARNING: No Vision API is configured!');
    console.error('⚠️  Please set either GEMINI_API_KEY or OPENAI_API_KEY.');
    console.error('⚠️  Recommend: GEMINI_API_KEY for better results.');
    console.log('='.repeat(60));
  }
});
