import { NextResponse } from "next/server";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeSentiment, labelTopics } from "@/lib/providers/deepseek";
import {
  analyzeSentimentOllama,
  labelTopicsOllama,
  listOllamaModels,
} from "@/lib/providers/ollama";
import { failure, requireAuth, unauthorized } from "@/lib/api";
import { allowRequest, requestKey } from "@/lib/rate-limit";

const item = z.object({
  id: z.string().max(150),
  text: z.string().max(10000),
  sentiment: z.string().optional(),
});

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sentiment"),
    items: z.array(item.omit({ sentiment: true })).min(1).max(50),
    llmProvider: z.enum(["deepseek", "ollama"]).optional(),
    ollamaHost: z.string().optional(),
    ollamaModel: z.string().optional(),
  }),
  z.object({
    action: z.literal("topics"),
    items: z.array(item).min(1).max(50),
    existing: z.array(z.string()).max(100).optional(),
    llmProvider: z.enum(["deepseek", "ollama"]).optional(),
    ollamaHost: z.string().optional(),
    ollamaModel: z.string().optional(),
  }),
  z.object({
    action: z.literal("test_ollama"),
    ollamaHost: z.string().optional(),
    refresh: z.boolean().optional(),
  }),
]);

export const maxDuration = 300;

function resolveOllamaHost(requestedHost?: string) {
  const requested = requestedHost?.trim().replace(/\/+$/, "");
  const configured = process.env.OLLAMA_HOST?.trim().replace(/\/+$/, "");
  const isLocalDefault =
    !requested ||
    requested === "http://localhost:11434" ||
    requested === "http://127.0.0.1:11434";

  return isLocalDefault
    ? configured || requested || "http://127.0.0.1:11434"
    : requested;
}

const ollamaCachePath = path.join(
  process.cwd(),
  ".sessions",
  "ollama-models.json",
);

async function readOllamaCache(host: string) {
  try {
    const cached = JSON.parse(await readFile(ollamaCachePath, "utf8")) as {
      host?: string;
      models?: unknown[];
      detectedAt?: string;
    };
    if (cached.host !== host || !Array.isArray(cached.models)) return null;
    return {
      models: cached.models.map(String).filter(Boolean),
      detectedAt: cached.detectedAt,
    };
  } catch {
    return null;
  }
}

async function writeOllamaCache(host: string, models: string[]) {
  await mkdir(path.dirname(ollamaCachePath), { recursive: true });
  const detectedAt = new Date().toISOString();
  await writeFile(
    ollamaCachePath,
    JSON.stringify({ host, models, detectedAt }, null, 2),
    "utf8",
  );
  return detectedAt;
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return unauthorized();
  if (!allowRequest(requestKey(request, "deepseek"), 40))
    return NextResponse.json(
      { ok: false, error: "Límite temporal de solicitudes alcanzado." },
      { status: 429 },
    );

  try {
    const body = schema.parse(await request.json());

    if (body.action === "test_ollama") {
      const host = resolveOllamaHost(body.ollamaHost);
      if (!body.refresh) {
        const cached = await readOllamaCache(host);
        if (cached) {
          return NextResponse.json({
            ok: true,
            data: { ...cached, cached: true },
            source: "ollama_startup_cache",
          });
        }
      }
      const models = await listOllamaModels(host);
      const detectedAt = await writeOllamaCache(host, models);
      return NextResponse.json({
        ok: true,
        data: { models, detectedAt, cached: false },
        source: "ollama",
      });
    }

    const provider = body.llmProvider || process.env.LLM_PROVIDER || "deepseek";
    const host = resolveOllamaHost(body.ollamaHost);
    const model = body.ollamaModel || process.env.OLLAMA_MODEL || "llama3";

    let data: unknown;

    if (provider === "ollama") {
      data =
        body.action === "sentiment"
          ? await analyzeSentimentOllama(body.items, host, model)
          : await labelTopicsOllama(body.items, body.existing, host, model);
    } else {
      data =
        body.action === "sentiment"
          ? await analyzeSentiment(body.items)
          : await labelTopics(body.items, body.existing);
    }

    return NextResponse.json({ ok: true, data, source: provider });
  } catch (error) {
    return failure(error, "llm_provider");
  }
}
