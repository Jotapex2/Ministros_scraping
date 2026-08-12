import { describe, expect, it } from "vitest";
import { deduplicatePosts, normalizePost } from "./normalize";

describe("social normalization", () => {
  it("normalizes TwitterAPI.io fields", () => {
    const result = normalizePost(
      {
        id: "1",
        text: "Hola",
        createdAt: "2026-08-01T12:00:00Z",
        likeCount: 5,
        replyCount: 2,
        author: { userName: "cuenta", name: "Cuenta" },
      },
      "x",
    );
    expect(result?.likes.value).toBe(5);
    expect(result?.username).toBe("cuenta");
  });

  it("deduplicates by platform and id", () => {
    const item = normalizePost(
      { id: "1", caption: "Hola", timestamp: "2026-08-01", username: "cuenta" },
      "instagram",
    )!;
    expect(deduplicatePosts([item, item])).toHaveLength(1);
  });
});
