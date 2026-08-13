"use client";
import type { AccountConfig } from "@/types/social";
import { CONFIG_STORE, observatoryDb } from "./database";

const LEGACY_KEY = "observatorio_accounts_v1";
const ACCOUNTS_KEY = "accounts";

export function mergeAccounts(
  stored: AccountConfig[],
  fallback: AccountConfig[],
) {
  const defaultsById = new Map(fallback.map((account) => [account.id, account]));
  const migrated = stored.map((account) => {
    const currentDefault = defaultsById.get(account.id);
    if (!currentDefault) return account;

    return {
      ...currentDefault,
      ...account,
      aliases: [
        ...new Set([...currentDefault.aliases, ...(account.aliases ?? [])]),
      ],
    };
  });
  const storedIds = new Set(stored.map((account) => account.id));
  return [...migrated, ...fallback.filter((account) => !storedIds.has(account.id))];
}

export async function loadAccounts(fallback: AccountConfig[]) {
  try {
    const database = await observatoryDb();
    let stored = (await database.get(CONFIG_STORE, ACCOUNTS_KEY)) as
      | AccountConfig[]
      | undefined;
    if (!Array.isArray(stored)) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      stored = legacy ? (JSON.parse(legacy) as AccountConfig[]) : undefined;
    }
    const result = Array.isArray(stored)
      ? mergeAccounts(stored, fallback)
      : fallback;
    await database.put(CONFIG_STORE, result, ACCOUNTS_KEY);
    localStorage.removeItem(LEGACY_KEY);
    return result;
  } catch {
    return fallback;
  }
}
export async function saveAccounts(accounts: AccountConfig[]) {
  await (await observatoryDb()).put(CONFIG_STORE, accounts, ACCOUNTS_KEY);
}
export async function clearAccounts() {
  localStorage.removeItem(LEGACY_KEY);
  await (await observatoryDb()).delete(CONFIG_STORE, ACCOUNTS_KEY);
}
