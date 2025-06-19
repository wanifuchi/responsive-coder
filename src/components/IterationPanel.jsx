import React, { useState } from 'react';
import './IterationPanel.css';

function IterationPanel({ html, css, targetImage, onCodeUpdate }) {
  const [isIterating, setIsIterating] = useState(false);
  const [iterations, setIterations] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedIteration, setSelectedIteration] = useState(null);

  const handleStartIteration = async () => {
    console.log('Starting iteration...', { html: !!html, css: !!css, targetImage: !!targetImage });
    
    if (!html || !css || !targetImage) {
      alert('コードと目標画像が必要です');
      return;
    }

    setIsIterating(true);
    setIterations([]);

    try {
      // まず現在のコードのスクリーンショットを取得
      console.log('Taking screenshot...');
      const API_URL = 'https://responsive-coder-production.up.railway.app';
      
      const screenshotRes = await fetch(`${API_URL}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, css })
      });

      if (!screenshotRes.ok) {
        throw new Error(`Screenshot API error: ${screenshotRes.status}`);
      }

      const screenshotData = await screenshotRes.json();
      console.log('Screenshot taken:', !!screenshotData.screenshot);
      const { screenshot } = screenshotData;

      // 初回の状態を追加
      setIterations([{
        iteration: 0,
        html,
        css,
        screenshot,
        diffPercentage: 100
      }]);

      // イテレーション処理を開始
      console.log('Starting iteration API call...');
      const formData = new FormData();
      const targetBlob = await fetch(targetImage).then(r => r.blob());
      formData.append('targetImage', targetBlob);
      formData.append('html', html);
      formData.append('css', css);
      formData.append('maxIterations', '5');

      console.log('FormData prepared, calling /api/iterate...');
      const response = await fetch(`${API_URL}/api/iterate`, {
        method: 'POST',
        body: formData
      });

      console.log('Iteration API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Iteration API error:', errorText);
        
        // 緊急修正: より詳細なエラー情報を解析
        let detailedError = `イテレーション処理に失敗しました: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.details) {
            detailedError = `${errorData.error}: ${errorData.details}`;
          }
        } catch (parseError) {
          // JSONパースに失敗した場合はそのまま
        }
        
        throw new Error(detailedError);
      }

      const result = await response.json();
      console.log('Iteration result:', result);
      setIterations(prev => [...prev, ...result.iterations]);
      
    } catch (error) {
      console.error('Iteration error:', error);
      alert(`イテレーション処理中にエラーが発生しました: ${error.message}`);
    } finally {
      setIsIterating(false);
    }
  };

  const handleCompareImages = async (iteration) => {
    setSelectedIteration(iteration);
    setShowComparison(true);
  };

  const handleUseCode = (iteration) => {
    if (onCodeUpdate) {
      onCodeUpdate({
        html: iteration.html,
        css: iteration.css,
        js: '' // イテレーションではJavaScriptは変更しない
      });
      alert(`イテレーション ${iteration.iteration} のコードを適用しました！`);
    }
  };

  return (
    <div className="iteration-panel">
      <div className="panel-header">
        <h3>自動改善イテレーション</h3>
        <button 
          className="iterate-button"
          onClick={handleStartIteration}
          disabled={isIterating || !html || !css || !targetImage}
        >
          {isIterating ? 'イテレーション中...' : 'イテレーション開始'}
        </button>
      </div>

      {iterations.length > 0 && (
        <div className="iterations-timeline">
          {iterations.map((iter, index) => (
            <div key={index} className="iteration-item">
              <div className="iteration-header">
                <h4>イテレーション {iter.iteration}</h4>
                <span className={`diff-badge ${iter.diffPercentage < 10 ? 'good' : iter.diffPercentage < 30 ? 'moderate' : 'poor'}`}>
                  差分: {iter.diffPercentage.toFixed(1)}%
                </span>
              </div>
              
              <div className="iteration-content">
                <div className="screenshot-preview">
                  <img src={iter.screenshot} alt={`イテレーション ${iter.iteration}`} />
                </div>
                
                <div className="iteration-actions">
                  <button onClick={() => handleCompareImages(iter)}>
                    元画像と比較
                  </button>
                  <button 
                    className="use-code-button"
                    onClick={() => handleUseCode(iter)}
                  >
                    このコードを使用
                  </button>
                </div>
              </div>

              {iter.diffImage && showComparison && selectedIteration === iter && (
                <div className="comparison-overlay" onClick={() => setShowComparison(false)}>
                  <div className="comparison-modal" onClick={e => e.stopPropagation()}>
                    <h3>差分画像</h3>
                    <img src={iter.diffImage} alt="差分" />
                    <button onClick={() => setShowComparison(false)}>閉じる</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {iterations.length > 0 && (
        <div className="iteration-summary">
          <p>
            {iterations.length}回のイテレーションで差分を
            {iterations[0].diffPercentage.toFixed(1)}%から
            {iterations[iterations.length - 1].diffPercentage.toFixed(1)}%に改善しました
          </p>
        </div>
      )}
    </div>
  );
}

export default IterationPanel;