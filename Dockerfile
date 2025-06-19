FROM node:20-alpine

# Playwright/Puppeteer用の依存関係をインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteer/Playwright用の環境変数
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BROWSERS_PATH=0

WORKDIR /app/server

# serverディレクトリのコードをコピー
COPY server .

# 依存関係をインストール
RUN npm install --production --omit=optional

# ポートを公開
EXPOSE 3001

# 起動
CMD ["node", "index.js"]