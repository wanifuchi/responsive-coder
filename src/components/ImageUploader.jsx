import React, { useRef, useState } from 'react';
import StatusIndicator from './StatusIndicator';
import './ImageUploader.css';

function ImageUploader({ type, label, image, onUpload }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        // ファイルサイズチェック
        if (file.size > 50 * 1024 * 1024) {
          setStatus('error');
          setStatusMessage('ファイルサイズが50MBを超えています');
          setTimeout(() => setStatus(null), 3000);
          return;
        }
        
        setStatus('loading');
        setStatusMessage(`${file.name}を読み込み中...`);
        
        onUpload(file);
        
        setTimeout(() => {
          setStatus('success');
          setStatusMessage('アップロード完了');
          setTimeout(() => setStatus(null), 2000);
        }, 500);
      } else {
        setStatus('error');
        setStatusMessage('画像またはPDFファイルを選択してください');
        setTimeout(() => setStatus(null), 3000);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        // ファイルサイズチェック
        if (file.size > 50 * 1024 * 1024) {
          setStatus('error');
          setStatusMessage('ファイルサイズが50MBを超えています');
          setTimeout(() => setStatus(null), 3000);
          return;
        }
        
        setStatus('loading');
        setStatusMessage(`${file.name}を読み込み中...`);
        
        onUpload(file);
        
        setTimeout(() => {
          setStatus('success');
          setStatusMessage('アップロード完了');
          setTimeout(() => setStatus(null), 2000);
        }, 500);
      } else {
        setStatus('error');
        setStatusMessage('画像またはPDFファイルをドロップしてください');
        setTimeout(() => setStatus(null), 3000);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="image-uploader">
      <h3>{label}</h3>
      <div 
        className={`upload-area ${image ? 'has-image' : ''}`}
        onClick={() => fileInputRef.current.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {image ? (
          <img src={image} alt={`${label}プレビュー`} />
        ) : (
          <div className="upload-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p>クリックまたはドラッグ＆ドロップ</p>
            <p className="file-type">PNG, JPG, GIF, PDF</p>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <StatusIndicator 
        status={status} 
        message={statusMessage} 
      />
    </div>
  );
}

export default ImageUploader;