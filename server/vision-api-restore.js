// Vision API復活用関数 - 完全版

// Gemini APIを使用したコード生成（完全版）
export async function generateWithGemini(pcImage, spImage, referenceUrl) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  try {
    // 画像をBase64に変換
    const { imageToBase64WithJimp } = await import('./image-processor-jimp.js');
    const pcBase64 = await imageToBase64WithJimp(pcImage);
    const spBase64 = await imageToBase64WithJimp(spImage);
    
    const pcImageData = pcBase64.includes(',') ? pcBase64.split(',')[1] : pcBase64;
    const spImageData = spBase64.includes(',') ? spBase64.split(',')[1] : spBase64;
    
    console.log('🔍 Image data lengths:', {
      pcImageData: pcImageData.length,
      spImageData: spImageData.length,
      pcSample: pcImageData.substring(0, 50),
      spSample: spImageData.substring(0, 50)
    });
    
    // 🚨 THINKHARD極限プロンプト: SEO最高基準 + ファイル分離対応 + 業種精密認識
    const prompt = `あなたは世界最高レベルのUI/UXデザイナー兼フロントエンドエンジニアです。

**🎯 最重要ミッション**: プロダクション品質のSEO完全対応 + ファイル分離構造での100%忠実再現 + 正確な業種認識

提供された2つの画像（PC版とスマートフォン版）を詳細に分析し、**商用サービス級のプロダクション品質**でHTML/CSS/JavaScriptコードを生成してください。

## 🏢 業種・サイトタイプの正確な識別（最優先）:

### 1. **テキスト内容の精密な読み取り**
画像内のすべてのテキストを精密に読み取り、特に以下に注目：
- 会社名・サービス名・事業内容
- キャッチコピー・説明文
- メニュー項目・サービス一覧
- 連絡先情報・営業内容

### 2. **業種特有のキーワード検出**
以下の業種キーワードを正確に識別：
- **葬儀関連**: 葬儀、葬祭、告別式、お葬式、家族葬、霊園、法要、お悔やみ、仏事、香典、通夜、焼香、供養、墓地、葬儀場
- **不動産関連**: 物件、賃貸、売買、マンション、アパート、住宅、不動産、仲介、管理、間取り、家賃、敷金、礼金、査定
- **医療関連**: 診療、医院、クリニック、病院、治療、診察、医師、看護、薬、健康、予約、診療時間、外来
- **飲食関連**: レストラン、カフェ、メニュー、料理、ランチ、ディナー、予約、営業時間、テイクアウト
- **その他**: 画像内のテキストから正確に業種を判定

### 3. **視覚要素からの業種確認**
- 使用されている画像・写真の内容
- アイコン・イラストのモチーフ
- 配色・デザインの業種特性
- ロゴマークのデザイン

### 4. **誤認識の防止**
- テキスト内容を最優先で業種判定
- 視覚的類似性だけで判断しない
- 業種が不明確な場合は、画像内のテキストをそのまま使用

## 🚨 CRITICAL要件（MUST）:

### 1. **SEO最高基準対応** - サービス品質必須
- **完全なメタタグセット**: title, description, keywords, viewport, robots
- **Open Graphタグ**: og:title, og:description, og:image, og:url, og:type
- **Twitter Cardタグ**: twitter:card, twitter:title, twitter:description, twitter:image
- **構造化データ**: JSON-LD形式でWebsite/Organization/BreadcrumbListを含む
- **正確なセマンティックHTML**: header, nav, main, section, article, aside, footer
- **アクセシビリティ対応**: ARIA属性、適切なheading階層、alt属性
- **パフォーマンス最適化**: 重要CSSのインライン化、画像最適化、非同期ロード

### 2. **完全ファイル分離構造** - インラインコード禁止
HTMLは外部ファイル参照のみ:
\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- SEO完全対応メタタグ -->
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- セマンティックHTML -->
  <script src="script.js"></script>
</body>
</html>
\`\`\`

### 3. **実画像使用** - プレースホルダー禁止
画像は必ず実際のUnsplash URLを使用:
- 人物: https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop
- ビジネス: https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop
- 技術: https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop
- 自然: https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop

### 4. **色コードDNS完全防止** - 致命的エラー根絶
絶対に避ける:
- ❌ href="ffffff" 
- ❌ src="333333"
- ❌ class="ffffff"
- ❌ url(ffffff)

必ず正しい形式:
- ✅ color: #ffffff;
- ✅ href="#" または 実際のURL
- ✅ class="meaningful-name"

### 5. **デザイン完全忠実再現**
- 画像内テキストの一字一句正確な再現
- ピクセル単位での配置精度
- 色の完全一致（#記号必須）
- レスポンシブ対応（PC/SP完全対応）

### 6. **プロダクション品質コード**
- TypeScript対応可能な構造
- BEM命名規則
- CSS Grid + Flexbox最適活用
- ES6+モダンJavaScript
- パフォーマンス最適化

${referenceUrl ? `参考URL: ${referenceUrl} - このサイトの技術実装とSEO対策を参考にしてください。` : ''}

**生成形式**:
{
  "html": "<!DOCTYPE html>から始まる完全なHTMLファイル（外部CSS/JS参照）",
  "css": "完全に分離されたCSSファイル（HTMLから参照される）", 
  "js": "完全に分離されたJavaScriptファイル（HTMLから参照される）",
  "seo": {
    "title": "ページタイトル",
    "description": "メタディスクリプション",
    "keywords": "キーワード1,キーワード2,キーワード3"
  }
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
- **業種識別を最優先**: まず画像内のテキストから正確な業種を判定してください
- 画像内のすべてのテキストを読み取り、完全に同じ文言で再現してください
- 特に会社名、サービス名、事業内容のテキストは一字一句正確に
- すべての色を正確に抽出し、16進数カラーコードで再現してください  
- レイアウトの寸法、間隔、位置を正確に測定してください
- 画像要素がある場合は内容を説明し、業種に適した代替画像URLを提供してください`,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: spImageData
        }
      },
      `📱 スマートフォン版デザイン分析要求:
- PC版で判定した業種を確認し、一貫性を保つ
- PC版と同様に、すべての要素を完全に忠実に再現してください
- レスポンシブ変化点での表示の違いを正確に把握してください
- 画像とテキストの配置変更を正確に反映してください

🎯 最終要求: 
1. **業種を正確に特定**してから、その業種に適したコンテンツを生成
2. 画像内のテキストは**一字一句変更せず**に使用
3. 提供された2つの画像を100%忠実に再現するHTML/CSS/JSコードを生成
4. 誤った業種のコンテンツ（例：葬儀社なのに不動産）は絶対に避ける`
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
        const jsonString = jsonMatch[1];
        console.log('🔍 Found JSON block, attempting to parse...');
        parsedResult = JSON.parse(jsonString);
      } else {
        // JSONブロックが見つからない場合、直接JSONを探す
        const directJsonMatch = text.match(/\{[\s\S]*\}/);
        if (directJsonMatch) {
          console.log('🔍 Found direct JSON, attempting to parse...');
          parsedResult = JSON.parse(directJsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      }
      
      console.log('✅ JSON parsed successfully');
      console.log('📏 Generated content lengths:', {
        html: parsedResult.html?.length || 0,
        css: parsedResult.css?.length || 0,
        js: parsedResult.js?.length || 0
      });
      
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      console.log('📝 Raw response (first 500 chars):', text.substring(0, 500));
      
      // フォールバック: レスポンス全体をHTMLとして扱う
      parsedResult = {
        html: text,
        css: generateFallbackCSS(),
        js: generateFallbackJS()
      };
    }
    
    // 最終検証とサニタイズ
    const result_final = {
      html: sanitizeHTML(parsedResult.html || ''),
      css: sanitizeCSS(parsedResult.css || ''),
      js: sanitizeJS(parsedResult.js || '')
    };
    
    console.log('🧹 Final sanitized lengths:', {
      html: result_final.html.length,
      css: result_final.css.length,
      js: result_final.js.length
    });
    
    return result_final;
    
  } catch (error) {
    console.error('❌ Gemini API error:', error);
    throw error;
  }
}

