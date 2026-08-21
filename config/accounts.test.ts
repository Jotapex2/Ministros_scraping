import { describe, expect, it } from "vitest";
import { defaultAccounts } from "./accounts";
import { uniqueSourceAccounts } from "@/lib/social/accounts";

describe("default government accounts", () => {
  it("includes 22 ministers and preserves intentional institutional proxies", () => {
    const ministers = defaultAccounts.filter(
      (account) => account.accountType === "minister",
    );
    const institutions = defaultAccounts.filter(
      (account) => account.accountType === "institutional",
    );

    expect(ministers).toHaveLength(22);
    expect(institutions.map((account) => account.xUsername)).toEqual(
      expect.arrayContaining(["mindefchile", "MinjuDDHH"]),
    );
    expect(
      ministers.find((account) => account.name === "Fernando Barros")
        ?.xUsername,
    ).toBe("mindefchile");
    expect(
      ministers.find((account) => account.name === "Fernando Rabat")
        ?.xUsername,
    ).toBe("MinjuDDHH");
    expect(
      ministers.filter((account) => account.proxyAccount).map((account) => account.name),
    ).toEqual(
      expect.arrayContaining(["Fernando Barros", "Fernando Rabat", "Francisco Riveros"]),
    );
  });

  it("scrapes each real X source only once and prefers its minister proxy", () => {
    const sources = uniqueSourceAccounts(defaultAccounts, "x");
    expect(sources).toHaveLength(22);
    expect(sources.find((account) => account.xUsername.toLowerCase() === "mindefchile")?.name).toBe(
      "Fernando Barros",
    );
    expect(sources.find((account) => account.xUsername.toLowerCase() === "minjuddhh")?.name).toBe(
      "Fernando Rabat",
    );
  });

  it("has no duplicate X usernames across minister accounts", () => {
    const ministers = defaultAccounts.filter(
      (account) => account.accountType === "minister",
    );
    const usernames = ministers
      .map((account) => account.xUsername.toLowerCase())
      .filter(Boolean);
    expect(new Set(usernames).size).toBe(usernames.length);
  });
});
