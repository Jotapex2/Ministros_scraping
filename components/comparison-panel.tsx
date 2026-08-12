"use client";

import { useMemo, useRef, useState } from "react";
import type { AnalysisSession } from "@/types/analysis";
import { Button, Card } from "./ui";
import { formatNumber, formatPercent } from "@/lib/utils";

export function ComparisonPanel({ current }: { current: AnalysisSession }) {
  const [previous, setPrevious] = useState<AnalysisSession>();
  const input = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    if (!previous?.metrics || !current.metrics) return [];
    const prior = new Map(
      previous.metrics.ministerRankings.map((item) => [item.accountId, item]),
    );
    return current.metrics.ministerRankings.map((item) => {
      const before = prior.get(item.accountId);
      const currentFollowers =
        (item.followersX ?? 0) + (item.followersInstagram ?? 0);
      const previousFollowers = before
        ? (before.followersX ?? 0) + (before.followersInstagram ?? 0)
        : undefined;
      return {
        name: item.name,
        followers:
          previousFollowers == null
            ? undefined
            : currentFollowers - previousFollowers,
        posts:
          before == null
            ? undefined
            : item.postsX +
              item.postsInstagram -
              before.postsX -
              before.postsInstagram,
        engagement:
          before == null ? undefined : item.engagement - before.engagement,
        mentions:
          before == null
            ? undefined
            : item.mentionsX +
              item.mentionsInstagram -
              before.mentionsX -
              before.mentionsInstagram,
        sov:
          before == null ? undefined : item.shareOfVoice - before.shareOfVoice,
      };
    });
  }, [current, previous]);

  return (
    <section className="section">
      <div className="section-heading">
        <h2>Comparación con medición anterior</h2>
        <p>El archivo se procesa únicamente durante esta sesión.</p>
      </div>
      {!previous ? (
        <Card>
          <p>Primera medición disponible.</p>
          <Button variant="outline" onClick={() => input.current?.click()}>
            Cargar sesión anterior JSON
          </Button>
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ministro</th>
                <th>Seguidores</th>
                <th>Publicaciones</th>
                <th>Engagement</th>
                <th>Menciones</th>
                <th>SOV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>
                    {row.followers == null
                      ? "N/D"
                      : formatNumber(row.followers)}
                  </td>
                  <td>{row.posts == null ? "N/D" : formatNumber(row.posts)}</td>
                  <td>
                    {row.engagement == null
                      ? "N/D"
                      : formatNumber(row.engagement)}
                  </td>
                  <td>
                    {row.mentions == null ? "N/D" : formatNumber(row.mentions)}
                  </td>
                  <td>{row.sov == null ? "N/D" : formatPercent(row.sov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const session = JSON.parse(await file.text()) as AnalysisSession;
            if (session.schemaVersion !== 1 || !session.metrics)
              throw new Error("Sesión incompatible");
            setPrevious(session);
          } catch (error) {
            alert(error instanceof Error ? error.message : "Archivo inválido");
          }
        }}
      />
    </section>
  );
}
