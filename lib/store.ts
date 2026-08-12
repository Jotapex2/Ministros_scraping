"use client";
import { create } from "zustand";
import type { AnalysisConfig, AnalysisSession } from "@/types/analysis";
import type { AccountConfig } from "@/types/social";
import { defaultAccounts } from "@/config/accounts";
import { format, subDays } from "date-fns";
import { loadAccounts, saveAccounts } from "@/lib/session/accounts";
import { clearSession, loadSession } from "@/lib/session/storage";
import { runAnalysis } from "@/lib/analysis/runner";

const limits = {
  xPostsPerAccount: 100,
  instagramPostsPerAccount: 100,
  commentsPerPost: 50,
  searchResults: 1000,
  deepseekItems: 1000,
  deepseekBatchSize: 25,
};
const defaultConfig = (): AnalysisConfig => ({
  startDate: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  endDate: format(new Date(), "yyyy-MM-dd"),
  platforms: ["x", "instagram"],
  accounts: defaultAccounts,
  queries: ["Gobierno de Chile"],
  limits,
  deepseekMode: "1000",
  apifyInputTemplates: {},
});
interface State {
  config: AnalysisConfig;
  session?: AnalysisSession;
  hydrated: boolean;
  controller?: AbortController;
  setConfig: (patch: Partial<AnalysisConfig>) => void;
  setAccounts: (accounts: AccountConfig[]) => void;
  hydrate: () => Promise<void>;
  run: () => Promise<void>;
  cancel: () => void;
  reset: () => Promise<void>;
  importSession: (session: AnalysisSession) => void;
}
export const useObservatory = create<State>((set, get) => ({
  config: defaultConfig(),
  hydrated: false,
  setConfig: (patch) =>
    set((state) => ({ config: { ...state.config, ...patch } })),
  setAccounts: (accounts) => {
    saveAccounts(accounts);
    set((state) => ({ config: { ...state.config, accounts } }));
  },
  hydrate: async () => {
    const [session, runtime] = await Promise.all([
      loadSession(),
      fetch("/api/auth/status")
        .then((response) => response.json())
        .catch(() => ({})),
    ]);
    set((state) => ({
      config: {
        ...state.config,
        accounts: loadAccounts(defaultAccounts),
        limits: runtime.limits
          ? { ...state.config.limits, ...runtime.limits }
          : state.config.limits,
      },
      session,
      hydrated: true,
    }));
  },
  run: async () => {
    const controller = new AbortController();
    set({ controller });
    await runAnalysis(get().config, controller.signal, (session) =>
      set({ session }),
    );
    set({ controller: undefined });
  },
  cancel: () => get().controller?.abort(),
  reset: async () => {
    get().controller?.abort();
    await clearSession();
    sessionStorage.removeItem("observatorio_apify_run");
    set({ session: undefined });
  },
  importSession: (session) => {
    if (session.schemaVersion !== 1)
      throw new Error("Versión de sesión no compatible.");
    set({ session, config: session.config });
  },
}));
