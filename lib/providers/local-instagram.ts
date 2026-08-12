import { getScraperContext } from "./session-manager";

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

type AnyObject = Record<string, unknown>;

function checkInstagramSession(page: any) {
  const url = page.url();
  if (
    url.includes("/accounts/login") ||
    url.includes("/challenge/") ||
    url.includes("/accounts/suspended")
  ) {
    throw new Error(
      "La sesión de Instagram expiró o requiere verificación. Vuelve a autenticar Instagram.",
    );
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

export const localInstagram = {
  getAccountPosts: async (
    username: string,
    limit = 20,
    sinceTime?: number,
  ) => {
    const cleanUser = username.replace(/^@/, "").trim();
    const { browser, context } = await getScraperContext("instagram");

    try {
      const page = await context.newPage();
      const posts = new Map<string, LocalInstagramPost>();
      const pendingResponses = new Set<Promise<void>>();

      const collect = (json: unknown) => {
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
              const contentType = response.headers()["content-type"] ?? "";
              if (!contentType.includes("json")) return;
              collect(await response.json());
            } catch {}
          })();
          pendingResponses.add(task);
          void task.finally(() => pendingResponses.delete(task));
        }
      });

      await page.goto(`https://www.instagram.com/${cleanUser}/`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(3500);
      checkInstagramSession(page);

      // Algunas respuestas iniciales están embebidas en scripts y no pasan por
      // el listener de red cuando Instagram reutiliza caché.
      const embedded = await page
        .locator('script[type="application/json"]')
        .allTextContents()
        .catch(() => [] as string[]);
      for (const content of embedded) {
        try {
          collect(JSON.parse(content));
        } catch {}
      }

      const maxScrolls = Math.min(30, Math.max(6, Math.ceil(limit / 6) + 4));
      let previousCount = posts.size;
      let stagnantScrolls = 0;
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, 1600));
        await page.waitForTimeout(1600);
        await Promise.allSettled([...pendingResponses]);

        stagnantScrolls = posts.size > previousCount ? 0 : stagnantScrolls + 1;
        previousCount = posts.size;
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
      }

      await page.waitForTimeout(500);
      await Promise.allSettled([...pendingResponses]);
      return [...posts.values()]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, limit);
    } catch (error) {
      throw new Error(
        `Error en scraper local de Instagram (@${cleanUser}): ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    } finally {
      await browser.close().catch(() => undefined);
    }
  },

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
