import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSessionStatus,
  loginInstagram,
  loginX,
} from "@/lib/providers/session-manager";
import { failure, requireAuth, unauthorized } from "@/lib/api";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({
    action: z.literal("login_x"),
    username: z.string().optional(),
    password: z.string().optional(),
    cookieAuthToken: z.string().optional(),
  }),
  z.object({
    action: z.literal("login_instagram"),
    username: z.string().optional(),
    password: z.string().optional(),
    cookieSessionId: z.string().optional(),
  }),
]);

export async function GET() {
  if (!(await requireAuth())) return unauthorized();
  try {
    const status = await getSessionStatus();
    return NextResponse.json({ ok: true, data: status });
  } catch (error) {
    return failure(error, "scraper_auth");
  }
}

export async function POST(request: Request) {
  if (!(await requireAuth())) return unauthorized();

  try {
    const body = schema.parse(await request.json());

    if (body.action === "status") {
      const status = await getSessionStatus();
      return NextResponse.json({ ok: true, data: status });
    }

    if (body.action === "login_x") {
      const res = await loginX({
        username: body.username,
        password: body.password,
        cookieAuthToken: body.cookieAuthToken,
      });
      if (!res.success) {
        return NextResponse.json(
          { ok: false, error: res.error || "Falló el login de X." },
          { status: 400 },
        );
      }
      const status = await getSessionStatus();
      return NextResponse.json({ ok: true, data: status });
    }

    if (body.action === "login_instagram") {
      const res = await loginInstagram({
        username: body.username,
        password: body.password,
        cookieSessionId: body.cookieSessionId,
      });
      if (!res.success) {
        return NextResponse.json(
          { ok: false, error: res.error || "Falló el login de Instagram." },
          { status: 400 },
        );
      }
      const status = await getSessionStatus();
      return NextResponse.json({ ok: true, data: status });
    }

    return NextResponse.json({ ok: false, error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    return failure(error, "scraper_auth");
  }
}
