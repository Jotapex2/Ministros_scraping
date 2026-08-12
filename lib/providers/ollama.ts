import { z } from "zod";
import { fetchWithRetry, ProviderError } from "./http";

const sentiments = ["positive", "negative", "neutral", "uncertain"] as const;
const targetKinds = [
  "government",
  "president",
  "institution",
  "public_policy",
  "minister",
  "congress",
  "opposition",
  "other",
] as const;

const resultSchema = z.object({
  id: z.string(),
  sentiment: z.enum(sentiments),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  target: z.string(),
  targetKind: z.enum(targetKinds),
  reasonShort: z.string(),
  topic: z.string(),
  keywords: z.array(z.string()),
  entities: z.array(z.string()),
});

const responseSchema = z.object({ results: z.array(resultSchema) });

type SentimentItem = { id: string; text: string };
type SentimentValue = (typeof sentiments)[number];
type TargetKindValue = (typeof targetKinds)[number];

function sentimentJsonSchema(ids: string[]) {
  return {
    type: "object",
    properties: {
      results: {
        type: "array",
        minItems: ids.length,
        maxItems: ids.length,
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ids },
            sentiment: { type: "string", enum: [...sentiments] },
            score: { type: "number", minimum: -1, maximum: 1 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            target: { type: "string" },
            targetKind: { type: "string", enum: [...targetKinds] },
            reasonShort: { type: "string" },
            topic: { type: "string" },
            keywords: { type: "array", items: { type: "string" } },
            entities: { type: "array", items: { type: "string" } },
          },
          required: [
            "id",
            "sentiment",
            "score",
            "confidence",
            "target",
            "targetKind",
            "reasonShort",
            "topic",
            "keywords",
            "entities",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  };
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function inferTargetKind(text: string, target: string): TargetKindValue {
  const value = `${target} ${text}`.toLocaleLowerCase("es");
  if (/\bpresident[ea]?\b/.test(value)) return "president";
  if (/\bministr[oa]\b/.test(value)) return "minister";
  if (/\b(congreso|senado|senador|diputad[oa]|c[aá]mara)\b/.test(value))
    return "congress";
  if (/\boposici[oó]n\b/.test(value)) return "opposition";
  if (/\b(gobierno|ejecutivo|la moneda)\b/.test(value)) return "government";
  if (/\b(ministerio|subsecretar[ií]a|seremi|instituci[oó]n)\b/.test(value))
    return "institution";
  if (/\b(ley|reforma|pol[ií]tica|programa|plan|proyecto)\b/.test(value))
    return "public_policy";
  return "other";
}

function normalizeSentimentResult(raw: unknown, item: SentimentItem) {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawScore = boundedNumber(value.score, -1, 1);
  const rawSentiment = String(value.sentiment ?? "").toLowerCase();
  const sentiment: SentimentValue = sentiments.includes(
    rawSentiment as SentimentValue,
  )
    ? (rawSentiment as SentimentValue)
    : rawScore > 0.15
      ? "positive"
      : rawScore < -0.15
        ? "negative"
        : "uncertain";
  const score =
    sentiment === "positive"
      ? Math.abs(rawScore)
      : sentiment === "negative"
        ? -Math.abs(rawScore)
        : sentiment === "neutral"
          ? 0
          : rawScore;
  const target =
    typeof value.target === "string" ? value.target.trim() : "";
  const rawTargetKind = String(value.targetKind ?? "").toLowerCase();
  const targetKind: TargetKindValue = targetKinds.includes(
    rawTargetKind as TargetKindValue,
  )
    ? (rawTargetKind as TargetKindValue)
    : inferTargetKind(item.text, target);

  return resultSchema.parse({
    id: item.id,
    sentiment,
    score,
    confidence: boundedNumber(value.confidence, 0, 1),
    target,
    targetKind,
    reasonShort:
      typeof value.reasonShort === "string"
        ? value.reasonShort
        : "ClasificaciÃ³n del modelo local sin explicaciÃ³n.",
    topic:
      typeof value.topic === "string" && value.topic.trim()
        ? value.topic
        : "Sin clasificar",
    keywords: stringArray(value.keywords),
    entities: stringArray(value.entities),
  });
}

function uncertainResult(item: SentimentItem) {
  return resultSchema.parse({
    id: item.id,
    sentiment: "uncertain",
    score: 0,
    confidence: 0,
    target: "",
    targetKind: inferTargetKind(item.text, ""),
    reasonShort: "El modelo local no pudo devolver una clasificaciÃ³n vÃ¡lida.",
    topic: "Sin clasificar",
    keywords: [],
    entities: [],
  });
}

function parseJsonResponse<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1)) as T;
    }
    throw new Error("Ollama no devolvió JSON válido.");
  }
}

export async function listOllamaModels(hostUrl = "http://127.0.0.1:11434") {
  const cleanHost = hostUrl.replace(/\/+$/, "");
  try {
    const res = await fetchWithRetry(`${cleanHost}/api/tags`, { method: "GET" }, { timeoutMs: 10000 });
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models || []).map((m) => m.name);
  } catch (error) {
    throw new ProviderError(
      `No se pudo conectar a Ollama en ${cleanHost}. Verifica que Ollama esté corriendo.`,
      503,
      false,
    );
  }
}

