# Dockerfile para Observatorio Digital del Gobierno con Webscraping Local (Playwright)
FROM node:20-bookworm

WORKDIR /app

# Copiar manifiestos e instalar dependencias de Node
COPY package*.json ./
RUN npm ci

# Instalar navegador Chromium y dependencias de sistema operativo de Linux
RUN npx playwright install --with-deps chromium

# Copiar el resto del código fuente del proyecto
COPY . .

# Variables de entorno para producción
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Construir aplicación Next.js
RUN npm run build

# Exponer el puerto 3000
EXPOSE 3000

# Detectar modelos de Ollama y luego iniciar Next.js
CMD ["node", "scripts/start-with-ollama-check.mjs"]
