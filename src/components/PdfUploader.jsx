import React, { useState, useRef } from 'react';
import StatusIndicator from './StatusIndicator';
import './PdfUploader.css';

function PdfUploader({ type, label, onUpload, onPdfInfo }) {
  const [pdfInfo, setPdfInfo] = useState(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isConverting, setIsConverting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const currentFileRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      currentFileRef.current = file;
      await handlePdfUpload(file);
    } else if (file) {
      setStatus('error');
      setStatusMessage('PDFファイルを選択してください');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handlePdfUpload = async (file) => {
    try {
      setStatus('loading');
      setStatusMessage('PDFファイルを解析中...');
      setUploadProgress(30);

      // ファイルサイズチェック
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('ファイルサイズが50MBを超えています');
      }

      // PDFの情報を取得
      const formData = new FormData();
      formData.append('pdfFile', file);

      const response = await fetch('/api/pdf-info', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'PDF情報の取得に失敗しました');
      }

      const info = await response.json();
      setPdfInfo(info);
      setUploadProgress(60);
      
      // 1ページ目を自動プレビュー
      await convertPdfPage(file, 1);
      
      if (onPdfInfo) {
        onPdfInfo(info);
      }

      setStatus('success');
      setStatusMessage('PDFの読み込みが完了しました');
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error('PDF upload error:', error);
      setStatus('error');
      setStatusMessage(error.message || 'PDFの処理中にエラーが発生しました');
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const convertPdfPage = async (file, page) => {
    setIsConverting(true);
    try {
      setStatusMessage(`${page}ページ目を画像に変換中...`);
      setUploadProgress(80);

      const formData = new FormData();
      formData.append('pdfFile', file);
      formData.append('page', page.toString());
      formData.append('density', '300');

      const response = await fetch('/api/convert-pdf-page', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'PDF変換に失敗しました');
      }

      const result = await response.json();
      setPreviewImage(result.image);
      setUploadProgress(100);
      
      // 親コンポーネントに変換された画像を渡す
      if (onUpload) {
        onUpload(result.image);
      }
    } catch (error) {
      console.error('PDF conversion error:', error);
      setStatus('error');
      setStatusMessage(error.message || 'PDF変換中にエラーが発生しました');
      setTimeout(() => setStatus(null), 5000);
    } finally {
      setIsConverting(false);
      setUploadProgress(0);
    }
  };

  const handlePageChange = async (page) => {
    setSelectedPage(page);
    if (pdfInfo && currentFileRef.current) {
      await convertPdfPage(currentFileRef.current, page);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      // ファイル入力を更新
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      currentFileRef.current = file;
      
      await handlePdfUpload(file);
    } else if (file) {
      setStatus('error');
      setStatusMessage('PDFファイルをドロップしてください');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="pdf-uploader">
      <h3>{label}</h3>
      <div 
        className={`upload-area ${previewImage ? 'has-preview' : ''}`}
        onClick={() => fileInputRef.current.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {previewImage ? (
          <img src={previewImage} alt="PDFプレビュー" />
        ) : (
          <div className="upload-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p>PDFファイルをドラッグ＆ドロップ</p>
            <p className="file-type">最大50MB</p>
          </div>
        )}
      </div>

      {pdfInfo && (
        <div className="pdf-controls">
          <div className="pdf-info">
            <p>📄 {pdfInfo.fileName}</p>
            <p>ページ数: {pdfInfo.pageCount}</p>
            <p>ファイルサイズ: {(pdfInfo.fileSize / 1024 / 1024).toFixed(1)}MB</p>
          </div>
          
          {pdfInfo.pageCount > 1 && (
            <div className="page-selector">
              <label>表示ページ:</label>
              <select 
                value={selectedPage} 
                onChange={(e) => handlePageChange(parseInt(e.target.value))}
                disabled={isConverting}
              >
                {Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).map(page => (
                  <option key={page} value={page}>
                    {page}ページ目
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {isConverting && (
        <div className="converting-indicator">
          <p>PDF変換中...</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <StatusIndicator 
        status={status} 
        message={statusMessage} 
        progress={uploadProgress}
      />
    </div>
  );
}

export default PdfUploader;