import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { takeScreenshot, compareImages, iterateDesign } from './screenshot.js';
import { convertPdfToImage, getPdfPageCount, cleanupTempFiles, convertPdfToMultipleImages, combineImagesVertically } from './pdfProcessor.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// OpenAI APIクライアントの初期化（APIキーが設定されている場合のみ）
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// CORS設定
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
      // Vercelのプレビューデプロイメント用
      /^https:\/\/.*\.vercel\.app$/
    ];
    
    // 開発環境ではoriginがundefinedの場合がある
    if (!origin || allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// ミドルウェア
app.use(cors(corsOptions));
app.use(express.json());

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

// 画像をBase64に変換
async function imageToBase64(buffer) {
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

// 画像を解析してHTML/CSSを生成
async function generateCodeFromDesigns(pcImage, spImage, referenceUrl = null) {
  try {
    // OpenAI APIが利用できない場合は高度なフォールバックを使用
    if (!openai) {
      console.log('OpenAI API key not configured, using advanced fallback template');
      return await getAdvancedFallbackTemplate(pcImage, spImage, referenceUrl);
    }

    // 画像をBase64に変換
    const pcBase64 = await imageToBase64(pcImage);
    const spBase64 = await imageToBase64(spImage);

    // OpenAI Vision APIを使用してデザインを解析
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: `あなたは優秀なフロントエンドエンジニアです。
提供されたPCとSPのデザイン画像から、レスポンシブなHTML/CSSコードを生成してください。

要件:
1. セマンティックなHTML5を使用
2. モダンなCSS（Flexbox、Grid）を活用
3. モバイルファーストのアプローチ
4. きれいで保守しやすいコード
5. アクセシビリティを考慮

レスポンスは以下のJSON形式で返してください:
{
  "html": "HTMLコード",
  "css": "CSSコード"
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "以下のPCデザインとSPデザインから、レスポンシブなHTML/CSSを生成してください。"
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
              text: "SPデザイン:"
            },
            {
              type: "image_url", 
              image_url: {
                url: spBase64,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);
    
    return result;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // フォールバック: 高度なテンプレートを返す
    return await getAdvancedFallbackTemplate(pcImage, spImage, referenceUrl);
  }
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

    // 画像ファイルの場合はリサイズのみ
    return await sharp(file.buffer)
      .resize(targetWidth, null, {
        withoutEnlargement: true,
        fit: "inside"
      })
      .png()
      .toBuffer();
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

// コード生成エンドポイント
app.post("/api/generate-code", upload.any(), async (req, res) => {
  try {
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
    res.status(500).json({ error: "コード生成中にエラーが発生しました" });
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Supported file types: Images (PNG, JPG, GIF, etc.) and PDF");
  console.log("Maximum file size: 50MB");
});
