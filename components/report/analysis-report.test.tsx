// @vitest-environment node
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AnalysisReport } from "./analysis-report";
import { emptySession, finalizeSession } from "@/lib/analysis/session";
import type { AnalysisConfig } from "@/types/analysis";
import type { SentimentResult, SocialPost } from "@/types/social";
import { available } from "@/lib/utils";
import { defaultAccounts } from "@/config/accounts";

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
    const ministerAccounts = defaultAccounts.filter(
      (account) => account.accountType === "minister",
    );
    const richConfig = { ...config, accounts: ministerAccounts };
    const session = emptySession(richConfig);
    const words = [
      "seguridad",
      "familias",
      "agenda",
      "trabajo",
      "acuerdo",
      "región",
      "política",
      "servicio",
      "programa",
      "comunidad",
    ];
    session.posts = ministerAccounts.flatMap((account, index) =>
      (["x", "instagram"] as const).flatMap((platform, platformIndex) =>
        Array.from(
          { length: (index % 5) + 1 },
          (_, pieceIndex): SocialPost => ({
            id: `${account.id}-${platform}-${pieceIndex}`,
            platform,
            authorName: account.name,
            username:
              account[platform === "x" ? "xUsername" : "instagramUsername"],
            authorType: "minister",
            accountId: account.id,
            ministerId: account.id,
            text: `${index % 3 === 0 ? "Excelente avance" : index % 3 === 1 ? "Crítica por retraso" : "Información oficial"} en ${words[index % words.length]} para Chile, familias y comunidad. ${account.xUsername ? `@${account.xUsername}` : `@${account.instagramUsername}`} presentó la agenda.`,
            createdAt: `2026-08-0${(index % 7) + 1}T12:0${pieceIndex}:00Z`,
            likes: available(
              1000 + index * 137 + platformIndex * 250 + pieceIndex * 31,
            ),
            comments: available(40 + index * 7 + pieceIndex),
            shares: available(10 + index),
            reposts: available(8 + index),
            quotes: available(index),
            views: available(5000 + index * 100),
            followers: available(5000 + index * 12345),
            url: `https://example.com/${account.id}/${platform}/${pieceIndex}`,
            hashtags: [],
          }),
        ),
      ),
    );
    session.profiles = ministerAccounts.flatMap((account, index) => [
      {
        accountId: account.id,
        platform: "x" as const,
        username: account.xUsername,
        followers: account.xUsername
          ? available(2500 + index * 4210)
          : available(undefined),
        capturedAt: new Date().toISOString(),
      },
      {
        accountId: account.id,
        platform: "instagram" as const,
        username: account.instagramUsername,
        followers: available(4500 + index * 11830),
        capturedAt: new Date().toISOString(),
      },
    ]);
    session.sentiments = session.posts.map(
      (post, index): SentimentResult => ({
        itemId: post.id,
        sentiment:
          index % 3 === 0
            ? "positive"
            : index % 3 === 1
              ? "negative"
              : "neutral",
        score: index % 3 === 0 ? 0.8 : index % 3 === 1 ? -0.7 : 0,
        confidence: 0.9,
        target: "Gobierno de Chile",
        targetKind: index % 2 ? "government" : "minister",
        reasonShort: "Clasificación de prueba",
        topic: words[index % words.length],
        keywords: [words[index % words.length]],
        entities: ["Chile"],
      }),
    );
    session.quality.deepseek.processed = session.sentiments.length;
    session.topics = words.slice(0, 10).map((word, index) => ({
      id: word,
      topicName: word[0].toUpperCase() + word.slice(1),
      summary: `Conversación observada sobre ${word}.`,
      posts: 8 + index,
      comments: 3 + index,
      uniqueAuthors: 4 + index,
      engagement: 500 + index * 150,
      positive: 3,
      negative: 2,
      neutral: 3,
      uncertain: 0,
      netSentiment: 12.5,
      platformDistribution: { x: 50, instagram: 50 },
      keywords: [word, "chile", "agenda"],
    }));
    finalizeSession(session);
    session.status = "completed";
    const output = await renderToBuffer(<AnalysisReport session={session} />);
    expect(output.subarray(0, 4).toString()).toBe("%PDF");
    expect(output.length).toBeGreaterThan(15_000);
    if (process.env.WRITE_REPORT_FIXTURE === "1") {
      const temporaryDirectory = path.join(process.cwd(), "tmp", "pdfs");
      const outputDirectory = path.join(process.cwd(), "output", "pdf");
      await Promise.all([
        mkdir(temporaryDirectory, { recursive: true }),
        mkdir(outputDirectory, { recursive: true }),
      ]);
      await Promise.all([
        writeFile(
          path.join(temporaryDirectory, "analysis-report-fixture.pdf"),
          output,
        ),
        writeFile(
          path.join(outputDirectory, "informe_observatorio_revision.pdf"),
          output,
        ),
      ]);
    }
  });
});
