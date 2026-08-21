# Observatorio Digital del Gobierno

Aplicación web para analizar, bajo demanda, la actividad y la conversación pública asociada al Gobierno de Chile en X e Instagram.

El proyecto obtiene datos mediante Playwright, normaliza y deduplica publicaciones, y genera métricas, análisis de sentimiento, temas y reportes. El análisis de lenguaje puede ejecutarse localmente con Ollama o mediante la API de DeepSeek.

## Funcionalidades

- Extracción local de perfiles, publicaciones, respuestas y comentarios de X e Instagram.
- Autenticación de los scrapers mediante credenciales o cookies guardadas únicamente en `.sessions/`.
- Análisis de sentimiento, temas semánticos, menciones, Share of Voice y rankings.
- Dashboard, explorador con filtros y comparación con una ejecución anterior.
- Exportación a CSV, JSON, PDF y ZIP.
- Configuración de cuentas y persistencia de análisis en el navegador mediante IndexedDB.
- Acceso a la aplicación mediante contraseña y cookie firmada.

## Tecnologías

- Next.js 14, React y TypeScript.
- Playwright para la extracción local.
- Ollama o DeepSeek para el análisis de texto.
- Vitest para pruebas unitarias.
- Docker y Docker Compose para ejecución contenerizada.
*Nota: Ocupé Deepseek porque es bueno, bonito y barato para estas labores. Consideré pysentimiento pero, evalúa el general, no evalúa bien el sentimiento hacia una marca, keyword, o en este caso, un ministro.

## Requisitos

- Node.js 20 o superior.
- npm.
- Chromium para Playwright.
- Ollama, si se utilizará el proveedor local.

## Ejecución local

1. Instala las dependencias:

   ```bash
   npm ci
   npx playwright install chromium
   ```

2. Crea la configuración local. En PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   En macOS o Linux:

   ```bash
   cp .env.example .env.local
   ```

3. Edita `.env.local`. Para usar Ollama con la configuración predeterminada:

   ```bash
   ollama pull gemma3:1b
   ```

4. Inicia la aplicación y abre <http://localhost:3000>:

   ```bash
   npm run dev
   ```

Las sesiones de X e Instagram se crean desde la interfaz y se guardan en `.sessions/`. Ese directorio puede contener cookies activas y nunca debe versionarse ni compartirse.

## Ejecución con Docker

Docker Compose usa `.env` como archivo local de variables:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

La aplicación queda disponible en <http://localhost:3000>. Compose monta `.sessions/` como volumen local para conservar la autenticación de los scrapers entre reinicios. Tanto `.env` como `.sessions/` están excluidos del repositorio y del contexto de construcción de Docker.

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `LLM_PROVIDER` | Proveedor de análisis: `ollama` o `deepseek`. |
| `OLLAMA_HOST` | URL de Ollama. Por defecto, `http://127.0.0.1:11434`. |
| `OLLAMA_MODEL` | Modelo local. Por defecto, `gemma3:1b`. |
| `OLLAMA_STARTUP_RETRIES` | Intentos de conexión al iniciar con Ollama. |
| `DEEPSEEK_API_KEY` | API key requerida cuando se usa DeepSeek. |
| `DEEPSEEK_MODEL` | Modelo de DeepSeek. Por defecto, `deepseek-chat`. |
| `APP_ACCESS_PASSWORD` | Contraseña de acceso; obligatoria en producción. |
| `AUTH_SECRET` | Secreto largo y aleatorio para firmar la cookie; obligatorio en producción. |
| `NEXT_PUBLIC_APP_NAME` | Nombre mostrado por la aplicación. |
| `NEXT_PUBLIC_USE_DEMO_DATA` | Activa el modo demo cuando vale `true`. |
| `MAX_X_POSTS_PER_ACCOUNT` | Máximo de publicaciones de X por cuenta. |
| `MAX_INSTAGRAM_POSTS_PER_ACCOUNT` | Máximo de publicaciones de Instagram por cuenta. |
| `MAX_COMMENTS_PER_POST` | Máximo de comentarios o respuestas por publicación. |
| `MAX_SEARCH_RESULTS` | Máximo de resultados de búsqueda. |
| `MAX_DEEPSEEK_ITEMS` | Máximo de elementos enviados al análisis de texto. |
| `MAX_DEEPSEEK_BATCH_SIZE` | Tamaño máximo de cada lote de análisis. |

En producción, configura estas variables mediante el panel o gestor de secretos del proveedor. No copies ningún archivo `.env` dentro de la imagen ni lo agregues al repositorio.

## Seguridad antes de publicar

- `.env`, sus variantes y `.sessions/` están ignorados por Git.
- Las cookies de X e Instagram equivalen a credenciales activas: no deben enviarse por correo, adjuntarse a incidencias ni incorporarse a reportes.
- `.env.example` solo contiene nombres de variables y valores de ejemplo no sensibles.
- Si una credencial o cookie llegó a un commit anterior, ignorar el archivo no la elimina del historial. Revoca o rota primero la credencial y limpia el historial antes de hacer público el repositorio.

## Configuración de cuentas

La lista inicial de ministros se encuentra en `config/accounts.ts`. Desde **Configuración** se pueden editar usuarios de X e Instagram, aliases y cuentas activas, además de importar o exportar CSV. Los cambios se guardan en el navegador y no se comparten automáticamente entre dispositivos.

## Privacidad y metodología

La aplicación procesa contenido público recuperado desde los proveedores configurados. No intenta identificar personas anónimas, inferir atributos sensibles ni crear perfiles individuales. Los indicadores describen la muestra recuperada y no representan una encuesta de opinión pública.

El engagement principal corresponde a `likes + comentarios`; el engagement ampliado agrega compartidos, reposts y citas. Los resultados de X e Instagram deben interpretarse según los mecanismos y límites propios de cada plataforma.

## Verificación

```bash
npm test
npm run build
```

Antes de una ejecución de alto volumen, revisa los límites configurados y las condiciones de uso de cada plataforma.
