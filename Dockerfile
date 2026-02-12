# ─── Stage 1: Build ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Required for bcrypt native compilation
RUN apk add --no-cache python3 make g++

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Stage 2: Production ────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Required for bcrypt native binding
RUN apk add --no-cache python3 make g++

# Install production dependencies only (skip prepare/husky scripts)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt && \
    npm cache clean --force

# Remove build tools after install to reduce image size
RUN apk del python3 make g++

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs
USER expressjs

EXPOSE 8000

CMD ["node", "dist/server.js"]
