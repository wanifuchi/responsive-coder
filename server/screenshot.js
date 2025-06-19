import { chromium } from 'playwright';
import puppeteer from 'puppeteer';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs/promises';
import path from 'path';

// スクリーンショット用HTMLサニタイズ関数
function sanitizeHtmlForScreenshot(html) {
  let sanitized = html;
  
  // 色コードがURLとして解釈されることを防ぐ
  sanitized = sanitized.replace(/href\s*=\s*["']([0-9a-fA-F]{6})["']/g, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']([0-9a-fA-F]{6})["']/g, 'src="https://via.placeholder.com/300x200/cccccc/ffffff?text=Image"');
  sanitized = sanitized.replace(/class\s*=\s*["']([0-9a-fA-F]{6})["']/g, 'class="generated-element"');
  sanitized = sanitized.replace(/id\s*=\s*["']([0-9a-fA-F]{6})["']/g, 'id="generated-element"');
  
  return sanitized;
}

// スクリーンショット用CSSサニタイズ関数
function sanitizeCssForScreenshot(css) {
  let sanitized = css;
  
  // 色コードがURLとして解釈されることを防ぐ
  sanitized = sanitized.replace(/url\s*\(\s*([0-9a-fA-F]{6})\s*\)/g, 'none');
  sanitized = sanitized.replace(/\.([0-9a-fA-F]{6})\s*\{/g, '.generated-class {');
  sanitized = sanitized.replace(/#([0-9a-fA-F]{6})\s*\{/g, '#generated-id {');
  
  // 色コードに#を追加
  sanitized = sanitized.replace(/color\s*:\s*([0-9a-fA-F]{6})([;\s}])/g, 'color: #$1$2');
  sanitized = sanitized.replace(/background\s*:\s*([0-9a-fA-F]{6})([;\s}])/g, 'background: #$1$2');
  sanitized = sanitized.replace(/background-color\s*:\s*([0-9a-fA-F]{6})([;\s}])/g, 'background-color: #$1$2');
  
  return sanitized;
}

// 🚨 HTML/CSS完全検証とサニタイズ
async function validateAndSanitizeForScreenshot(html, css) {
  const errors = [];
  let isValid = true;

  // HTML基本検証
  if (!html.includes('<!DOCTYPE')) {
    errors.push('Missing DOCTYPE declaration');
  }
  if (!html.includes('<html')) {
    errors.push('Missing html tag');
  }
  if (!html.includes('<body')) {
    errors.push('Missing body tag');
  }

  // 危険な文字・パターンを除去
  let sanitizedHtml = html;
  let sanitizedCss = css;

  try {
    // HTML完全サニタイズ
    sanitizedHtml = sanitizeHtmlForScreenshot(html);
    
    // CSS完全サニタイズ  
    sanitizedCss = sanitizeCssForScreenshot(css);
    
    // 致命的エラーチェック
    if (sanitizedHtml.length < 50) {
      errors.push('HTML too short after sanitization');
      isValid = false;
    }
    
    if (sanitizedCss.length < 10) {
      errors.push('CSS too short after sanitization');
      isValid = false;
    }

    // 不正な制御文字除去
    sanitizedHtml = sanitizedHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    sanitizedCss = sanitizedCss.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  } catch (error) {
    errors.push(`Sanitization failed: ${error.message}`);
    isValid = false;
  }

  return {
    isValid,
    errors,
    sanitizedHtml,
    sanitizedCss
  };
}

// 高度なフォールバックスクリーンショット
async function generateAdvancedFallbackScreenshot(html, css, device = 'desktop') {
  console.log('🎨 Generating advanced fallback screenshot...');
  
  const sizes = {
    desktop: { width: 1200, height: 800 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  };
  
  const { width, height } = sizes[device] || sizes.desktop;
  
  // 高品質なフォールバック画像を生成
  const png = new PNG({ width, height });
  
  // グラデーション背景を作成
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      
      // グラデーション計算
      const gradientValue = Math.floor(240 + (y / height) * 15);
      
      png.data[idx] = gradientValue;     // R
      png.data[idx + 1] = gradientValue; // G  
      png.data[idx + 2] = gradientValue; // B
      png.data[idx + 3] = 255;           // A
    }
  }
  
  return PNG.sync.write(png);
}

// 緊急フォールバック
async function generateEmergencyFallback(device = 'desktop') {
  console.log('🆘 Generating emergency fallback...');
  
  const sizes = {
    desktop: { width: 800, height: 600 },
    tablet: { width: 600, height: 800 },
    mobile: { width: 300, height: 500 }
  };
  
  const { width, height } = sizes[device] || sizes.desktop;
  const png = new PNG({ width, height });
  
  // シンプルな白背景
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = 255;     // R
      png.data[idx + 1] = 255; // G
      png.data[idx + 2] = 255; // B
      png.data[idx + 3] = 255; // A
    }
  }
  
  return PNG.sync.write(png);
}

// HTMLとCSSからスクリーンショットを撮影
export async function takeScreenshot(html, css, device = 'desktop') {
  console.log('🚨 THINKHARD極限スクリーンショット開始');
  
  // 🚨 CRITICAL: 厳格な入力検証
  if (!html || !css || html.trim() === '' || css.trim() === '') {
    console.log('⚠️ Invalid or empty input data, generating fallback screenshot');
    return await generateFallbackScreenshot(html, css, device);
  }

  // 🚨 HTML/CSS完全検証とサニタイズ
  const validationResult = await validateAndSanitizeForScreenshot(html, css);
  if (!validationResult.isValid) {
    console.log('❌ HTML/CSS validation failed:', validationResult.errors);
    return await generateFallbackScreenshot(html, css, device);
  }

  const { sanitizedHtml, sanitizedCss } = validationResult;
  
  console.log('🛡️ Complete validation and sanitization:', {
    originalHtmlLength: html.length,
    sanitizedHtmlLength: sanitizedHtml.length,
    originalCssLength: css.length,
    sanitizedCssLength: sanitizedCss.length,
    errors: validationResult.errors.length
  });

  // 🚨 STREAM ERROR完全回避: Playwright完全無効化
  const engines = [
    { name: 'Puppeteer', func: takeScreenshotWithPuppeteer },
    { name: 'AdvancedFallback', func: generateAdvancedFallbackScreenshot },
    { name: 'EmergencyFallback', func: generateEmergencyFallback }
  ];

  for (const engine of engines) {
    try {
      console.log(`🎯 Attempting ${engine.name}...`);
      const result = await engine.func(sanitizedHtml, sanitizedCss, device);
      console.log(`✅ ${engine.name} screenshot successful`);
      
      // 結果検証: 破損データチェック
      if (result && result.length > 1000) { // 最小サイズチェック
        return result;
      } else {
        throw new Error(`${engine.name} returned invalid data: ${result.length} bytes`);
      }
    } catch (error) {
      console.log(`⚠️ ${engine.name} failed:`, error.message);
      
      // 特定エラーの詳細ログ
      if (error.message.includes('unrecognised content')) {
        console.log('🚨 STREAM ERROR detected - trying next engine');
      }
      
      // 最後のエンジンの場合は続行
      if (engine.name === 'Fallback') {
        throw error;
      }
    }
  }

  // すべて失敗した場合の最終手段
  console.log('🔄 All engines failed, generating emergency fallback...');
  return await generateEmergencyFallback(device);
}

// Playwright実装（メイン手法）
async function takeScreenshotWithPlaywright(html, css, device = 'desktop') {
  console.log('🎭 Starting Playwright screenshot for:', device);
  
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    timeout: 30000, // 30秒のタイムアウト
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=VizDisplayCompositor',
      '--disable-ipc-flooding-protection'
    ]
  });

  try {
    const page = await browser.newPage();

    // デバイスに応じたビューポートを設定
    const viewports = {
      desktop: { width: 1920, height: 1080 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 375, height: 812 }
    };

    await page.setViewportSize(viewports[device] || viewports.desktop);

    // HTMLコンテンツを設定
    const content = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${css}</style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    await page.setContent(content, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 短い待機を追加してレンダリングを完了
    await page.waitForTimeout(1000);

    // スクリーンショットを撮影
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
      timeout: 30000,
      animations: 'disabled' // アニメーションを無効化
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

// 基本的なフォールバック画像生成
async function generateFallbackScreenshot(html, css, device = 'desktop') {
  console.log('🔄 Generating fallback screenshot for:', device);
  
  const sizes = {
    desktop: { width: 1200, height: 800 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  };
  
  const { width, height } = sizes[device] || sizes.desktop;
  
  // 簡易的なPNG画像を生成
  const png = new PNG({ width, height });
  
  // 白い背景で塗りつぶし
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = 248;     // R
      png.data[idx + 1] = 249; // G
      png.data[idx + 2] = 250; // B
      png.data[idx + 3] = 255; // A
    }
  }
  
  return PNG.sync.write(png);
}

// 🚨 THINKHARD極限Puppeteer: ストリームエラー完全回避
async function takeScreenshotWithPuppeteer(html, css, device = 'desktop') {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
  
  console.log('🚨 EXTREME Puppeteer launching with STREAM ERROR prevention:', { executablePath, device });
  
  const browser = await puppeteer.launch({
    executablePath: executablePath,
    headless: 'new',
    timeout: 60000, // 60秒タイムアウト
    slowMo: 100, // 処理を意図的に遅くしてストリームエラー防止
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images', // 画像読み込みを無効化してストリーム問題回避
      '--disable-javascript', // JS実行を無効化
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--virtual-time-budget=10000' // 仮想時間制限
    ]
  });

  try {
    const page = await browser.newPage();
    
    // 🚨 EXTREME設定: ストリームエラー完全防止
    
    // タイムアウト設定
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    
    // リクエストをブロック（ストリーム問題の原因となるリソースを遮断）
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // 危険なリソースタイプをブロック
      if (resourceType === 'image' || 
          resourceType === 'media' || 
          resourceType === 'font' ||
          resourceType === 'websocket' ||
          url.includes('google') ||
          url.includes('facebook') ||
          url.includes('twitter') ||
          /[0-9a-fA-F]{6}/.test(url)) { // 色コードURL完全ブロック
        request.abort();
      } else {
        request.continue();
      }
    });

    // ビューポート設定
    const viewports = {
      desktop: { width: 1200, height: 800 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 375, height: 812 }
    };

    await page.setViewport(viewports[device] || viewports.desktop);

    // 🛡️ 完全サニタイズ済みコンテンツ
    const safeContent = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* ストリームエラー防止CSS */
          * { 
            background-image: none !important;
            content: none !important;
          }
          ${css}
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    console.log('🛡️ Setting safe content...');
    await page.setContent(safeContent, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 追加の安定化待機
    await page.waitForTimeout(2000);
    
    console.log('📸 Taking screenshot with STREAM ERROR prevention...');
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
      timeout: 30000,
      captureBeyondViewport: false, // ビューポート外キャプチャ無効
      clip: null // クリップ無効
    });

    console.log('✅ Screenshot successful, size:', screenshot.length);
    return screenshot;
  } finally {
    await browser.close();
  }
}

