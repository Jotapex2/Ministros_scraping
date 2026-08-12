import { NextResponse } from "next/server";
import { z } from "zod";
import { localInstagram } from "@/lib/providers/local-instagram";
import { failure, requireAuth, unauthorized } from "@/lib/api";
import { allowRequest, requestKey } from "@/lib/rate-limit";

// Memory cache for active local scraping jobs to preserve backward API structure
const localJobs = new Map<string, { status: string; items: unknown[] }>();

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    platform: z.enum(["x", "instagram"]),
    input: z.record(z.string(), z.unknown()),
  }),
  z.object({ action: z.literal("status"), runId: z.string().min(1).max(100) }),
  z.object({
    action: z.literal("items"),
    datasetId: z.string().min(1).max(100),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  z.object({ action: z.literal("abort"), runId: z.string().min(1).max(100) }),
]);

export async function POST(request: Request) {
  if (!(await requireAuth())) return unauthorized();
  if (!allowRequest(requestKey(request, "apify"), 120))
    return NextResponse.json(
      { ok: false, error: "Límite temporal de solicitudes alcanzado." },
      { status: 429 },
    );

  try {
    const body = schema.parse(await request.json());

    if (body.action === "start") {
      const runId = `local_run_${Date.now()}`;
      localJobs.set(runId, { status: "RUNNING", items: [] });

      // Run local Instagram scraping in background or inline
      const directUrls = (body.input.directUrls as string[]) || [];
      const usernames = directUrls
        .map((url) => {
          const m = url.match(/instagram\.com\/([^/]+)/);
          return m ? m[1] : "";
        })
        .filter(Boolean);

      const limit = Number(body.input.resultsLimit || 20);

      // Async execution of local scraper
      localInstagram
        .getAllAccountsPosts(usernames, limit)
        .then((items) => {
          localJobs.set(runId, { status: "SUCCEEDED", items });
        })
        .catch((err) => {
          console.error("Local IG scraper error:", err);
          localJobs.set(runId, { status: "FAILED", items: [] });
        });

      return NextResponse.json({
        ok: true,
        data: { id: runId, defaultDatasetId: runId },
        source: "local_playwright_instagram",
      });
    }

    if (body.action === "status") {
      const job = localJobs.get(body.runId) || { status: "SUCCEEDED", items: [] };
      return NextResponse.json({
        ok: true,
        data: { status: job.status, defaultDatasetId: body.runId },
        source: "local_playwright_instagram",
      });
    }

    if (body.action === "items") {
      const job = localJobs.get(body.datasetId);
      const items = job?.items || [];
      const offset = body.offset || 0;
      const limit = body.limit || 250;
      const sliced = items.slice(offset, offset + limit);

      return NextResponse.json({
        ok: true,
        data: sliced,
        source: "local_playwright_instagram",
      });
    }

    if (body.action === "abort") {
      localJobs.delete(body.runId);
      return NextResponse.json({ ok: true, data: { status: "ABORTED" } });
    }

    return NextResponse.json({ ok: false, error: "Acción no soportada" }, { status: 400 });
  } catch (error) {
    return failure(error, "local_playwright_instagram");
  }
}
