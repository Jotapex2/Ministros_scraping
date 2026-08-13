"use client";
import type { AnalysisSession } from "@/types/analysis";
import { observatoryDb, SESSION_STORE } from "./database";
export async function saveSession(session: AnalysisSession) {
  return (await observatoryDb()).put(SESSION_STORE, session, "current");
}
export async function loadSession() {
  return (await observatoryDb()).get(SESSION_STORE, "current") as Promise<
    AnalysisSession | undefined
  >;
}
export async function clearSession() {
  return (await observatoryDb()).delete(SESSION_STORE, "current");
}
