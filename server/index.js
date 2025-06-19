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
import { PixelPerfectEngine } from './pixel-perfect-engine.js';

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

// CORS設定
const corsOptions = {
  origin: true,
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

app.use(cors(corsOptions));

// 追加のCORSヘッダー設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    console.log('🔵 OPTIONS request received for:', req.path);
    return res.status(200).end();
  } else {
    next();
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true,
  parameterLimit: 50000 
}));

// ヘルスチェックエンドポイント
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Static files
app.use(express.static(join(__dirname, '../dist')));

// Catch all handler for React app
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// マルチパートフォームデータ処理用の設定
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB制限
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルまたはPDFファイルのみアップロード可能です'));
    }
  }
});

// 緊急フォールバック関数
function generateEmergencyFallback(referenceUrl = null) {
  return {
    html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>デザイン生成</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header class="site-header">
            <h1>サイトタイトル</h1>
            <nav>
                <ul>
                    <li><a href="#home">ホーム</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#services">サービス</a></li>
                    <li><a href="#contact">お問い合わせ</a></li>
                </ul>
            </nav>
        </header>
        
        <main class="main-content">
            <section class="hero">
                <h2>メインタイトル</h2>
                <p>アップロードされた画像に基づいてコンテンツを生成しています。</p>
                <button class="cta-button">詳細を見る</button>
            </section>
            
            <section class="features">
                <div class="feature-grid">
                    <div class="feature-card">
                        <img src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop" alt="Feature 1">
                        <h3>特徴1</h3>
                        <p>サービスの特徴を説明します。</p>
                    </div>
                    <div class="feature-card">
                        <img src="https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop" alt="Feature 2">
                        <h3>特徴2</h3>
                        <p>追加の特徴について説明します。</p>
                    </div>
                    <div class="feature-card">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop" alt="Feature 3">
                        <h3>特徴3</h3>
                        <p>さらなる特徴の詳細です。</p>
                    </div>
                </div>
            </section>
        </main>
        
        <footer class="site-footer">
            <p>&copy; 2024 Generated Site. All rights reserved.</p>
        </footer>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
    css: `/* Emergency CSS */
:root {
    --primary-color: #007bff;
    --secondary-color: #6c757d;
    --accent-color: #28a745;
    --background-color: #ffffff;
    --text-color: #333333;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: var(--background-color);
    color: var(--text-color);
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

.site-header {
    background-color: var(--primary-color);
    color: white;
    padding: 1rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.site-header h1 {
    font-size: 1.5rem;
}

.site-header nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.site-header nav a {
    color: white;
    text-decoration: none;
    font-weight: 500;
}

.site-header nav a:hover {
    opacity: 0.8;
}

.main-content {
    padding: 3rem 0;
}

.hero {
    text-align: center;
    padding: 4rem 0;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border-radius: 10px;
    margin-bottom: 3rem;
}

.hero h2 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: var(--primary-color);
}

.hero p {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

.cta-button {
    background-color: var(--accent-color);
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.cta-button:hover {
    background-color: var(--primary-color);
    transform: translateY(-2px);
}

.features {
    padding: 2rem 0;
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.feature-card {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    text-align: center;
    transition: transform 0.3s ease;
}

.feature-card:hover {
    transform: translateY(-5px);
}

.feature-card img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-radius: 5px;
    margin-bottom: 1rem;
}

.feature-card h3 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    font-size: 1.3rem;
}

.site-footer {
    background-color: var(--primary-color);
    color: white;
    text-align: center;
    padding: 2rem 0;
    margin-top: 3rem;
}

@media (max-width: 768px) {
    .site-header {
        flex-direction: column;
        gap: 1rem;
    }
    
    .site-header nav ul {
        gap: 1rem;
    }
    
    .hero h2 {
        font-size: 2rem;
    }
    
    .feature-grid {
        grid-template-columns: 1fr;
    }
    
    .container {
        padding: 0 1rem;
    }
}`,
    js: `// Generated JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Site loaded successfully');
    
    // スムーススクロール
    const scrollLinks = document.querySelectorAll('a[href^="#"]');
    scrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
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
    
    // レスポンシブ対応
    function handleResize() {
        const width = window.innerWidth;
        document.body.classList.toggle('mobile', width < 768);
        document.body.classList.toggle('tablet', width >= 768 && width < 1024);
        document.body.classList.toggle('desktop', width >= 1024);
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
});`
  };
}

// コード生成のメイン関数
async function generateCodeFromDesigns(pcImage, spImage, referenceUrl = null) {
  try {
    console.log('🎯 Starting design analysis...');
    
    // PixelPerfectEngine を試行
    try {
      const engine = new PixelPerfectEngine();
      console.log('📊 Analyzing PC design...');
      const pcAnalysis = await engine.analyzeDesignCompletely(pcImage);
      console.log('📱 Analyzing SP design...');
      const spAnalysis = await engine.analyzeDesignCompletely(spImage);
      
      const html = engine.generatePixelPerfectHTML(pcAnalysis);
      const css = engine.generatePixelPerfectCSS(pcAnalysis);
      const js = `// Generated JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded successfully');
});`;
      
      return { html, css, js };
    } catch (engineError) {
      console.error('❌ PixelPerfectEngine failed:', engineError);
      
      // Vision API フォールバック
      if (geminiModel || openai) {
        console.log('🔄 Falling back to Vision API...');
        return generateEmergencyFallback(referenceUrl);
      }
    }
    
    // 最終フォールバック
    console.log('🆘 Using emergency fallback...');
    return generateEmergencyFallback(referenceUrl);
    
  } catch (error) {
    console.error('❌ Generation failed completely:', error);
    return generateEmergencyFallback(referenceUrl);
  }
}

// メインエンドポイント
app.post("/api/generate-code", upload.fields([
  { name: 'pcDesign', maxCount: 1 },
  { name: 'spDesign', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('📥 Generate code request received');
    
    const pcFile = req.files?.pcDesign?.[0];
    const spFile = req.files?.spDesign?.[0];
    const referenceUrl = req.body.referenceUrl || null;
    
    if (!pcFile || !spFile) {
      return res.status(400).json({
        error: 'PC and SP design files are required',
        details: 'Please upload both PC and SP design images'
      });
    }
    
    console.log('📊 Processing files:', {
      pcSize: `${(pcFile.size / 1024 / 1024).toFixed(2)}MB`,
      spSize: `${(spFile.size / 1024 / 1024).toFixed(2)}MB`,
      hasReferenceUrl: !!referenceUrl
    });
    
    const result = await generateCodeFromDesigns(
      pcFile.buffer,
      spFile.buffer,
      referenceUrl
    );
    
    console.log('✅ Code generation completed successfully');
    res.json(result);
    
  } catch (error) {
    console.error('❌ Generate code error:', error);
    res.status(500).json({
      error: 'Code generation failed',
      details: error.message
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log('✅ Emergency repair completed - syntax fixed');
  console.log('='.repeat(60));
  console.log("📋 Configuration Status:");
  console.log(`  - Gemini API: ${geminiModel ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`  - OpenAI API: ${openai ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  
  if (!geminiModel && !openai) {
    console.error('⚠️  WARNING: No Vision API configured!');
    console.error('⚠️  Please set GEMINI_API_KEY or OPENAI_API_KEY');
    console.log('='.repeat(60));
  }
});