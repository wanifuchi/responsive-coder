import Jimp from 'jimp';

// Jimpを使用した画像処理（sharpの代替）
export async function imageToBase64WithJimp(buffer, maxSizeMB = 3.5) {
  try {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const originalSize = buffer.length;
    
    console.log(`📷 Original image size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (originalSize <= maxSizeBytes) {
      return buffer.toString('base64');
    }
    
    console.log('🔄 Image too large, compressing with Jimp...');
    
    // Jimpで画像を読み込む
    const image = await Jimp.read(buffer);
    
    // 画像をリサイズ（最大1920x1080）
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    if (width > 1920 || height > 1080) {
      image.scaleToFit(1920, 1080);
    }
    
    // 品質を調整しながら圧縮
    let quality = 90;
    let compressed;
    
    do {
      compressed = await image
        .quality(quality)
        .getBufferAsync(Jimp.MIME_JPEG);
      
      if (compressed.length <= maxSizeBytes) {
        break;
      }
      
      quality -= 10;
    } while (quality > 30);
    
    console.log(`✅ Compressed to ${(compressed.length / 1024 / 1024).toFixed(2)}MB (quality: ${quality})`);
    
    return compressed.toString('base64');
  } catch (error) {
    console.error('❌ Jimp compression error:', error);
    // エラーの場合は元のバッファをそのまま返す
    return buffer.toString('base64');
  }
}