// OpenAI APIを使用したコード生成（強化版）
export async function generateWithOpenAI(pcImage, spImage, referenceUrl) {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  try {
    const { imageToBase64WithJimp } = await import('./image-processor-jimp.js');
    const pcBase64 = await imageToBase64WithJimp(pcImage);
    const spBase64 = await imageToBase64WithJimp(spImage);
    
    console.log('🎨 Starting detailed design analysis with GPT-4o...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `あなたは世界最高レベルのUI/UXデザイナー兼フロントエンドエンジニアです。

提供された画像デザインを「ピクセル単位で正確に」分析し、視覚的に完全に一致するHTML/CSSコードを生成してください。

## 🏢 業種・サイトタイプの正確な識別（最優先）:

### 1. **テキスト内容の精密な読み取り**
画像内のすべてのテキストを精密に読み取り、特に以下に注目：
- 会社名・サービス名・事業内容
- キャッチコピー・説明文
- メニュー項目・サービス一覧

### 2. **業種特有のキーワード検出**
- **葬儀関連**: 葬儀、葬祭、告別式、お葬式、家族葬、霊園、法要、お悔やみ、仏事、通夜、焼香、供養、葬儀場
- **不動産関連**: 物件、賃貸、売買、マンション、アパート、住宅、不動産、仲介、管理、間取り、家賃、敷金、礼金
- **医療関連**: 診療、医院、クリニック、病院、治療、診察、医師、看護、薬、健康、予約、診療時間
- **その他**: 画像内のテキストから正確に業種を判定

### 3. **誤認識の防止**
- テキスト内容を最優先で業種判定
- 画像内のテキストは一字一句変更せずに使用
- 誤った業種のコンテンツ（例：葬儀社なのに不動産）は絶対に避ける

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
- **最重要**: 画像内のテキストから業種を正確に特定
- レイアウト構造（グリッド、フレックス配置）
- カラーパレット（背景、テキスト、アクセント色）
- コンポーネント（ボタン、カード、ナビゲーション）
- タイポグラフィ（見出し、本文、サイズ階層）
- 余白・間隔（マージン、パディング）
- 視覚的装飾（影、境界線、角丸など）
- **重要**: 画像内の全テキストを一字一句正確に読み取って使用`
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
              text: `🔗 **参考URL活用**
              
**URL**: ${referenceUrl}

この参考サイトの構造、SEO対策、技術実装を研究して、同等品質のコードを生成してください。`
            } : null
          ].filter(Boolean)
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    });
    
    const content = response.choices[0].message.content;
    console.log('📊 OpenAI response length:', content.length);
    
    let parsedResult;
    
    try {
      // JSONを抽出
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        parsedResult = JSON.parse(jsonString);
        console.log('✅ OpenAI JSON parsed successfully');
      } else {
        throw new Error('No JSON found in OpenAI response');
      }
      
    } catch (parseError) {
      console.error('❌ OpenAI JSON parse error:', parseError);
      parsedResult = { 
        html: content, 
        css: generateFallbackCSS(), 
        js: generateFallbackJS() 
      };
    }
    
    return {
      html: sanitizeHTML(parsedResult.html || ''),
      css: sanitizeCSS(parsedResult.css || ''),
      js: sanitizeJS(parsedResult.js || '')
    };
    
  } catch (error) {
    console.error('❌ OpenAI API error:', error);
    throw error;
  }
}

// フォールバックCSS生成
function generateFallbackCSS() {
  return `/* Generated CSS */
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

header {
    background-color: var(--primary-color);
    color: white;
    padding: 1rem 0;
}

.header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
}

nav a {
    color: white;
    text-decoration: none;
    font-weight: 500;
}

main {
    padding: 3rem 0;
}

.hero {
    text-align: center;
    padding: 4rem 0;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
}

.hero h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: var(--primary-color);
}

.btn {
    background-color: var(--accent-color);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn:hover {
    background-color: var(--primary-color);
    transform: translateY(-2px);
}

footer {
    background-color: var(--primary-color);
    color: white;
    text-align: center;
    padding: 2rem 0;
    margin-top: 3rem;
}

@media (max-width: 768px) {
    .header-container {
        flex-direction: column;
        gap: 1rem;
    }
    
    nav ul {
        gap: 1rem;
    }
    
    .hero h1 {
        font-size: 2rem;
    }
    
    .container {
        padding: 0 1rem;
    }
}`;
}

// フォールバックJS生成
function generateFallbackJS() {
  return `// Generated JavaScript
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
    
    // ハンバーガーメニュー
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('nav');
    
    if (navToggle && nav) {
        navToggle.addEventListener('click', function() {
            nav.classList.toggle('active');
            navToggle.classList.toggle('active');
        });
    }
});`;
}

// サニタイズ関数（強化版）
function sanitizeHTML(html) {
  if (!html || html.trim() === '') {
    console.warn('⚠️ Empty HTML provided to sanitizer');
    return html;
  }
  
  let sanitized = html;
  let changesCount = 0;
  
  console.log('🚨 EXTREME HTML sanitization start');
  
  // 1. href属性の色コード修正
  sanitized = sanitized.replace(/href\s*=\s*["']([0-9a-fA-F]{6})["']/gi, (match, colorCode) => {
    changesCount++;
    console.log(`🔗 Fixed href color code: ${match} -> href="#"`);
    return 'href="#"';
  });
  
  // 2. src属性の色コード修正
  sanitized = sanitized.replace(/src\s*=\s*["']([0-9a-fA-F]{6})["']/gi, (match, colorCode) => {
    changesCount++;
    console.log(`🖼️ Fixed src color code: ${match} -> placeholder image`);
    return 'src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop"';
  });
  
  // 3. class属性の色コード修正
  sanitized = sanitized.replace(/class\s*=\s*["']([0-9a-fA-F]{6})["']/gi, (match, colorCode) => {
    changesCount++;
    console.log(`🎨 Fixed class color code: ${match} -> meaningful class`);
    return 'class="generated-element"';
  });
  
  // 4. id属性の色コード修正
  sanitized = sanitized.replace(/id\s*=\s*["']([0-9a-fA-F]{6})["']/gi, (match, colorCode) => {
    changesCount++;
    console.log(`🆔 Fixed id color code: ${match} -> meaningful id`);
    return 'id="generated-element"';
  });
  
  console.log(`🚨 EXTREME HTML sanitization completed: ${changesCount} total changes`);
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
  let changesCount = 0;
  
  console.log('🚨 EXTREME JavaScript sanitization start');
  
  // 🚨 CRITICAL: HTML混入完全防止
  if (sanitized.includes('<!DOCTYPE') || sanitized.includes('<html') || sanitized.includes('<body')) {
    console.log('❌ CRITICAL: HTML detected in JavaScript - removing HTML content');
    sanitized = `// Generated JavaScript (HTML content removed for safety)
