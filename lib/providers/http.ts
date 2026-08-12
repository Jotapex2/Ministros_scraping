export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 500,
    public retryable = false,
  ) {
    super(message);
  }
}
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: { retries?: number; timeoutMs?: number } = {},
) {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 30_000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok) return response;
      const retryable = [429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === retries) {
        const providerDetail = await response
          .text()
          .then((value) => value.replace(/\s+/g, " ").slice(0, 600))
          .catch(() => "");
        throw new ProviderError(
          `El proveedor respondió HTTP ${response.status}${providerDetail ? `: ${providerDetail}` : "."}`,
          response.status,
          retryable,
        );
      }
    } catch (error) {
      if (
        attempt === retries ||
        (error instanceof ProviderError && !error.retryable)
      )
        throw error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(8000, 500 * 2 ** attempt + Math.random() * 300),
      ),
    );
  }
  throw new ProviderError("No fue posible contactar al proveedor.", 504, true);
}