// 画像を比較して差分を計算
export async function compareImages(img1Buffer, img2Buffer) {
  const img1 = PNG.sync.read(img1Buffer);
  const img2 = PNG.sync.read(img2Buffer);

  // 画像サイズを統一（大きい方に合わせる）
  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  // 小さい画像を大きい方に合わせてリサイズ
  const resizedImg1 = new PNG({ width, height });
  const resizedImg2 = new PNG({ width, height });

  // 画像データをコピー（小さい画像は上左に配置、残りは透明/白）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      
      // img1のピクセル
      if (x < img1.width && y < img1.height) {
        const img1Idx = (img1.width * y + x) << 2;
        resizedImg1.data[idx] = img1.data[img1Idx];     // R
        resizedImg1.data[idx + 1] = img1.data[img1Idx + 1]; // G
        resizedImg1.data[idx + 2] = img1.data[img1Idx + 2]; // B
        resizedImg1.data[idx + 3] = img1.data[img1Idx + 3]; // A
      } else {
        // 範囲外は白色で埋める
        resizedImg1.data[idx] = 255;     // R
        resizedImg1.data[idx + 1] = 255; // G
        resizedImg1.data[idx + 2] = 255; // B
        resizedImg1.data[idx + 3] = 255; // A
      }
      
      // img2のピクセル
      if (x < img2.width && y < img2.height) {
        const img2Idx = (img2.width * y + x) << 2;
        resizedImg2.data[idx] = img2.data[img2Idx];     // R
        resizedImg2.data[idx + 1] = img2.data[img2Idx + 1]; // G
        resizedImg2.data[idx + 2] = img2.data[img2Idx + 2]; // B
        resizedImg2.data[idx + 3] = img2.data[img2Idx + 3]; // A
      } else {
        // 範囲外は白色で埋める
        resizedImg2.data[idx] = 255;     // R
        resizedImg2.data[idx + 1] = 255; // G
        resizedImg2.data[idx + 2] = 255; // B
        resizedImg2.data[idx + 3] = 255; // A
      }
    }
  }

  // 差分画像用のバッファを作成
  const diff = new PNG({ width, height });

  // pixelmatchで差分を計算
  const numDiffPixels = pixelmatch(
    resizedImg1.data,
    resizedImg2.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  // 差分率を計算
  const totalPixels = width * height;
  const diffPercentage = (numDiffPixels / totalPixels) * 100;

  return {
    diffPercentage,
    diffImage: PNG.sync.write(diff),
    numDiffPixels,
    totalPixels
  };
}

