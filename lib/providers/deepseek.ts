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

export async function analyzeSentiment(items: { id: string; text: string }[]) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key)
    throw new ProviderError("DEEPSEEK_API_KEY no está configurada.", 503);
  const system = `Eres analista experto en comunicación política chilena. Analiza exclusivamente el contenido entregado. Determina el objeto evaluado: una noticia negativa no implica valoración negativa del Gobierno y una crítica de un ministro no es crítica hacia el ministro. Identifica ironía solo con evidencia. Usa uncertain si no hay seguridad. Responde únicamente JSON con {"results":[{"id":"","sentiment":"positive|negative|neutral|uncertain","score":0,"confidence":0,"target":"","targetKind":"government|president|institution|public_policy|minister|congress|opposition|other","reasonShort":"","topic":"","keywords":[],"entities":[]}]}. Conserva exactamente cada id.`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchWithRetry(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
            messages: [
              { role: "system", content: system },
              { role: "user", content: JSON.stringify(items) },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 6000,
          }),
          cache: "no-store",
        },
        { timeoutMs: 90_000 },
      );
      const raw = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = raw.choices?.[0]?.message?.content;
      if (!content) throw new Error("respuesta vacía");

      return responseSchema
        .parse(JSON.parse(content))
        .results.map((item) => ({ ...item, itemId: item.id }));
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 750 * 2 ** attempt + Math.random() * 250),
        );
      }
    }
  }

  throw new ProviderError(
    `DeepSeek no devolvió JSON válido después de 3 intentos: ${lastError instanceof Error ? lastError.message : "respuesta inválida"}`,
    502,
    true,
  );
}

export async function labelTopics(
  items: { id: string; text: string; sentiment?: string }[],
  existing: string[] = [],
) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key)
    throw new ProviderError("DEEPSEEK_API_KEY no está configurada.", 503);
  const prompt = `Agrupa conversación política chilena en acontecimientos concretos, no palabras genéricas. Catálogo existente: ${JSON.stringify(existing)}. Devuelve JSON {"assignments":[{"id":"","topicName":"","summary":"","keywords":[]}]}. Reutiliza catálogo si corresponde; no inventes causas ni cifras.`;
  const response = await fetchWithRetry(
    "https://api.deepseek.com/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(items) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 5000,
      }),
      cache: "no-store",
    },
    { timeoutMs: 90_000 },
  );
  const raw = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return JSON.parse(
    raw.choices?.[0]?.message?.content || '{"assignments":[]}',
  ) as {
    assignments: {
      id: string;
      topicName: string;
      summary: string;
      keywords: string[];
    }[];
  };
}
