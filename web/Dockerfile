# --- Stage 1: Build React ---
FROM node:24-alpine AS builder

RUN corepack enable
WORKDIR /app

# Copy dependency files — termasuk pnpm-workspace.yaml & package.json packages
# lain yang di-reference workspace (mis. @nyx/shared) agar install tidak gagal.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build React untuk production
# Pastikan env variable VITE_API_URL mengarah ke relative path untuk proxy
ENV VITE_API_URL=/api 
RUN pnpm build

# --- Stage 2: Serve with Nginx ---
FROM nginx:alpine

# Copy hasil build React ke folder Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy konfigurasi Nginx custom kita
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
