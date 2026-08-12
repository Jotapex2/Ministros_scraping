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

export function calculateMetrics(
  posts: SocialPost[],
  profiles: SocialProfileSnapshot[],
  sentiments: SentimentResult[],
  accounts: AccountConfig[],
  topics: TopicResult[] = [],
): AnalysisMetrics {
  void topics;
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
  const ministerRankings: MinisterMetric[] = ministerAccounts.map((account) => {
    const own = posts.filter(
      (post) => post.accountId === account.id && !post.isComment,
    );
    const cited = posts.filter((post) =>
      mentions.get(post.id)?.includes(account.id),
    );
    const sentimentsForMinister = cited
      .map((post) => sentimentById.get(post.id))
      .filter(Boolean) as SentimentResult[];
    const counts = emptySentiment();
    sentimentsForMinister.forEach((item) => counts[item.sentiment]++);
    const opinions =
      counts.positive + counts.negative + counts.neutral + counts.uncertain;
    const profile = (platform: "x" | "instagram") =>
      profiles.find(
        (item) => item.accountId === account.id && item.platform === platform,
      )?.followers.value;
    const basic = own.reduce((sum, post) => sum + engagementBasic(post), 0);
    return {
      accountId: account.id,
      name: account.name,
      position: account.position,
      postsX: own.filter((post) => post.platform === "x").length,
      postsInstagram: own.filter((post) => post.platform === "instagram")
        .length,
      likesX: own
        .filter((post) => post.platform === "x")
        .reduce((sum, post) => sum + numeric(post.likes), 0),
      commentsX: own
        .filter((post) => post.platform === "x")
        .reduce((sum, post) => sum + numeric(post.comments), 0),
      likesInstagram: own
        .filter((post) => post.platform === "instagram")
        .reduce((sum, post) => sum + numeric(post.likes), 0),
      commentsInstagram: own
        .filter((post) => post.platform === "instagram")
        .reduce((sum, post) => sum + numeric(post.comments), 0),
      engagement: basic,
      averageEngagement: own.length ? basic / own.length : 0,
      mentionsX: cited.filter((post) => post.platform === "x").length,
      mentionsInstagram: cited.filter((post) => post.platform === "instagram")
        .length,
      uniqueAuthors: new Set(
        cited.map((post) => `${post.platform}:${post.username}`),
      ).size,
      ...counts,
      netSentiment: opinions
        ? (counts.positive / opinions - counts.negative / opinions) * 100
        : 0,
      followersX: profile("x"),
      followersInstagram: profile("instagram"),
      shareOfVoice: totalMinisterMentions
        ? (cited.length / totalMinisterMentions) * 100
        : 0,
    };
  });
  const platformMetrics = Object.fromEntries(
    (["x", "instagram"] as const).map((platform) => {
      const items = posts.filter((post) => post.platform === platform);
      const s = emptySentiment();
      sentiments
        .filter((result) => items.some((item) => item.id === result.itemId))
        .forEach((result) => s[result.sentiment]++);
      return [
        platform,
        {
          posts: items.filter((post) => !post.isComment).length,
          comments: items.filter((post) => post.isComment).length,
          interactions: items.reduce(
            (sum, post) => sum + engagementBasic(post),
            0,
          ),
          mentions: items.reduce(
            (sum, post) => sum + (mentions.get(post.id)?.length ?? 0),
            0,
          ),
          averageEngagement: items.length
            ? items.reduce((sum, post) => sum + engagementBasic(post), 0) /
              items.length
            : 0,
          sentiment: s,
        },
      ];
    }),
  ) as AnalysisMetrics["platformMetrics"];
  const institutional = posts.filter(
    (post) => post.authorType === "institutional" && !post.isComment,
  );
  const top = (items: SocialPost[]) =>
    [...items].sort((a, b) => numeric(b.likes) - numeric(a.likes))[0];
  return {
    publications: posts.filter((post) => !post.isComment).length,
    comments: posts.filter((post) => post.isComment).length,
    interactionsBasic: posts.reduce(
      (sum, post) => sum + engagementBasic(post),
      0,
    ),
    interactionsExpanded: posts.reduce(
      (sum, post) => sum + engagementExpanded(post),
      0,
    ),
    governmentMentions: sentiments.filter((item) =>
      ["government", "president", "institution", "public_policy"].includes(
        item.targetKind,
      ),
    ).length,
    ministerMentions: totalMinisterMentions,
    uniqueUsers: new Set(
      posts.map((post) => `${post.platform}:${post.username}`),
    ).size,
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
