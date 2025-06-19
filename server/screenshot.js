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

// HTMLとCSSからスクリーンショットを撮影
export async function takeScreenshot(html, css, device = 'desktop') {
  // 緊急修正: 入力データの厳格な検証と前処理
  if (!html || !css || html.trim() === '' || css.trim() === '') {
    console.log('⚠️ Invalid or empty input data, generating fallback screenshot');
    return await generateFallbackScreenshot(html, css, device);
  }

  // 色コードDNSエラーを防ぐため、HTMLとCSSを事前サニタイズ
  const sanitizedHtml = sanitizeHtmlForScreenshot(html);
  const sanitizedCss = sanitizeCssForScreenshot(css);
  
  console.log('🧹 Pre-screenshot sanitization:', {
    originalHtmlLength: html.length,
    sanitizedHtmlLength: sanitizedHtml.length,
    originalCssLength: css.length,
    sanitizedCssLength: sanitizedCss.length
  });

  // 最初からPuppeteerを使用（Playwrightのストリームエラーを回避）
  try {
    console.log('🎯 Using Puppeteer for reliable screenshot...');
    const result = await takeScreenshotWithPuppeteer(sanitizedHtml, sanitizedCss, device);
    console.log('✅ Puppeteer screenshot successful');
    return result;
  } catch (puppeteerError) {
    console.log('⚠️ Puppeteer failed, trying Playwright as backup:', puppeteerError.message);
    
    // Playwrightをバックアップとして使用
    try {
      console.log('🎭 Attempting Playwright as backup...');
      const result = await takeScreenshotWithPlaywright(sanitizedHtml, sanitizedCss, device);
      console.log('✅ Playwright screenshot successful');
      return result;
    } catch (playwrightError) {
      console.log('⚠️ Both engines failed, using fallback:', playwrightError.message);
      
      // 最終フォールバック
      console.log('🔄 Using fallback screenshot generator...');
      return await generateFallbackScreenshot(html, css, device);
    }
  }
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

// Puppeteer実装（バックアップ）
async function takeScreenshotWithPuppeteer(html, css, device = 'desktop') {
  // Railway環境でのChromiumパスを確認
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
  
  console.log('🎯 Launching Puppeteer with:', { executablePath, device });
  
  const browser = await puppeteer.launch({
    executablePath: executablePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
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

    await page.setViewport(viewports[device] || viewports.desktop);

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
      waitUntil: ['networkidle0', 'domcontentloaded']
    });

    // スクリーンショットを撮影
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png'
    });

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