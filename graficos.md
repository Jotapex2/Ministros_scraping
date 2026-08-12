# Descripción de los gráficos

Este documento describe las visualizaciones del dashboard **Observatorio Digital del Gobierno**. Los gráficos presentan datos de la ejecución actualmente cargada en el navegador.

## Criterios generales

- Las publicaciones propias se cuentan excluyendo los comentarios (`isComment`); los comentarios se mantienen para las métricas de conversación e interacción cuando corresponde.
- La interacción principal es `likes + comentarios`. No equivale necesariamente a la interacción de otra plataforma.
- Las métricas cuantitativas se calculan en el código a partir de las publicaciones recuperadas. DeepSeek se utiliza para las clasificaciones cualitativas, como sentimiento y temas.
- Los valores `N/D` representan datos no disponibles; no deben interpretarse como cero.
- Los botones **CSV**, **PNG** y **Ver datos** permiten descargar la información del gráfico o inspeccionar sus filas subyacentes.

## X vs Instagram

### Desempeño por plataforma

Compara X e Instagram mediante barras por plataforma.

- **Eje horizontal:** plataforma: X o Instagram.
- **Publicaciones:** cantidad de publicaciones propias recuperadas.
- **Menciones:** cantidad de menciones detectadas a ministros, según sus aliases configurados.
- **Interacciones:** está disponible en la tabla de datos del gráfico y corresponde a likes más comentarios.

La comparación es descriptiva. Una interacción en X y una interacción en Instagram no representan necesariamente el mismo comportamiento de audiencia.

### Sentimiento por plataforma

Muestra la composición relativa del sentimiento clasificado por plataforma.

- **Eje horizontal:** X o Instagram.
- **Eje vertical:** proporción del total clasificado, expresada como porcentaje.
- **Categorías:** positivo, neutral, negativo e incierto.

El gráfico usa los resultados cualitativos disponibles de DeepSeek. Si no hay publicaciones clasificadas, la plataforma puede aparecer sin una distribución visible.

## Actividad e impacto ministerial

Esta sección tiene tres controles compartidos:

- **Filtrar plataforma:** Todas, X o Instagram.
- **Ministros visibles:** Top 5, Top 10, Top 15 o Todos.
- **Orden:** Mayor a menor (descendente) o Menor a mayor (ascendente).

Por defecto se muestran los cinco ministros con los valores más altos en orden descendente. El filtro de plataforma recalcula el orden usando únicamente publicaciones propias de la plataforma seleccionada.

### Ministros que más publicaron

Ranking de ministros según la cantidad de publicaciones propias.

- **Eje vertical:** nombre completo del ministro.
- **Eje horizontal:** número de publicaciones.
- **Series:** X e Instagram, cuando corresponde al filtro seleccionado.
- **Orden:** configurable (mayor a menor o menor a mayor).

Con **Todas**, el total combina X e Instagram. Con X o Instagram, el ranking se calcula solo con esa plataforma.

### Ministros con mayor interacción

Ranking de ministros según la interacción principal acumulada.

- **Eje vertical:** nombre completo del ministro.
- **Eje horizontal:** likes más comentarios.
- **Orden:** configurable (mayor a menor o menor a mayor).
- **Tabla de datos:** incluye también el promedio de interacción por publicación.

El promedio se calcula sobre las publicaciones propias que cumplen el filtro de plataforma.

### Actividad, impacto y menciones

Gráfico de dispersión en el que cada punto representa un ministro.

- **Eje X:** número de publicaciones propias.
- **Eje Y:** engagement promedio por publicación.
- **Tamaño de la burbuja:** seguidores agregados de X e Instagram.
- **Etiqueta:** nombre completo del ministro.
- **Datos adicionales:** menciones a ese ministro disponibles en el tooltip y en **Ver datos**.

Este gráfico no es un ranking. Sirve para observar simultáneamente actividad, rendimiento promedio y tamaño de audiencia. Los ministros sin publicaciones pueden aparecer en el origen, con valores cuantitativos iguales a cero.

## Conversación ministerial

Esta sección cuenta con los mismos tres controles de filtrado interactivos:

- **Filtrar plataforma:** Todas, X o Instagram.
- **Ministros visibles:** Top 5, Top 10, Top 15 o Todos.
- **Orden:** Mayor a menor (descendente) o Menor a mayor (ascendente).

### Ministros más mencionados

Ranking de menciones detectadas a ministros en publicaciones y comentarios recuperados.

- **Eje vertical:** nombre completo del ministro.
- **Eje horizontal:** cantidad de menciones.
- **Series:** menciones en X y en Instagram.
- **Orden:** configurable (mayor a menor o menor a mayor).
- **Tabla de datos:** incluye menciones, usuarios únicos y sentimiento neto.

Las menciones dependen de los nombres, usuarios y aliases definidos en Configuración. Una mención no implica necesariamente una valoración positiva o negativa.

### Participación en la conversación ministerial

Representa el Share of Voice (SOV) de cada ministro dentro del conjunto de menciones ministeriales.

- **Eje vertical:** nombre completo del ministro.
- **Eje horizontal:** porcentaje de participación.
- **Cálculo:** menciones del ministro / total de menciones a ministros × 100.
- **Orden:** configurable (mayor a menor o menor a mayor).

El SOV describe la distribución de la conversación observada; no mide apoyo, aprobación ni importancia política.

## Sentimiento

### Sentimiento general hacia el Gobierno

Gráfico circular con la distribución de las clasificaciones cualitativas dirigidas al Gobierno.

- **Categorías:** positivo, neutral, negativo e incierto.
- **Valores:** cantidad de publicaciones o comentarios clasificados.
- **Fuente:** clasificación de sentimiento realizada por DeepSeek.

El sentimiento se asigna al objeto evaluado. Una publicación negativa sobre un hecho noticioso no implica automáticamente una valoración negativa del Gobierno.

## Temas principales

### Volumen y sentimiento de los principales temas

Gráfico de dispersión de los temas agrupados por DeepSeek.

- **Eje X:** sentimiento neto del tema, desde -100 a 100.
- **Eje Y:** volumen del tema, definido como publicaciones más comentarios.
- **Tamaño de la burbuja:** interacción principal acumulada del tema.
- **Datos adicionales:** nombre del tema, resumen, palabras clave y distribución por plataforma en **Ver datos**.

El nombre y la agrupación de los temas son cualitativos. Los volúmenes e interacciones se calculan en código a partir de las piezas asociadas.

## Nubes de palabras

La sección contiene tres nubes de hasta 25 palabras individuales cada una:

- **Nube positiva:** palabras más frecuentes en piezas clasificadas como positivas.
- **Nube negativa:** palabras más frecuentes en piezas clasificadas como negativas.
- **Nube total:** palabras más frecuentes en todas las piezas, sin filtro de sentimiento.

En las tres nubes:

- El tamaño de la palabra representa su frecuencia relativa dentro de la nube.
- La frecuencia cuenta en cuántas piezas aparece cada palabra, evitando duplicarla varias veces dentro del mismo texto.
- Se eliminan palabras vacías, nombres y aliases de ministros, nombres de autoridades configuradas, cargos genéricos y referencias al Presidente Kast.
- Las palabras se normalizan para agrupar variantes con y sin tilde.

Las nubes muestran vocabulario repetido, no frases ni una interpretación causal del contenido.

## Lectura recomendada

Los gráficos deben leerse como una descripción de la muestra pública recuperada durante el período seleccionado. Las diferencias entre plataformas, la cobertura incompleta de cuentas y la clasificación automatizada pueden afectar la comparación.
