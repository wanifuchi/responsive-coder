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
  geminiModel = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
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
      return await generateWithGemini(pcImage, spImage, referenceUrl);
    }
    
    // OpenAI APIをフォールバックとして使用
    if (openai) {
      console.log('🔄 Falling back to OpenAI GPT-4o...');
      return await generateWithOpenAI(pcImage, spImage, referenceUrl);
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
    
    // Base64プレフィックスを削除（Gemini API用）
    const pcImageData = pcBase64.split(',')[1];
    const spImageData = spBase64.split(',')[1];
    
    // プロンプトの構築
    const prompt = `あなたは世界最高レベルのUI/UXデザイナー兼フロントエンドエンジニアです。

提供された2つの画像（PC版とスマートフォン版）のデザインを詳細に分析し、ピクセルパーフェクトなレスポンシブHTML/CSS/JavaScriptコードを生成してください。

## 重要な指示:
1. 画像のレイアウト、色、フォント、余白を正確に再現
2. PC版は1200px以上、SP版は767px以下で完璧に表示
3. 中間のタブレットサイズも考慮
4. モダンなCSS（Grid、Flexbox、カスタムプロパティ）を使用
5. セマンティックHTML5を使用
6. 必要に応じてインタラクティブなJavaScriptを追加

${referenceUrl ? `参考URL: ${referenceUrl} - このサイトの技術的実装も参考にしてください。` : ''}

以下のJSON形式で回答してください：
{
  "html": "完全なHTMLコード（DOCTYPE含む）",
  "css": "完全なCSSコード（レスポンシブ対応）",
  "js": "JavaScriptコード（必要な場合）"
}`;

    // Gemini APIを呼び出し
    const result = await geminiModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/png",
          data: pcImageData
        }
      },
      "上記はPC版デザインです。",
      {
        inlineData: {
          mimeType: "image/png",
          data: spImageData
        }
      },
      "上記はスマートフォン版デザインです。これらを元にコードを生成してください。"
    ]);
    
    const response = await result.response;
    const text = response.text();
    console.log('📊 Gemini response length:', text.length);
    
    // JSONを抽出
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                     text.match(/```\s*([\s\S]*?)\s*```/) ||
                     [null, text];
    
    const jsonContent = jsonMatch[1] || text;
    const parsedResult = JSON.parse(jsonContent.trim());
    
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

// 超詳細画像分析
async function analyzeImageUltraDetailed(imageBuffer) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const stats = await image.stats();
  
  // 画像を小さなグリッドに分割して色を分析
  const gridSize = 10; // 10x10グリッド
  const cellWidth = Math.floor(metadata.width / gridSize);
  const cellHeight = Math.floor(metadata.height / gridSize);
  
  const colorGrid = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) {
      const region = await image
        .extract({
          left: x * cellWidth,
          top: y * cellHeight,
          width: cellWidth,
          height: cellHeight
        })
        .stats();
      
      row.push({
        r: Math.round(region.dominant.r),
        g: Math.round(region.dominant.g),
        b: Math.round(region.dominant.b),
        brightness: (region.dominant.r + region.dominant.g + region.dominant.b) / 3 / 255
      });
    }
    colorGrid.push(row);
  }
  
  // レイアウト推定のための分析
  const topSection = colorGrid.slice(0, 2);
  const middleSection = colorGrid.slice(3, 7);
  const bottomSection = colorGrid.slice(8, 10);
  
  // ヘッダー検出（上部が均一な色かチェック）
  const hasHeader = checkUniformColor(topSection);
  
  // フッター検出（下部が均一な色かチェック）
  const hasFooter = checkUniformColor(bottomSection);
  
  // カラムレイアウト検出（中央部の色の変化を分析）
  const columnCount = detectColumns(middleSection);
  
  return {
    width: metadata.width,
    height: metadata.height,
    colorGrid,
    dominantColors: extractDominantColors(stats),
    layout: {
      hasHeader,
      hasFooter,
      columnCount,
      isSidebar: columnCount === 2 && metadata.width > 1000
    },
    brightness: stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length / 255
  };
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

// 主要な色を抽出
function extractDominantColors(stats) {
  const { dominant, channels } = stats;
  
  return {
    primary: `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`,
    isDark: (dominant.r + dominant.g + dominant.b) / 3 < 128,
    hasHighContrast: Math.max(...channels.map(ch => ch.stdev)) > 100
  };
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

// 画像から詳細情報を抽出
async function analyzeImageBasics(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    // 主要色を抽出
    const { dominant } = stats;
    const dominantColor = `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`;
    
    // より詳細な画像解析
    const enhancedImage = await image
      .resize(800, null, { withoutEnlargement: true })
      .ensureAlpha()
      .png()
      .toBuffer();
    
    // エッジ検出のための処理
    const edgeDetection = await sharp(enhancedImage)
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
      })
      .toBuffer();
    
    // 色の分散を計算（複雑さの指標）
    const { channels } = stats;
    const colorComplexity = Math.sqrt(
      channels[0].stdev ** 2 + 
      channels[1].stdev ** 2 + 
      channels[2].stdev ** 2
    ) / 255;
    
    // レイアウト推定（横縦比と複雑さから）
    const layoutType = determineLayoutType(metadata.width / metadata.height, colorComplexity);
    
    // コンテンツタイプの推定
    const contentType = estimateContentType(colorComplexity, metadata.width, metadata.height);
    
    return {
      width: metadata.width,
      height: metadata.height,
      aspect: metadata.width / metadata.height,
      dominantColor,
      isLandscape: metadata.width > metadata.height,
      size: metadata.width > 1000 ? 'large' : metadata.width > 600 ? 'medium' : 'small',
      colorComplexity,
      layoutType,
      contentType,
      hasHeader: colorComplexity > 0.3 && metadata.height > 400,
      hasMultipleColumns: metadata.width > 800 && colorComplexity > 0.4,
      brightness: channels.reduce((sum, ch) => sum + ch.mean, 0) / channels.length / 255
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
      filesCount: req.files ? req.files.length : 0 
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
      const pcFile = req.files.find(f => f.fieldname === "pcDesign");
      const spFile = req.files.find(f => f.fieldname === "spDesign");

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
    res.status(500).json({ error: "スクリーンショットの生成に失敗しました" });
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
    res.status(500).json({ 
      error: "イテレーション処理に失敗しました",
      details: error.message
    });
  }
});

// ヘルスチェック
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

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
