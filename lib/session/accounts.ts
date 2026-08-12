"use client";
import type { AccountConfig } from "@/types/social";
const KEY = "observatorio_accounts_v1";
export function loadAccounts(fallback: AccountConfig[]) {
  try {
    const value = localStorage.getItem(KEY);
    if (!value) return fallback;

    const stored = JSON.parse(value) as AccountConfig[];
    if (!Array.isArray(stored)) return fallback;

    const defaultsById = new Map(
      fallback.map((account) => [account.id, account]),
    );
    const migrated = stored.map((account) => {
      const currentDefault = defaultsById.get(account.id);
      if (!currentDefault) return account;

      return {
        ...currentDefault,
        ...account,
        xUsername: account.xUsername || currentDefault.xUsername,
        instagramUsername:
          account.instagramUsername || currentDefault.instagramUsername,
        aliases: [
          ...new Set([...currentDefault.aliases, ...(account.aliases ?? [])]),
        ],
      };
    });

    const storedIds = new Set(stored.map((account) => account.id));
    const newDefaults = fallback.filter(
      (account) => !storedIds.has(account.id),
    );
    const result = [...migrated, ...newDefaults];
    localStorage.setItem(KEY, JSON.stringify(result));
    return result;
  } catch {
    return fallback;
  }
}
export function saveAccounts(accounts: AccountConfig[]) {
  localStorage.setItem(KEY, JSON.stringify(accounts));
}
export function clearAccounts() {
  localStorage.removeItem(KEY);
}
