"use client";
import type { AnalysisConfig, AnalysisSession } from "@/types/analysis";
import type { SentimentResult, SocialPost } from "@/types/social";
import {
  deduplicatePosts,
  normalizePost,
  normalizeProfile,
} from "@/lib/social/normalize";
import { aggregateTopics, emptySession, finalizeSession } from "./session";
import { saveSession } from "@/lib/session/storage";

async function api(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error(result.error || "Error de proveedor.");
  return result.data;
}
const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

async function requestSentimentWithFallback(
  items: SocialPost[],
  signal: AbortSignal,
): Promise<{ results: SentimentResult[]; failed: number; errors: string[] }> {
  try {
    const results = (await api(
      "/api/deepseek",
      {
        action: "sentiment",
        items: items.map((item) => ({ id: item.id, text: item.text })),
      },
      signal,
    )) as SentimentResult[];
    return { results, failed: 0, errors: [] };
  } catch (error) {
    if (items.length <= 5) {
      return {
        results: [],
        failed: items.length,
        errors: [error instanceof Error ? error.message : "error desconocido"],
      };
    }

    const middle = Math.ceil(items.length / 2);
    const left = await requestSentimentWithFallback(
      items.slice(0, middle),
      signal,
    );
    const right = await requestSentimentWithFallback(
      items.slice(middle),
      signal,
    );
    return {
      results: [...left.results, ...right.results],
      failed: left.failed + right.failed,
      errors: [...left.errors, ...right.errors],
    };
  }
}

const rawItems = (raw: Record<string, unknown>, names: string[]) => {
  for (const name of names) {
    const value = name.split(".").reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      raw,
    );
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
};
async function checkpoint(
  session: AnalysisSession,
  stage: string,
  onUpdate: (session: AnalysisSession) => void,
) {
  session.stage = stage;
  session.status = "partial";
  session.posts = deduplicatePosts(session.posts);
  finalizeSession(session);
  await saveSession(session);
  onUpdate({ ...session });
}

