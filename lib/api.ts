import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validToken } from "./auth";
import { ProviderError } from "./providers/http";
export async function requireAuth() {
  return true;
}
export const unauthorized = () =>
  NextResponse.json(
    { ok: false, error: "Sesión no autorizada.", retryable: false },
    { status: 401 },
  );
export const failure = (error: unknown, source: string) => {
  const status =
    error instanceof ProviderError && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado.",
      retryable: error instanceof ProviderError ? error.retryable : false,
      source,
    },
    { status },
  );
};
