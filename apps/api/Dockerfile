# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps for both workspaces needed at build time
COPY package.json package-lock.json* ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json        ./apps/api/

RUN npm ci --workspace=packages/types --workspace=apps/api --ignore-scripts

# Copy source
COPY packages/types/ ./packages/types/
COPY apps/api/       ./apps/api/

# Build shared types then API
RUN npm run build -w packages/types
RUN npm run build -w apps/api

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules          ./node_modules
COPY --from=builder /app/packages/types/dist   ./packages/types/dist
COPY --from=builder /app/apps/api/dist         ./apps/api/dist
COPY --from=builder /app/apps/api/prisma       ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 3000

# Run migrations then start
CMD sh -c "npx prisma migrate deploy && node dist/main"
