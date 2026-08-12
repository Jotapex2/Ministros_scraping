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
  url?: string;
  inReplyToId?: string;
}

export const localX = {
  profile: async (username: string) => {
    const cleanUser = username.replace(/^@/, "").trim();
    const { browser, context } = await getScraperContext("x");

    try {
      const page = await context.newPage();
      let capturedProfile: Record<string, unknown> | null = null;

      page.on("response", async (response: any) => {
        const url = response.url();
        if (url.includes("/UserByScreenName") || url.includes("/UserDetail")) {
          try {
            const json = await response.json();
            const result = json?.data?.user?.result;
            if (result) {
              const legacy = result.legacy || {};
              capturedProfile = {
                username: legacy.screen_name || cleanUser,
                name: legacy.name || cleanUser,
                followersCount: legacy.followers_count || 0,
                description: legacy.description || "",
                profileImageUrl: legacy.profile_image_url_https || "",
              };
            }
          } catch {}
        }
      });

      await page.goto(`https://x.com/${cleanUser}`, { waitUntil: "networkidle", timeout: 25000 });
      await page.waitForTimeout(2000);

      if (!capturedProfile) {
        // Fallback DOM extraction
        const followersText = await page.locator('a[href*="/verified_followers"] span, a[href*="/followers"] span').first().innerText().catch(() => "0");
        const followersNum = parseInt(followersText.replace(/[^0-9]/g, "")) || 0;
        capturedProfile = {
          username: cleanUser,
          name: cleanUser,
          followersCount: followersNum,
        };
      }

      await browser.close();
      return capturedProfile;
    } catch (error) {
      await browser.close();
      throw new Error(`Error en scraper local de X (perfil @${cleanUser}): ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  },

  timeline: async (username: string, _cursor?: string, _includeReplies = false) => {
    const cleanUser = username.replace(/^@/, "").trim();
    const { browser, context } = await getScraperContext("x");

    try {
      const page = await context.newPage();
      const tweets: LocalXTweet[] = [];

      page.on("response", async (response: any) => {
        const url = response.url();
        if (url.includes("/UserTweets") || url.includes("/UserByScreenName") || url.includes("TweetDetail")) {
          try {
            const json = await response.json();
            const instructions = json?.data?.user?.result?.timeline_v2?.timeline?.instructions || json?.data?.threaded_conversation_with_injections_v2?.instructions || [];
            
            for (const inst of instructions) {
              const entries = inst.entries || inst.moduleItems || [];
              for (const entry of entries) {
                const item = entry?.content?.itemContent?.tweet_results?.result || entry?.item?.itemContent?.tweet_results?.result;
                const tweetData = item?.tweet || item;
                const legacy = tweetData?.legacy;
                const userLegacy = tweetData?.core?.user_results?.result?.legacy;

                if (legacy && legacy.id_str) {
                  tweets.push({
                    id: legacy.id_str,
                    text: legacy.full_text || legacy.text || "",
                    createdAt: legacy.created_at || new Date().toISOString(),
                    author: {
                      userName: userLegacy?.screen_name || cleanUser,
                      name: userLegacy?.name || cleanUser,
                      followersCount: userLegacy?.followers_count,
                    },
                    likeCount: legacy.favorite_count || 0,
                    replyCount: legacy.reply_count || 0,
                    retweetCount: legacy.retweet_count || 0,
                    quoteCount: legacy.quote_count || 0,
                    url: `https://x.com/${userLegacy?.screen_name || cleanUser}/status/${legacy.id_str}`,
                  });
                }
              }
            }
          } catch {}
        }
      });

      await page.goto(`https://x.com/${cleanUser}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Scroll a bit to fetch more items
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(1500);
      }

      // Deduplicate tweets by id
      const uniqueMap = new Map<string, LocalXTweet>();
      for (const t of tweets) {
        uniqueMap.set(t.id, t);
      }

      await browser.close();
      return { tweets: Array.from(uniqueMap.values()), next_cursor: "" };
    } catch (error) {
      await browser.close();
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
            const instructions = json?.data?.threaded_conversation_with_injections_v2?.instructions || [];

            for (const inst of instructions) {
              const entries = inst.entries || [];
              for (const entry of entries) {
                const item = entry?.content?.itemContent?.tweet_results?.result;
                const legacy = item?.legacy;
                const userLegacy = item?.core?.user_results?.result?.legacy;

                if (legacy && legacy.id_str && legacy.id_str !== tweetId) {
                  replies.push({
                    id: legacy.id_str,
                    text: legacy.full_text || legacy.text || "",
                    createdAt: legacy.created_at || new Date().toISOString(),
                    author: {
                      userName: userLegacy?.screen_name || "desconocido",
                      name: userLegacy?.name || "Desconocido",
                      followersCount: userLegacy?.followers_count,
                    },
                    likeCount: legacy.favorite_count || 0,
                    replyCount: legacy.reply_count || 0,
                    retweetCount: legacy.retweet_count || 0,
                    inReplyToId: tweetId,
                  });
                }
              }
            }
          } catch {}
        }
      });

      await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2500);

      const uniqueMap = new Map<string, LocalXTweet>();
      for (const r of replies) {
        uniqueMap.set(r.id, r);
      }

      await browser.close();
      return { replies: Array.from(uniqueMap.values()), next_cursor: "" };
    } catch (error) {
      await browser.close();
      return { replies: [], next_cursor: "" };
    }
  },

  search: async (query: string, _sinceTime: number, _untilTime: number) => {
    const { browser, context } = await getScraperContext("x");

    try {
      const page = await context.newPage();
      const tweets: LocalXTweet[] = [];

      page.on("response", async (response: any) => {
        const url = response.url();
        if (url.includes("/SearchTimeline")) {
          try {
            const json = await response.json();
            const instructions = json?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];

            for (const inst of instructions) {
              const entries = inst.entries || [];
              for (const entry of entries) {
                const item = entry?.content?.itemContent?.tweet_results?.result;
                const legacy = item?.legacy;
                const userLegacy = item?.core?.user_results?.result?.legacy;

                if (legacy && legacy.id_str) {
                  tweets.push({
                    id: legacy.id_str,
                    text: legacy.full_text || legacy.text || "",
                    createdAt: legacy.created_at || new Date().toISOString(),
                    author: {
                      userName: userLegacy?.screen_name || "desconocido",
                      name: userLegacy?.name || "Desconocido",
                      followersCount: userLegacy?.followers_count,
                    },
                    likeCount: legacy.favorite_count || 0,
                    replyCount: legacy.reply_count || 0,
                    retweetCount: legacy.retweet_count || 0,
                    quoteCount: legacy.quote_count || 0,
                  });
                }
              }
            }
          } catch {}
        }
      });

      const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
      await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);

      const uniqueMap = new Map<string, LocalXTweet>();
      for (const t of tweets) {
        uniqueMap.set(t.id, t);
      }

      await browser.close();
      return { tweets: Array.from(uniqueMap.values()) };
    } catch (error) {
      await browser.close();
      return { tweets: [] };
    }
  },
};
