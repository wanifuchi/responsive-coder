// 画像解析のヘルパー関数

// サイドバーレイアウト生成
export function generateSidebarLayout() {
  return `
        <div class="content-with-sidebar">
            <aside class="sidebar">
                <div class="sidebar-section">
                    <h3>カテゴリー</h3>
                    <ul class="category-list">
                        <li><a href="#">デザイン</a></li>
                        <li><a href="#">開発</a></li>
                        <li><a href="#">マーケティング</a></li>
                        <li><a href="#">ビジネス</a></li>
                    </ul>
                </div>
                <div class="sidebar-section">
                    <h3>最新記事</h3>
                    <ul class="recent-posts">
                        <li><a href="#">レスポンシブデザインの基礎</a></li>
                        <li><a href="#">モダンCSSテクニック</a></li>
                        <li><a href="#">JavaScriptフレームワーク比較</a></li>
                    </ul>
                </div>
            </aside>
            
            <div class="main-area">
                <article class="content-article">
                    <h2>メインコンテンツエリア</h2>
                    <p>ここに主要なコンテンツが表示されます。サイドバーレイアウトにより、追加情報やナビゲーションを効果的に配置できます。</p>
                    
                    <div class="content-grid">
                        <div class="content-card">
                            <h3>セクション1</h3>
                            <p>詳細なコンテンツがここに入ります。</p>
                        </div>
                        <div class="content-card">
                            <h3>セクション2</h3>
                            <p>追加の情報やデータを表示します。</p>
                        </div>
                    </div>
                </article>
            </div>
        </div>`;
}

// マルチカラムコンテンツ生成
export function generateMultiColumnContent(columnCount) {
  const columns = [];
  for (let i = 1; i <= columnCount; i++) {
    columns.push(`
                    <div class="column">
                        <h3>カラム ${i}</h3>
                        <p>このセクションには重要な情報が含まれています。複数のカラムレイアウトにより、情報を効率的に整理できます。</p>
                        <a href="#" class="read-more">続きを読む →</a>
                    </div>`);
  }
  
  return `
        <section class="multi-column-section">
            <div class="container">
                <h2 class="section-title">マルチカラムレイアウト</h2>
                <div class="columns-wrapper columns-${columnCount}">
                    ${columns.join('')}
                </div>
            </div>
        </section>`;
}

// フッター生成
export function generateFooter(bgColor, textColor) {
  return `
    <footer class="site-footer">
        <div class="footer-container">
            <div class="footer-grid">
                <div class="footer-column">
                    <h4>会社情報</h4>
                    <ul>
                        <li><a href="#">会社概要</a></li>
                        <li><a href="#">採用情報</a></li>
                        <li><a href="#">プレスリリース</a></li>
                    </ul>
                </div>
                <div class="footer-column">
                    <h4>サービス</h4>
                    <ul>
                        <li><a href="#">Web制作</a></li>
                        <li><a href="#">アプリ開発</a></li>
                        <li><a href="#">コンサルティング</a></li>
                    </ul>
                </div>
                <div class="footer-column">
                    <h4>サポート</h4>
                    <ul>
                        <li><a href="#">ヘルプセンター</a></li>
                        <li><a href="#">お問い合わせ</a></li>
                        <li><a href="#">FAQ</a></li>
                    </ul>
                </div>
                <div class="footer-column">
                    <h4>フォローする</h4>
                    <div class="social-links">
                        <a href="#" aria-label="Twitter">📱</a>
                        <a href="#" aria-label="Facebook">📘</a>
                        <a href="#" aria-label="Instagram">📷</a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2024 Your Company. All rights reserved.</p>
            </div>
        </div>
    </footer>`;
}

