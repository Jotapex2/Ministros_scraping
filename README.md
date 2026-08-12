# Observatorio Digital del Gobierno

Aplicación web stateless para analizar, bajo demanda, actividad y conversación pública asociada al Gobierno de Chile en X e Instagram.

## Características

- Integración server-side con TwitterAPI.io, Apify y DeepSeek.
- Datos normalizados, deduplicación, comentarios/replies y perfiles de seguidores.
- Sentimiento dirigido al objeto evaluado, temas semánticos, menciones, Share of Voice y rankings.
- Dashboard progresivo, explorador con filtros y calidad de datos por proveedor.
- Exportaciones CSV compatibles con Excel, JSON de sesión, informe PDF y ZIP completo.
- Sin base de datos ni persistencia en el servidor. La ejecución y la configuración editable viven en el navegador.
- Acceso mediante contraseña y cookie firmada, sin cuentas de usuario.

## Puesta en marcha

1. Instale Node.js 20 o superior.
2. Ejecute `npm install`.
3. Copie `.env.example` a `.env.local` y complete las credenciales.
4. Ejecute `npm run dev` y abra `http://localhost:3000`.

Para producción, importe el repositorio en Vercel, configure las mismas variables de entorno y despliegue como proyecto Next.js.

## Variables de entorno

| Variable                    | Uso                                                                         |
| --------------------------- | --------------------------------------------------------------------------- |
| `TWITTERAPI_IO_KEY`         | Perfiles, timelines, búsquedas y replies de X.                              |
| `APIFY_API_TOKEN`           | Autorización de runs y datasets Apify.                                      |
| `TWITTER_APIFY_ACTOR_ID`    | Actor opcional de respaldo para X.                                          |
| `INSTAGRAM_APIFY_ACTOR_ID`  | ID del Actor propio de Instagram.                                           |
| `DEEPSEEK_API_KEY`          | Sentimiento y temas.                                                        |
| `DEEPSEEK_MODEL`            | Modelo; por defecto `deepseek-chat`.                                        |
| `APP_ACCESS_PASSWORD`       | Clave para entrar a la aplicación. Obligatoria en producción.               |
| `AUTH_SECRET`               | Secreto largo y aleatorio para firmar la cookie. Obligatorio en producción. |
| `NEXT_PUBLIC_USE_DEMO_DATA` | Reserva el modo demo; nunca se mezcla con datos reales.                     |

## Configuración de cuentas

El archivo CSV entregado se convirtió en la lista inicial de 22 ministros. Contiene Instagram, pero no usuarios de X ni cuentas institucionales. Desde **Configuración** se puede:

- completar o cambiar usuarios X e Instagram;
- agregar cuentas institucionales o Presidencia;
- editar aliases y activar/desactivar cuentas;
- importar/exportar CSV;
- guardar los cambios en el navegador.

El filesystem de Vercel es inmutable durante la ejecución. Por eso estos cambios sobreviven recargas en el mismo navegador, pero no se comparten automáticamente entre dispositivos. Use el CSV de configuración o el JSON de sesión para trasladarlos, sin añadir una base de datos.

## Configuración de Actors Apify

La aplicación incluye un Actor adaptador en
[`apify/observatorio-instagram-adapter`](./apify/observatorio-instagram-adapter).
Este ejecuta el scraper oficial de Instagram y entrega al dashboard un formato
estable. Las instrucciones para publicarlo y obtener su ID están en el README
de esa carpeta. En **Configuración** también puede ajustar temporalmente la
plantilla JSON enviada al Actor.

Si el Actor elegido usa nombres de entrada distintos, defínalos en la plantilla. Las respuestas incompatibles se reportan como error de fuente y nunca se convierten en ceros.

## Privacidad y metodología

Solo se procesa contenido público obtenido de los proveedores configurados. No se intenta identificar personas anónimas, inferir atributos sensibles ni crear perfiles individuales. Los indicadores describen la muestra recuperada y no representan una encuesta de opinión pública.

Engagement principal es `likes + comentarios`; engagement ampliado agrega shares, reposts y quotes. El balance gubernamental ampliado incluye Gobierno, Presidencia, instituciones y políticas públicas, mientras que ministros, Congreso, oposición y otros objetivos se conservan separadamente.

## Verificación

- `npm test`: pruebas unitarias de normalización, engagement y CSV.
- `npm run build`: compilación de producción compatible con Vercel.

Antes de una ejecución de alto volumen, revise los límites y el costo estimado. La cancelación detiene solicitudes nuevas, conserva resultados parciales e intenta abortar el run Apify activo.
