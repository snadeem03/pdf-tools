FROM node:18-alpine

WORKDIR /app

# Install native dependencies required for tesseract.js and sharp on Alpine
RUN apk update && \
    apk add --no-cache tesseract-ocr tzdata

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["node", "server.js"]
