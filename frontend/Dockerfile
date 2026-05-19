# syntax=docker/dockerfile:1.7

############################
# 1. Build SPA bằng Vite
############################
FROM node:22-alpine AS builder
WORKDIR /app

# Vite bake biến VITE_* vào bundle lúc build => phải truyền qua build arg.
# Mặc định "/api" để nginx của frontend reverse-proxy sang backend (same-origin, không cần CORS).
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Chỉ chạy vite build, KHÔNG chạy vue-tsc song song.
# Lý do: `npm run build` = `run-p type-check build-only` -> chạy vue-tsc + vite cùng lúc,
# trên VPS RAM thấp (<= 2GB) sẽ bị OOM kill (exit 137).
# Type-check là việc của dev/CI, không phải của bước deploy.
RUN npm run build-only

############################
# 2. Phục vụ static bằng nginx
############################
FROM nginx:1.27-alpine AS runner

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx","-g","daemon off;"]
