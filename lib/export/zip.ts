"use client";
import JSZip from "jszip";
import type { AnalysisSession } from "@/types/analysis";
import { accountRows, csvString, postsRows } from "./csv";
import { wordFrequencies } from "@/lib/social/wordcloud";
export async function buildZip(session: AnalysisSession, pdf?: Blob) {
  const zip = new JSZip();
  const csv = zip.folder("csv")!;
  csv.file(
    "publicaciones.csv",
    csvString(
      postsRows({
        ...session,
        posts: session.posts.filter((post) => !post.isComment),
      }),
    ),
  );
  csv.file(
    "comentarios.csv",
    csvString(
      postsRows({
        ...session,
        posts: session.posts.filter((post) => post.isComment),
      }),
    ),
  );
  csv.file("ministros.csv", csvString(accountRows(session.config.accounts)));
  csv.file(
    "ranking_publicaciones.csv",
    csvString(
      (session.metrics?.ministerRankings ?? []).map((item) => ({
        ministro: item.name,
        x: item.postsX,
        instagram: item.postsInstagram,
        total: item.postsX + item.postsInstagram,
      })),
    ),
  );
  csv.file(
    "ranking_engagement.csv",
    csvString(
      (session.metrics?.ministerRankings ?? []).map((item) => ({
        ministro: item.name,
        engagement: item.engagement,
        promedio: item.averageEngagement,
      })),
    ),
  );
  csv.file(
    "seguidores.csv",
    csvString(
      session.profiles.map((item) => ({
        account_id: item.accountId,
        plataforma: item.platform,
        username: item.username,
        seguidores: item.followers.value ?? "N/D",
        fecha: item.capturedAt,
      })),
    ),
  );
  csv.file(
    "menciones.csv",
    csvString(
      (session.metrics?.ministerRankings ?? []).map((item) => ({
        ministro: item.name,
        x: item.mentionsX,
        instagram: item.mentionsInstagram,
        total: item.mentionsX + item.mentionsInstagram,
        usuarios: item.uniqueAuthors,
      })),
    ),
  );
  csv.file(
    "share_of_voice.csv",
    csvString(
      (session.metrics?.ministerRankings ?? []).map((item) => ({
        ministro: item.name,
        sov: item.shareOfVoice,
      })),
    ),
  );
  csv.file("sentimiento.csv", csvString(session.sentiments));
  csv.file("temas.csv", csvString(session.topics));
  csv.file(
    "palabras_positivas.csv",
    csvString(wordFrequencies(session.posts, session.sentiments, "positive")),
  );
  csv.file(
    "palabras_negativas.csv",
    csvString(wordFrequencies(session.posts, session.sentiments, "negative")),
  );
  zip.folder("data")!.file("session.json", JSON.stringify(session, null, 2));
  if (pdf) zip.folder("report")!.file("informe_observatorio.pdf", pdf);
  return zip.generateAsync({ type: "blob" });
}
