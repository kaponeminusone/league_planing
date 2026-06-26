# Build frontend + download game assets
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:vercel

# Production: static app + WebSocket sync on one port
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV DIST_PATH=/app/dist
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 10000

CMD ["node", "server/sync-server.mjs"]
