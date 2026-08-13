import { describe, expect, it } from "vitest";
import type { AccountConfig } from "@/types/social";
import { mergeAccounts } from "./accounts";

const account = (patch: Partial<AccountConfig> = {}): AccountConfig => ({
  id: "stable-id",
  name: "Nombre original",
  position: "Cargo",
  ministry: "Ministerio",
  accountType: "minister",
  xUsername: "cuenta_x",
  instagramUsername: "cuenta_ig",
  aliases: ["alias original"],
  active: true,
  ...patch,
});

describe("account configuration migration", () => {
  it("preserves edited names and intentionally empty usernames by stable id", () => {
    const result = mergeAccounts(
      [account({ name: "Nombre elegido", xUsername: "", aliases: [] })],
      [account()],
    );

    expect(result[0]).toMatchObject({
      id: "stable-id",
      name: "Nombre elegido",
      xUsername: "",
    });
    expect(result[0].aliases).toContain("alias original");
  });
});
