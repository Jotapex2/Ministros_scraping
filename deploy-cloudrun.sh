#!/bin/bash
# Script de despliegue a Google Cloud Run
# Uso: ./deploy-cloudrun.sh [PROJECT_ID] [REGION]

set -e

# Configuración - editar estos valores
PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${2:-us-central1}"
SERVICE_NAME="observatorio-scraping"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Despliegue a Google Cloud Run ===${NC}"
echo ""

# Verificar que gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI no está instalado.${NC}"
    echo "Instala Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar proyecto
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No se especificó el proyecto de GCP.${NC}"
    echo "Uso: ./deploy-cloudrun.sh PROJECT_ID [REGION]"
    echo "O ejecuta: gcloud config set project PROJECT_ID"
    exit 1
fi

echo -e "${YELLOW}Proyecto:${NC} ${PROJECT_ID}"
echo -e "${YELLOW}Región:${NC} ${REGION}"
echo -e "${YELLOW}Servicio:${NC} ${SERVICE_NAME}"
echo ""

# Verificar autenticación
echo "Verificando autenticación..."
if ! gcloud auth print-access-token &> /dev/null; then
    echo -e "${YELLOW}No autenticado. Ejecutando gcloud auth login...${NC}"
    gcloud auth login
fi

# Configurar proyecto
echo "Configurando proyecto..."
gcloud config set project "$PROJECT_ID"

# Habilitar APIs necesarias
echo "Habilitando APIs necesarias..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com

# Configurar Docker para push a GCR
echo "Configurando Docker para Google Container Registry..."
gcloud auth configure-docker

# Build de la imagen
echo ""
echo -e "${GREEN}Construyendo imagen Docker...${NC}"
docker build -t "${IMAGE_NAME}:latest" .

# Push a GCR
echo ""
echo -e "${GREEN}Subiendo imagen a Container Registry...${NC}"
docker push "${IMAGE_NAME}:latest"

# Verificar si el servicio ya existe
echo ""
if gcloud run services describe "$SERVICE_NAME" --region "$REGION" &> /dev/null; then
    echo -e "${YELLOW}Servicio existente encontrado. Actualizando...${NC}"
    ACTION="services update"
else
    echo -e "${GREEN}Creando nuevo servicio...${NC}"
    ACTION="services create"
fi

# Variables de entorno requeridas
echo ""
echo -e "${YELLOW}=== Variables de entorno requeridas ===${NC}"
echo "Se necesitan las siguientes variables para el despliegue:"
echo ""
echo "  DEEPSEEK_API_KEY    - API key de DeepSeek"
echo "  APP_ACCESS_PASSWORD - Password de acceso a la app"
echo "  AUTH_SECRET         - Secret para tokens de autenticación"
echo ""

# Solicitar variables si no están en el entorno
if [ -z "$DEEPSEEK_API_KEY" ]; then
    read -rp "DEEPSEEK_API_KEY: " DEEPSEEK_API_KEY
fi
if [ -z "$APP_ACCESS_PASSWORD" ]; then
    read -rp "APP_ACCESS_PASSWORD: " APP_ACCESS_PASSWORD
fi
if [ -z "$AUTH_SECRET" ]; then
    read -rp "AUTH_SECRET (dejar vacío para generar): " AUTH_SECRET
    if [ -z "$AUTH_SECRET" ]; then
        AUTH_SECRET=$(openssl rand -hex 32)
        echo "  Generado: ${AUTH_SECRET:0:16}..."
    fi
fi

# Desplegar a Cloud Run
echo ""
echo -e "${GREEN}Desplegando a Cloud Run...${NC}"

gcloud run deploy "$SERVICE_NAME" \
    --image "${IMAGE_NAME}:latest" \
    --platform managed \
    --region "$REGION" \
    --port 3000 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --max-instances 3 \
    --min-instances 0 \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY},APP_ACCESS_PASSWORD=${APP_ACCESS_PASSWORD},AUTH_SECRET=${AUTH_SECRET}" \
    --no-cpu-throttling

# Obtener URL del servicio
echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')

echo -e "${GREEN}=== Despliegue completado ===${NC}"
echo ""
echo -e "URL del servicio: ${GREEN}${SERVICE_URL}${NC}"
echo ""
echo "Comandos útiles:"
echo "  Ver logs:     gcloud run services logs read $SERVICE_NAME --region $REGION"
echo "  Ver servicio: gcloud run services describe $SERVICE_NAME --region $REGION"
echo "  Eliminar:     gcloud run services delete $SERVICE_NAME --region $REGION"
echo ""
echo -e "${YELLOW}Nota:${NC} Las sesiones de Instagram/X se pierden en cada reinicio."
echo "Los usuarios deberán re-autenticar tras cold starts."
