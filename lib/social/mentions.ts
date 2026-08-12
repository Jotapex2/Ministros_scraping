import type { AccountConfig, SocialPost } from "@/types/social";
import { plain } from "@/lib/utils";

export function mentionedAccounts(post: SocialPost, accounts: AccountConfig[]) {
  const source = ` ${plain(post.text).replace(/[^a-z0-9@._]+/g, " ")} `;
  return accounts
    .filter(
      (account) =>
        account.active &&
        account.aliases.some((alias) => {
          const candidate = plain(alias).trim();
          if (candidate.length < 4) return false;
          return (
            source.includes(` ${candidate.replace(/[^a-z0-9@._]+/g, " ")} `) ||
            source.includes(`@${candidate.replace(/^@/, "")}`)
          );
        }),
    )
    .map((account) => account.id);
}
