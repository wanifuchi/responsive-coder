import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
// 画像処理にJimpを使用（Pure JavaScript）
import Jimp from 'jimp';
import { imageToBase64WithJimp } from './image-processor-jimp.js';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { takeScreenshot, compareImages, iterateDesign } from './screenshot.js';
import { convertPdfToImage, getPdfPageCount, cleanupTempFiles, convertPdfToMultipleImages, combineImagesVertically } from './pdfProcessor.js';
import { 
  generateSidebarLayout, 
  generateMultiColumnContent, 
  generateFooter, 
  generatePixelPerfectCSS, 
  generateInteractiveJS,
  getUltraBasicTemplate,
  adjustColor
} from './image-analysis-helpers.js';
import { PixelPerfectEngine } from './pixel-perfect-engine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// 最小限の設定でサーバーを起動
app.use(express.json());
app.use(cors());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 EMERGENCY SERVER running at http://localhost:${port}`);
  console.log('✅ Basic server started successfully');
});