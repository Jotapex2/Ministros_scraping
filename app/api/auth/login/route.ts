import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionToken, validPassword } from "@/lib/auth";
import { allowRequest, requestKey } from "@/lib/rate-limit";
export async function POST(request: Request) {
  if (!allowRequest(requestKey(request, "login"), 8, 10 * 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Intente más tarde." },
      { status: 429 },
    );
  }
  const parsed = z
    .object({ password: z.string().max(256) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success || !validPassword(parsed.data.password))
    return NextResponse.json(
      { ok: false, error: "Clave incorrecta." },
      { status: 401 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set("observatorio_auth", sessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
