import { describe, expect, it } from "vitest";
import { mentionedAccounts } from "./mentions";
import type { AccountConfig, SocialPost } from "@/types/social";

const post = {
  text: "Actividad de @mindefchile",
} as SocialPost;

const account = (id: string, accountType: AccountConfig["accountType"], aliases: string[]) =>
  ({
    id,
    name: id,
    position: "",
    ministry: "",
    accountType,
    xUsername: "",
    instagramUsername: "",
    aliases,
    active: true,
  }) satisfies AccountConfig;

describe("account mentions", () => {
  it("does not double-count an institutional handle used as a minister proxy", () => {
    const minister = account("fernando-barros", "minister", ["@mindefchile"]);
    const institution = account("defensa", "institutional", ["@mindefchile"]);

    expect(mentionedAccounts(post, [minister, institution])).toEqual([
      minister.id,
    ]);
  });
});
