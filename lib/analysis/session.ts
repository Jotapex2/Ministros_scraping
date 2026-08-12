import type {
  AnalysisConfig,
  AnalysisSession,
  TopicResult,
} from "@/types/analysis";
import type { SentimentResult, SocialPost } from "@/types/social";
import { calculateMetrics, engagementBasic } from "@/lib/social/metrics";
import { slugify } from "@/lib/utils";
export function emptySession(config: AnalysisConfig): AnalysisSession {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "running",
    stage: "Validando configuración",
    config,
    posts: [],
    profiles: [],
    sentiments: [],
    topics: [],
    quality: {
      x: { requested: 0, succeeded: 0, errors: 0, posts: 0 },
      instagram: { requested: 0, succeeded: 0, errors: 0, posts: 0 },
      deepseek: { processed: 0, errors: 0, uncertain: 0, omitted: 0 },
    },
    executiveSummary: [],
    errors: [],
  };
}
export function aggregateTopics(
  posts: SocialPost[],
  sentiments: SentimentResult[],
  assignments: {
    id: string;
    topicName: string;
    summary: string;
    keywords: string[];
  }[],
): TopicResult[] {
  const postMap = new Map(posts.map((post) => [post.id, post]));
  const sentimentMap = new Map(sentiments.map((item) => [item.itemId, item]));
  const groups = new Map<string, typeof assignments>();
  assignments.forEach((item) => {
    const key = slugify(item.topicName);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.entries()]
    .map(([id, items]) => {
      const linked = items
        .map((item) => postMap.get(item.id))
        .filter(Boolean) as SocialPost[];
      const s = { positive: 0, negative: 0, neutral: 0, uncertain: 0 };
      linked.forEach((post) => {
        const result = sentimentMap.get(post.id);
        if (result) s[result.sentiment]++;
      });
      const total = Object.values(s).reduce((a, b) => a + b, 0);
      return {
        id,
        topicName: items[0].topicName,
        summary: items[0].summary,
        posts: linked.filter((item) => !item.isComment).length,
        comments: linked.filter((item) => item.isComment).length,
        uniqueAuthors: new Set(
          linked.map((item) => `${item.platform}:${item.username}`),
        ).size,
        engagement: linked.reduce(
          (sum, item) => sum + engagementBasic(item),
          0,
        ),
        ...s,
        netSentiment: total ? ((s.positive - s.negative) / total) * 100 : 0,
        platformDistribution: {
          x: linked.length
            ? (linked.filter((item) => item.platform === "x").length /
                linked.length) *
              100
            : 0,
          instagram: linked.length
            ? (linked.filter((item) => item.platform === "instagram").length /
                linked.length) *
              100
            : 0,
        },
        keywords: [...new Set(items.flatMap((item) => item.keywords))].slice(
          0,
          12,
        ),
      };
    })
    .sort((a, b) => b.posts + b.comments - a.posts - a.comments)
    .slice(0, 10);
}
export function finalizeSession(session: AnalysisSession) {
  session.metrics = calculateMetrics(
    session.posts,
    session.profiles,
    session.sentiments,
    session.config.accounts,
    session.topics,
  );
  const rankingPosts = [...session.metrics.ministerRankings].sort(
    (a, b) => b.postsX + b.postsInstagram - a.postsX - a.postsInstagram,
  )[0];
  const rankingEng = [...session.metrics.ministerRankings].sort(
    (a, b) => b.engagement - a.engagement,
  )[0];
  const rankingMentions = [...session.metrics.ministerRankings].sort(
    (a, b) =>
      b.mentionsX + b.mentionsInstagram - a.mentionsX - a.mentionsInstagram,
  )[0];
  const topTopic = session.topics[0];
  const totalPlatform =
    session.metrics.platformMetrics.x.posts +
    session.metrics.platformMetrics.instagram.posts;
  const gs = session.metrics.governmentSentiment;
  const st = Object.values(gs).reduce((a, b) => a + b, 0);
  session.executiveSummary = [
    rankingPosts &&
      `${rankingPosts.name} fue quien más publicó, con ${rankingPosts.postsX + rankingPosts.postsInstagram} publicaciones.`,
    rankingEng &&
      `${rankingEng.name} obtuvo la mayor interacción principal, con ${Math.round(rankingEng.engagement)} interacciones.`,
    rankingMentions &&
      `${rankingMentions.name} fue el ministro más mencionado, con ${rankingMentions.mentionsX + rankingMentions.mentionsInstagram} menciones.`,
    totalPlatform &&
      `X concentró ${Math.round((session.metrics.platformMetrics.x.posts / totalPlatform) * 100)}% de las publicaciones recuperadas e Instagram ${Math.round((session.metrics.platformMetrics.instagram.posts / totalPlatform) * 100)}%.`,
    topTopic &&
      `${topTopic.topicName} fue el tema con mayor volumen observado, con ${topTopic.posts + topTopic.comments} piezas de conversación.`,
    st &&
      `El sentimiento gubernamental clasificado fue ${Math.round((gs.positive / st) * 100)}% positivo, ${Math.round((gs.neutral / st) * 100)}% neutral, ${Math.round((gs.negative / st) * 100)}% negativo y ${Math.round((gs.uncertain / st) * 100)}% incierto.`,
  ].filter(Boolean) as string[];
  return session;
}
