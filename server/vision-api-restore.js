// Vision API復活用関数

// Gemini APIを使用したコード生成
export async function generateWithGemini(pcImage, spImage, referenceUrl) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  try {
    // 画像をBase64に変換
    const { imageToBase64WithJimp } = await import('./image-processor-jimp.js');
    const pcBase64 = await imageToBase64WithJimp(pcImage);
    const spBase64 = await imageToBase64WithJimp(spImage);
    
    const pcImageData = pcBase64.includes(',') ? pcBase64.split(',')[1] : pcBase64;
    const spImageData = spBase64.includes(',') ? spBase64.split(',')[1] : spBase64;
    
    const prompt = `あなたは世界最高レベルのUI/UXデザイナー兼フロントエンドエンジニアです。

**🎯 最重要ミッション**: 提供された画像のデザインを100%忠実に再現するHTML/CSS/JavaScriptコードを生成してください。

## 画像解析要件:
1. **レイアウト**: 画像内の全要素の配置を正確に再現
2. **色彩**: 全ての色を正確に抽出し、#記号付きの16進数で使用
3. **テキスト**: 画像内の全テキストを一字一句正確に読み取って使用
4. **画像**: 適切なUnsplash URLを使用（https://images.unsplash.com/...）
5. **レスポンシブ**: PC版とSP版の両方に対応

## 出力形式（JSON）:
{
  "html": "<!DOCTYPE html>から始まる完全なHTML（外部CSS/JS参照）",
  "css": "完全なCSSファイル",
  "js": "インタラクティブなJavaScript"
}

重要: 画像内のデザインを正確に再現することが最優先です。`;

    const result = await geminiModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: pcImageData
        }
      },
      "PC版デザインを詳細に分析してください",
      {
        inlineData: {
          mimeType: "image/jpeg", 
          data: spImageData
        }
      },
      "SP版デザインを詳細に分析してください"
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    // JSONを抽出
    let parsedResult;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                     text.match(/```\s*([\s\S]*?)\s*```/) ||
                     text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonString = jsonMatch[1] || jsonMatch[0];
      try {
        parsedResult = JSON.parse(jsonString);
      } catch (e) {
        console.error('JSON parse error:', e);
        parsedResult = { html: text, css: '', js: '' };
      }
    } else {
      parsedResult = { html: text, css: '', js: '' };
    }
    
    // サニタイズ
    return {
      html: sanitizeHTML(parsedResult.html || ''),
      css: sanitizeCSS(parsedResult.css || ''),
      js: sanitizeJS(parsedResult.js || '')
    };
    
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

// OpenAI APIを使用したコード生成
export async function generateWithOpenAI(pcImage, spImage, referenceUrl) {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  try {
    const { imageToBase64WithJimp } = await import('./image-processor-jimp.js');
    const pcBase64 = await imageToBase64WithJimp(pcImage);
    const spBase64 = await imageToBase64WithJimp(spImage);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `あなたは世界最高レベルのUI/UXデザイナー兼フロントエンドエンジニアです。
提供された画像デザインをピクセル単位で正確に分析し、完全に一致するHTML/CSSコードを生成してください。

必ず以下のJSON形式で返答してください：
{
  "html": "完全なHTMLコード",
  "css": "完全なCSSコード", 
  "js": "JavaScriptコード"
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "以下のPC版とSP版のデザインを完全に再現するコードを生成してください"
            },
            {
              type: "image_url",
              image_url: {
                url: pcBase64,
                detail: "high"
              }
            },
            {
              type: "image_url",
              image_url: {
                url: spBase64,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    });
    
    const content = response.choices[0].message.content;
    let parsedResult;
    
    try {
      parsedResult = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', e);
      parsedResult = { html: content, css: '', js: '' };
    }
    
    return {
      html: sanitizeHTML(parsedResult.html || ''),
      css: sanitizeCSS(parsedResult.css || ''),
      js: sanitizeJS(parsedResult.js || '')
    };
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// サニタイズ関数
function sanitizeGeneratedCode(codeObject) {
  if (!codeObject || typeof codeObject !== 'object') {
    return { html: '', css: '', js: '' };
  }
  
  return {
    html: sanitizeHTML(codeObject.html || ''),
    css: sanitizeCSS(codeObject.css || ''),
    js: sanitizeJS(codeObject.js || '')
  };
}

function sanitizeHTML(html) {
  if (!html) return '';
  
  let sanitized = html;
  
  // 色コードエラー防止
  sanitized = sanitized.replace(/href\s*=\s*["']([0-9a-fA-F]{6})["']/g, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']([0-9a-fA-F]{6})["']/g, 'src="https://via.placeholder.com/400x300"');
  
  return sanitized;
}

function sanitizeCSS(css) {
  if (!css) return '';
  
  let sanitized = css;
  
  // 色コードに#を追加
  sanitized = sanitized.replace(/color\s*:\s*([0-9a-fA-F]{6})([;\s}])/g, 'color: #$1$2');
  sanitized = sanitized.replace(/background-color\s*:\s*([0-9a-fA-F]{6})([;\s}])/g, 'background-color: #$1$2');
  
  return sanitized;
}

function sanitizeJS(js) {
  if (!js) return '';
  
  // HTML混入防止
  if (js.includes('<!DOCTYPE') || js.includes('<html')) {
    return `// Generated JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded successfully');
});`;
  }
  
  return js;
}