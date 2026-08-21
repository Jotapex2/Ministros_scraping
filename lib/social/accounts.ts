import type { AccountConfig, Platform } from "@/types/social";

const sourceUsername = (account: AccountConfig, platform: Platform) =>
  (platform === "x" ? account.xUsername : account.instagramUsername)
    .trim()
    .replace(/^@/, "");

const accountPriority = (account: AccountConfig) => {
  if (account.accountType === "minister") return 3;
  if (account.accountType === "president") return 2;
  return 1;
};

/**
 * Returns one configured account per real social profile.
 * Minister records intentionally win when an institutional profile is also
 * used as a minister proxy (for example @mindefchile).
 */
export function uniqueSourceAccounts(
  accounts: AccountConfig[],
  platform: Platform,
) {
  const byUsername = new Map<string, AccountConfig>();
  for (const account of accounts) {
    if (!account.active) continue;
    const username = sourceUsername(account, platform);
    if (!username) continue;
    const key = username.toLowerCase();
    const existing = byUsername.get(key);
    if (!existing || accountPriority(account) > accountPriority(existing)) {
      byUsername.set(key, account);
    }
  }
  return [...byUsername.values()];
}

export function uniqueSourceCount(
  accounts: AccountConfig[],
  platform: Platform,
) {
  return uniqueSourceAccounts(accounts, platform).length;
}
