import { describe, expect, it } from "vitest";
import { engagementBasic, engagementExpanded } from "./metrics";
import type { SocialPost } from "@/types/social";

const metric = (value: number) => ({ status: "available" as const, value });
const post = {
  likes: metric(10),
  comments: metric(4),
  shares: metric(2),
  reposts: metric(3),
  quotes: metric(1),
  views: metric(100),
  followers: metric(1000),
} as SocialPost;

describe("engagement", () => {
  it("keeps basic and expanded engagement separate", () => {
    expect(engagementBasic(post)).toBe(14);
    expect(engagementExpanded(post)).toBe(20);
  });
});
