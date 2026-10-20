# syntax=docker/dockerfile:1

# ---- Client: Vite build -> static files ----
FROM node:24-alpine AS client
WORKDIR /build
COPY shared ./shared
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --no-audit --no-fund
COPY client ./client
RUN cd client && npm run build

# ---- Server: TypeScript build + production dependencies ----
FROM node:24-alpine AS server
WORKDIR /build
COPY shared ./shared
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --no-audit --no-fund
COPY server ./server
RUN cd server && npm run build && npm prune --omit=dev

# ---- Runtime: only compiled server, prod node_modules and the built client ----
FROM node:24-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3090 \
    STATIC_DIR=/app/public \
    DB_PATH=/data/tank90.sqlite
WORKDIR /app
COPY --from=server --chown=root:root /build/server/package.json ./package.json
COPY --from=server --chown=root:root /build/server/node_modules ./node_modules
COPY --from=server --chown=root:root /build/server/dist ./dist
COPY --from=client --chown=root:root /build/client/dist ./public
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3090
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3090/healthz >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server/src/index.js"]
