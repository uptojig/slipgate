# syntax=docker/dockerfile:1.7
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept every env that EasyPanel passes via --build-arg. We don't need their
# real values at build time (postgres-js is lazy; TMN tokens are read at
# request time), but declaring ARG silences "unknown arg" warnings and lets
# NEXT_PUBLIC_* values be inlined into the client bundle when present.
ARG DATABASE_URL
ARG AUTH_SECRET
ARG AUTH_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ADMIN_TMN_PHONE
ARG SLIP_OCR_MODEL
ARG TMN_WEBHOOK_AUTH_KEY
ARG TMN_WEBHOOK_JWT_SECRET
ARG TMN_P2P_VALIDATE_TOKEN
ARG TMN_LAST_RECEIVE_TOKEN
ARG TMN_BALANCE_TOKEN
ARG TMN_TRANSFER_LINK_TOKEN
ARG TMN_QR_INFO_TOKEN
ARG AI_GATEWAY_API_KEY
ARG GIT_SHA
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_ADMIN_TMN_PHONE=${NEXT_PUBLIC_ADMIN_TMN_PHONE}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
