@echo off
REM Script de despliegue a Google Cloud Run (Windows)
REM Uso: deploy-cloudrun.bat [PROJECT_ID] [REGION]

setlocal enabledelayedexpansion

REM Configuración
set "PROJECT_ID=%~1"
set "REGION=%~2"
if "%PROJECT_ID%"=="" (
    for /f "tokens=*" %%i in ('gcloud config get-value project 2^>nul') do set "PROJECT_ID=%%i"
)
if "%REGION%"=="" set "REGION=us-central1"
set "SERVICE_NAME=observatorio-scraping"
set "IMAGE_NAME=gcr.io/%PROJECT_ID%/%SERVICE_NAME%"

echo === Despliegue a Google Cloud Run ===
echo.

REM Verificar proyecto
if "%PROJECT_ID%"=="" (
    echo Error: No se especifico el proyecto de GCP.
    echo Uso: deploy-cloudrun.bat PROJECT_ID [REGION]
    exit /b 1
)

echo Proyecto: %PROJECT_ID%
echo Region: %REGION%
echo Servicio: %SERVICE_NAME%
echo.

REM Verificar autenticación
echo Verificando autenticacion...
gcloud auth print-access-token >nul 2>&1
if errorlevel 1 (
    echo No autenticado. Ejecutando gcloud auth login...
    gcloud auth login
)

REM Configurar proyecto
echo Configurando proyecto...
gcloud config set project "%PROJECT_ID%"

REM Habilitar APIs
echo Habilitando APIs necesarias...
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

REM Configurar Docker
echo Configurando Docker para Google Container Registry...
gcloud auth configure-docker

REM Build
echo.
echo Construyendo imagen Docker...
docker build -t "%IMAGE_NAME%:latest" .
if errorlevel 1 (
    echo Error en el build de Docker.
    exit /b 1
)

REM Push
echo.
echo Subiendo imagen a Container Registry...
docker push "%IMAGE_NAME%:latest"
if errorlevel 1 (
    echo Error al subir la imagen.
    exit /b 1
)

REM Variables de entorno
echo.
echo === Variables de entorno requeridas ===
echo.
echo   DEEPSEEK_API_KEY    - API key de DeepSeek
echo   APP_ACCESS_PASSWORD - Password de acceso a la app
echo   AUTH_SECRET         - Secret para tokens de autenticacion
echo.

if "%DEEPSEEK_API_KEY%"=="" (
    set /p DEEPSEEK_API_KEY="DEEPSEEK_API_KEY: "
)
if "%APP_ACCESS_PASSWORD%"=="" (
    set /p APP_ACCESS_PASSWORD="APP_ACCESS_PASSWORD: "
)
if "%AUTH_SECRET%"=="" (
    set /p AUTH_SECRET="AUTH_SECRET (dejar vacio para generar): "
    if "!AUTH_SECRET!"=="" (
        for /f "tokens=*" %%i in ('openssl rand -hex 32') do set "AUTH_SECRET=%%i"
        echo   Generado: !AUTH_SECRET:~0,16!...
    )
)

REM Desplegar
echo.
echo Desplegando a Cloud Run...

gcloud run deploy "%SERVICE_NAME%" ^
    --image "%IMAGE_NAME%:latest" ^
    --platform managed ^
    --region "%REGION%" ^
    --port 3000 ^
    --memory 2Gi ^
    --cpu 2 ^
    --timeout 300 ^
    --max-instances 3 ^
    --min-instances 0 ^
    --allow-unauthenticated ^
    --set-env-vars "NODE_ENV=production,DEEPSEEK_API_KEY=%DEEPSEEK_API_KEY%,APP_ACCESS_PASSWORD=%APP_ACCESS_PASSWORD%,AUTH_SECRET=%AUTH_SECRET%" ^
    --no-cpu-throttling

if errorlevel 1 (
    echo Error en el despliegue.
    exit /b 1
)

REM Obtener URL
echo.
for /f "tokens=*" %%i in ('gcloud run services describe "%SERVICE_NAME%" --region "%REGION%" --format^="value(status.url)"') do set "SERVICE_URL=%%i"

echo === Despliegue completado ===
echo.
echo URL del servicio: %SERVICE_URL%
echo.
echo Comandos utiles:
echo   Ver logs:     gcloud run services logs read %SERVICE_NAME% --region %REGION%
echo   Ver servicio: gcloud run services describe %SERVICE_NAME% --region %REGION%
echo   Eliminar:     gcloud run services delete %SERVICE_NAME% --region %REGION%
echo.
echo Nota: Las sesiones de Instagram/X se pierden en cada reinicio.
echo Los usuarios deberan re-autenticar tras cold starts.

endlocal
