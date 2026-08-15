# --- Stage 1: Build & Prune ---
FROM node:24-alpine AS builder

# Install dependencies sistem
RUN corepack enable && apk add --no-cache openssl

WORKDIR /app

# Copy konfigurasi package
COPY package.json pnpm-lock.yaml ./

# 1. Install SEMUA dependencies (termasuk devDependencies untuk build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# 2. Generate Prisma Client (Binary akan masuk ke node_modules)
RUN npx prisma generate

# 3. Build TypeScript
RUN pnpm build

# 4. Hapus devDependencies agar node_modules jadi ringan untuk production
#    (Langkah ini memastikan kita membawa node_modules yang valid ke stage runner)
RUN pnpm prune --prod

# --- Stage 2: Production Runner ---
FROM node:24-alpine AS runner

WORKDIR /app

# Install dependencies sistem (OpenSSL wajib untuk Prisma)
RUN corepack enable && apk add --no-cache openssl

# Copy file package
COPY package.json pnpm-lock.yaml ./

# --- COPY DARI BUILDER ---
# Copy folder node_modules yang sudah di-prune (bersih & lengkap dengan binary prisma)
COPY --from=builder /app/node_modules ./node_modules

# Copy hasil build kode & schema prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Set Port Koyeb (8000)
ENV PORT=4000
EXPOSE 4000

# Jalankan sebagai non-root (keamanan container)
RUN addgroup -S nyx && adduser -S nyx -G nyx
USER nyx

# Healthcheck: endpoint /health mengembalikan 200 saat siap
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health >/dev/null 2>&1 || exit 1

# Command Start
CMD ["node", "dist/index.js"]