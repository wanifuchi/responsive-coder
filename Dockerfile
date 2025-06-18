FROM node:20-slim

# 必要なシステムパッケージをインストール
RUN apt-get update && apt-get install -y \
    libvips-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# serverディレクトリのpackage.jsonをコピー
COPY server/package*.json ./server/

# 依存関係をインストール
WORKDIR /app/server
RUN npm ci --production || npm install --production

# アプリケーションコードをコピー
WORKDIR /app
COPY . .

# ポートを公開
EXPOSE 3001

# サーバーディレクトリに移動して起動
WORKDIR /app/server
CMD ["npm", "start"]