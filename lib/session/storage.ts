"use client";
import { openDB } from "idb";
import type { AnalysisSession } from "@/types/analysis";
const DB = "observatorio-digital";
const STORE = "sessions";
const db = () =>
  openDB(DB, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE))
        database.createObjectStore(STORE);
    },
  });
export async function saveSession(session: AnalysisSession) {
  return (await db()).put(STORE, session, "current");
}
export async function loadSession() {
  return (await db()).get(STORE, "current") as Promise<
    AnalysisSession | undefined
  >;
}
export async function clearSession() {
  return (await db()).delete(STORE, "current");
}
