import {
  getScraperContext,
  markScraperSessionInvalid,
} from "./session-manager";

export interface LocalInstagramPost {
  id: string;
  shortCode: string;
  caption: string;
  createdAt: string;
  ownerUsername: string;
  ownerFullName?: string;
  ownerFollowers?: number;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  url?: string;
}

export interface LocalInstagramProfile {
  username: string;
  fullName?: string;
  followersCount?: number;
}

export interface LocalInstagramAccountData {
  profile: LocalInstagramProfile;
  posts: LocalInstagramPost[];
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

async function checkInstagramSession(page: any) {
  const url = page.url();
  const loginFormVisible = await page
    .locator('input[name="username"], input[name="password"]')
    .first()
    .isVisible()
    .catch(() => false);
  const loginPromptVisible = await page
    .locator(
      'form[action*="/accounts/login"], button:has-text("Log in"), button:has-text("Iniciar sesión")',
    )
    .first()
    .isVisible()
    .catch(() => false);
  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  if (
    url.includes("/accounts/login") ||
    url.includes("/challenge/") ||
    url.includes("/accounts/suspended") ||
    loginFormVisible ||
    loginPromptVisible ||
    /Log into Instagram|Inicia sesi[oó]n en Instagram/i.test(bodyText)
  ) {
    markScraperSessionInvalid("instagram");
    throw new Error(
      "La sesión de Instagram expiró o requiere verificación. Vuelve a autenticar Instagram.",
    );
  }
}

function compactNumber(value: string): number | undefined {
  const match = value.trim().match(/([\d.,]+)\s*([KM])?/i);
  if (!match) return undefined;
  const suffix = match[2]?.toUpperCase();
  const numericText = suffix
    ? match[1].replace(",", ".")
    : match[1].replace(/[.,]/g, "");
  const parsed = Number(numericText);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed * (suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : 1));
}

async function scrapeVisiblePostPage(
  context: any,
  url: string,
  username: string,
  followersCount?: number,
): Promise<LocalInstagramPost | null> {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1200);
    await checkInstagramSession(page);

    const createdAt = await page
      .locator("time[datetime]")
      .first()
      .getAttribute("datetime")
      .catch(() => null);
    if (!createdAt) return null;

    const description =
      (await page
        .locator('meta[property="og:description"]')
        .getAttribute("content")
        .catch(() => null)) ?? "";
    const postPath = new URL(page.url()).pathname;
    const pathMatch = postPath.match(/\/(?:p|reel)\/([^/]+)/);
    if (!pathMatch) return null;
    const shortCode = pathMatch[1];
    const likes = description.match(/([\d.,]+\s*[KM]?)\s+likes?/i)?.[1];
    const comments = description.match(/([\d.,]+\s*[KM]?)\s+comments?/i)?.[1];
    const quotedCaption = description.match(/:\s*[“"]([\s\S]*?)[”"]\s*$/)?.[1];
    const articleText = await page
      .locator("article")
      .first()
      .innerText()
      .catch(() => "");

    return {
      id: shortCode,
      shortCode,
      caption: quotedCaption ?? articleText.split("\n").slice(0, 8).join(" "),
      createdAt: new Date(createdAt).toISOString(),
      ownerUsername: username,
      ownerFollowers: followersCount,
      likeCount: likes ? compactNumber(likes) : undefined,
      commentCount: comments ? compactNumber(comments) : undefined,
      url: `https://www.instagram.com${postPath}`,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

function numeric(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nestedCount(value: unknown): number | undefined {
  if (value && typeof value === "object") {
    return numeric((value as AnyObject).count);
  }
  return numeric(value);
}

function profileFromJson(
  json: unknown,
  username: string,
): LocalInstagramProfile | undefined {
  const cleanUser = username.toLowerCase();
  const seen = new WeakSet<object>();
  let fallback: LocalInstagramProfile | undefined;

  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 16) return;
    if (seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }

    const record = value as AnyObject;
    const candidateUsername = String(record.username ?? "").replace(/^@/, "");
    if (candidateUsername.toLowerCase() === cleanUser) {
      const followersCount =
        numeric(record.follower_count) ??
        numeric(record.followers_count) ??
        numeric(record.followersCount) ??
        nestedCount(record.edge_followed_by) ??
        nestedCount(record.followers);
      const candidate = {
        username: candidateUsername,
        fullName:
          String(record.full_name ?? record.fullName ?? "") || undefined,
        followersCount,
      };
      if (followersCount != null) fallback = candidate;
      else fallback ??= candidate;
    }

    for (const child of Object.values(record)) visit(child, depth + 1);
  };

  visit(json, 0);
  return fallback;
}

