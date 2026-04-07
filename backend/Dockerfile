# Backend — production-optimized, minimal image
# Prisma: generate in builder (full deps), runner gets only @prisma/client + generated output

FROM node:24-slim AS builder
WORKDIR /app
# Prisma needs OpenSSL; slim image doesn't include it
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Full install so prisma CLI is available (it's devDependency in lockfile)
COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# Runner: production deps only, no prisma CLI; OpenSSL for Prisma engine
FROM node:24-slim AS runner
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --create-home nodejs
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies (as root), then hand over to nodejs
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY src ./src
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chown -R nodejs:nodejs /app && chmod +x /docker-entrypoint.sh

EXPOSE 25044
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]