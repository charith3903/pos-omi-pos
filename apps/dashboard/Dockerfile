# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY packages/types/package.json    ./packages/types/
COPY apps/dashboard/package.json    ./apps/dashboard/

RUN npm ci --workspace=packages/types --workspace=apps/dashboard --ignore-scripts

COPY packages/types/ ./packages/types/
COPY apps/dashboard/ ./apps/dashboard/

RUN npm run build -w packages/types
RUN npm run build -w apps/dashboard

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app/apps/dashboard
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/dashboard/.next          ./.next
COPY --from=builder /app/apps/dashboard/public         ./public
COPY --from=builder /app/apps/dashboard/package.json   ./package.json
COPY --from=builder /app/apps/dashboard/node_modules   ./node_modules

EXPOSE 3001
CMD ["npm", "start"]