// ピクセルパーフェクトCSS生成
export function generatePixelPerfectCSS(pcAnalysis, spAnalysis, backgroundColor, textColor, primaryColor) {
  const { width: pcWidth } = pcAnalysis;
  const { width: spWidth } = spAnalysis;
  
  return `/* リセットCSS */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

/* カスタムプロパティ */
:root {
    --primary-color: ${primaryColor};
    --bg-color: ${backgroundColor};
    --text-color: ${textColor};
    --secondary-bg: ${backgroundColor === '#ffffff' ? '#f8f9fa' : '#1a1a1a'};
    --card-bg: ${backgroundColor === '#ffffff' ? '#ffffff' : '#2a2a2a'};
    --border-color: ${backgroundColor === '#ffffff' ? '#e9ecef' : '#333333'};
    --shadow: ${backgroundColor === '#ffffff' 
        ? '0 2px 8px rgba(0,0,0,0.1)' 
        : '0 2px 8px rgba(0,0,0,0.3)'};
}

/* 基本スタイル */
body {
    font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.6;
    overflow-x: hidden;
}

.container {
    max-width: ${pcWidth}px;
    margin: 0 auto;
    padding: 0 20px;
}

/* ヘッダー */
.site-header {
    background-color: var(--primary-color);
    color: white;
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 1000;
    box-shadow: var(--shadow);
}

.header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: ${pcWidth}px;
    margin: 0 auto;
    padding: 0 20px;
}

.logo h1 {
    font-size: 1.8rem;
    font-weight: 700;
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
    transition: opacity 0.3s ease;
}

.main-nav a:hover {
    opacity: 0.8;
}

.mobile-menu-toggle {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
}

.mobile-menu-toggle span {
    display: block;
    width: 25px;
    height: 3px;
    background-color: white;
    margin: 5px 0;
    transition: transform 0.3s ease;
}

/* ヒーローセクション */
.hero-section {
    padding: 4rem 0;
    text-align: center;
    background: linear-gradient(135deg, var(--primary-color), ${adjustColor(primaryColor, -20)});
    color: white;
}

.hero-title {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 1rem;
    animation: fadeInUp 0.8s ease;
}

.hero-description {
    font-size: 1.25rem;
    margin-bottom: 2rem;
    opacity: 0.9;
    animation: fadeInUp 0.8s ease 0.2s both;
}

.cta-group {
    display: flex;
    gap: 1rem;
    justify-content: center;
    animation: fadeInUp 0.8s ease 0.4s both;
}

.cta-button {
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: 600;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
}

.cta-button.primary {
    background-color: white;
    color: var(--primary-color);
}

.cta-button.secondary {
    background-color: transparent;
    color: white;
    border: 2px solid white;
}

.cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
}

/* 機能セクション */
.features-section {
    padding: 4rem 0;
    background-color: var(--secondary-bg);
}

.section-title {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 3rem;
    font-weight: 700;
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.feature-card {
    background-color: var(--card-bg);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: var(--shadow);
    text-align: center;
    transition: transform 0.3s ease;
}

.feature-card:hover {
    transform: translateY(-5px);
}

.feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.feature-card h4 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    font-weight: 600;
}

/* サイドバーレイアウト */
.content-with-sidebar {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 2rem;
    padding: 2rem 0;
}

.sidebar {
    background-color: var(--secondary-bg);
    padding: 2rem;
    border-radius: 12px;
    position: sticky;
    top: 100px;
    height: fit-content;
}

.sidebar-section {
    margin-bottom: 2rem;
}

.sidebar-section h3 {
    font-size: 1.3rem;
    margin-bottom: 1rem;
    font-weight: 600;
}

.category-list,
.recent-posts {
    list-style: none;
}

.category-list li,
.recent-posts li {
    margin-bottom: 0.5rem;
}

.category-list a,
.recent-posts a {
    color: var(--text-color);
    text-decoration: none;
    transition: color 0.3s ease;
}

.category-list a:hover,
.recent-posts a:hover {
    color: var(--primary-color);
}

/* マルチカラム */
.columns-wrapper {
    display: grid;
    gap: 2rem;
}

.columns-2 {
    grid-template-columns: repeat(2, 1fr);
}

.columns-3 {
    grid-template-columns: repeat(3, 1fr);
}

.columns-4 {
    grid-template-columns: repeat(4, 1fr);
}

.column {
    background-color: var(--card-bg);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: var(--shadow);
}

.column h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    font-weight: 600;
}

.read-more {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
    display: inline-block;
    margin-top: 1rem;
    transition: transform 0.3s ease;
}

.read-more:hover {
    transform: translateX(5px);
}

/* フッター */
.site-footer {
    background-color: var(--primary-color);
    color: white;
    padding: 3rem 0 1rem;
    margin-top: 4rem;
}

.footer-container {
    max-width: ${pcWidth}px;
    margin: 0 auto;
    padding: 0 20px;
}

.footer-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2rem;
    margin-bottom: 2rem;
}

.footer-column h4 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
    font-weight: 600;
}

.footer-column ul {
    list-style: none;
}

.footer-column li {
    margin-bottom: 0.5rem;
}

.footer-column a {
    color: white;
    text-decoration: none;
    opacity: 0.8;
    transition: opacity 0.3s ease;
}

.footer-column a:hover {
    opacity: 1;
}

.social-links {
    display: flex;
    gap: 1rem;
    font-size: 1.5rem;
}

.footer-bottom {
    text-align: center;
    padding-top: 2rem;
    border-top: 1px solid rgba(255,255,255,0.2);
    opacity: 0.8;
}

/* レスポンシブデザイン */
@media (max-width: ${spWidth}px) {
    .container {
        padding: 0 15px;
    }
    
    .main-nav {
        display: none;
    }
    
    .mobile-menu-toggle {
        display: block;
    }
    
    .hero-title {
        font-size: 2rem;
    }
    
    .hero-description {
        font-size: 1rem;
    }
    
    .cta-group {
        flex-direction: column;
        align-items: center;
    }
    
    .features-grid {
        grid-template-columns: 1fr;
    }
    
    .content-with-sidebar {
        grid-template-columns: 1fr;
    }
    
    .sidebar {
        position: static;
    }
    
    .columns-wrapper {
        grid-template-columns: 1fr !important;
    }
    
    .footer-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* アニメーション */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* ユーティリティクラス */
.text-center {
    text-align: center;
}

.mt-2 {
    margin-top: 2rem;
}

.mb-2 {
    margin-bottom: 2rem;
}`;
}

