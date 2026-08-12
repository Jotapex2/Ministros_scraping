"use client";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { AnalysisSession } from "@/types/analysis";
import { formatNumber, formatPercent } from "@/lib/utils";

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", fontSize: 9, color: "#18231f" },
  cover: {
    backgroundColor: "#142b26",
    color: "#f6f2e8",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#bf9b61",
    marginBottom: 18,
  },
  title: { fontSize: 29, lineHeight: 1.08, marginBottom: 18 },
  subtitle: { fontSize: 13, color: "#d8dfdb", marginBottom: 44 },
  section: { fontSize: 17, marginBottom: 14, color: "#142b26" },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #dce2df",
    paddingVertical: 7,
  },
  header: { backgroundColor: "#edf0ee", fontFamily: "Helvetica-Bold" },
  cell: { flex: 1, paddingRight: 6 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "31%", border: "1 solid #dce2df", padding: 12 },
  kpiValue: { fontSize: 18, marginTop: 5, color: "#8b5e27" },
  bullet: { marginBottom: 8, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#66726d",
    fontSize: 7,
  },
  note: { fontSize: 8, color: "#66726d", lineHeight: 1.4, marginTop: 12 },
  barRow: { marginBottom: 9 },
  bar: { height: 8, backgroundColor: "#286b5b", marginTop: 3 },
  red: { backgroundColor: "#a9483f" },
  gray: { backgroundColor: "#8a9490" },
});
const Footer = () => (
  <View style={styles.footer} fixed>
    <Text>Observatorio Digital del Gobierno · Fuente: APIs configuradas</Text>
    <Text
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  </View>
);
const Table = ({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) => (
  <View>
    <View style={[styles.row, styles.header]}>
      {headers.map((header) => (
        <Text key={header} style={styles.cell}>
          {header}
        </Text>
      ))}
    </View>
    {rows.slice(0, 12).map((row, i) => (
      <View key={i} style={styles.row}>
        {row.map((value, j) => (
          <Text key={j} style={styles.cell}>
            {String(value)}
          </Text>
        ))}
      </View>
    ))}
  </View>
);

export function AnalysisReport({ session }: { session: AnalysisSession }) {
  const metrics = session.metrics;
  const rankings = [...(metrics?.ministerRankings ?? [])];
  const sentimentTotal = metrics
    ? Object.values(metrics.governmentSentiment).reduce((a, b) => a + b, 0)
    : 0;
  return (
    <Document
      title="Observatorio Digital del Gobierno"
      author="Observatorio Digital del Gobierno"
    >
      <Page size="A4" style={[styles.page, styles.cover]}>
        <Text style={styles.eyebrow}>
          INTELIGENCIA POLÍTICA Y COMUNICACIONAL
        </Text>
        <Text style={styles.title}>OBSERVATORIO DIGITAL DEL GOBIERNO</Text>
        <Text style={styles.subtitle}>
          Análisis de conversación y desempeño digital en X e Instagram
        </Text>
        <Text>
          Período: {session.config.startDate} — {session.config.endDate}
        </Text>
        <Text>Generado: {new Date().toLocaleString("es-CL")}</Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Resumen ejecutivo</Text>
        {session.executiveSummary.length ? (
          session.executiveSummary.map((item, i) => (
            <Text key={i} style={styles.bullet}>
              • {item}
            </Text>
          ))
        ) : (
          <Text>El resumen estará disponible al completar el análisis.</Text>
        )}
        <Text style={styles.note}>
          Los resultados representan contenido público recuperado y no
          constituyen una encuesta representativa.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Indicadores generales</Text>
        <View style={styles.kpis}>
          {[
            ["Publicaciones", metrics?.publications],
            ["Comentarios", metrics?.comments],
            ["Interacciones", metrics?.interactionsBasic],
            ["Menciones ministeriales", metrics?.ministerMentions],
            ["Usuarios únicos", metrics?.uniqueUsers],
            ["Temas", session.topics.length],
          ].map(([label, value]) => (
            <View style={styles.kpi} key={String(label)}>
              <Text>{label}</Text>
              <Text style={styles.kpiValue}>
                {formatNumber(value as number | undefined)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.section}>Actividad por plataforma</Text>
        <Table
          headers={[
            "Plataforma",
            "Posts",
            "Comentarios",
            "Interacciones",
            "Menciones",
          ]}
          rows={(["x", "instagram"] as const).map((p) => [
            p === "x" ? "X" : "Instagram",
            metrics?.platformMetrics[p].posts ?? 0,
            metrics?.platformMetrics[p].comments ?? 0,
            metrics?.platformMetrics[p].interactions ?? 0,
            metrics?.platformMetrics[p].mentions ?? 0,
          ])}
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Actividad e interacción ministerial</Text>
        <Table
          headers={[
            "Ministro",
            "Posts",
            "Interacción",
            "Promedio",
            "Seguidores X",
            "Seguidores IG",
          ]}
          rows={rankings
            .sort((a, b) => b.engagement - a.engagement)
            .map((m) => [
              m.name,
              m.postsX + m.postsInstagram,
              formatNumber(m.engagement),
              formatNumber(Math.round(m.averageEngagement)),
              formatNumber(m.followersX),
              formatNumber(m.followersInstagram),
            ])}
        />
        <Text style={styles.note}>
          Seguidores agregados por plataforma; una persona puede seguir al
          ministro en más de una red.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Menciones y Share of Voice</Text>
        <Table
          headers={["Ministro", "X", "Instagram", "SOV", "Net sentiment"]}
          rows={rankings
            .sort(
              (a, b) =>
                b.mentionsX +
                b.mentionsInstagram -
                a.mentionsX -
                a.mentionsInstagram,
            )
            .map((m) => [
              m.name,
              m.mentionsX,
              m.mentionsInstagram,
              formatPercent(m.shareOfVoice),
              formatPercent(m.netSentiment),
            ])}
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Sentimiento hacia el Gobierno</Text>
        {metrics &&
          (["positive", "neutral", "negative", "uncertain"] as const).map(
            (key) => {
              const value = metrics.governmentSentiment[key];
              const pct = sentimentTotal ? (value / sentimentTotal) * 100 : 0;
              return (
                <View key={key} style={styles.barRow}>
                  <Text>
                    {key}: {value} ({formatPercent(pct)})
                  </Text>
                  <View
                    style={[
                      styles.bar,
                      key === "negative"
                        ? styles.red
                        : key !== "positive"
                          ? styles.gray
                          : {},
                      { width: `${Math.max(1, pct)}%` },
                    ]}
                  />
                </View>
              );
            },
          )}
        <Text style={styles.note}>
          Clasificación automatizada mediante DeepSeek; puede contener errores
          de interpretación.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Temas principales</Text>
        <Table
          headers={[
            "Tema",
            "Posts",
            "Comentarios",
            "Usuarios",
            "Interacción",
            "Net sentiment",
          ]}
          rows={session.topics.map((t) => [
            t.topicName,
            t.posts,
            t.comments,
            t.uniqueAuthors,
            t.engagement,
            formatPercent(t.netSentiment),
          ])}
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Metodología y fuentes</Text>
        <Text style={styles.bullet}>
          Publicaciones y comentarios se normalizan desde TwitterAPI.io y los
          Actors Apify configurados. Los duplicados se eliminan por plataforma e
          identificador.
        </Text>
        <Text style={styles.bullet}>
          Engagement principal = likes + comentarios. Engagement ampliado agrega
          shares, reposts y quotes cuando están disponibles.
        </Text>
        <Text style={styles.bullet}>
          Share of Voice = menciones de cada ministro / menciones ministeriales
          totales.
        </Text>
        <Text style={styles.bullet}>
          Net Sentiment = porcentaje positivo - porcentaje negativo. El balance
          gubernamental ampliado considera Gobierno, Presidencia, instituciones
          y políticas públicas.
        </Text>
        <Text style={styles.bullet}>
          Los temas son agrupaciones semánticas etiquetadas por DeepSeek; los
          volúmenes se calculan en código.
        </Text>
        <Text style={styles.note}>
          Extracción: {session.createdAt}. Plataformas:{" "}
          {session.config.platforms.join(", ")}. Los resultados no se almacenan
          en el servidor.
        </Text>
        <Footer />
      </Page>
    </Document>
  );
}
export const generatePdf = (session: AnalysisSession) =>
  pdf(<AnalysisReport session={session} />).toBlob();
