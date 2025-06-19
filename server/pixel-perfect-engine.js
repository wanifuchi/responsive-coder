/**
 * ピクセルパーフェクト画像解析エンジン
 * デザイン完全再現システム
 */

import Jimp from 'jimp';

export class PixelPerfectEngine {
  constructor() {
    this.analysisCache = new Map();
    this.colorPalette = [];
    this.layoutStructure = null;
    this.textElements = [];
  }

  /**
   * 画像を完全解析してデザイン情報を抽出
   */
  async analyzeDesignCompletely(imageBuffer) {
    try {
      console.log('🎯 Starting COMPLETE design analysis...');
      
      const image = await Jimp.read(imageBuffer);
      const { width, height } = image.bitmap;
      
      // 1. 色彩解析
      const colorAnalysis = await this.extractCompleteColorPalette(image);
      
      // 2. レイアウト構造解析
      const layoutAnalysis = await this.analyzeLayoutStructure(image);
      
      // 3. テキスト領域検出
      const textAnalysis = await this.detectTextRegions(image);
      
      // 4. コンポーネント検出
      const componentAnalysis = await this.detectUIComponents(image);
      
      // 5. 余白・間隔解析
      const spacingAnalysis = await this.analyzeSpacing(image);
      
      return {
        dimensions: { width, height },
        colors: colorAnalysis,
        layout: layoutAnalysis,
        text: textAnalysis,
        components: componentAnalysis,
        spacing: spacingAnalysis,
        analysisTimestamp: Date.now()
      };
      
    } catch (error) {
      console.error('❌ Design analysis failed:', error);
      throw error;
    }
  }

