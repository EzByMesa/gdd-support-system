FROM node:20-slim

WORKDIR /app

# Зависимости
COPY package.json ./
RUN npm install --omit=dev

# Исходный код
COPY src/ ./src/

# Директории для данных
RUN mkdir -p data attachments

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/app.js"]