function parseProfileMeta(
  content: string,
  username: string,
): LocalInstagramProfile | undefined {
  const match = content.match(/([\d.,]+)\s*(K|M|mil|mill[oó]n(?:es)?)?\s+(?:followers|seguidores)/i);
  if (!match) return undefined;
  const suffix = match[2]?.toLowerCase();
  const decimalText = match[1].replace(",", ".");
  const decimal = Number(
    decimalText.split(".").length > 2
      ? decimalText.replace(/\.(?=.*\.)/g, "")
      : decimalText,
  );
  const followersCount = suffix
    ? Math.round(
        decimal *
          (suffix === "k" || suffix === "mil" ? 1_000 : 1_000_000),
      )
    : Number(match[1].replace(/[.,]/g, ""));
  if (!Number.isFinite(followersCount)) return undefined;
  return { username, followersCount };
}

function extractNodes(json: unknown): AnyObject[] {
  const nodes: AnyObject[] = [];
  const seen = new WeakSet<object>();

  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 14) return;
    if (seen.has(value as object)) return;
    seen.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }

    const record = value as AnyObject;
    const hasId = record.pk != null || record.id != null;
    const hasTimestamp =
      record.taken_at != null ||
      record.taken_at_timestamp != null ||
      record.timestamp != null;
    const hasMediaCode = record.code != null || record.shortcode != null;
    if (hasId && hasTimestamp && hasMediaCode) nodes.push(record);

    for (const child of Object.values(record)) visit(child, depth + 1);
  };

  visit(json, 0);
  return nodes;
}

function mapPost(node: AnyObject, username: string): LocalInstagramPost | null {
  const id = node.pk ?? node.id;
  const shortCode = node.code ?? node.shortcode ?? "";
  const takenAt =
    node.taken_at ?? node.taken_at_timestamp ?? node.timestamp;
  if (id == null || takenAt == null || !shortCode) return null;

  const timestampNumber = numeric(takenAt);
  const timestampMs =
    timestampNumber != null
      ? timestampNumber > 10_000_000_000
        ? timestampNumber
        : timestampNumber * 1000
      : new Date(String(takenAt)).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  const captionRaw = node.caption as AnyObject | AnyObject[] | string | undefined;
  const edgeCaption = node.edge_media_to_caption as AnyObject | undefined;
  const edgeText = ((edgeCaption?.edges as AnyObject[] | undefined)?.[0]
    ?.node as AnyObject | undefined)?.text;
  const caption =
    typeof captionRaw === "string"
      ? captionRaw
      : Array.isArray(captionRaw)
        ? String((captionRaw[0] as AnyObject | undefined)?.text ?? "")
        : captionRaw && typeof captionRaw === "object"
          ? String(captionRaw.text ?? "")
          : typeof edgeText === "string"
            ? edgeText
            : "";

  const user = (node.user ?? node.owner) as AnyObject | undefined;
  const ownerUsername = String(user?.username ?? username).replace(/^@/, "");

  return {
    id: String(id),
    shortCode: String(shortCode),
    caption,
    createdAt: new Date(timestampMs).toISOString(),
    ownerUsername,
    ownerFullName: String(user?.full_name ?? user?.fullName ?? "") || undefined,
    ownerFollowers:
      nestedCount(user?.edge_followed_by) ?? numeric(user?.follower_count),
    likeCount:
      numeric(node.like_count) ??
      nestedCount(node.edge_liked_by) ??
      nestedCount(node.edge_media_preview_like),
    commentCount:
      numeric(node.comment_count) ?? nestedCount(node.edge_media_to_comment),
    viewCount:
      numeric(node.view_count) ??
      numeric(node.video_view_count) ??
      numeric(node.play_count),
    url: `https://www.instagram.com/p/${String(shortCode)}/`,
  };
}

