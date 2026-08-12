import { getScraperContext } from "./session-manager";

export interface LocalXTweet {
  id: string;
  text: string;
  createdAt: string;
  author: {
    userName: string;
    name: string;
    followersCount?: number;
  };
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  views?: number;
  url?: string;
  inReplyToId?: string;
}

type AnyObject = Record<string, unknown>;

async function closeBrowserSafely(browser: any) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    browser.close().catch(() => undefined),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, 3000);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
}

async function settlePendingSafely(
  pending: Set<Promise<void>>,
  timeoutMs = 4000,
) {
  if (!pending.size) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled([...pending]),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, timeoutMs);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
}

async function publicXProfile(username: string) {
  try {
    const response = await fetch(
      `https://api.vxtwitter.com/${encodeURIComponent(username)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const raw = (await response.json()) as AnyObject;
    const followersCount = Number(raw.followers_count);
    if (!Number.isFinite(followersCount)) return null;
    return {
      username: String(raw.screen_name ?? username),
      name: String(raw.name ?? username),
      followersCount,
      description:
        typeof raw.description === "string" ? raw.description : undefined,
      profileImageUrl:
        typeof raw.profile_image_url === "string"
          ? raw.profile_image_url
          : undefined,
    };
  } catch {
    return null;
  }
}

function parseCompactCount(value: string): number | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
  const match = normalized.match(/([\d.,]+)\s*(mil|k|m|mill[oó]n(?:es)?)?/i);
  if (!match) return undefined;

  const suffix = match[2]?.toLowerCase();
  if (suffix) {
    const decimalText = match[1].replace(",", ".");
    const decimal = Number(
      decimalText.split(".").length > 2
        ? decimalText.replace(/\.(?=.*\.)/g, "")
        : decimalText,
    );
    if (!Number.isFinite(decimal)) return undefined;
    return Math.round(
      decimal * (suffix === "mil" || suffix === "k" ? 1_000 : 1_000_000),
    );
  }

  const integer = Number(match[1].replace(/[.,]/g, ""));
  return Number.isFinite(integer) ? integer : undefined;
}

function checkXSession(page: any) {
  const url = page.url();
  if (url.includes("/login") || url.includes("/flow/login") || url.includes("/account/access")) {
    throw new Error("La sesión de X (Twitter) expiró o requiere verificación. Por favor haz clic en 'Iniciar Sesión' e ingresa tu cookie auth_token actualizada.");
  }
}

function timelineInstructions(json: any): AnyObject[] {
  const data = json?.data ?? {};
  const userResult = data.user?.result;
  const candidates = [
    userResult?.timeline_v2?.timeline?.instructions,
    userResult?.timeline?.timeline?.instructions,
    userResult?.instructions,
    data.threaded_conversation_with_injections_v2?.instructions,
    data.search_by_raw_query?.search_timeline?.timeline?.instructions,
    data.search_by_raw_query?.search_timeline?.instructions,
    data.search_timeline?.timeline?.instructions,
    data.search_timeline?.instructions,
  ];
  const found = candidates.find(
    (candidate) => Array.isArray(candidate) && candidate.length > 0,
  );
  return (found as AnyObject[] | undefined) ?? [];
}

function tweetResultsOf(entry: any): AnyObject[] {
  const content = entry?.content;
  if (!content) return [];
  const results: AnyObject[] = [];
  const direct = content.itemContent?.tweet_results?.result as
    | AnyObject
    | undefined;
  if (direct) results.push(direct);
  const items = content.items as AnyObject[] | undefined;
  if (Array.isArray(items)) {
    for (const item of items) {
      const nested = (item as any).item?.itemContent?.tweet_results?.result as
        | AnyObject
        | undefined;
      if (nested) results.push(nested);
    }
  }
  return results;
}

function newUserStats(result: AnyObject | undefined) {
  if (!result) return undefined;
  const core = result.core as AnyObject | undefined;
  if (!core) return undefined;
  const counts = result.relationship_counts as AnyObject | undefined;
  return {
    userName:
      typeof core.screen_name === "string" ? core.screen_name : undefined,
    name: typeof core.name === "string" ? core.name : undefined,
    followersCount:
      typeof counts?.followers === "number" ? counts.followers : undefined,
  };
}

function legacyUserStats(result: AnyObject | undefined) {
  const legacy = result?.legacy as AnyObject | undefined;
  if (!legacy) return undefined;
  return {
    userName:
      typeof legacy.screen_name === "string" ? legacy.screen_name : undefined,
    name: typeof legacy.name === "string" ? legacy.name : undefined,
    followersCount:
      typeof legacy.followers_count === "number"
        ? legacy.followers_count
        : undefined,
  };
}

function extractTweet(
  result: any,
  fallbackUsername?: string,
): LocalXTweet | null {
  const tweetData = result.tweet ?? result;
  const legacy = tweetData.legacy as AnyObject | undefined;
  if (!legacy || !legacy.id_str) return null;

  const userNode =
    tweetData.core?.user_results?.result ??
    tweetData.core?.user_results ??
    tweetData.core;
  const user = newUserStats(userNode) ?? legacyUserStats(userNode);
  const userName = user?.userName ?? fallbackUsername ?? "desconocido";
  const noteText = result.note_tweet?.note_tweet_results?.result?.text as
    | string
    | undefined;
  const viewsRaw = tweetData.views?.count;
  const views = Number(viewsRaw);

  return {
    id: String(legacy.id_str),
    text:
      (legacy.full_text as string) || (legacy.text as string) || noteText || "",
    createdAt: new Date(String(legacy.created_at)).toISOString(),
    author: {
      userName,
      name: user?.name ?? userName,
      followersCount: user?.followersCount,
    },
    likeCount:
      typeof legacy.favorite_count === "number" ? legacy.favorite_count : undefined,
    replyCount:
      typeof legacy.reply_count === "number" ? legacy.reply_count : undefined,
    retweetCount:
      typeof legacy.retweet_count === "number" ? legacy.retweet_count : undefined,
    quoteCount:
      typeof legacy.quote_count === "number" ? legacy.quote_count : undefined,
    views: Number.isFinite(views) ? views : undefined,
    url: `https://x.com/${userName || "i"}/status/${legacy.id_str}`,
    inReplyToId: legacy.in_reply_to_status_id_str as string | undefined,
  };
}

function collectTweets(
  json: any,
  tweets: LocalXTweet[],
  fallbackUsername?: string,
) {
  if (!json || typeof json !== "object") return;
  const instructions = timelineInstructions(json);
  for (const instruction of instructions) {
    const entries = (
      instruction.entries ?? instruction.moduleItems ?? instruction.addEntries
    ) as
      | AnyObject[]
      | undefined;
    for (const entry of entries ?? []) {
      for (const result of tweetResultsOf(entry)) {
        const tweet = extractTweet(result, fallbackUsername);
        if (tweet) tweets.push(tweet);
      }
    }
  }
}

export const localX = {
  profile: async (username: string) => {
    const cleanUser = username.replace(/^@/, "").trim();
    const publicProfile = await publicXProfile(cleanUser);
    if (publicProfile) return publicProfile;

    const { browser, context } = await getScraperContext("x");

    try {
      const page = await context.newPage();
      let capturedProfile: Record<string, unknown> | null = null;
      const pendingProfileResponses = new Set<Promise<void>>();

      page.on("response", (response: any) => {
        const url = response.url();
        if (url.includes("/UserByScreenName") || url.includes("/UserDetail")) {
          const task = (async () => {
            try {
              const json = await response.json();
              const result = json?.data?.user?.result;
              if (result) {
                const user = newUserStats(result) ?? legacyUserStats(result);
                const bio = result.profile_bio as AnyObject | undefined;
                capturedProfile = {
                  username: user?.userName ?? cleanUser,
                  name: user?.name ?? cleanUser,
                  followersCount: user?.followersCount,
                  description:
                    typeof bio?.description === "string"
                      ? bio.description
                      : undefined,
                  profileImageUrl:
                    (result.avatar as AnyObject | undefined)?.image_url ?? "",
                };
              }
            } catch {}
          })();
          pendingProfileResponses.add(task);
          void task.finally(() => pendingProfileResponses.delete(task));
        }
      });

      await page.goto(`https://x.com/${cleanUser}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      checkXSession(page);
      await settlePendingSafely(pendingProfileResponses);

      const resolvedProfile = capturedProfile as Record<string, unknown> | null;
      if (
        !resolvedProfile ||
        typeof resolvedProfile.followersCount !== "number"
      ) {
        const followersLocator = page
          .locator(
            'a[href$="/verified_followers"], a[href$="/followers"]',
          )
          .first();
        await followersLocator
          .waitFor({ state: "visible", timeout: 5000 })
          .catch(() => undefined);
        const followersTitle = await followersLocator
          .locator("[title]")
          .first()
          .getAttribute("title")
          .catch(() => null);
        const followersLabel = await followersLocator
          .getAttribute("aria-label")
          .catch(() => null);
        const followersText = await followersLocator.innerText().catch(() => "");
        const followersCount = [followersTitle, followersLabel, followersText]
          .filter((value): value is string => !!value)
          .map(parseCompactCount)
          .find((value) => value != null);
        capturedProfile = {
          username: cleanUser,
          name: cleanUser,
          ...(resolvedProfile ?? {}),
          ...(followersCount == null ? {} : { followersCount }),
        };
      }

      await closeBrowserSafely(browser);
      return capturedProfile;
    } catch (error) {
      await closeBrowserSafely(browser);
      throw new Error(`Error en scraper local de X (perfil @${cleanUser}): ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  },

  timeline: async (
    username: string,
    _cursor?: string,
    _includeReplies = false,
    limit = 100,
    sinceTime?: number,
  ) => {
    const cleanUser = username.replace(/^@/, "").trim();
    const { browser, context } = await getScraperContext("x");

    try {
      const page = await context.newPage();
      const tweets: LocalXTweet[] = [];
      const pendingResponses = new Set<Promise<void>>();

      page.on("response", (response: any) => {
        const url = response.url();
        if (url.includes("/UserTweets") || url.includes("/UserByScreenName") || url.includes("TweetDetail")) {
          const task = (async () => {
            try {
              const json = await response.json();
              collectTweets(json as AnyObject, tweets, cleanUser);
            } catch {}
          })();
          pendingResponses.add(task);
          void task.finally(() => pendingResponses.delete(task));
        }
      });

      await page.goto(`https://x.com/${cleanUser}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      checkXSession(page);

      // X carga el timeline por bloques. Seguimos hasta alcanzar la fecha
      // solicitada, el límite, o hasta que varios scrolls no agreguen datos.
      const maxScrolls = Math.min(40, Math.max(8, Math.ceil(limit / 10) + 4));
      let previousCount = 0;
      let stagnantScrolls = 0;
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await page.waitForTimeout(1800);
        await settlePendingSafely(pendingResponses);

        const uniqueCount = new Set(tweets.map((tweet) => tweet.id)).size;
        stagnantScrolls = uniqueCount > previousCount ? 0 : stagnantScrolls + 1;
        previousCount = uniqueCount;
        const oldestTime = Math.min(
          ...tweets.map((tweet) => new Date(tweet.createdAt).getTime()),
        );
        if (
          uniqueCount >= limit ||
          (sinceTime != null && Number.isFinite(oldestTime) && oldestTime <= sinceTime) ||
          stagnantScrolls >= 3
        ) {
          break;
        }
      }
      await page.waitForTimeout(750);
      await settlePendingSafely(pendingResponses);

      // Deduplicate tweets by id
      const uniqueMap = new Map<string, LocalXTweet>();
      for (const t of tweets) {
        uniqueMap.set(t.id, t);
      }

      await closeBrowserSafely(browser);
      return { tweets: Array.from(uniqueMap.values()), next_cursor: "" };
    } catch (error) {
      await closeBrowserSafely(browser);
      throw new Error(`Error en scraper local de X (timeline @${cleanUser}): ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  },

  replies: async (tweetId: string, _cursor?: string) => {
    const { browser, context } = await getScraperContext("x");

    try {
      const page = await context.newPage();
      const replies: LocalXTweet[] = [];

      page.on("response", async (response: any) => {
        const url = response.url();
        if (url.includes("/TweetDetail")) {
          try {
            const json = await response.json();
            collectTweets(json as AnyObject, replies);
          } catch {}
        }
      });

      await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3500);
      checkXSession(page);

      const uniqueMap = new Map<string, LocalXTweet>();
      for (const r of replies) {
        if (r.id === tweetId) continue;
        r.inReplyToId = r.inReplyToId ?? tweetId;
        uniqueMap.set(r.id, r);
      }

      await closeBrowserSafely(browser);
      return { replies: Array.from(uniqueMap.values()), next_cursor: "" };
    } catch (error) {
      await closeBrowserSafely(browser);
      return { replies: [], next_cursor: "" };
    }
  },

  search: async (
    query: string,
    _sinceTime: number,
    _untilTime: number,
    limit = 100,
  ) => {
    const { browser, context } = await getScraperContext("x");

    try {
      const page = await context.newPage();
      const tweets: LocalXTweet[] = [];
      const pendingResponses = new Set<Promise<void>>();

      page.on("response", (response: any) => {
        const url = response.url();
        if (url.includes("SearchTimeline") || url.includes("search") || url.includes("adaptive")) {
          const task = (async () => {
            try {
              const json = await response.json();
              collectTweets(json as AnyObject, tweets);
            } catch {}
          })();
          pendingResponses.add(task);
          void task.finally(() => pendingResponses.delete(task));
        }
      });

      const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      checkXSession(page);

      const maxScrolls = Math.min(20, Math.max(4, Math.ceil(limit / 10)));
      let previousCount = 0;
      let stagnantScrolls = 0;
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await page.waitForTimeout(1800);
        await settlePendingSafely(pendingResponses);
        const uniqueCount = new Set(tweets.map((tweet) => tweet.id)).size;
        stagnantScrolls = uniqueCount > previousCount ? 0 : stagnantScrolls + 1;
        previousCount = uniqueCount;
        if (uniqueCount >= limit || stagnantScrolls >= 3) break;
      }
      await settlePendingSafely(pendingResponses);

      const uniqueMap = new Map<string, LocalXTweet>();
      for (const t of tweets) {
        uniqueMap.set(t.id, t);
      }

      await closeBrowserSafely(browser);
      return { tweets: Array.from(uniqueMap.values()).slice(0, limit) };
    } catch (error) {
      await closeBrowserSafely(browser);
      throw new Error(
        `Error en búsqueda local de X (${query}): ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    }
  },
};