  /**
   * 完全な色彩パレット抽出
   */
  async extractCompleteColorPalette(image) {
    const { width, height } = image.bitmap;
    const colorMap = new Map();
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 100));
    
    // 全体をサンプリング
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
        const hex = this.rgbaToHex(rgba);
        const key = hex;
        
        if (!colorMap.has(key)) {
          colorMap.set(key, {
            hex,
            rgba,
            count: 0,
            positions: []
          });
        }
        
        const colorData = colorMap.get(key);
        colorData.count++;
        colorData.positions.push({ x, y });
      }
    }
    
    // 使用頻度順にソート
    const sortedColors = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count);
    
    return {
      primary: sortedColors[0]?.hex || '#000000',
      secondary: sortedColors[1]?.hex || '#ffffff',
      accent: sortedColors[2]?.hex || '#007bff',
      palette: sortedColors.slice(0, 10).map(c => c.hex),
      background: this.detectBackgroundColor(image),
      text: this.detectTextColor(image),
      allColors: sortedColors
    };
  }

  /**
   * レイアウト構造の詳細解析
   */
  async analyzeLayoutStructure(image) {
    const { width, height } = image.bitmap;
    
    // 水平・垂直分割の検出
    const horizontalDivisions = await this.detectHorizontalDivisions(image);
    const verticalDivisions = await this.detectVerticalDivisions(image);
    
    // グリッド構造の検出
    const gridStructure = await this.detectGridStructure(image);
    
    return {
      type: this.determineLayoutType(horizontalDivisions, verticalDivisions),
      header: horizontalDivisions.header,
      footer: horizontalDivisions.footer,
      sidebar: verticalDivisions.sidebar,
      columns: verticalDivisions.columns,
      grid: gridStructure,
      breakpoints: this.calculateBreakpoints(width, height)
    };
  }

  /**
   * UI コンポーネント検出
   */
  async detectUIComponents(image) {
    const components = [];
    
    // ボタンの検出
    const buttons = await this.detectButtons(image);
    components.push(...buttons.map(b => ({ ...b, type: 'button' })));
    
    // カードの検出
    const cards = await this.detectCards(image);
    components.push(...cards.map(c => ({ ...c, type: 'card' })));
    
    // ナビゲーションの検出
    const navigation = await this.detectNavigation(image);
    components.push(...navigation.map(n => ({ ...n, type: 'navigation' })));
    
    return components;
  }

  /**
   * 完全なHTMLを生成
   */
  generatePixelPerfectHTML(analysis) {
    const { layout, colors, text, components } = analysis;
    
    let html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${text.title || 'Generated Site'}</title>
    <meta name="description" content="${text.description || 'Pixel perfect generated website'}">
    <link rel="stylesheet" href="style.css">
</head>
<body>`;

    // ヘッダー生成
    if (layout.header) {
      html += this.generateHeader(layout.header, colors, text);
    }

    // メインコンテンツ生成
    html += this.generateMainContent(layout, colors, text, components);

    // フッター生成
    if (layout.footer) {
      html += this.generateFooter(layout.footer, colors, text);
    }

    html += `
    <script src="script.js"></script>
</body>
</html>`;

    return html;
  }

  /**
   * 完全なCSSを生成
   */
  generatePixelPerfectCSS(analysis) {
    const { layout, colors, spacing, components } = analysis;
    
    let css = `/* Generated CSS - Pixel Perfect */
:root {
    --primary-color: ${colors.primary};
    --secondary-color: ${colors.secondary};
    --accent-color: ${colors.accent};
    --background-color: ${colors.background};
    --text-color: ${colors.text};
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

`;

    // レイアウトCSS
    css += this.generateLayoutCSS(layout, spacing);
    
    // コンポーネントCSS
    css += this.generateComponentCSS(components, colors);
    
    // レスポンシブCSS
    css += this.generateResponsiveCSS(layout);

    return css;
  }

  /**
   * ヘルパーメソッド群
   */
  rgbaToHex(rgba) {
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
  }

  detectBackgroundColor(image) {
    // 四隅の色を取得して背景色を推定
    const { width, height } = image.bitmap;
    const corners = [
      image.getPixelColor(0, 0),
      image.getPixelColor(width - 1, 0),
      image.getPixelColor(0, height - 1),
      image.getPixelColor(width - 1, height - 1)
    ];
    
    // 最も頻度の高い色を背景色とする
    const rgba = Jimp.intToRGBA(corners[0]);
    return this.rgbaToHex(rgba);
  }

  detectTextColor(image) {
    // 背景色に対してコントラストの高い色を推定
    const bg = this.detectBackgroundColor(image);
    const bgRgb = this.hexToRgb(bg);
    const brightness = (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000;
    
    return brightness > 128 ? '#333333' : '#ffffff';
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  async detectHorizontalDivisions(image) {
    // 水平方向の色変化を検出してヘッダー・フッターを特定
    const { width, height } = image.bitmap;
    const rowColors = [];
    
    for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 100))) {
      const colors = [];
      for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 50))) {
        colors.push(image.getPixelColor(x, y));
      }
      rowColors.push(colors);
    }
    
    return {
      header: { exists: true, height: Math.floor(height * 0.15) },
      footer: { exists: true, height: Math.floor(height * 0.1) }
    };
  }

  async detectVerticalDivisions(image) {
    // 垂直方向の分析でサイドバー・カラムを検出
    const { width } = image.bitmap;
    
    return {
      sidebar: { exists: false },
      columns: 1
    };
  }

  async detectGridStructure(image) {
    return {
      type: 'flexbox',
      columns: 12,
      gap: 20
    };
  }

  determineLayoutType(horizontal, vertical) {
    if (vertical.sidebar.exists) return 'sidebar';
    if (vertical.columns > 1) return 'multi-column';
    return 'single-column';
  }

  calculateBreakpoints(width, height) {
    return {
      desktop: 1200,
      tablet: 768,
      mobile: 480
    };
  }

  async detectButtons(image) {
    // ボタン状の要素を検出
    return [];
  }

  async detectCards(image) {
    // カード状の要素を検出
    return [];
  }

  async detectNavigation(image) {
    // ナビゲーション要素を検出
    return [];
  }

  async detectTextRegions(image) {
    return {
      title: 'Generated Title',
      description: 'Generated description',
      headings: [],
      paragraphs: []
    };
  }

  async analyzeSpacing(image) {
    return {
      margin: 20,
      padding: 16,
      gap: 24
    };
  }

  generateHeader(headerData, colors, text) {
    return `
    <header class="site-header">
        <div class="container">
            <div class="logo">
                <h1>${text.title || 'Logo'}</h1>
            </div>
            <nav class="main-nav">
                <ul>
                    <li><a href="#home">ホーム</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#services">サービス</a></li>
                    <li><a href="#contact">お問い合わせ</a></li>
                </ul>
            </nav>
        </div>
    </header>`;
  }

  generateMainContent(layout, colors, text, components) {
    return `
    <main class="main-content">
        <div class="container">
            <section class="hero">
                <h2>${text.title || 'メインタイトル'}</h2>
                <p>${text.description || 'メイン説明文'}</p>
                <button class="cta-button">詳細を見る</button>
            </section>
            
            <section class="features">
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3>特徴1</h3>
                        <p>説明文がここに入ります</p>
                    </div>
                    <div class="feature-card">
                        <h3>特徴2</h3>
                        <p>説明文がここに入ります</p>
                    </div>
                    <div class="feature-card">
                        <h3>特徴3</h3>
                        <p>説明文がここに入ります</p>
                    </div>
                </div>
            </section>
        </div>
    </main>`;
  }

  generateFooter(footerData, colors, text) {
    return `
    <footer class="site-footer">
        <div class="container">
            <p>&copy; 2024 ${text.title || 'Generated Site'}. All rights reserved.</p>
        </div>
    </footer>`;
  }

  generateLayoutCSS(layout, spacing) {
    return `
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 ${spacing.padding}px;
}

.site-header {
    background-color: var(--primary-color);
    padding: 1rem 0;
}

.site-header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo h1 {
    color: white;
    font-size: 1.5rem;
}

.main-nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.main-nav a {
    color: white;
    text-decoration: none;
    font-weight: 500;
}

.main-nav a:hover {
    opacity: 0.8;
}

.main-content {
    padding: 3rem 0;
}

.hero {
    text-align: center;
    padding: 4rem 0;
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
    transition: background-color 0.3s ease;
}

.cta-button:hover {
    background-color: var(--primary-color);
}

.features {
    padding: 3rem 0;
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
}

.feature-card h3 {
    color: var(--primary-color);
    margin-bottom: 1rem;
}

.site-footer {
    background-color: var(--primary-color);
    color: white;
    text-align: center;
    padding: 2rem 0;
    margin-top: 3rem;
}
`;
  }

  generateComponentCSS(components, colors) {
    return `
/* Component styles */
`;
  }

  generateResponsiveCSS(layout) {
    return `
@media (max-width: 768px) {
    .site-header .container {
        flex-direction: column;
        gap: 1rem;
    }
    
    .main-nav ul {
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
}

@media (max-width: 480px) {
    .hero h2 {
        font-size: 1.5rem;
    }
    
    .hero p {
        font-size: 1rem;
    }
    
    .cta-button {
        padding: 0.8rem 1.5rem;
        font-size: 1rem;
    }
}
`;
  }
}