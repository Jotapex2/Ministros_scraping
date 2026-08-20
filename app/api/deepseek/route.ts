import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSentiment, labelTopics } from "@/lib/providers/deepseek";
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
  }),
  z.object({
    action: z.literal("topics"),
    items: z.array(item).min(1).max(50),
    existing: z.array(z.string()).max(100).optional(),
  }),
]);

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!(await requireAuth())) return unauthorized();
  if (!allowRequest(requestKey(request, "deepseek"), 40))
    return NextResponse.json(
      { ok: false, error: "Límite temporal de solicitudes alcanzado." },
      { status: 429 },
    );

  try {
    const body = schema.parse(await request.json());

    const data =
      body.action === "sentiment"
        ? await analyzeSentiment(body.items)
        : await labelTopics(body.items, body.existing);

    return NextResponse.json({ ok: true, data, source: "deepseek" });
  } catch (error) {
    return failure(error, "llm_provider");
  }
}
