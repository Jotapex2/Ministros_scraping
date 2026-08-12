# Observatorio - Instagram Adapter

Actor adaptador para el **Observatorio Digital del Gobierno**. Recibe perfiles
públicos de Instagram, ejecuta `apify/instagram-scraper` y copia al dataset de
esta ejecución una representación estable y normalizada de las publicaciones.

## Entrada

```json
{
  "directUrls": ["https://www.instagram.com/gobiernodechile/"],
  "resultsType": "posts",
  "resultsLimit": 20,
  "onlyPostsNewerThan": "2026-08-05",
  "includeComments": true
}
```

## Publicación en Apify

Desde esta carpeta:

```bash
npm install
npm test
apify login
apify push
```

Apify mostrará un identificador similar a:

```text
tu_usuario~observatorio-instagram-adapter
```

Ese valor —solo el identificador, sin URL ni token— se configura en Vercel como
`INSTAGRAM_APIFY_ACTOR_ID`.

## Costos y seguridad

El adaptador llama al Actor oficial `apify/instagram-scraper`, por lo que sus
consumos y tarifas se aplican a la cuenta de Apify que ejecuta este Actor. No se
deben guardar tokens en el código ni en el input.

Los valores no disponibles se conservan como `null`; no se transforman en cero.
