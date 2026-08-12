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
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
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
    } catch (error) {
      lastError = error;
      if (
        signal?.aborted ||
        (error instanceof DOMException && error.name === "AbortError") ||
        attempt === 2
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Error de proveedor.");
}
const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

async function requestSentimentWithFallback(
  items: SocialPost[],
  config: AnalysisConfig,
  signal: AbortSignal,
): Promise<{ results: SentimentResult[]; failed: number; errors: string[] }> {
  try {
    const results = (await api(
      "/api/deepseek",
      {
        action: "sentiment",
        items: items.map((item) => ({ id: item.id, text: item.text })),
        llmProvider: config.llmProvider,
        ollamaHost: config.ollamaHost,
        ollamaModel: config.ollamaModel,
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
      config,
      signal,
    );
    const right = await requestSentimentWithFallback(
      items.slice(middle),
      config,
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
  const llmLabel = config.llmProvider === "ollama" ? "Ollama" : "DeepSeek";
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
          const rangeStart = new Date(`${config.startDate}T00:00:00`).getTime();
          const rangeEnd = new Date(`${config.endDate}T23:59:59`).getTime();
          let profileRaw: Record<string, unknown> | null = null;
          try {
            profileRaw = (await api(
              "/api/twitter",
              { action: "profile", username: account.xUsername },
              signal,
            )) as Record<string, unknown>;
          } catch (error) {
            session.errors.push(
              `X perfil · ${account.name}: ${error instanceof Error ? error.message : "error"}`,
            );
          }
          const profileObject = profileRaw
            ? ((profileRaw.data ?? profileRaw.user ?? profileRaw) as Record<
                string,
                unknown
              >)
            : undefined;
          const normalizedProfile = profileObject
            ? normalizeProfile(profileObject, "x", account)
            : undefined;
          // El perfil es independiente del timeline. Conservamos seguidores
          // aunque luego falle la lectura de publicaciones de esta cuenta.
          if (normalizedProfile?.followers.value != null) {
            session.profiles.push(normalizedProfile);
          }
          const firstTimeline = await api(
            "/api/twitter",
              {
                action: "timeline",
                username: account.xUsername,
                includeReplies: false,
                limit: config.limits.xPostsPerAccount,
                sinceTime: rangeStart,
              },
            signal,
          );
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
                limit: config.limits.xPostsPerAccount,
                sinceTime: rangeStart,
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

          // El timeline de perfil de X puede truncarse antes del rango pedido.
          // Complementamos con una búsqueda exacta por autor y fecha.
          const dayAfterEnd = new Date(
            new Date(`${config.endDate}T00:00:00Z`).getTime() + 86_400_000,
          )
            .toISOString()
            .slice(0, 10);
          try {
            const accountSearch = (await api(
              "/api/twitter",
              {
                action: "search",
                query: `from:${account.xUsername.replace(/^@/, "")} since:${config.startDate} until:${dayAfterEnd}`,
                sinceTime: Math.floor(rangeStart / 1000),
                untilTime: Math.floor(rangeEnd / 1000),
                limit: config.limits.xPostsPerAccount,
              },
              signal,
            )) as Record<string, unknown>;
            timelineItems.push(
              ...rawItems(accountSearch, ["tweets", "data.tweets", "data"]),
            );
          } catch (error) {
            session.errors.push(
              `X búsqueda por cuenta · ${account.name}: ${error instanceof Error ? error.message : "error"}`,
            );
          }

          const timelineProfile = timelineItems
            .map((item) => normalizeProfile(item, "x", account))
            .find((item) => item.followers.value != null);
          if (normalizedProfile?.followers.value == null && timelineProfile) {
            session.profiles.push(timelineProfile);
          } else if (
            normalizedProfile?.followers.value == null &&
            normalizedProfile
          ) {
            session.profiles.push(normalizedProfile);
          }

          const posts = timelineItems
            .map((item) => normalizePost(item, "x", account))
            .filter(
              (item): item is SocialPost =>
                !!item &&
                new Date(item.createdAt).getTime() >= rangeStart &&
                new Date(item.createdAt).getTime() <= rangeEnd,
            )
            .filter(
              (item, index, items) =>
                items.findIndex((candidate) => candidate.id === item.id) === index,
            )
            .slice(0, config.limits.xPostsPerAccount);
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
      const startsAt = new Date(`${config.startDate}T00:00:00`).getTime();
      const endsAt = new Date(`${config.endDate}T23:59:59`).getTime();

      for (const [accountIndex, account] of accounts.entries()) {
        if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
        session.stage = `Consultando Instagram · cuenta ${accountIndex + 1} de ${accounts.length} · @${account.instagramUsername}`;
        onUpdate({ ...session });
        try {
          const accountData = (await api(
            "/api/apify",
            {
              action: "account_data",
              username: account.instagramUsername,
              limit: config.limits.instagramPostsPerAccount,
              sinceTime: startsAt,
            },
            signal,
          )) as Record<string, unknown>;
          const items = rawItems(accountData, ["posts"]);

          for (const item of items) {
            const normalized = normalizePost(item, "instagram", account);
            if (!normalized) continue;
            const publishedAt = new Date(normalized.createdAt).getTime();
            if (publishedAt < startsAt || publishedAt > endsAt) continue;
            session.posts.push(normalized);
          }

          session.quality.instagram.succeeded++;
          const instagramProfile = accountData.profile as
            | Record<string, unknown>
            | undefined;
          if (instagramProfile) {
            session.profiles.push(
              normalizeProfile(instagramProfile, "instagram", account),
            );
          }
        } catch (error) {
          session.quality.instagram.errors++;
          session.errors.push(
            `Instagram · ${account.name}: ${error instanceof Error ? error.message : "error"}`,
          );
        }
        session.posts = deduplicatePosts(session.posts);
        session.quality.instagram.posts = session.posts.filter(
          (post) => post.platform === "instagram" && !post.isComment,
        ).length;
        await checkpoint(
          session,
          `Instagram · ${accountIndex + 1} de ${accounts.length} cuentas completadas · ${session.quality.instagram.posts} publicaciones`,
          onUpdate,
        );
      }
      await checkpoint(
        session,
        "Publicaciones de Instagram disponibles",
        onUpdate,
      );
    }
    session.stage = `Analizando sentimiento con ${llmLabel}`;
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
      const outcome = await requestSentimentWithFallback(batch, config, signal);
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
          `Análisis de sentimiento: ${[...new Set(outcome.errors)].join(" · ")}`,
        );
      }
      await checkpoint(
        session,
        `${llmLabel}: ${session.quality.deepseek.processed}/${selected.length}`,
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
            llmProvider: config.llmProvider,
            ollamaHost: config.ollamaHost,
            ollamaModel: config.ollamaModel,
          },
          signal,
        )) as { assignments: typeof assignments };
        assignments.push(...result.assignments);
        for (const item of result.assignments)
          if (!catalog.includes(item.topicName)) catalog.push(item.topicName);
      } catch (error) {
        session.errors.push(
        `${llmLabel} temas: ${error instanceof Error ? error.message : "error"}`,
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
