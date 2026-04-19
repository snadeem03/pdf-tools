# Stage 1: Build React/Vite app
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
# We use Docker build arguments or environment variables to point API to backend if needed
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts to nginx folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default nginx config to support React Router (SPA fallback)
RUN echo "server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files \$uri \$uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://backend:3001/api/; \
        proxy_set_header Host \$host; \
        proxy_set_header X-Real-IP \$remote_addr; \
        client_max_body_size 50M; \
    } \
}" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
