# Catering frontend — production: build then serve with nginx

# Stage 1: build
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Limit Node heap for low-RAM servers (e.g. 1 GB); split build to reduce peak memory (tsc then vite)
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npx tsc -b
RUN npx vite build --config config/vite.config.ts

# Stage 2: serve static files
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
