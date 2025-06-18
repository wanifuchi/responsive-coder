import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import MultiImageUploader from './components/MultiImageUploader';
import CodeGenerator from './components/CodeGenerator';
import CodePreview from './components/CodePreview';
import IterationPanel from './components/IterationPanel';
import StatusIndicator from './components/StatusIndicator';
import './styles/App.css';

function App() {
  const [designs, setDesigns] = useState({
    pc: null,
    sp: null
  });
  const [multiImages, setMultiImages] = useState({
    pc: [],
    sp: []
  });
  const [useMultiMode, setUseMultiMode] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [generatedCode, setGeneratedCode] = useState({
    html: '',
    css: '',
    js: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [appStatus, setAppStatus] = useState(null);
  const [appStatusMessage, setAppStatusMessage] = useState('');

  const handleImageUpload = (type, fileOrDataUrl) => {
    if (typeof fileOrDataUrl === 'string') {
      // すでにData URLの場合（PDF変換済み）
      setDesigns(prev => ({
        ...prev,
        [type]: fileOrDataUrl
      }));
    } else {
      // ファイルの場合
      const reader = new FileReader();
      reader.onload = (e) => {
        setDesigns(prev => ({
          ...prev,
          [type]: e.target.result
        }));
      };
      reader.readAsDataURL(fileOrDataUrl);
    }
  };

  const handleMultiImageUpload = (type, files) => {
    setMultiImages(prev => ({
      ...prev,
      [type]: files
    }));
  };

  const handleCodeUpdate = (newCode) => {
    setGeneratedCode(newCode);
  };

  const handleGenerateCode = async () => {
    // モードに応じた検証
    if (useMultiMode) {
      if (multiImages.pc.length === 0 || multiImages.sp.length === 0) {
        alert('PCとSP両方の画像をアップロードしてください');
        return;
      }
    } else {
      if (!designs.pc || !designs.sp) {
        alert('PCとSP両方のデザインをアップロードしてください');
        return;
      }
    }

    setIsGenerating(true);
    setAppStatus('loading');
    setAppStatusMessage('コードを生成中...');
    
    try {
      const formData = new FormData();
      
      if (useMultiMode) {
        // マルチ画像モード: 複数ファイルを送信
        multiImages.pc.forEach((image, index) => {
          formData.append(`pcDesign_${index}`, image.file, image.name);
        });
        multiImages.sp.forEach((image, index) => {
          formData.append(`spDesign_${index}`, image.file, image.name);
        });
        formData.append('mode', 'multi');
        formData.append('pcCount', multiImages.pc.length.toString());
        formData.append('spCount', multiImages.sp.length.toString());
        if (referenceUrl) formData.append('referenceUrl', referenceUrl);
      } else {
        // シングル画像モード: 従来の処理
        const pcBlob = await fetch(designs.pc).then(r => r.blob());
        const spBlob = await fetch(designs.sp).then(r => r.blob());
        
        formData.append('pcDesign', pcBlob, 'pc-design.png');
        formData.append('spDesign', spBlob, 'sp-design.png');
        formData.append('mode', 'single');
        if (referenceUrl) formData.append('referenceUrl', referenceUrl);
      }

      const API_URL = 'https://responsive-coder-production.up.railway.app';
      console.log('API URL being used:', API_URL);
      const response = await fetch(`${API_URL}/api/generate-code`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'コード生成に失敗しました');
      }

      const result = await response.json();
      setGeneratedCode({
        html: result.html,
        css: result.css,
        js: result.js || ''
      });
      
      setAppStatus('success');
      setAppStatusMessage('コード生成が完了しました！');
      setTimeout(() => setAppStatus(null), 3000);
    } catch (error) {
      console.error('Error generating code:', error);
      setAppStatus('error');
      setAppStatusMessage(error.message || 'コード生成中にエラーが発生しました');
      setTimeout(() => setAppStatus(null), 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    // HTML ファイルのダウンロード
    const htmlBlob = new Blob([generatedCode.html], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    const htmlLink = document.createElement('a');
    htmlLink.href = htmlUrl;
    htmlLink.download = 'index.html';
    htmlLink.click();

    // CSS ファイルのダウンロード
    const cssBlob = new Blob([generatedCode.css], { type: 'text/css' });
    const cssUrl = URL.createObjectURL(cssBlob);
    const cssLink = document.createElement('a');
    cssLink.href = cssUrl;
    cssLink.download = 'style.css';
    cssLink.click();

    // JavaScript ファイルのダウンロード
    if (generatedCode.js) {
      const jsBlob = new Blob([generatedCode.js], { type: 'text/javascript' });
      const jsUrl = URL.createObjectURL(jsBlob);
      const jsLink = document.createElement('a');
      jsLink.href = jsUrl;
      jsLink.download = 'script.js';
      jsLink.click();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>自動レスポンシブコーディング</h1>
        <p>PCとSPのデザインをアップロードして、レスポンシブなHTML/CSSを自動生成</p>
      </header>

      <main className="app-main">
        <section className="mode-selector">
          <div className="mode-toggle">
            <label>
              <input
                type="radio"
                name="uploadMode"
                checked={!useMultiMode}
                onChange={() => setUseMultiMode(false)}
              />
              シングル画像モード
            </label>
            <label>
              <input
                type="radio"
                name="uploadMode"
                checked={useMultiMode}
                onChange={() => setUseMultiMode(true)}
              />
              複数画像モード
            </label>
          </div>
          <p className="mode-description">
            {useMultiMode 
              ? '複数の画像やPDFページを自動結合してコード生成' 
              : '単一の画像またはPDFからコード生成'
            }
          </p>
          
          <div className="reference-url-section">
            <label htmlFor="referenceUrl" className="url-label">
              参考URL（オプション）:
            </label>
            <input
              id="referenceUrl"
              type="url"
              className="url-input"
              placeholder="https://example.com （参考にしたいサイトのURL）"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
            />
            <small className="url-help">
              参考サイトのタイトルやメタ情報を抽出して、より適切なコード生成を行います
            </small>
          </div>
        </section>

        <section className="upload-section">
          {useMultiMode ? (
            <>
              <MultiImageUploader 
                type="pc" 
                label="PCデザイン（複数可）"
                images={multiImages.pc}
                onUpload={handleMultiImageUpload}
              />
              <MultiImageUploader 
                type="sp" 
                label="SPデザイン（複数可）"
                images={multiImages.sp}
                onUpload={handleMultiImageUpload}
              />
            </>
          ) : (
            <>
              <FileUploader 
                type="pc" 
                label="PCデザイン"
                design={designs.pc}
                onUpload={handleImageUpload}
              />
              <FileUploader 
                type="sp" 
                label="SPデザイン"
                design={designs.sp}
                onUpload={handleImageUpload}
              />
            </>
          )}
        </section>

        <div className="generate-button-wrapper">
          <button 
            className="generate-button"
            onClick={handleGenerateCode}
            disabled={
              isGenerating || 
              (useMultiMode 
                ? (multiImages.pc.length === 0 || multiImages.sp.length === 0)
                : (!designs.pc || !designs.sp)
              )
            }
          >
            {isGenerating ? 'コード生成中...' : 'コードを生成'}
          </button>
          {/* 詳細情報表示 */}
          <div style={{fontSize: '12px', color: '#666', marginTop: '10px', background: '#f8f9fa', padding: '10px', borderRadius: '5px'}}>
            {useMultiMode ? (
              <>
                <div>📁 PC画像: {multiImages.pc.length}個 | SP画像: {multiImages.sp.length}個</div>
                <div>🔄 生成状態: {isGenerating ? '✅ 処理中' : '❌ 待機中'}</div>
              </>
            ) : (
              <>
                <div>📁 PC画像: {designs.pc ? '✅ 準備完了' : '❌ 未アップロード'} | SP画像: {designs.sp ? '✅ 準備完了' : '❌ 未アップロード'}</div>
                <div>🔄 生成状態: {isGenerating ? '✅ 処理中' : '❌ 待機中'}</div>
                <div style={{marginTop: '5px', fontSize: '11px', color: '#888'}}>
                  💡 ヒント: 大きな画像（50MB以下）もアップロード可能です。サーバーで自動的に最適化されます。
                </div>
              </>
            )}
          </div>
        </div>

        {generatedCode.html && (
          <>
            <CodeGenerator 
              html={generatedCode.html}
              css={generatedCode.css}
              js={generatedCode.js}
              onDownload={handleDownload}
            />
            <CodePreview 
              html={generatedCode.html}
              css={generatedCode.css}
            />
            <IterationPanel
              html={generatedCode.html}
              css={generatedCode.css}
              targetImage={designs.pc}
              onCodeUpdate={handleCodeUpdate}
            />
          </>
        )}
      </main>
      
      <StatusIndicator 
        status={appStatus} 
        message={appStatusMessage} 
      />
    </div>
  );
}

export default App;