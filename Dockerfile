FROM node:20-alpine

WORKDIR /app

# serverディレクトリのコードをコピー
COPY server ./server

# 依存関係をインストール（sharpをスキップ）
WORKDIR /app/server
RUN npm install --production --omit=optional

# ポートを公開
EXPOSE 3001

# 起動
CMD ["node", "index.js"]