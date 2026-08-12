import { fetchWithRetry, ProviderError } from "./http";
const BASE = "https://api.twitterapi.io";
const headers = () => {
  const key = process.env.TWITTERAPI_IO_KEY;
  if (!key)
    throw new ProviderError("TWITTERAPI_IO_KEY no está configurada.", 503);
  return { "X-API-Key": key };
};
async function get(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  const url = new URL(path, BASE);
  Object.entries(params).forEach(
    ([key, value]) =>
      value !== undefined && url.searchParams.set(key, String(value)),
  );
  const response = await fetchWithRetry(url.toString(), {
    headers: headers(),
    cache: "no-store",
  });
  return response.json() as Promise<Record<string, unknown>>;
}
export const twitterApi = {
  profile: (userName: string) => get("/twitter/user/info", { userName }),
  timeline: (userName: string, cursor = "", includeReplies = false) =>
    get("/twitter/user/last_tweets", { userName, cursor, includeReplies }),
  replies: (tweetId: string, cursor = "") =>
    get("/twitter/tweet/replies/v2", { tweetId, cursor, queryType: "Latest" }),
  search: (query: string, sinceTime: number, untilTime: number) =>
    get("/twitter/tweet/advanced_search", {
      query: `${query} since_time:${sinceTime} until_time:${untilTime}`,
      queryType: "Latest",
    }),
};
