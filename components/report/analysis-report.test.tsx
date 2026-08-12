// @vitest-environment node
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { AnalysisReport } from "./analysis-report";
import { emptySession, finalizeSession } from "@/lib/analysis/session";
import type { AnalysisConfig } from "@/types/analysis";

const config: AnalysisConfig = {
  startDate: "2026-08-01",
  endDate: "2026-08-07",
  platforms: ["x", "instagram"],
  accounts: [],
  queries: [],
  limits: {
    xPostsPerAccount: 100,
    instagramPostsPerAccount: 100,
    commentsPerPost: 50,
    searchResults: 1000,
    deepseekItems: 1000,
    deepseekBatchSize: 25,
  },
  deepseekMode: "1000",
};

describe("executive PDF", () => {
  it("renders a valid multi-page document", async () => {
    const session = finalizeSession(emptySession(config));
    session.status = "completed";
    const output = await renderToBuffer(<AnalysisReport session={session} />);
    expect(output.subarray(0, 4).toString()).toBe("%PDF");
    expect(output.length).toBeGreaterThan(5_000);
  });
});
