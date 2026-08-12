const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const nullableNumber = (...values) => {
  const value = firstDefined(...values);
  if (value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nullableText = (...values) => {
  const value = firstDefined(...values);
  return value === undefined ? null : String(value);
};

const normalizeComment = (comment) => ({
  id: nullableText(comment.id, comment.pk, comment.commentId),
  text: nullableText(comment.text, comment.comment),
  ownerUsername: nullableText(
    comment.ownerUsername,
    comment.owner?.username,
    comment.username,
  ),
  timestamp: nullableText(
    comment.timestamp,
    comment.createdAt,
    comment.created_at,
  ),
  likesCount: nullableNumber(comment.likesCount, comment.likeCount),
});

export function normalizeInstagramPost(item, includeComments = true) {
  const shortCode = nullableText(item.shortCode, item.shortcode, item.code);
  const username = nullableText(
    item.ownerUsername,
    item.owner?.username,
    item.username,
  );
  const comments = firstDefined(item.latestComments, item.comments);

  return {
    id: nullableText(item.id, item.pk, shortCode),
    platform: "instagram",
    type: nullableText(item.type, item.productType),
    shortCode,
    url: nullableText(
      item.url,
      shortCode ? `https://www.instagram.com/p/${shortCode}/` : undefined,
    ),
    caption: nullableText(item.caption, item.text, item.description),
    timestamp: nullableText(
      item.timestamp,
      item.takenAt,
      item.createdAt,
      item.date,
    ),
    likesCount: nullableNumber(item.likesCount, item.likeCount, item.likes),
    commentsCount: nullableNumber(item.commentsCount, item.commentCount),
    videoViewCount: nullableNumber(
      item.videoViewCount,
      item.videoPlayCount,
      item.viewsCount,
    ),
    ownerUsername: username,
    ownerFullName: nullableText(
      item.ownerFullName,
      item.owner?.fullName,
      item.fullName,
    ),
    followersCount: nullableNumber(
      item.followersCount,
      item.ownerFollowersCount,
      item.owner?.followersCount,
    ),
    hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
    latestComments:
      includeComments && Array.isArray(comments)
        ? comments.map(normalizeComment)
        : [],
    inputUrl: nullableText(item.inputUrl),
    scrapedAt: new Date().toISOString(),
  };
}
