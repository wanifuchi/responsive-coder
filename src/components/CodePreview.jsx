import React, { useState, useEffect, useRef } from 'react';
import './CodePreview.css';

function CodePreview({ html, css }) {
  const [previewSize, setPreviewSize] = useState('desktop');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (iframeRef.current && html && css) {
      try {
        const document = iframeRef.current.contentDocument;
        
        // HTMLとCSSの有効性をチェック
        if (!html.trim() || !css.trim()) {
          console.warn('⚠️ Empty HTML or CSS provided to CodePreview');
          return;
        }
        
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
        
        console.log('📱 Updating CodePreview iframe with content length:', {
          htmlLength: html.length,
          cssLength: css.length,
          totalContentLength: content.length
        });
        
        document.open();
        document.write(content);
        document.close();
      } catch (error) {
        console.error('❌ Error updating CodePreview iframe:', error);
        
        // エラー時のフォールバック表示
        const document = iframeRef.current.contentDocument;
        document.open();
        document.write(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family: Arial, sans-serif; padding: 20px; color: #e74c3c;">
            <h2>⚠️ プレビューエラー</h2>
            <p>コードのプレビューを表示できませんでした。</p>
            <p>エラー: ${error.message}</p>
          </body>
          </html>
        `);
        document.close();
      }
    }
  }, [html, css]);

  return (
    <div className="code-preview">
      <div className="preview-header">
        <h3>プレビュー</h3>
        <div className="preview-size-selector">
          <button
            className={`size-button ${previewSize === 'desktop' ? 'active' : ''}`}
            onClick={() => setPreviewSize('desktop')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Desktop
          </button>
          <button
            className={`size-button ${previewSize === 'tablet' ? 'active' : ''}`}
            onClick={() => setPreviewSize('tablet')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Tablet
          </button>
          <button
            className={`size-button ${previewSize === 'mobile' ? 'active' : ''}`}
            onClick={() => setPreviewSize('mobile')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Mobile
          </button>
        </div>
      </div>
      <div className={`preview-container ${previewSize}`}>
        <iframe
          ref={iframeRef}
          className="preview-iframe"
          title="コードプレビュー"
        />
      </div>
    </div>
  );
}

export default CodePreview;