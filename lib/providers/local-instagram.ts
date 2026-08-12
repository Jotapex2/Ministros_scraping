import { getScraperContext } from "./session-manager";

export interface LocalInstagramPost {
  id: string;
  shortCode: string;
  caption: string;
  createdAt: string;
  ownerUsername: string;
  ownerFullName?: string;
  ownerFollowers?: number;
  likesCount?: number;
  commentsCount?: number;
  url?: string;
  latestComments?: Array<{
    id: string;
    text: string;
    ownerUsername: string;
    createdAt: string;
  }>;
}

export const localInstagram = {
  getAccountPosts: async (username: string, limit = 20) => {
    const cleanUser = username.replace(/^@/, "").trim();
    const { browser, context } = await getScraperContext("instagram");

    try {
      const page = await context.newPage();
      const posts: LocalInstagramPost[] = [];

      page.on("response", async (response: any) => {
        const url = response.url();
        if (url.includes("/graphql/query") || url.includes("/api/v1/feed/user")) {
          try {
            const json = await response.json();
            const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges || json?.items || [];
            
            for (const edge of edges) {
              const node = edge.node || edge;
              if (node && (node.id || node.pk)) {
                const captionText = node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || "";
                const shortcode = node.shortcode || node.code || "";
                const timestamp = node.taken_at_timestamp || node.taken_at || Date.now() / 1000;
                
                posts.push({
                  id: String(node.id || node.pk),
                  shortCode: shortcode,
                  caption: captionText,
                  createdAt: new Date(timestamp * 1000).toISOString(),
                  ownerUsername: cleanUser,
                  likesCount: node.edge_media_preview_like?.count || node.like_count || 0,
                  commentsCount: node.edge_media_to_comment?.count || node.comment_count || 0,
                  url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : undefined,
                });
              }
            }
          } catch {}
        }
      });

      await page.goto(`https://www.instagram.com/${cleanUser}/`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);

      // Scroll to trigger more media fetching
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(1500);
      }

      // Deduplicate posts
      const uniqueMap = new Map<string, LocalInstagramPost>();
      for (const p of posts) {
        uniqueMap.set(p.id, p);
      }

      const result = Array.from(uniqueMap.values()).slice(0, limit);
      await browser.close();
      return result;
    } catch (error) {
      await browser.close();
      throw new Error(`Error en scraper local de Instagram (@${cleanUser}): ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  },

  getAllAccountsPosts: async (usernames: string[], limitPerAccount = 20) => {
    const allPosts: LocalInstagramPost[] = [];

    for (const username of usernames) {
      try {
        const posts = await localInstagram.getAccountPosts(username, limitPerAccount);
        allPosts.push(...posts);
      } catch (error) {
        console.error(`Error scraping Instagram para ${username}:`, error);
      }
    }

    return allPosts;
  },
};