// インタラクティブJS生成
export function generateInteractiveJS() {
  return `// インタラクティブ機能
document.addEventListener('DOMContentLoaded', function() {
    // モバイルメニュートグル
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            mainNav.classList.toggle('active');
            this.classList.toggle('active');
        });
    }
    
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
    document.querySelectorAll('.feature-card, .column, .content-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
    
    // パララックス効果
    let ticking = false;
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const heroSection = document.querySelector('.hero-section');
        
        if (heroSection) {
            heroSection.style.transform = \`translateY(\${scrolled * 0.5}px)\`;
        }
        
        ticking = false;
    }
    
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    });
    
    // フォームバリデーション（もしフォームがある場合）
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            // ここにフォーム送信処理を追加
            console.log('Form submitted');
        });
    });
    
    // 画像の遅延読み込み
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
});`;
}

// 最終フォールバックテンプレート
export function getUltraBasicTemplate() {
  return {
    html: `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>エラー：画像解析に失敗しました</title>
</head>
<body>
    <div style="max-width: 800px; margin: 50px auto; padding: 20px; text-align: center;">
        <h1 style="color: #e74c3c;">⚠️ 画像解析エラー</h1>
        <p style="font-size: 18px; color: #666;">申し訳ございません。画像の解析中にエラーが発生しました。</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333;">考えられる原因：</h2>
            <ul style="text-align: left; display: inline-block;">
                <li>OpenAI APIキーが設定されていない</li>
                <li>画像ファイルが破損している</li>
                <li>サーバーの一時的な問題</li>
            </ul>
        </div>
        <p style="font-size: 16px; color: #666;">
            Railway環境でOPENAI_API_KEYが正しく設定されているか確認してください。
        </p>
    </div>
</body>
</html>`,
    css: '',
    js: ''
  };
}

// 色の調整関数
export function adjustColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}