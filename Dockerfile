FROM node:20-alpine

# Alpine Linux用のパッケージをインストール
RUN apk add --no-cache \
    vips-dev \
    build-base \
    python3

WORKDIR /app

# serverディレクトリのpackage.jsonをコピー
COPY server/package*.json ./server/

# 依存関係をインストール（sharpは事前ビルド版を使用）
WORKDIR /app/server
RUN npm install --production --platform=linux --arch=x64 sharp
RUN npm ci --production || npm install --production

# アプリケーションコードをコピー
WORKDIR /app
COPY . .

# ポートを公開
EXPOSE 3001

# サーバーディレクトリに移動して起動
WORKDIR /app/server
CMD ["npm", "start"]