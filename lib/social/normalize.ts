import type {
  AccountConfig,
  Platform,
  SocialPost,
  SocialProfileSnapshot,
} from "@/types/social";
import { available, cleanUsername } from "@/lib/utils";

const pick = (raw: Record<string, unknown>, names: string[]) => {
  for (const name of names) {
    const value = name
      .split(".")
      .reduce<unknown>(
        (current, key) =>
          current && typeof current === "object"
            ? (current as Record<string, unknown>)[key]
            : undefined,
        raw,
      );
    if (value !== undefined && value !== null) return value;
  }
};
const num = (value: unknown) =>
  typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : undefined;
const text = (value: unknown) => (typeof value === "string" ? value : "");

export function normalizePost(
  raw: Record<string, unknown>,
  platform: Platform,
  account?: AccountConfig,
  isComment = false,
): SocialPost | null {
  const id = text(
    pick(raw, ["id", "postId", "tweetId", "shortCode", "pk", "code"]),
  );
  const body = text(
    pick(raw, ["text", "fullText", "caption", "content", "description"]),
  );
  const created = pick(raw, [
    "createdAt",
    "timestamp",
    "takenAt",
    "date",
    "created_at",
  ]);
  if (!id || !created) return null;
  const username = cleanUsername(
    text(
      pick(raw, [
        "author.userName",
        "author.username",
        "ownerUsername",
        "username",
        "user.username",
      ]),
    ) ||
      account?.[platform === "x" ? "xUsername" : "instagramUsername"] ||
      "desconocido",
  );
  return {
    id,
    platform,
    authorName:
      text(
        pick(raw, [
          "author.name",
          "ownerFullName",
          "fullName",
          "user.full_name",
        ]),
      ) ||
      account?.name ||
      username,
    username,
    authorType: account?.accountType ?? "public",
    accountId: account?.id,
    ministerId: account?.accountType === "minister" ? account.id : undefined,
    text: body,
    createdAt: new Date(created as string | number).toISOString(),
    likes: available(
      num(pick(raw, ["likeCount", "likesCount", "likes", "diggCount"])),
    ),
    comments: available(
      num(
        pick(raw, ["replyCount", "commentsCount", "commentCount", "comments"]),
      ),
    ),
    shares: available(num(pick(raw, ["shareCount", "sharesCount", "shares"]))),
    reposts: available(
      num(pick(raw, ["retweetCount", "repostCount", "reposts"])),
    ),
    quotes: available(num(pick(raw, ["quoteCount", "quotesCount", "quotes"]))),
    views: available(
      num(pick(raw, ["viewCount", "videoViewCount", "viewsCount", "views"])),
    ),
    followers: available(
      num(pick(raw, ["author.followers", "author.followersCount", "ownerFollowers", "followersCount"])),
    ),
    url: text(pick(raw, ["url", "postUrl", "inputUrl", "displayUrl"])),
    hashtags: Array.isArray(pick(raw, ["hashtags"]))
      ? (pick(raw, ["hashtags"]) as unknown[]).map(String)
      : [...body.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) => match[1]),
    parentPostId:
      text(pick(raw, ["parentPostId", "inReplyToId", "replyToId"])) ||
      undefined,
    isComment,
  };
}

export function normalizeProfile(
  raw: Record<string, unknown>,
  platform: Platform,
  account: AccountConfig,
): SocialProfileSnapshot {
  return {
    accountId: account.id,
    platform,
    username:
      cleanUsername(
        text(pick(raw, ["userName", "username", "ownerUsername"])),
      ) || account[platform === "x" ? "xUsername" : "instagramUsername"],
    followers: available(
      num(pick(raw, ["followers", "followersCount", "edge_followed_by.count"])),
    ),
    capturedAt: new Date().toISOString(),
  };
}

export function deduplicatePosts(posts: SocialPost[]) {
  const map = new Map<string, SocialPost>();
  for (const post of posts)
    map.set(`${post.platform}:${post.id || post.url}`, post);
  return [...map.values()];
}
