FROM node:20-alpine

# Puppeteer用の依存関係をインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteerが使用するChromiumのパスを指定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app/server

# serverディレクトリのコードをコピー
COPY server .

# 依存関係をインストール
RUN npm install --production --omit=optional

# ポートを公開
EXPOSE 3001

# 起動
CMD ["node", "index.js"]