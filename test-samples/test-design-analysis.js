// テスト用: 画像解析機能の検証スクリプト
import fs from 'fs/promises';
import sharp from 'sharp';

// シンプルなテスト画像を生成
async function createTestImage(width, height, filename) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- ヘッダー -->
      <rect width="${width}" height="80" fill="#2c3e50"/>
      <text x="20" y="50" fill="white" font-family="Arial" font-size="24" font-weight="bold">サンプルサイト</text>
      <text x="${width - 200}" y="30" fill="white" font-family="Arial" font-size="14">ホーム</text>
      <text x="${width - 140}" y="30" fill="white" font-family="Arial" font-size="14">サービス</text>
      <text x="${width - 80}" y="30" fill="white" font-family="Arial" font-size="14">お問い合わせ</text>
      
      <!-- ヒーローセクション -->
      <rect y="80" width="${width}" height="300" fill="#3498db"/>
      <text x="${width/2}" y="200" fill="white" font-family="Arial" font-size="32" text-anchor="middle" font-weight="bold">メインタイトル</text>
      <text x="${width/2}" y="240" fill="white" font-family="Arial" font-size="18" text-anchor="middle">サブタイトルテキストです</text>
      <rect x="${width/2 - 75}" y="260" width="150" height="40" fill="#e74c3c" rx="5"/>
      <text x="${width/2}" y="285" fill="white" font-family="Arial" font-size="16" text-anchor="middle">今すぐ始める</text>
      
      <!-- コンテンツセクション -->
      <rect y="380" width="${width}" height="200" fill="#ecf0f1"/>
      <text x="20" y="420" fill="#2c3e50" font-family="Arial" font-size="24" font-weight="bold">特徴</text>
      
      <!-- カード1 -->
      <rect x="20" y="440" width="${(width-80)/3}" height="120" fill="white" stroke="#bdc3c7" rx="8"/>
      <text x="30" y="470" fill="#2c3e50" font-family="Arial" font-size="16" font-weight="bold">機能1</text>
      <text x="30" y="490" fill="#7f8c8d" font-family="Arial" font-size="14">説明テキスト</text>
      
      <!-- カード2 -->
      <rect x="${40 + (width-80)/3}" y="440" width="${(width-80)/3}" height="120" fill="white" stroke="#bdc3c7" rx="8"/>
      <text x="${50 + (width-80)/3}" y="470" fill="#2c3e50" font-family="Arial" font-size="16" font-weight="bold">機能2</text>
      <text x="${50 + (width-80)/3}" y="490" fill="#7f8c8d" font-family="Arial" font-size="14">説明テキスト</text>
      
      <!-- カード3 -->
      <rect x="${60 + 2*(width-80)/3}" y="440" width="${(width-80)/3}" height="120" fill="white" stroke="#bdc3c7" rx="8"/>
      <text x="${70 + 2*(width-80)/3}" y="470" fill="#2c3e50" font-family="Arial" font-size="16" font-weight="bold">機能3</text>
      <text x="${70 + 2*(width-80)/3}" y="490" fill="#7f8c8d" font-family="Arial" font-size="14">説明テキスト</text>
      
      <!-- フッター -->
      <rect y="${height-60}" width="${width}" height="60" fill="#34495e"/>
      <text x="${width/2}" y="${height-30}" fill="white" font-family="Arial" font-size="14" text-anchor="middle">© 2024 サンプルサイト. All rights reserved.</text>
    </svg>
  `;
  
  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
    
  await fs.writeFile(filename, buffer);
  console.log(`✅ Test image created: ${filename}`);
  return buffer;
}

// PC版とSP版のテスト画像を生成
export async function generateTestImages() {
  const pcImage = await createTestImage(1200, 800, 'test-samples/pc-design.png');
  const spImage = await createTestImage(375, 800, 'test-samples/sp-design.png');
  
  return { pcImage, spImage };
}

// スタンドアロン実行用
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTestImages().then(() => {
    console.log('🎨 Test images generated successfully!');
  }).catch(console.error);
}