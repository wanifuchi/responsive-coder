import React, { useState, useRef } from 'react';
import ImageUploader from './ImageUploader';
import PdfUploader from './PdfUploader';
import './FileUploader.css';

function FileUploader({ type, label, design, onUpload }) {
  const [uploadMode, setUploadMode] = useState('image'); // 'image' or 'pdf'

  return (
    <div className="file-uploader">
      <div className="upload-mode-selector">
        <button
          className={`mode-button ${uploadMode === 'image' ? 'active' : ''}`}
          onClick={() => setUploadMode('image')}
        >
          画像アップロード
        </button>
        <button
          className={`mode-button ${uploadMode === 'pdf' ? 'active' : ''}`}
          onClick={() => setUploadMode('pdf')}
        >
          PDFアップロード
        </button>
      </div>

      {uploadMode === 'image' ? (
        <ImageUploader
          type={type}
          label={label}
          image={design}
          onUpload={(file) => onUpload(type, file)}
        />
      ) : (
        <PdfUploader
          type={type}
          label={label}
          onUpload={(dataUrl) => onUpload(type, dataUrl)}
        />
      )}
    </div>
  );
}

export default FileUploader;