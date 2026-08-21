import {
  getScraperContext,
  markScraperSessionInvalid,
} from "./session-manager";

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
  source?: "api" | "dom";
}

type AnyObject = Record<string, unknown>;

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
      decimal *
        (suffix === "mil" || suffix === "k"
          ? 1_000
          : suffix === "b"
            ? 1_000_000_000
            : 1_000_000),
    );
  }

  const integer = Number(match[1].replace(/[.,]/g, ""));
  return Number.isFinite(integer) ? integer : undefined;
}

export function isXTimelineResponse(url: string) {
  return /\/(?:UserTweets(?:AndReplies)?|UserOriginalsTimeline|UserByScreenName|TweetDetail)(?:\?|$)/i.test(
    url,
  );
}

export function addXDateRange(
  query: string,
  sinceTime: number,
  untilTime: number,
) {
  const parts = [query.trim()];
  if (!/(?:^|\s)since:/i.test(query)) {
    parts.push(
      `since:${new Date(sinceTime * 1000).toISOString().slice(0, 10)}`,
    );
  }
  if (!/(?:^|\s)until:/i.test(query)) {
    parts.push(
      `until:${new Date(untilTime * 1000 + 1000).toISOString().slice(0, 10)}`,
    );
  }
  return parts.join(" ");
}

async function collectVisibleTweets(
  page: any,
  tweets: LocalXTweet[],
  fallbackUsername?: string,
) {
  const locator = page.locator(
    'article[data-testid="tweet"], article[itemtype*="SocialMediaPosting"], article[data-tweet-id]',
  );
  await locator
    .first()
    .waitFor({ state: "attached", timeout: 5000 })
    .catch(() => undefined);
  const visible = (await locator.evaluateAll((articles: Element[]) =>
      articles.map((article) => {
        const metaContent = (itemprop: string, scope: Element = article) =>
          scope.querySelector(`meta[itemprop="${itemprop}"]`)?.getAttribute("content") ??
          "";
        const namedMetric = (name: string) => {
          const metas = [...article.querySelectorAll("meta")];
          const nameIndex = metas.findIndex(
            (meta) =>
              meta.getAttribute("itemprop") === "name" &&
              meta.getAttribute("content")?.toLowerCase() === name.toLowerCase(),
          );
          if (nameIndex < 0) return "";
          return metas
            .slice(nameIndex + 1)
            .find((meta) => meta.getAttribute("itemprop") === "userInteractionCount")
            ?.getAttribute("content") ?? "";
        };

        const time = article.querySelector("time");
        const statusAnchor = time?.closest("a") as HTMLAnchorElement | null;
        const href =
          statusAnchor?.getAttribute("href") ?? metaContent("url");
        const match = href.match(/(?:https?:\/\/[^/]+)?\/([^/]+)\/status\/(\d+)/);
        const id =
          match?.[2] ?? article.getAttribute("data-tweet-id") ?? "";
        const createdAt =
          time?.getAttribute("datetime") ??
          metaContent("datePublished") ??
          metaContent("dateCreated");
        if (!id || !createdAt) return null;

        const metric = (selector: string) => {
          const element = article.querySelector(selector);
          return (
            element?.getAttribute("aria-label") ??
            element?.textContent ??
            ""
          );
        };
        const userName =
          match?.[1] ??
          article.querySelector('[itemprop="alternateName"]')?.getAttribute("content") ??
          "";
        const userBlock = article.querySelector('[data-testid="User-Name"]');
        const name =
          userBlock?.querySelector("span")?.textContent?.trim() ??
          article.querySelector('[itemprop="author"] [itemprop="name"]')?.getAttribute("content") ??
          article.querySelector('[itemprop="author"] [itemprop="name"]')?.textContent?.trim();
        return {
          id,
          text:
            article
              .querySelector('[data-testid="tweetText"]')
              ?.textContent?.trim() ??
            metaContent("text"),
          createdAt,
          userName,
          name: name || userName,
          url: href.startsWith("http") ? href : `https://x.com${href}`,
          reply:
            metric('[data-testid="reply"]') ||
            metaContent("commentCount") ||
            namedMetric("Replies"),
          retweet:
            metric('[data-testid="retweet"]') || namedMetric("Retweets"),
          like: metric('[data-testid="like"]') || namedMetric("Likes"),
          views: metric('a[href$="/analytics"]') || namedMetric("Views"),
        };
      }),
    )
    .catch(() => [])) as Array<{
    id: string;
    text: string;
    createdAt: string;
    userName: string;
    name: string;
    url: string;
    reply: string;
    retweet: string;
    like: string;
    views: string;
  } | null>;

  for (const item of visible) {
    if (!item) continue;
    tweets.push({
      id: item.id,
      text: item.text,
      createdAt: item.createdAt,
      author: {
        userName: item.userName || fallbackUsername || "desconocido",
        name: item.name || item.userName || fallbackUsername || "desconocido",
      },
      replyCount: parseCompactCount(item.reply),
      retweetCount: parseCompactCount(item.retweet),
      likeCount: parseCompactCount(item.like),
      views: parseCompactCount(item.views),
      url: item.url,
      source: "dom",
    });
  }
}

