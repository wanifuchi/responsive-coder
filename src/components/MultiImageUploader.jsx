import React, { useState, useRef } from 'react';
import './MultiImageUploader.css';

function MultiImageUploader({ type, label, images, onUpload }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );

    if (imageFiles.length === 0) {
      alert('画像ファイルまたはPDFファイルを選択してください');
      return;
    }

    // 複数ファイルの処理
    Promise.all(
      imageFiles.map((file, index) => {
        return new Promise((resolve) => {
          if (file.type === 'application/pdf') {
            // PDFファイルの場合はそのまま返す（サーバーで処理）
            resolve({
              file,
              name: file.name,
              type: 'pdf',
              preview: null,
              index
            });
          } else {
            // 画像ファイルの場合はプレビューを生成
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                file,
                name: file.name,
                type: 'image',
                preview: e.target.result,
                index
              });
            };
            reader.readAsDataURL(file);
          }
        });
      })
    ).then((processedFiles) => {
      onUpload(type, processedFiles);
    });
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onUpload(type, newImages);
  };

  return (
    <div className="multi-image-uploader">
      <h3>{label}</h3>
      
      <div 
        className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
        />
        
        {images && images.length > 0 ? (
          <div className="images-grid">
            {images.map((image, index) => (
              <div key={index} className="image-item">
                {image.type === 'pdf' ? (
                  <div className="pdf-placeholder">
                    <span>📄</span>
                    <p>{image.name}</p>
                  </div>
                ) : (
                  <img src={image.preview} alt={`Preview ${index + 1}`} />
                )}
                <button 
                  className="remove-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                >
                  ✕
                </button>
                <span className="image-index">{index + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="upload-placeholder">
            <div className="upload-icon">📁</div>
            <p>複数の画像またはPDFファイルをドラッグ&ドロップ</p>
            <p>または<strong>クリック</strong>してファイルを選択</p>
            <small>PNG, JPG, GIF, PDF形式対応 / 最大50MB</small>
          </div>
        )}
      </div>

      {images && images.length > 0 && (
        <div className="upload-actions">
          <button className="add-more-button" onClick={handleClick}>
            画像を追加
          </button>
          <p className="file-count">{images.length}個のファイルが選択されています</p>
        </div>
      )}
    </div>
  );
}

export default MultiImageUploader;