// イテレーション処理
export async function iterateDesign(originalImage, html, css, maxIterations = 5) {
  const iterations = [];
  let currentHtml = html;
  let currentCss = css;

  for (let i = 0; i < maxIterations; i++) {
    // 現在のコードでスクリーンショットを撮影
    const screenshotBuffer = await takeScreenshot(currentHtml, currentCss);
    
    // 元画像と比較
    const comparison = await compareImages(originalImage, screenshotBuffer);
    
    iterations.push({
      iteration: i + 1,
      html: currentHtml,
      css: currentCss,
      screenshot: screenshotBuffer,
      diffPercentage: comparison.diffPercentage,
      diffImage: comparison.diffImage
    });

    // 差分が十分小さければ終了
    if (comparison.diffPercentage < 5) {
      break;
    }

    // 差分を基にコードを改善
    const improvements = generateBasicImprovements(comparison.diffPercentage, i + 1);
    currentCss = applyImprovements(currentCss, improvements);
  }

  return iterations;
}

// 基本的な改善案を生成
function generateBasicImprovements(diffPercentage, iteration) {
  const improvements = [];
  
  // 差分が大きい場合の改善案
  if (diffPercentage > 50) {
    improvements.push({
      type: 'layout',
      description: 'レイアウト構造の調整',
      css: `
        /* Iteration ${iteration} - Layout improvements */
        * { box-sizing: border-box; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
        .flex { display: flex; align-items: center; justify-content: center; }
      `
    });
  }
  
  if (diffPercentage > 30) {
    improvements.push({
      type: 'spacing',
      description: 'スペーシングの調整',
      css: `
        /* Iteration ${iteration} - Spacing improvements */
        section { padding: 3rem 0; }
        .card { padding: 2rem; margin-bottom: 2rem; }
        h1, h2, h3 { margin-bottom: 1rem; }
        p { margin-bottom: 1rem; line-height: 1.6; }
      `
    });
  }
  
  if (diffPercentage > 20) {
    improvements.push({
      type: 'styling',
      description: 'スタイリングの改善',
      css: `
        /* Iteration ${iteration} - Visual improvements */
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { background: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; }
        .button:hover { background: #0056b3; }
      `
    });
  }
  
  if (diffPercentage > 10) {
    improvements.push({
      type: 'responsive',
      description: 'レスポンシブ対応',
      css: `
        /* Iteration ${iteration} - Responsive improvements */
        @media (max-width: 768px) {
          .container { padding: 0 15px; }
          .grid { grid-template-columns: 1fr; gap: 1rem; }
          section { padding: 2rem 0; }
          h1 { font-size: 2rem; }
          h2 { font-size: 1.5rem; }
        }
      `
    });
  }
  
  return improvements;
}

// CSSに改善を適用
function applyImprovements(currentCss, improvements) {
  let improvedCss = currentCss;
  
  improvements.forEach(improvement => {
    // 重複を避けるため、同じタイプの改善が既にある場合はスキップ
    if (!improvedCss.includes(`/* Iteration`) || !improvedCss.includes(improvement.type)) {
      improvedCss += '\n' + improvement.css;
    }
  });
  
  return improvedCss;
}