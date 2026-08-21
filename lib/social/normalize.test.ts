import { describe, expect, it } from "vitest";
import {
  deduplicatePosts,
  normalizePost,
  normalizeProfile,
} from "./normalize";
import type { AccountConfig } from "@/types/social";

const account = {
  id: "ministro",
  name: "Ministro",
  position: "Cartera",
  ministry: "Ministerio",
  accountType: "minister",
  xUsername: "ministro_x",
  instagramUsername: "ministro_ig",
  aliases: [],
  active: true,
} satisfies AccountConfig;

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

  it("keeps the account-attributed copy over a public search duplicate", () => {
    const publicCopy = normalizePost(
      { id: "2", text: "Hola", createdAt: "2026-08-01T12:00:00Z", username: "cuenta" },
      "x",
    )!;
    const accountCopy = normalizePost(
      { id: "2", text: "Hola", createdAt: "2026-08-01T12:00:00Z", username: "cuenta" },
      "x",
      account,
    )!;
    const result = deduplicatePosts([accountCopy, publicCopy]);
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe(account.id);
    expect(result[0].ministerId).toBe(account.id);
  });

  it("normalizes profile followers from X and Instagram scraper fields", () => {
    expect(
      normalizeProfile(
        { author: { userName: "ministro_x", followersCount: 33_992 } },
        "x",
        account,
      ).followers.value,
    ).toBe(33_992);
    expect(
      normalizeProfile(
        { username: "ministro_ig", followersCount: 92_739 },
        "instagram",
        account,
      ).followers.value,
    ).toBe(92_739);
  });
});
