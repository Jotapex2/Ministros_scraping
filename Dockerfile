# Dockerfile para Observatorio Digital del Gobierno con Webscraping Local (Playwright)
FROM mcr.microsoft.com/playwright/node:20-jammy AS base

WORKDIR /app

# Copiar manifiestos e instalar dependencias de Node
COPY package*.json ./
RUN npm ci

# Instalar navegadores de Playwright con sus dependencias de Linux
RUN npx playwright install --with-deps chromium

# Copiar el resto del código fuente del proyecto
COPY . .

# Variables de entorno por defecto para producción
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Construir aplicación Next.js
RUN npm run build

# Exponer el puerto 3000
EXPOSE 3000

# Iniciar servidor Next.js
CMD ["npm", "start"]