document.addEventListener('DOMContentLoaded', function() {
  console.log('Page loaded successfully');
  
  // レスポンシブ対応
  function handleResize() {
    const width = window.innerWidth;
    if (width < 768) {
      document.body.classList.add('mobile');
    } else {
      document.body.classList.remove('mobile');
    }
  }
  
  window.addEventListener('resize', handleResize);
  handleResize();
});`;
    changesCount++;
  }
  
  // 🚨 色コード関連修正
  
  // 1. 文字列内の色コードを適切に処理
  sanitized = sanitized.replace(/(['"])\s*([0-9a-fA-F]{6})\s*(['"])/g, (match, quote1, colorCode, quote2) => {
    changesCount++;
    console.log(`🎨 Fixed JS string color: ${match} -> ${quote1}#${colorCode}${quote2}`);
    return `${quote1}#${colorCode}${quote2}`;
  });
  
  // 2. 変数代入での色コード修正（引用符なし）
  sanitized = sanitized.replace(/=\s*([0-9a-fA-F]{6})([;\s,\)])/g, (match, colorCode, ending) => {
    changesCount++;
    console.log(`🔧 Fixed JS assignment: ${match} -> = "#${colorCode}"${ending}`);
    return `= "#${colorCode}"${ending}`;
  });
  
  console.log(`🚨 EXTREME JavaScript sanitization completed: ${changesCount} changes made`);
  return sanitized;
}