import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const cleanUsername = (value: string) => value.trim().replace(/^@/, "");
export const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const available = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? { status: "available" as const, value }
    : { status: "not_available" as const };
export const numeric = (value: { status: string; value?: number }) =>
  value.status === "available" ? (value.value ?? 0) : 0;
export const slugify = (value: string) =>
  plain(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const formatNumber = (value?: number) =>
  value == null ? "N/D" : new Intl.NumberFormat("es-CL").format(value);
export const formatPercent = (value?: number) =>
  value == null
    ? "N/D"
    : `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value)}%`;
