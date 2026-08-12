import type { SocialPost } from "@/types/social";
import type { SentimentResult } from "@/types/social";
import { plain } from "@/lib/utils";
const STOPWORDS = new Set(
  "a al algo ante bajo cada como con contra cual cuando de del desde donde el ella en entre era es esa ese esta este esto fue ha hacia hay la las lo los mas me mi muy ni no o para pero por porque que se ser si sin sobre son su sus te tu un una y ya gobierno chile ministro ministra".split(
    " ",
  ),
);
export interface WordFrequency {
  word: string;
  frequency: number;
  score: number;
}
export function wordFrequencies(
  posts: SocialPost[],
  sentiments?: SentimentResult[],
  sentiment?: "positive" | "negative" | "neutral",
) {
  const allowed =
    sentiments && sentiment
      ? new Set(
          sentiments
            .filter((item) => item.sentiment === sentiment)
            .map((item) => item.itemId),
        )
      : null;
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (allowed && !allowed.has(post.id)) continue;
    const unique = new Set(
      plain(post.text)
        .replace(/https?:\/\/\S+|@[\w.]+|#[\w]+/g, " ")
        .match(/[a-z]{3,}/g) ?? [],
    );
    for (const word of unique)
      if (!STOPWORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  return [...counts]
    .map(([word, frequency]) => ({ word, frequency, score: frequency / max }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 60);
}
