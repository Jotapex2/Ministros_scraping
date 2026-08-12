import { NextResponse } from "next/server";
import { z } from "zod";
import { localX } from "@/lib/providers/local-x";
import { failure, requireAuth, unauthorized } from "@/lib/api";
import { allowRequest, requestKey } from "@/lib/rate-limit";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("profile"),
    username: z.string().min(1).max(50),
  }),
  z.object({
    action: z.literal("timeline"),
    username: z.string().min(1).max(50),
    cursor: z.string().max(5000).optional(),
    includeReplies: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    sinceTime: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("replies"),
    tweetId: z.string().min(1).max(100),
    cursor: z.string().max(5000).optional(),
  }),
  z.object({
    action: z.literal("search"),
    query: z.string().min(1).max(500),
    sinceTime: z.number().int(),
    untilTime: z.number().int(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
]);

export async function POST(request: Request) {
  if (!(await requireAuth())) return unauthorized();
  if (!allowRequest(requestKey(request, "twitter"), 120))
    return NextResponse.json(
      { ok: false, error: "Límite temporal de solicitudes alcanzado." },
      { status: 429 },
    );

  try {
    const body = schema.parse(await request.json());
    let data: unknown;

    if (body.action === "profile") {
      data = await localX.profile(body.username);
    } else if (body.action === "timeline") {
      data = await localX.timeline(
        body.username,
        body.cursor,
        body.includeReplies,
        body.limit,
        body.sinceTime,
      );
    } else if (body.action === "replies") {
      data = await localX.replies(body.tweetId, body.cursor);
    } else {
      data = await localX.search(
        body.query,
        body.sinceTime,
        body.untilTime,
        body.limit,
      );
    }

    return NextResponse.json({ ok: true, data, source: "local_playwright_x" });
  } catch (error) {
    return failure(error, "local_playwright_x");
  }
}
