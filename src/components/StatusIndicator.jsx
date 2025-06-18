import React from 'react';
import './StatusIndicator.css';

function StatusIndicator({ status, message, progress }) {
  if (!status) return null;

  return (
    <div className={`status-indicator ${status}`}>
      <div className="status-content">
        {status === 'loading' && (
          <>
            <div className="spinner"></div>
            <p>{message || '処理中...'}</p>
            {progress && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </>
        )}
        
        {status === 'success' && (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <p>{message || '完了しました'}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>{message || 'エラーが発生しました'}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default StatusIndicator;