"use client";

import type { SentimentResult } from "@/types/social";
import { observatoryDb, SENTIMENT_CACHE_STORE } from "./database";

function textHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export async function getCachedSentiments(
  items: { id: string; text: string }[],
): Promise<{ cached: SentimentResult[]; missing: { id: string; text: string }[] }> {
  try {
    const db = await observatoryDb();
    const cached: SentimentResult[] = [];
    const missing: { id: string; text: string }[] = [];

    for (const item of items) {
      const key = `${item.id}_${textHash(item.text)}`;
      const result = (await db.get(SENTIMENT_CACHE_STORE, key)) as SentimentResult | undefined;
      if (result) {
        cached.push({ ...result, itemId: item.id });
      } else {
        missing.push(item);
      }
    }

    return { cached, missing };
  } catch {
    return { cached: [], missing: items };
  }
}

export async function setCachedSentiments(results: SentimentResult[], itemsMap: Map<string, string>) {
  try {
    const db = await observatoryDb();
    const tx = db.transaction(SENTIMENT_CACHE_STORE, "readwrite");
    for (const res of results) {
      const text = itemsMap.get(res.itemId) || "";
      const key = `${res.itemId}_${textHash(text)}`;
      await tx.store.put(res, key);
    }
    await tx.done;
  } catch {
    // Ignore cache write failure
  }
}
