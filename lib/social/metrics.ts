import type {
  AccountConfig,
  SentimentResult,
  SocialPost,
  SocialProfileSnapshot,
} from "@/types/social";
import type {
  AnalysisMetrics,
  MinisterMetric,
  TopicResult,
} from "@/types/analysis";
import { numeric } from "@/lib/utils";
import { mentionedAccounts } from "./mentions";

export const engagementBasic = (post: SocialPost) =>
  numeric(post.likes) + numeric(post.comments);
export const engagementExpanded = (post: SocialPost) =>
  engagementBasic(post) +
  numeric(post.shares) +
  numeric(post.reposts) +
  numeric(post.quotes);
const emptySentiment = () => ({
  positive: 0,
  negative: 0,
  neutral: 0,
  uncertain: 0,
});

function top(items: SocialPost[]): SocialPost | undefined {
  let best: SocialPost | undefined;
  let bestLikes = -1;
  for (const item of items) {
    const likes = numeric(item.likes);
    if (likes > bestLikes) {
      bestLikes = likes;
      best = item;
    }
  }
  return best;
}

export function calculateMetrics(
  posts: SocialPost[],
  profiles: SocialProfileSnapshot[],
  sentiments: SentimentResult[],
  accounts: AccountConfig[],
  _topics: TopicResult[] = [],
): AnalysisMetrics {
  const sentimentById = new Map(sentiments.map((item) => [item.itemId, item]));
  const governmentSentiment = emptySentiment();
  const sentiment = emptySentiment();
  for (const result of sentiments) {
    sentiment[result.sentiment]++;
    if (
      ["government", "president", "institution", "public_policy"].includes(
        result.targetKind,
      )
    )
      governmentSentiment[result.sentiment]++;
  }

  const mentions = new Map(
    posts.map((post) => [post.id, mentionedAccounts(post, accounts)]),
  );

  const ministerAccounts = accounts.filter(
    (account) => account.active && account.accountType === "minister",
  );

  const totalMinisterMentions = [...mentions.values()].reduce(
    (sum, ids) => sum + ids.length,
    0,
  );

  const ownByAccount = new Map<string, SocialPost[]>();
  for (const post of posts) {
    if (post.isComment || !post.accountId) continue;
    const list = ownByAccount.get(post.accountId);
    if (list) list.push(post);
    else ownByAccount.set(post.accountId, [post]);
  }

  const citedByAccount = new Map<string, SocialPost[]>();
  for (const post of posts) {
    const mentionIds = mentions.get(post.id);
    if (!mentionIds?.length) continue;
    for (const accountId of mentionIds) {
      const list = citedByAccount.get(accountId);
      if (list) list.push(post);
      else citedByAccount.set(accountId, [post]);
    }
  }

  const profileByAccountPlatform = new Map<string, number | undefined>();
  for (const p of profiles) {
    const key = `${p.accountId}:${p.platform}`;
    const existing = profileByAccountPlatform.get(key);
    if (existing == null || p.followers.value != null) {
      profileByAccountPlatform.set(key, p.followers.value);
    }
  }

  const ministerRankings: MinisterMetric[] = ministerAccounts.map((account) => {
    const own = ownByAccount.get(account.id) ?? [];
    const cited = citedByAccount.get(account.id) ?? [];
    const sentimentsForMinister = cited
      .map((post) => sentimentById.get(post.id))
      .filter(Boolean) as SentimentResult[];
    const counts = emptySentiment();
    sentimentsForMinister.forEach((item) => counts[item.sentiment]++);
    const opinions =
      counts.positive + counts.negative + counts.neutral + counts.uncertain;

    let postsX = 0;
    let postsInstagram = 0;
    let likesX = 0;
    let commentsX = 0;
    let likesInstagram = 0;
    let commentsInstagram = 0;
    let mentionsX = 0;
    let mentionsInstagram = 0;
    let totalEngagement = 0;
    for (const post of own) {
      totalEngagement += engagementBasic(post);
      if (post.platform === "x") {
        postsX++;
        likesX += numeric(post.likes);
        commentsX += numeric(post.comments);
      } else {
        postsInstagram++;
        likesInstagram += numeric(post.likes);
        commentsInstagram += numeric(post.comments);
      }
    }
    for (const post of cited) {
      if (post.platform === "x") mentionsX++;
      else mentionsInstagram++;
    }

    return {
      accountId: account.id,
      name: account.name,
      position: account.position,
      postsX,
      postsInstagram,
      likesX,
      commentsX,
      likesInstagram,
      commentsInstagram,
      engagement: totalEngagement,
      averageEngagement: own.length ? totalEngagement / own.length : 0,
      mentionsX,
      mentionsInstagram,
      uniqueAuthors: new Set(
        cited.map((post) => `${post.platform}:${post.username}`),
      ).size,
      ...counts,
      netSentiment: opinions
        ? (counts.positive / opinions - counts.negative / opinions) * 100
        : 0,
      followersX: profileByAccountPlatform.get(`${account.id}:x`),
      followersInstagram: profileByAccountPlatform.get(
        `${account.id}:instagram`,
      ),
      shareOfVoice: totalMinisterMentions
        ? (cited.length / totalMinisterMentions) * 100
        : 0,
    };
  });

  const postsByPlatform = new Map<string, SocialPost[]>();
  for (const post of posts) {
    const list = postsByPlatform.get(post.platform);
    if (list) list.push(post);
    else postsByPlatform.set(post.platform, [post]);
  }

  const sentimentByItemId = new Set(sentiments.map((r) => r.itemId));

  const platformMetrics = Object.fromEntries(
    (["x", "instagram"] as const).map((platform) => {
      const items = postsByPlatform.get(platform) ?? [];
      const s = emptySentiment();
      for (const result of sentiments) {
        if (items.some((item) => item.id === result.itemId)) {
          s[result.sentiment]++;
        }
      }
      let interactions = 0;
      let mentionsCount = 0;
      let nonComments = 0;
      let commentCount = 0;
      for (const item of items) {
        interactions += engagementBasic(item);
        mentionsCount += mentions.get(item.id)?.length ?? 0;
        if (item.isComment) commentCount++;
        else nonComments++;
      }
      return [
        platform,
        {
          posts: nonComments,
          comments: commentCount,
          interactions,
          mentions: mentionsCount,
          averageEngagement: items.length ? interactions / items.length : 0,
          sentiment: s,
        },
      ];
    }),
  ) as AnalysisMetrics["platformMetrics"];

  const institutional = posts.filter(
    (post) => post.authorType === "institutional" && !post.isComment,
  );

  let publications = 0;
  let commentCount = 0;
  let interactionsBasic = 0;
  let interactionsExpanded = 0;
  const uniqueUsers = new Set<string>();
  for (const post of posts) {
    if (post.isComment) commentCount++;
    else publications++;
    interactionsBasic += engagementBasic(post);
    interactionsExpanded += engagementExpanded(post);
    uniqueUsers.add(`${post.platform}:${post.username}`);
  }

  return {
    publications,
    comments: commentCount,
    interactionsBasic,
    interactionsExpanded,
    governmentMentions: sentiments.filter((item) =>
      ["government", "president", "institution", "public_policy"].includes(
        item.targetKind,
      ),
    ).length,
    ministerMentions: totalMinisterMentions,
    uniqueUsers: uniqueUsers.size,
    sentiment,
    governmentSentiment,
    ministerRankings,
    platformMetrics,
    topPosts: {
      x: top(institutional.filter((post) => post.platform === "x")),
      instagram: top(
        institutional.filter((post) => post.platform === "instagram"),
      ),
      general: top(institutional),
    },
  };
}
