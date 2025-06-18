import React, { useState } from 'react';
import './CodeGenerator.css';

function CodeGenerator({ html, css, js, onDownload }) {
  const [activeTab, setActiveTab] = useState('html');

  const getCurrentCode = () => {
    switch (activeTab) {
      case 'html': return html;
      case 'css': return css;
      case 'js': return js || '';
      default: return '';
    }
  };

  const copyToClipboard = () => {
    const code = getCurrentCode();
    navigator.clipboard.writeText(code).then(() => {
      alert(`${activeTab.toUpperCase()}コードをコピーしました！`);
    });
  };

  return (
    <div className="code-generator">
      <div className="code-header">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'html' ? 'active' : ''}`}
            onClick={() => setActiveTab('html')}
          >
            HTML
          </button>
          <button 
            className={`tab ${activeTab === 'css' ? 'active' : ''}`}
            onClick={() => setActiveTab('css')}
          >
            CSS
          </button>
          {js && (
            <button 
              className={`tab ${activeTab === 'js' ? 'active' : ''}`}
              onClick={() => setActiveTab('js')}
            >
              JavaScript
            </button>
          )}
        </div>
        <div className="actions">
          <button 
            className="copy-button"
            onClick={copyToClipboard}
          >
            コピー
          </button>
          <button 
            className="download-button"
            onClick={onDownload}
          >
            ダウンロード
          </button>
        </div>
      </div>
      <div className="code-content">
        <pre>
          <code>
            {getCurrentCode()}
          </code>
        </pre>
      </div>
    </div>
  );
}

export default CodeGenerator;