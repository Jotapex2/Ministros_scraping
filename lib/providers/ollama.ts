import { z } from "zod";
import { fetchWithRetry, ProviderError } from "./http";

const resultSchema = z.object({
  id: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral", "uncertain"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  target: z.string(),
  targetKind: z.enum([
    "government",
    "president",
    "institution",
    "public_policy",
    "minister",
    "congress",
    "opposition",
    "other",
  ]),
  reasonShort: z.string(),
  topic: z.string(),
  keywords: z.array(z.string()),
  entities: z.array(z.string()),
});

const responseSchema = z.object({ results: z.array(resultSchema) });

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
  items: { id: string; text: string }[],
  hostUrl = "http://127.0.0.1:11434",
  modelName = "llama3",
) {
  const cleanHost = hostUrl.replace(/\/+$/, "");
  const system = `Eres un analista experto en comunicación política e inteligencia comunicacional del Gobierno de Chile. Tu objetivo es medir con máxima precisión el sentimiento hacia el Gobierno de Chile, el Presidente de la República, Ministerios/Instituciones y Ministros/Autoridades de Gabinete. Evalúa el objeto prioritario evaluado: targetKind="government|president|institution|public_policy|minister|congress|opposition|other". Registra "negative" ante críticas o desacuerdos explícitos, "positive" ante apoyo o elogios, "neutral" para reportes noticiosos u objetivos, y "uncertain" si es ambiguo. Identifica ironía solo con evidencia. Responde ÚNICAMENTE un JSON válido con esta estructura exacta: {"results":[{"id":"","sentiment":"positive|negative|neutral|uncertain","score":0,"confidence":0,"target":"","targetKind":"government|president|institution|public_policy|minister|congress|opposition|other","reasonShort":"","topic":"","keywords":[],"entities":[]}]}. Conserva exactamente cada id.`;

  try {
    const response = await fetchWithRetry(
      `${cleanHost}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          prompt: `${system}\n\nEntrada:\n${JSON.stringify(items)}\n\nJSON:`,
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

    const parsed = parseJsonResponse<unknown>(content);
    const results = responseSchema.parse(parsed).results;
    return results.map((item) => ({ ...item, itemId: item.id }));
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