export async function runAnalysis(
  config: AnalysisConfig,
  signal: AbortSignal,
  onUpdate: (session: AnalysisSession) => void,
) {
  const session = emptySession(config);
  onUpdate({ ...session });
  try {
    if (!config.platforms.length)
      throw new Error("Seleccione al menos una plataforma.");

    // Check session status before starting local scraping
    try {
      const authStatus = await api("/api/scraper/auth", { action: "status" }, signal);
      if (config.platforms.includes("x") && !authStatus?.x?.authenticated) {
        throw new Error("Se requiere iniciar sesión en X (Twitter) antes de comenzar el análisis.");
      }
      if (config.platforms.includes("instagram") && !authStatus?.instagram?.authenticated) {
        throw new Error("Se requiere iniciar sesión en Instagram antes de comenzar el análisis.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Se requiere iniciar sesión")) {
        throw err;
      }
      // If endpoint status check fails, proceed and let platform scrapers handle errors
    }

    const active = config.accounts.filter((account) => account.active);
    if (config.platforms.includes("x")) {
      const accounts = active.filter((account) => account.xUsername);
      session.quality.x.requested = accounts.length;
      for (const [accountIndex, account] of accounts.entries()) {
        if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
        session.stage = `Consultando X · cuenta ${accountIndex + 1} de ${accounts.length} · @${account.xUsername}`;
        onUpdate({ ...session });
        try {
          const [profileRaw, firstTimeline] = await Promise.all([
            api(
              "/api/twitter",
              { action: "profile", username: account.xUsername },
              signal,
            ),
            api(
              "/api/twitter",
              {
                action: "timeline",
                username: account.xUsername,
                includeReplies: false,
              },
              signal,
            ),
          ]);
          const profileObject = (profileRaw.data ??
            profileRaw.user ??
            profileRaw) as Record<string, unknown>;
          session.profiles.push(normalizeProfile(profileObject, "x", account));
          const timelineItems = [
            ...rawItems(firstTimeline as Record<string, unknown>, [
              "tweets",
              "data.tweets",
              "data",
            ]),
          ];
          let cursor = String(
            (firstTimeline as Record<string, unknown>).next_cursor ?? "",
          );
          const seenTimelineCursors = new Set<string>();
          let timelinePages = 1;
          const maximumTimelinePages =
            Math.ceil(config.limits.xPostsPerAccount / 20) + 2;
          while (
            cursor &&
            timelineItems.length < config.limits.xPostsPerAccount &&
            timelinePages < maximumTimelinePages &&
            !seenTimelineCursors.has(cursor)
          ) {
            seenTimelineCursors.add(cursor);
            const page = (await api(
              "/api/twitter",
              {
                action: "timeline",
                username: account.xUsername,
                cursor,
                includeReplies: false,
              },
              signal,
            )) as Record<string, unknown>;
            const pageItems = rawItems(page, [
              "tweets",
              "data.tweets",
              "data",
            ]);
            const nextCursor = String(page.next_cursor ?? "");
            timelineItems.push(...pageItems);
            timelinePages++;
            if (!pageItems.length || !nextCursor || nextCursor === cursor)
              break;
            cursor = nextCursor;
          }
          const rangeStart = new Date(`${config.startDate}T00:00:00`).getTime();
          const rangeEnd = new Date(`${config.endDate}T23:59:59`).getTime();
          const posts = timelineItems
            .slice(0, config.limits.xPostsPerAccount)
            .map((item) => normalizePost(item, "x", account))
            .filter(
              (item): item is SocialPost =>
                !!item &&
                new Date(item.createdAt).getTime() >= rangeStart &&
                new Date(item.createdAt).getTime() <= rangeEnd,
            );
          session.posts.push(...posts);
          session.quality.x.succeeded++;
          session.quality.x.posts += posts.length;
          session.stage = `Consultando X · cuenta ${accountIndex + 1} de ${accounts.length} · ${session.quality.x.posts} publicaciones`;
          onUpdate({ ...session });
          for (const post of posts.filter(
            (item) => (item.comments.value ?? 0) > 0,
          )) {
            let replyCursor = "";
            let found = 0;
            let replyPages = 0;
            const seenReplyCursors = new Set<string>();
            const maximumReplyPages =
              Math.ceil(config.limits.commentsPerPost / 20) + 2;
            do {
              if (
                replyPages >= maximumReplyPages ||
                (replyCursor && seenReplyCursors.has(replyCursor))
              )
                break;
              if (replyCursor) seenReplyCursors.add(replyCursor);
              const repliesRaw = (await api(
                "/api/twitter",
                { action: "replies", tweetId: post.id, cursor: replyCursor },
                signal,
              )) as Record<string, unknown>;
              const replies = rawItems(repliesRaw, [
                "replies",
                "tweets",
                "data.replies",
                "data.tweets",
                "data",
              ])
                .map((item) =>
                  normalizePost(
                    { ...item, parentPostId: post.id },
                    "x",
                    undefined,
                    true,
                  ),
                )
                .filter(Boolean) as SocialPost[];
              const remaining = config.limits.commentsPerPost - found;
              const acceptedReplies = replies.slice(0, remaining);
              session.posts.push(...acceptedReplies);
              found += acceptedReplies.length;
              replyPages++;
              const nextCursor = String(repliesRaw.next_cursor ?? "");
              if (!replies.length || !nextCursor || nextCursor === replyCursor)
                break;
              replyCursor = nextCursor;
              const repliesRecovered = session.posts.filter(
                (item) => item.platform === "x" && item.isComment,
              ).length;
              session.stage = `Consultando X · cuenta ${accountIndex + 1} de ${accounts.length} · ${session.quality.x.posts} publicaciones · ${repliesRecovered} replies`;
              onUpdate({ ...session });
            } while (replyCursor && found < config.limits.commentsPerPost);
          }
        } catch (error) {
          session.quality.x.errors++;
          session.errors.push(
            `X · ${account.name}: ${error instanceof Error ? error.message : "error"}`,
          );
        }
        await checkpoint(
          session,
          `X · ${accountIndex + 1} de ${accounts.length} cuentas completadas · ${session.quality.x.posts} publicaciones`,
          onUpdate,
        );
      }
      const window = 24 * 60 * 60;
      const start = Math.floor(
        new Date(`${config.startDate}T00:00:00`).getTime() / 1000,
      );
      const end = Math.floor(
        new Date(`${config.endDate}T23:59:59`).getTime() / 1000,
      );
      for (const query of config.queries)
        for (
          let since = start;
          since < end && session.posts.length < config.limits.searchResults;
          since += window
        ) {
          const currentDay = Math.floor((since - start) / window) + 1;
          const totalDays = Math.max(1, Math.ceil((end - start) / window));
          session.stage = `Buscando conversación en X · “${query}” · día ${currentDay} de ${totalDays}`;
          onUpdate({ ...session });
          try {
            const raw = await api(
              "/api/twitter",
              {
                action: "search",
                query,
                sinceTime: since,
                untilTime: Math.min(end, since + window),
              },
              signal,
            );
            session.posts.push(
              ...(rawItems(raw as Record<string, unknown>, ["tweets", "data"])
                .map((item) => normalizePost(item, "x"))
                .filter(Boolean) as SocialPost[]),
            );
            session.posts = deduplicatePosts(session.posts);
            onUpdate({ ...session });
          } catch (error) {
            session.errors.push(
              `Búsqueda X · ${query}: ${error instanceof Error ? error.message : "error"}`,
            );
          }
        }
      await checkpoint(session, "Publicaciones de X disponibles", onUpdate);
    }
    if (config.platforms.includes("instagram")) {
      const accounts = active.filter((account) => account.instagramUsername);
      session.quality.instagram.requested = accounts.length;
      if (accounts.length) {
        try {
          const template = config.apifyInputTemplates?.instagram ?? {};
          const {
            usernames: _legacyUsernames,
            onlyPostsNewerThan: _legacyDateFilter,
            search: _legacySearch,
            searchType: _legacySearchType,
            searchLimit: _legacySearchLimit,
            ...safeTemplate
          } = template;
          void _legacyUsernames;
          void _legacyDateFilter;
          void _legacySearch;
          void _legacySearchType;
          void _legacySearchLimit;
          const input = {
            ...safeTemplate,
            directUrls: accounts.map(
              (account) =>
                `https://www.instagram.com/${account.instagramUsername}/`,
            ),
            resultsLimit: config.limits.instagramPostsPerAccount,
            resultsType: "posts",
          };
          const started = (await api(
            "/api/apify",
            { action: "start", platform: "instagram", input },
            signal,
          )) as { data?: { id?: string }; id?: string };
          const runId = started.data?.id ?? started.id;
          if (!runId) throw new Error("Apify no devolvió runId.");
          sessionStorage.setItem("observatorio_apify_run", runId);
          let status = "RUNNING";
          let datasetId = "";
          while (
            !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)
          ) {
            await new Promise((resolve) => setTimeout(resolve, 4000));
            const raw = (await api(
              "/api/apify",
              { action: "status", runId },
              signal,
            )) as { data?: { status?: string; defaultDatasetId?: string } };
            status = raw.data?.status ?? "RUNNING";
            datasetId = raw.data?.defaultDatasetId ?? datasetId;
            session.stage = `Consultando Instagram · Actor ${status}`;
            onUpdate({ ...session });
          }
          if (status !== "SUCCEEDED")
            throw new Error(`Actor finalizó con estado ${status}.`);
          const byUsername = new Map(
            accounts.map((account) => [
              account.instagramUsername.toLowerCase(),
              account,
            ]),
          );
          let offset = 0;
          while (
            offset <
            accounts.length * config.limits.instagramPostsPerAccount
          ) {
            const items = (await api(
              "/api/apify",
              { action: "items", datasetId, offset, limit: 250 },
              signal,
            )) as Record<string, unknown>[];
            if (!items.length) break;
            for (const item of items) {
              const username = String(item.ownerUsername ?? item.username ?? "")
                .replace(/^@/, "")
                .toLowerCase();
              const normalized = normalizePost(
                item,
                "instagram",
                byUsername.get(username),
              );
              if (normalized) {
                const publishedAt = new Date(normalized.createdAt).getTime();
                const startsAt = new Date(
                  `${config.startDate}T00:00:00`,
                ).getTime();
                const endsAt = new Date(`${config.endDate}T23:59:59`).getTime();
                if (publishedAt < startsAt || publishedAt > endsAt) continue;
                session.posts.push(normalized);
                const comments = [
                  item.latestComments,
                  item.comments,
                  item.childPosts,
                ].find(Array.isArray) as Record<string, unknown>[] | undefined;
                if (comments)
                  session.posts.push(
                    ...(comments
                      .slice(0, config.limits.commentsPerPost)
                      .map((comment) =>
                        normalizePost(
                          {
                            ...comment,
                            parentPostId: normalized.id,
                            id:
                              comment.id ??
                              comment.pk ??
                              `${normalized.id}-comment-${crypto.randomUUID()}`,
                          },
                          "instagram",
                          undefined,
                          true,
                        ),
                      )
                      .filter(Boolean) as SocialPost[]),
                  );
              }
            }
            offset += items.length;
            session.posts = deduplicatePosts(session.posts);
            session.stage = `Descargando Instagram · ${offset} resultados del dataset`;
            onUpdate({ ...session });
            if (items.length < 250) break;
          }
          session.quality.instagram.succeeded = accounts.length;
          session.quality.instagram.posts = session.posts.filter(
            (post) => post.platform === "instagram" && !post.isComment,
          ).length;
          for (const account of accounts) {
            const post = session.posts.find(
              (item) =>
                item.accountId === account.id && item.platform === "instagram",
            );
            if (post)
              session.profiles.push({
                accountId: account.id,
                platform: "instagram",
                username: account.instagramUsername,
                followers: post.followers,
                capturedAt: new Date().toISOString(),
              });
          }
        } catch (error) {
          session.quality.instagram.errors = accounts.length;
          session.errors.push(
            `Instagram: ${error instanceof Error ? error.message : "error"}`,
          );
        }
      }
      await checkpoint(
        session,
        "Publicaciones de Instagram disponibles",
        onUpdate,
      );
    }
    session.stage = "Analizando sentimiento";
    onUpdate({ ...session });
    const uniqueText = new Map<string, SocialPost>();
    session.posts.forEach((post) => {
      const key = post.text.trim().toLowerCase();
      if (key && !uniqueText.has(key)) uniqueText.set(key, post);
    });
    const limit = Math.min(config.limits.deepseekItems, uniqueText.size);
    const selected = [...uniqueText.values()].slice(0, limit);
    session.quality.deepseek.omitted = uniqueText.size - selected.length;
    for (const batch of chunks(
      selected,
      Math.min(50, config.limits.deepseekBatchSize),
    )) {
      const outcome = await requestSentimentWithFallback(batch, signal);
      for (const result of outcome.results) {
        session.sentiments.push(result);
        const sourceText = batch
          .find((item) => item.id === result.itemId)
          ?.text.trim()
          .toLowerCase();
        if (sourceText)
          session.posts
            .filter(
              (post) =>
                post.id !== result.itemId &&
                post.text.trim().toLowerCase() === sourceText,
            )
            .forEach((post) =>
              session.sentiments.push({ ...result, itemId: post.id }),
            );
      }
      session.quality.deepseek.processed += batch.length - outcome.failed;
      session.quality.deepseek.errors += outcome.failed;
      if (outcome.errors.length) {
        session.errors.push(
          `DeepSeek sentimiento: ${[...new Set(outcome.errors)].join(" · ")}`,
        );
      }
      await checkpoint(
        session,
        `Sentimiento: ${session.quality.deepseek.processed}/${selected.length}`,
        onUpdate,
      );
    }
    session.quality.deepseek.uncertain = session.sentiments.filter(
      (item) => item.sentiment === "uncertain",
    ).length;
    session.stage = "Detectando temas";
    const assignments: {
      id: string;
      topicName: string;
      summary: string;
      keywords: string[];
    }[] = [];
    const catalog: string[] = [];
    for (const batch of chunks(
      selected,
      Math.min(50, config.limits.deepseekBatchSize),
    )) {
      try {
        const result = (await api(
          "/api/deepseek",
          {
            action: "topics",
            items: batch.map((item) => ({
              id: item.id,
              text: item.text,
              sentiment: session.sentiments.find((s) => s.itemId === item.id)
                ?.sentiment,
            })),
            existing: catalog,
          },
          signal,
        )) as { assignments: typeof assignments };
        assignments.push(...result.assignments);
        for (const item of result.assignments)
          if (!catalog.includes(item.topicName)) catalog.push(item.topicName);
      } catch (error) {
        session.errors.push(
          `DeepSeek temas: ${error instanceof Error ? error.message : "error"}`,
        );
      }
    }
    session.topics = aggregateTopics(
      session.posts,
      session.sentiments,
      assignments,
    );
    finalizeSession(session);
    session.status = session.errors.length ? "partial" : "completed";
    session.stage = "Dashboard generado";
    session.completedAt = new Date().toISOString();
    await saveSession(session);
    onUpdate({ ...session });
    return session;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      session.status = "cancelled";
      session.stage = "Análisis cancelado · resultados parciales disponibles";
      const runId = sessionStorage.getItem("observatorio_apify_run");
      if (runId)
        api("/api/apify", { action: "abort", runId }).catch(() => undefined);
    } else {
      session.status = "error";
      session.stage = "Error de ejecución";
      session.errors.push(
        error instanceof Error ? error.message : "Error inesperado",
      );
    }
    finalizeSession(session);
    await saveSession(session);
    onUpdate({ ...session });
    return session;
  }
}
