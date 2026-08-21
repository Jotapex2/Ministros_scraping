import type { AccountConfig, SocialPost } from "@/types/social";
import { plain } from "@/lib/utils";

export function mentionedAccounts(post: SocialPost, accounts: AccountConfig[]) {
  const source = ` ${plain(post.text).replace(/[^a-z0-9@._]+/g, " ")} `;
  const priority = (account: AccountConfig) =>
    account.accountType === "minister"
      ? 3
      : account.accountType === "president"
        ? 2
        : 1;
  const handleOwners = new Map<string, AccountConfig>();
  for (const account of accounts) {
    if (!account.active) continue;
    for (const alias of account.aliases) {
      const candidate = plain(alias).trim();
      if (!candidate.startsWith("@")) continue;
      const key = candidate.slice(1).toLowerCase();
      const existing = handleOwners.get(key);
      if (!existing || priority(account) > priority(existing)) {
        handleOwners.set(key, account);
      }
    }
  }

  return accounts
    .filter((account) => {
      if (!account.active) return false;
      const matchingAliases = account.aliases.filter((alias) => {
        const candidate = plain(alias).trim();
        if (candidate.length < 4) return false;
        return (
          source.includes(` ${candidate.replace(/[^a-z0-9@._]+/g, " ")} `) ||
          source.includes(`@${candidate.replace(/^@/, "")}`)
        );
      });
      const ownedHandle = matchingAliases
        .map((alias) => plain(alias).trim())
        .find((alias) => alias.startsWith("@"));
      return (
        matchingAliases.length > 0 &&
        (!ownedHandle ||
          handleOwners.get(ownedHandle.slice(1).toLowerCase())?.id === account.id)
      );
    })
    .map((account) => account.id);
}
