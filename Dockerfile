# Dockerfile para Observatorio Digital del Gobierno con Webscraping Local (Playwright)
FROM node:20-bookworm AS base

WORKDIR /app

# Etapa 1: Dependencias de Node
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Etapa 2: Builder (Playwright + Next.js build)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Instalar Chromium y dependencias de sistema operativo para Playwright
RUN npx playwright install --with-deps chromium

# Copiar el código después de la capa pesada para conservar la caché de Chromium
COPY . .

# Compilar la aplicación Next.js
RUN npm run build

# Etapa 3: Runner (Producción) — imagen slim para reducir tamaño
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Dependencias de sistema mínimas para Chromium headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Copiar solo el headless shell de Playwright (el chromium completo no se usa en headless:true)
COPY --from=builder /root/.cache/ms-playwright/chromium_headless_shell-1234 /root/.cache/ms-playwright/chromium_headless_shell-1234

# Copiar archivos compilados y dependencias de la aplicación
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apify ./apify

EXPOSE 3000

CMD ["node", "server.js"]
