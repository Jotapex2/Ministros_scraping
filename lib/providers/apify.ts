import { fetchWithRetry, ProviderError } from "./http";
const BASE = "https://api.apify.com/v2";
const token = () => {
  if (!process.env.APIFY_API_TOKEN)
    throw new ProviderError("APIFY_API_TOKEN no está configurado.", 503);
  return process.env.APIFY_API_TOKEN;
};
const actorId = (platform: "x" | "instagram") => {
  const raw =
    platform === "x"
      ? process.env.TWITTER_APIFY_ACTOR_ID
      : process.env.INSTAGRAM_APIFY_ACTOR_ID;
  const value = raw?.trim();

  if (!value)
    throw new ProviderError(`Actor de ${platform} no configurado.`, 503);
  if (/^https?:\/\//i.test(value))
    throw new ProviderError(
      `${platform === "instagram" ? "INSTAGRAM_APIFY_ACTOR_ID" : "TWITTER_APIFY_ACTOR_ID"} debe contener solo el ID del Actor, no una URL.`,
      503,
    );

  return value.replace("/", "~");
};
const auth = () => ({
  Authorization: `Bearer ${token()}`,
  "Content-Type": "application/json",
});
export async function startActor(
  platform: "x" | "instagram",
  input: Record<string, unknown>,
) {
  const id = actorId(platform);
  try {
    const response = await fetchWithRetry(
      `${BASE}/acts/${encodeURIComponent(id)}/runs`,
      {
        method: "POST",
        headers: auth(),
        body: JSON.stringify(input),
        cache: "no-store",
      },
      { timeoutMs: 60_000 },
    );
    return response.json() as Promise<Record<string, unknown>>;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw new ProviderError(
        `${error.message} Actor resuelto: ${id}.`,
        error.status,
        error.retryable,
      );
    }
    throw error;
  }
}
export async function actorStatus(runId: string) {
  const response = await fetchWithRetry(
    `${BASE}/actor-runs/${encodeURIComponent(runId)}`,
    { headers: auth(), cache: "no-store" },
  );
  return response.json() as Promise<Record<string, unknown>>;
}
export async function actorItems(datasetId: string, offset = 0, limit = 250) {
  const response = await fetchWithRetry(
    `${BASE}/datasets/${encodeURIComponent(datasetId)}/items?offset=${offset}&limit=${limit}&clean=true`,
    { headers: auth(), cache: "no-store" },
  );
  return response.json() as Promise<unknown[]>;
}
export async function abortActor(runId: string) {
  const response = await fetchWithRetry(
    `${BASE}/actor-runs/${encodeURIComponent(runId)}/abort`,
    { method: "POST", headers: auth(), cache: "no-store" },
  );
  return response.json() as Promise<Record<string, unknown>>;
}