async function checkXSession(page: any) {
  const url = page.url();
  const loginVisible = await page
    .locator('input[name="text"], input[name="password"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (
    url.includes("/login") ||
    url.includes("/flow/login") ||
    url.includes("/account/access") ||
    loginVisible
  ) {
    markScraperSessionInvalid("x");
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
    source: "api",
  };
}

function mergeTweetVersions(first: LocalXTweet, second: LocalXTweet) {
  const preferred =
    first.source === "api" || second.source !== "api" ? first : second;
  const fallback = preferred === first ? second : first;
  return {
    ...fallback,
    ...preferred,
    likeCount: preferred.likeCount ?? fallback.likeCount,
    replyCount: preferred.replyCount ?? fallback.replyCount,
    retweetCount: preferred.retweetCount ?? fallback.retweetCount,
    quoteCount: preferred.quoteCount ?? fallback.quoteCount,
    views: preferred.views ?? fallback.views,
    source: preferred.source,
  };
}

function mergeTweetIntoMap(map: Map<string, LocalXTweet>, tweet: LocalXTweet) {
  const existing = map.get(tweet.id);
  map.set(tweet.id, existing ? mergeTweetVersions(existing, tweet) : tweet);
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
    // X public content is collected anonymously to avoid account-level
    // Viewer rate limits from making public timelines appear empty.
    const pooled = await getScraperContext("x", true);

    try {
      const page = await pooled.context.newPage();
      let capturedProfile: Record<string, unknown> | null = null;
      const pendingProfileResponses = new Set<Promise<void>>();
      let resolveWait: (() => void) | null = null;

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
                if (resolveWait) resolveWait();
              }
            } catch {}
          })();
          pendingProfileResponses.add(task);
          void task.finally(() => pendingProfileResponses.delete(task));
        }
      });

      await page.goto(`https://x.com/${cleanUser}`, { waitUntil: "domcontentloaded", timeout: 30000 });

      await new Promise<void>((resolve) => {
        resolveWait = resolve;
        setTimeout(resolve, 3000);
      });

      await checkXSession(page);
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

      pooled.release();
      return capturedProfile;
    } catch (error) {
      pooled.release();
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
    // X public content is collected anonymously to avoid account-level
    // Viewer rate limits from making public timelines appear empty.
    const pooled = await getScraperContext("x", true);

    try {
      const page = await pooled.context.newPage();
      const tweets: LocalXTweet[] = [];
      const pendingResponses = new Set<Promise<void>>();

      page.on("response", (response: any) => {
        const url = response.url();
        if (isXTimelineResponse(url)) {
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
      await checkXSession(page);
      await collectVisibleTweets(page, tweets, cleanUser);

      const maxScrolls = Math.min(40, Math.max(8, Math.ceil(limit / 10) + 4));
      let previousCount = 0;
      let stagnantScrolls = 0;
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await page.waitForTimeout(1800);
        await settlePendingSafely(pendingResponses);
        await collectVisibleTweets(page, tweets, cleanUser);

        const uniqueCount = new Set(tweets.map((tweet) => tweet.id)).size;
        stagnantScrolls = uniqueCount > previousCount ? 0 : stagnantScrolls + 1;
        previousCount = uniqueCount;
        if (tweets.length > 0) {
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
        } else if (stagnantScrolls >= 3) {
          break;
        }
      }
      await page.waitForTimeout(750);
      await settlePendingSafely(pendingResponses);
      await collectVisibleTweets(page, tweets, cleanUser);

      const uniqueMap = new Map<string, LocalXTweet>();
      for (const t of tweets) {
        mergeTweetIntoMap(uniqueMap, t);
      }

      pooled.release();
      return { tweets: Array.from(uniqueMap.values()), next_cursor: "" };
    } catch (error) {
      pooled.release();
      throw new Error(`Error en scraper local de X (timeline @${cleanUser}): ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  },

  replies: async (tweetId: string, _cursor?: string) => {
    // X public content is collected anonymously to avoid account-level
    // Viewer rate limits from making public timelines appear empty.
    const pooled = await getScraperContext("x", true);

    try {
      const page = await pooled.context.newPage();
      const replies: LocalXTweet[] = [];
      let resolveWait: (() => void) | null = null;

      page.on("response", async (response: any) => {
        const url = response.url();
        if (url.includes("/TweetDetail")) {
          try {
            const json = await response.json();
            collectTweets(json as AnyObject, replies);
            if (resolveWait) resolveWait();
          } catch {}
        }
      });

      await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: "domcontentloaded", timeout: 30000 });

      await new Promise<void>((resolve) => {
        resolveWait = resolve;
        setTimeout(resolve, 3500);
      });

      await checkXSession(page);
      await collectVisibleTweets(page, replies);

      const uniqueMap = new Map<string, LocalXTweet>();
      for (const r of replies) {
        if (r.id === tweetId) continue;
        r.inReplyToId = r.inReplyToId ?? tweetId;
        mergeTweetIntoMap(uniqueMap, r);
      }

      pooled.release();
      return { replies: Array.from(uniqueMap.values()), next_cursor: "" };
    } catch (error) {
      pooled.release();
      throw new Error(
        `Error en scraper local de replies de X (${tweetId}): ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    }
  },

  search: async (
    query: string,
    sinceTime: number,
    untilTime: number,
    limit = 100,
  ) => {
    // X public content is collected anonymously to avoid account-level
    // Viewer rate limits from making public timelines appear empty.
    const pooled = await getScraperContext("x", true);

    try {
      const page = await pooled.context.newPage();
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

      const datedQuery = addXDateRange(query, sinceTime, untilTime);
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(datedQuery)}&f=live`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      await page.waitForTimeout(3000);
      await checkXSession(page);
      await collectVisibleTweets(page, tweets);

      const maxScrolls = Math.min(20, Math.max(4, Math.ceil(limit / 10)));
      let previousCount = 0;
      let stagnantScrolls = 0;
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await page.waitForTimeout(1800);
        await settlePendingSafely(pendingResponses);
        await collectVisibleTweets(page, tweets);
        const uniqueCount = new Set(tweets.map((tweet) => tweet.id)).size;
        stagnantScrolls = uniqueCount > previousCount ? 0 : stagnantScrolls + 1;
        previousCount = uniqueCount;
        if (uniqueCount >= limit || stagnantScrolls >= 3) break;
      }
      await settlePendingSafely(pendingResponses);

      const uniqueMap = new Map<string, LocalXTweet>();
      for (const t of tweets) {
        const createdAt = new Date(t.createdAt).getTime();
        if (createdAt < sinceTime * 1000 || createdAt > untilTime * 1000) {
          continue;
        }
        mergeTweetIntoMap(uniqueMap, t);
      }

      pooled.release();
      return { tweets: Array.from(uniqueMap.values()).slice(0, limit) };
    } catch (error) {
      pooled.release();
      throw new Error(
        `Error en búsqueda local de X (${query}): ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    }
  },
};