async function scrapeAccount(
    username: string,
    limit = 20,
    sinceTime?: number,
  ): Promise<LocalInstagramAccountData> {
    const cleanUser = username.replace(/^@/, "").trim();
    const pooled = await getScraperContext("instagram");

    try {
      const page = await pooled.context.newPage();
      const posts = new Map<string, LocalInstagramPost>();
      const visiblePostUrls = new Map<string, string>();
      const pendingResponses = new Set<Promise<void>>();
      let profile: LocalInstagramProfile = { username: cleanUser };
      let resolveInitial: (() => void) | null = null;

      const collect = (json: unknown) => {
        const foundProfile = profileFromJson(json, cleanUser);
        if (
          foundProfile &&
          (profile.followersCount == null || foundProfile.followersCount != null)
        ) {
          profile = { ...profile, ...foundProfile };
        }
        for (const node of extractNodes(json)) {
          const post = mapPost(node, cleanUser);
          if (
            post &&
            post.ownerUsername.toLowerCase() === cleanUser.toLowerCase()
          ) {
            posts.set(post.id, post);
          }
        }
      };

      page.on("response", (response: any) => {
        const url = response.url();
        if (
          url.includes("/api/graphql") ||
          url.includes("/graphql/query") ||
          url.includes("/api/v1/feed/user") ||
          url.includes("PolarisProfilePosts")
        ) {
          const task = (async () => {
            try {
              collect(await response.json());
              if (resolveInitial) resolveInitial();
            } catch {}
          })();
          pendingResponses.add(task);
          void task.finally(() => pendingResponses.delete(task));
        }
      });

      const collectVisiblePostUrls = async () => {
        const hrefs = (await page
          .locator('a[href*="/p/"], a[href*="/reel/"]')
          .evaluateAll((links: Element[]) =>
            links
              .map((link) => link.getAttribute("href"))
              .filter((href): href is string => !!href),
          )
          .catch(() => [])) as string[];
        for (const href of hrefs) {
          const match = href.match(/\/(?:p|reel)\/([^/]+)/);
          if (match) {
            visiblePostUrls.set(
              match[1],
              new URL(href, "https://www.instagram.com").href,
            );
          }
        }
      };

      await page.goto(`https://www.instagram.com/${cleanUser}/`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });

      await new Promise<void>((resolve) => {
        resolveInitial = resolve;
        setTimeout(resolve, 3500);
      });

      await checkInstagramSession(page);
      await collectVisiblePostUrls();

      const embedded = await page
        .locator('script[type="application/json"]')
        .allTextContents()
        .catch(() => [] as string[]);
      for (const content of embedded) {
        try {
          collect(JSON.parse(content));
        } catch {}
      }

      if (profile.followersCount == null) {
        const metaContent = await page
          .locator('meta[property="og:description"]')
          .getAttribute("content")
          .catch(() => null);
        const metaProfile = metaContent
          ? parseProfileMeta(metaContent, cleanUser)
          : undefined;
        if (metaProfile) profile = { ...profile, ...metaProfile };
      }

      const maxScrolls = Math.min(30, Math.max(6, Math.ceil(limit / 6) + 4));
      let previousCount = posts.size;
      let stagnantScrolls = 0;
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 1600));
        await page.waitForTimeout(1600);
        await settlePendingSafely(pendingResponses);
        await collectVisiblePostUrls();

        stagnantScrolls = posts.size > previousCount ? 0 : stagnantScrolls + 1;
        previousCount = posts.size;
        if (posts.size > 0) {
          const oldestTime = Math.min(
            ...[...posts.values()].map((post) =>
              new Date(post.createdAt).getTime(),
            ),
          );
          if (
            posts.size >= limit ||
            (sinceTime != null &&
              Number.isFinite(oldestTime) &&
              oldestTime <= sinceTime) ||
            stagnantScrolls >= 3
          ) {
            break;
          }
        } else if (stagnantScrolls >= 3) {
          break;
        }
      }

      await page.waitForTimeout(500);
      await settlePendingSafely(pendingResponses);

      if (posts.size === 0 && visiblePostUrls.size > 0) {
        for (const [shortCode, url] of [...visiblePostUrls].slice(0, limit)) {
          const post = await scrapeVisiblePostPage(
            pooled.context,
            url,
            cleanUser,
            profile.followersCount,
          );
          if (!post) continue;
          posts.set(shortCode, post);
          if (
            sinceTime != null &&
            new Date(post.createdAt).getTime() <= sinceTime
          ) {
            break;
          }
        }
      }
      const sortedPosts = [...posts.values()]
        .map((post) => ({
          ...post,
          ownerFollowers: post.ownerFollowers ?? profile.followersCount,
        }))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, limit);
      return { profile, posts: sortedPosts };
    } catch (error) {
      throw new Error(
        `Error en scraper local de Instagram (@${cleanUser}): ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    } finally {
      pooled.release();
    }
  }

export const localInstagram = {
  getAccountData: scrapeAccount,

  getAccountPosts: async (
    username: string,
    limit = 20,
    sinceTime?: number,
  ) => (await scrapeAccount(username, limit, sinceTime)).posts,

  getAllAccountsPosts: async (usernames: string[], limitPerAccount = 20) => {
    const allPosts: LocalInstagramPost[] = [];
    for (const username of usernames) {
      try {
        allPosts.push(
          ...(await localInstagram.getAccountPosts(username, limitPerAccount)),
        );
      } catch (error) {
        console.error(`Error scraping Instagram para ${username}:`, error);
      }
    }
    return allPosts;
  },
};
