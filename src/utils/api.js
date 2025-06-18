// API設定
export const API_URL = import.meta.env.PROD 
  ? import.meta.env.VITE_API_URL 
  : '';

// APIヘルパー関数
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP error! status: ${response.status}`
      }));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
};

// 特定のAPI呼び出し
export const generateCode = async (formData) => {
  return apiCall('/api/generate-code', {
    method: 'POST',
    body: formData
  });
};

export const takeScreenshot = async (html, css, device = 'desktop') => {
  return apiCall('/api/screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, css, device })
  });
};

export const iterateDesign = async (formData) => {
  return apiCall('/api/iterate', {
    method: 'POST',
    body: formData
  });
};