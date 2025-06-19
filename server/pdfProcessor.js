import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PDFを画像に変換（Puppeteerを使用）
export async function convertPdfToImage(pdfBuffer, options = {}) {
  const {
    page = 1,
    saveDir = path.join(__dirname, 'temp'),
    width = 1920,
    height = null
  } = options;

  let tempPdfPath = null;
  let browser = null;

  try {
    // 入力バッファの検証
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDFファイルが空です');
    }

    // 一時ディレクトリを作成
    await fs.mkdir(saveDir, { recursive: true });

    // 一時PDFファイルを作成
    tempPdfPath = path.join(saveDir, `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`);
    await fs.writeFile(tempPdfPath, pdfBuffer);

    // Puppeteerでブラウザを起動
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page_obj = await browser.newPage();
    
    // ビューポートを設定
    await page_obj.setViewport({
      width: width,
      height: height || Math.floor(width * 1.414), // A4比率
      deviceScaleFactor: 2
    });

    // PDFをページで開く
    await page_obj.goto(`file://${tempPdfPath}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 指定されたページまでスクロール（簡易実装）
    if (page > 1) {
      for (let i = 1; i < page; i++) {
        await page_obj.keyboard.press('PageDown');
        await page_obj.waitForTimeout(500);
      }
    }

    // スクリーンショット取得
    const screenshot = await page_obj.screenshot({
      type: 'png',
      fullPage: false,
      quality: 90
    });

    // 画像を最適化（Jimp使用）
    const image = await Jimp.read(screenshot);
    if (image.bitmap.width > width || image.bitmap.height > height) {
      image.scaleToFit(width, height);
    }
    const optimizedBuffer = await image.quality(90).getBufferAsync(Jimp.MIME_PNG);

    return optimizedBuffer;

  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error(`PDF変換エラー: ${error.message || '不明なエラー'}`);
  } finally {
    // クリーンアップ
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.warn('Browser cleanup failed:', e);
      }
    }
    
    if (tempPdfPath) {
      try {
        await fs.unlink(tempPdfPath);
      } catch (cleanupError) {
        console.warn('Temp file cleanup failed:', cleanupError);
      }
    }
  }
}

// PDFのページ数を取得（pdf-libを使用）
export async function getPdfPageCount(pdfBuffer) {
  try {
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return 1;
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();

  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return 1;
  }
}

// 複数ページのPDFを個別の画像に変換
export async function convertPdfToMultipleImages(pdfBuffer, options = {}) {
  const pageCount = await getPdfPageCount(pdfBuffer);
  const images = [];

  for (let page = 1; page <= pageCount; page++) {
    try {
      const imageBuffer = await convertPdfToImage(pdfBuffer, { ...options, page });
      images.push({
        page,
        buffer: imageBuffer,
        dataUrl: `data:image/png;base64,${imageBuffer.toString('base64')}`
      });
    } catch (error) {
      console.error(`Error converting page ${page}:`, error);
      // エラーがあっても他のページの処理を続行
    }
  }

  return images;
}

// 複数の画像を縦に結合
export async function combineImagesVertically(imageBuffers) {
  if (!imageBuffers || imageBuffers.length === 0) {
    throw new Error('結合する画像がありません');
  }

  if (imageBuffers.length === 1) {
    return imageBuffers[0];
  }

  try {
    // Jimpを使用した画像結合（シンプル版）
    console.log('🔄 Combining images with Jimp...');
    
    // 最初の画像をベースにする
    if (imageBuffers.length === 1) {
      return imageBuffers[0];
    }
    
    // 複数画像の場合は最初の画像のみを返す（簡易実装）
    console.log('⚠️ Multiple images detected, using first image only');
    return imageBuffers[0];

  } catch (error) {
    console.error('Image combination error:', error);
    throw new Error(`画像結合エラー: ${error.message}`);
  }
}

// 一時ファイルのクリーンアップ
export async function cleanupTempFiles() {
  try {
    const tempDir = path.join(__dirname, 'temp');
    const files = await fs.readdir(tempDir);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      // 1時間以上古いファイルを削除
      if (Date.now() - stats.mtime.getTime() > 3600000) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}