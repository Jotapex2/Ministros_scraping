import { describe, expect, it } from "vitest";
import { defaultAccounts } from "./accounts";

describe("default government accounts", () => {
  it("includes 22 ministers and separates institutional X accounts", () => {
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
      ministers.find((account) => account.name === "Fernando Barros Tocornal")
        ?.xUsername,
    ).toBe("");
    expect(
      ministers.find((account) => account.name === "Fernando Rabat Celis")
        ?.xUsername,
    ).toBe("");
  });

  it("has no duplicate X usernames", () => {
    const usernames = defaultAccounts
      .map((account) => account.xUsername.toLowerCase())
      .filter(Boolean);
    expect(new Set(usernames).size).toBe(usernames.length);
  });
});