export async function analyzeSentimentOllama(
  items: SentimentItem[],
  hostUrl = "http://127.0.0.1:11434",
  modelName = "llama3",
) {
  const cleanHost = hostUrl.replace(/\/+$/, "");
  const system = `Eres un analista de comunicación política chilena. Clasifica el sentimiento hacia el objeto evaluado, no el tono general del texto.
Reglas:
- sentiment debe ser UNA sola palabra: positive, negative, neutral o uncertain. Nunca unas opciones con "|".
- targetKind debe ser UNA sola palabra: government, president, institution, public_policy, minister, congress, opposition u other. Nunca copies la lista de opciones.
- negative: crítica o desacuerdo explícito; positive: apoyo o elogio; neutral: información objetiva; uncertain: ambigüedad real.
- Conserva los ids recibidos y produce exactamente un resultado por entrada, en el mismo orden.
- Responde sólo el JSON exigido por el esquema.`;

  const generateBatch = async (batch: SentimentItem[]) => {
    const compactItems = batch.map((item) => ({
      id: item.id,
      text: item.text.slice(0, 900),
    }));
    const response = await fetchWithRetry(
      `${cleanHost}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          system,
          prompt: `Analiza estas ${batch.length} entradas y devuelve ${batch.length} resultados en el mismo orden:\n${JSON.stringify(compactItems)}`,
          format: sentimentJsonSchema(batch.map((item) => item.id)),
          stream: false,
          think: false,
          options: {
            temperature: 0,
            num_ctx: 4096,
            num_predict: Math.min(3000, 250 + batch.length * 180),
          },
        }),
        cache: "no-store",
      },
      { timeoutMs: 180_000, retries: 1 },
    );

    const raw = (await response.json()) as {
      response?: string;
      thinking?: string;
    };
    const content = (raw.response || raw.thinking)?.trim();
    if (!content) throw new Error("Ollama devolvió una respuesta vacía.");

    const parsed = parseJsonResponse<{ results?: unknown[] }>(content);
    if (!Array.isArray(parsed.results)) {
      throw new Error("Ollama no devolvió una lista de resultados.");
    }
    const exactById = new Map<string, unknown>();
    for (const result of parsed.results) {
      if (result && typeof result === "object") {
        const id = String((result as Record<string, unknown>).id ?? "");
        if (batch.some((item) => item.id === id)) exactById.set(id, result);
      }
    }
    return batch.map((item, index) =>
      normalizeSentimentResult(
        exactById.get(item.id) ?? parsed.results?.[index],
        item,
      ),
    );
  };

  try {
    const batchSize = /(^|[:_-])1b($|[:_-])/i.test(modelName) ? 10 : 20;
    const results: z.infer<typeof resultSchema>[] = [];
    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      try {
        results.push(...(await generateBatch(batch)));
      } catch (batchError) {
        // Una pieza problemática no debe invalidar todo el lote ni la sesión.
        for (const item of batch) {
          try {
            results.push(...(await generateBatch([item])));
          } catch {
            results.push(uncertainResult(item));
          }
        }
        console.warn(
          `[ollama] Lote reparado elemento a elemento (${modelName}):`,
          batchError,
        );
      }
    }
    const validated = responseSchema.parse({ results }).results;
    return validated.map((item) => ({ ...item, itemId: item.id }));
  } catch (error) {
    throw new ProviderError(
      `Error al procesar sentimiento en Ollama (${modelName}): ${error instanceof Error ? error.message : "Error desconocido"}`,
      502,
      true,
    );
  }
}

export async function labelTopicsOllama(
  items: { id: string; text: string; sentiment?: string }[],
  existing: string[] = [],
  hostUrl = "http://127.0.0.1:11434",
  modelName = "llama3",
) {
  const cleanHost = hostUrl.replace(/\/+$/, "");
  const prompt = `Agrupa conversación política chilena en acontecimientos concretos, no palabras genéricas. Catálogo existente: ${JSON.stringify(existing)}. Devuelve ÚNICAMENTE un JSON con formato {"assignments":[{"id":"","topicName":"","summary":"","keywords":[]}]}. Reutiliza catálogo si corresponde; no inventes causas ni cifras.\n\nPiezas:\n${JSON.stringify(items)}\n\nJSON:`;

  try {
    const response = await fetchWithRetry(
      `${cleanHost}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          prompt,
          format: "json",
          stream: false,
          think: false,
          options: { temperature: 0.1 },
        }),
        cache: "no-store",
      },
      { timeoutMs: 120_000 },
    );

    const raw = (await response.json()) as {
      response?: string;
      thinking?: string;
    };
    const content = (raw.response || raw.thinking)?.trim();
    if (!content) throw new Error("Ollama devolvió una respuesta vacía.");

    const parsed = parseJsonResponse<{
      assignments: {
        id: string;
        topicName: string;
        summary: string;
        keywords: string[];
      }[];
    }>(content);
    if (!Array.isArray(parsed.assignments)) {
      throw new Error("Ollama no devolvió asignaciones de temas válidas.");
    }
    return parsed;
  } catch (error) {
    throw new ProviderError(
      `Error al detectar temas en Ollama (${modelName}): ${error instanceof Error ? error.message : "Error desconocido"}`,
      502,
      true,
    );
  }
}
