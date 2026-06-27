# Build frontend + download game assets
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:vercel

# Production: static app + WebSocket sync on one port
# bookworm-slim (Debian) — Alpine/OpenSSL rompe TLS con MongoDB Atlas en Render
FROM node:22-bookworm-slim AS production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV DIST_PATH=/app/dist
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 10000

CMD ["node", "server/sync-server.mjs"]
