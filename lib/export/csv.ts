import type { AnalysisSession } from "@/types/analysis";
import type { AccountConfig } from "@/types/social";
import { engagementBasic, engagementExpanded } from "@/lib/social/metrics";

const cell = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/"/g, '""')
    .replace(/\r?\n/g, " ")}"`;
export function csvString<T extends object>(rows: T[], separator = ";") {
  if (!rows.length) return "\uFEFF";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `\uFEFF${headers.map(cell).join(separator)}\r\n${rows.map((row) => headers.map((header) => cell((row as Record<string, unknown>)[header])).join(separator)).join("\r\n")}`;
}
export function downloadBlob(
  content: BlobPart,
  filename: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const downloadCsv = (rows: object[], filename: string) =>
  downloadBlob(csvString(rows), filename, "text/csv;charset=utf-8");
export function postsRows(session: AnalysisSession) {
  const sentiments = new Map(
    session.sentiments.map((item) => [item.itemId, item]),
  );
  return session.posts.map((post) => {
    const result = sentiments.get(post.id);
    return {
      platform: post.platform,
      post_id: post.id,
      date: post.createdAt.replace("T", " ").replace("Z", ""),
      author: post.authorName,
      username: post.username,
      account_type: post.authorType,
      minister: post.ministerId ?? "",
      text: post.text,
      likes: post.likes.value ?? "N/D",
      comments: post.comments.value ?? "N/D",
      shares: post.shares.value ?? "N/D",
      reposts: post.reposts.value ?? "N/D",
      quotes: post.quotes.value ?? "N/D",
      views: post.views.value ?? "N/D",
      engagement_basic: engagementBasic(post),
      engagement_total: engagementExpanded(post),
      sentiment: result?.sentiment ?? "No analizado",
      sentiment_score: result?.score ?? "",
      sentiment_confidence: result?.confidence ?? "",
      sentiment_target: result?.target ?? "",
      topic: result?.topic ?? "",
      keywords: result?.keywords.join("|") ?? "",
      entities: result?.entities.join("|") ?? "",
      url: post.url,
    };
  });
}
export const accountRows = (accounts: AccountConfig[]) =>
  accounts.map((account) => ({
    nombre: account.name,
    cargo: account.position,
    ministerio: account.ministry,
    tipo: account.accountType,
    x: account.xUsername,
    link_x: account.xUsername ? `https://x.com/${account.xUsername}` : "",
    instagram: account.instagramUsername,
    link_instagram: account.instagramUsername
      ? `https://www.instagram.com/${account.instagramUsername}/`
      : "",
    aliases: account.aliases.join("|"),
    activo: account.active ? "sí" : "no",
  }));
export function parseAccountCsv(input: string): AccountConfig[] {
  const lines = input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) throw new Error("El CSV no contiene filas.");
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const parse = (line: string) => {
    const out: string[] = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) {
        out.push(value);
        value = "";
      } else value += char;
    }
    out.push(value);
    return out;
  };
  const headers = parse(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = parse(line);
    const get = (...names: string[]) => {
      const position = headers.findIndex((header) => names.includes(header));
      return position >= 0 ? (values[position] ?? "").trim() : "";
    };
    const name = get("nombre", "nombre ministro", "name");
    if (!name) throw new Error(`Fila ${index + 2}: falta el nombre.`);
    const ministry = get("ministerio", "cargo", "ministry");
    return {
      id:
        get("id") ||
        name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
      name,
      position: get("posición", "position", "cargo") || ministry,
      ministry,
      accountType: (get("tipo", "account_type") ||
        "minister") as AccountConfig["accountType"],
      xUsername: get("x", "xusername", "perfil de x").replace(/^@/, ""),
      instagramUsername: get(
        "instagram",
        "instagramusername",
        "perfil de ig",
      ).replace(/^@/, ""),
      aliases: (get("aliases") || name)
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean),
      active: !["no", "false", "0"].includes(
        get("activo", "active").toLowerCase(),
      ),
    };
  });
}
