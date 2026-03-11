# Backend — production-optimized
FROM node:24-alpine AS base
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nodejs -G nodejs
WORKDIR /app

# Install dependencies (production only)
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Generate Prisma client
FROM base AS prisma
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN npx prisma generate

# Final image: app only
FROM base AS runner
ENV NODE_ENV=production
USER nodejs

COPY --from=prisma /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY src ./src

# Prisma client already generated in prisma stage
EXPOSE 25044

CMD ["node", "src/index.js"]
