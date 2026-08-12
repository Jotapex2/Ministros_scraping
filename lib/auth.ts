import { createHmac, timingSafeEqual } from "node:crypto";
const secret = () => process.env.AUTH_SECRET || "development-only-change-me";
export const sessionToken = () =>
  createHmac("sha256", secret())
    .update("observatorio-session-v1")
    .digest("hex");
export function validPassword(input: string) {
  const expected = process.env.APP_ACCESS_PASSWORD;
  if (!expected) return process.env.NODE_ENV !== "production";
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const validToken = (input?: string) =>
  !!input &&
  input.length === sessionToken().length &&
  timingSafeEqual(Buffer.from(input), Buffer.from(sessionToken()));
