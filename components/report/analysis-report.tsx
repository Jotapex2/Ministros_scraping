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
import type { MinisterMetric } from "@/types/analysis";
import { formatNumber, formatPercent } from "@/lib/utils";
import { wordFrequencies, type WordFrequency } from "@/lib/social/wordcloud";

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
  demoBadge: {
    alignSelf: "flex-start",
    border: "1 solid #bf9b61",
    color: "#f6d89e",
    fontSize: 8,
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 18,
  },
  section: { fontSize: 17, marginBottom: 14, color: "#142b26" },
  sectionSubtitle: {
    fontSize: 8,
    color: "#66726d",
    marginTop: -9,
    marginBottom: 13,
  },
  subsection: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#142b26",
  },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #dce2df",
    paddingVertical: 7,
  },
  header: { backgroundColor: "#edf0ee", fontFamily: "Helvetica-Bold" },
  cell: { flex: 1, paddingHorizontal: 4 },
  compactRow: { paddingVertical: 4, fontSize: 7.2 },
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
  twoColumns: { flexDirection: "row", gap: 16 },
  chartPanel: {
    flex: 1,
    border: "1 solid #dce2df",
    padding: 10,
    minHeight: 250,
  },
  chartRow: { marginBottom: 8 },
  chartLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    marginBottom: 2,
  },
  chartTrack: { height: 9, backgroundColor: "#edf0ee" },
  chartX: { height: 9, backgroundColor: "#263d48" },
  chartInstagram: { height: 9, backgroundColor: "#8d5265" },
  chartGreen: { height: 9, backgroundColor: "#205e50" },
  legend: { flexDirection: "row", gap: 12, marginTop: 8, fontSize: 7 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendSwatch: { width: 7, height: 7 },
  scatter: {
    position: "relative",
    height: 320,
    marginTop: 8,
    marginLeft: 34,
    marginBottom: 24,
    borderLeft: "1 solid #526962",
    borderBottom: "1 solid #526962",
    backgroundColor: "#fbfcfb",
  },
  scatterPoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0f766e",
    border: "1 solid #ffffff",
  },
  scatterLabel: {
    position: "absolute",
    width: 72,
    fontSize: 5.5,
    textAlign: "center",
    color: "#18231f",
  },
  topicScatter: {
    position: "relative",
    height: 300,
    marginTop: 12,
    marginLeft: 38,
    marginRight: 10,
    marginBottom: 32,
    borderLeft: "1 solid #526962",
    borderBottom: "1 solid #526962",
    backgroundColor: "#fbfcfb",
  },
  topicGridVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderLeft: "0.5 solid #dce2df",
  },
  topicGridHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTop: "0.5 solid #dce2df",
  },
  topicTickX: {
    position: "absolute",
    bottom: -13,
    width: 34,
    marginLeft: -17,
    fontSize: 6,
    textAlign: "center",
    color: "#526962",
  },
  topicTickY: {
    position: "absolute",
    left: -34,
    width: 29,
    marginBottom: -3,
    fontSize: 6,
    textAlign: "right",
    color: "#526962",
  },
  topicPoint: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#205e50",
    border: "1 solid #ffffff",
  },
  topicPointNumber: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 6,
  },
  axisLabelX: {
    position: "absolute",
    bottom: 22,
    left: 170,
    fontSize: 7,
    color: "#526962",
  },
  axisLabelY: {
    position: "absolute",
    left: 42,
    top: 215,
    fontSize: 7,
    color: "#526962",
  },
  wordCloudRow: { flexDirection: "row", gap: 12 },
  wordCloudPanel: {
    flex: 1,
    minHeight: 315,
    border: "1 solid #dce2df",
    padding: 11,
  },
  wordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
});
const Footer = () => (
  <View style={styles.footer} fixed>
    <Text>Observatorio Digital del Gobierno - Fuentes: X e Instagram</Text>
    <Text
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  </View>
);
const Table = ({
  headers,
  rows,
  widths,
  compact = false,
}: {
  headers: string[];
  rows: (string | number)[][];
  widths?: number[];
  compact?: boolean;
}) => (
  <View>
    <View style={[styles.row, styles.header, compact ? styles.compactRow : {}]} wrap={false}>
      {headers.map((header, index) => (
        <Text
          key={header}
          style={[styles.cell, widths ? { flex: widths[index] } : {}]}
        >
          {header}
        </Text>
      ))}
    </View>
    {rows.map((row, i) => (
      <View
        key={i}
        style={[styles.row, compact ? styles.compactRow : {}]}
        wrap={false}
      >
        {row.map((value, j) => (
          <Text
            key={j}
            style={[styles.cell, widths ? { flex: widths[j] } : {}]}
          >
            {String(value)}
          </Text>
        ))}
      </View>
    ))}
  </View>
);

const Legend = () => (
  <View style={styles.legend}>
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: "#263d48" }]} />
      <Text>X</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: "#8d5265" }]} />
      <Text>Instagram</Text>
    </View>
  </View>
);

const RankedBars = ({
  title,
  items,
  mode,
}: {
  title: string;
  items: MinisterMetric[];
  mode: "posts" | "engagement" | "mentions" | "sov";
}) => {
  const value = (item: MinisterMetric) =>
    mode === "posts"
      ? item.postsX + item.postsInstagram
      : mode === "engagement"
        ? item.engagement
        : mode === "mentions"
          ? item.mentionsX + item.mentionsInstagram
          : item.shareOfVoice;
  const maximum = Math.max(1, ...items.map(value));
  return (
    <View style={styles.chartPanel}>
      <Text style={styles.subsection}>{title}</Text>
      {items.map((item) => {
        const total = value(item);
        const xShare =
          mode === "posts"
            ? item.postsX / Math.max(1, total)
            : mode === "mentions"
              ? item.mentionsX / Math.max(1, total)
              : 1;
        const width = `${Math.max(1, (total / maximum) * 100)}%`;
        return (
          <View key={item.accountId} style={styles.chartRow} wrap={false}>
            <View style={styles.chartLabelRow}>
              <Text>{item.name}</Text>
              <Text>
                {mode === "sov" ? formatPercent(total) : formatNumber(total)}
              </Text>
            </View>
            <View style={styles.chartTrack}>
              {mode === "posts" || mode === "mentions" ? (
                <View style={{ flexDirection: "row", width }}>
                  <View style={[styles.chartX, { width: `${xShare * 100}%` }]} />
                  <View
                    style={[
                      styles.chartInstagram,
                      { width: `${(1 - xShare) * 100}%` },
                    ]}
                  />
                </View>
              ) : (
                <View style={[styles.chartGreen, { width }]} />
              )}
            </View>
          </View>
        );
      })}
      {(mode === "posts" || mode === "mentions") && <Legend />}
    </View>
  );
};

const ImpactScatter = ({ items }: { items: MinisterMetric[] }) => {
  const maxPosts = Math.max(1, ...items.map((item) => item.postsX + item.postsInstagram));
  const maxAverage = Math.max(1, ...items.map((item) => item.averageEngagement));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <View>
      <Text style={{ fontSize: 7, color: "#526962", marginLeft: 34 }}>
        Eje Y: engagement promedio por publicación
      </Text>
      <View style={styles.scatter}>
        {ticks.map((ratio) => (
          <React.Fragment key={`impact-${ratio}`}>
            <View
              style={[styles.topicGridVertical, { left: `${ratio * 100}%` }]}
            />
            <Text style={[styles.topicTickX, { left: `${ratio * 100}%` }]}>
              {Math.round(maxPosts * ratio)}
            </Text>
            <View
              style={[styles.topicGridHorizontal, { bottom: `${ratio * 100}%` }]}
            />
            <Text style={[styles.topicTickY, { bottom: `${ratio * 100}%` }]}>
              {formatNumber(Math.round(maxAverage * ratio))}
            </Text>
          </React.Fragment>
        ))}
        {items.map((item, index) => {
          const posts = item.postsX + item.postsInstagram;
          const left = Math.min(97, Math.max(3, (posts / maxPosts) * 100));
          const bottom = Math.min(
            96,
            Math.max(3, (item.averageEngagement / maxAverage) * 100),
          );
          return (
            <View
              key={item.accountId}
              style={[
                styles.topicPoint,
                {
                  left: `${left}%`,
                  bottom: `${bottom}%`,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  marginLeft: -8,
                  marginBottom: -8,
                },
              ]}
            >
              <Text style={styles.topicPointNumber}>{index + 1}</Text>
            </View>
          );
        })}
      </View>
      <Text
        style={{
          fontSize: 7,
          color: "#526962",
          textAlign: "center",
          marginTop: -16,
        }}
      >
        Eje X: publicaciones propias
      </Text>
    </View>
  );
};

const TopicScatter = ({ topics }: { topics: AnalysisSession["topics"] }) => {
  const maxVolume = Math.max(
    1,
    ...topics.map((topic) => topic.posts + topic.comments),
  );
  const maxEngagement = Math.max(1, ...topics.map((topic) => topic.engagement));
  const xTicks = [-100, -50, 0, 50, 100];
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <View>
      <Text style={{ fontSize: 7, color: "#526962", marginLeft: 38 }}>
        Eje Y: volumen del tema (publicaciones + comentarios)
      </Text>
      <View style={styles.topicScatter}>
        {xTicks.map((tick) => {
          const left = ((tick + 100) / 200) * 100;
          return (
            <React.Fragment key={`x-${tick}`}>
              <View style={[styles.topicGridVertical, { left: `${left}%` }]} />
              <Text style={[styles.topicTickX, { left: `${left}%` }]}>
                {tick}%
              </Text>
            </React.Fragment>
          );
        })}
        {yTicks.map((ratio) => {
          const volume = Math.round(maxVolume * ratio);
          return (
            <React.Fragment key={`y-${ratio}`}>
              <View
                style={[styles.topicGridHorizontal, { bottom: `${ratio * 100}%` }]}
              />
              <Text style={[styles.topicTickY, { bottom: `${ratio * 100}%` }]}>
                {volume}
              </Text>
            </React.Fragment>
          );
        })}
        {topics.map((topic, index) => {
          const volume = topic.posts + topic.comments;
          const size = 13 + (topic.engagement / maxEngagement) * 14;
          const left = Math.min(
            97,
            Math.max(3, ((topic.netSentiment + 100) / 200) * 100),
          );
          const bottom = Math.min(
            96,
            Math.max(3, (volume / maxVolume) * 100),
          );
          return (
            <View
              key={`${topic.topicName}-${index}`}
              style={[
                styles.topicPoint,
                {
                  left: `${left}%`,
                  bottom: `${bottom}%`,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  marginLeft: -size / 2,
                  marginBottom: -size / 2,
                },
              ]}
            >
              <Text style={styles.topicPointNumber}>{index + 1}</Text>
            </View>
          );
        })}
      </View>
      <Text
        style={{
          fontSize: 7,
          color: "#526962",
          textAlign: "center",
          marginTop: -17,
        }}
      >
        Eje X: Net Sentiment (%) = % positivo - % negativo
      </Text>
      <Text style={[styles.note, { marginTop: 20 }]}>
        Cada burbuja lleva el número de su fila en la tabla; su tamaño
        representa la interacción. Un valor X negativo indica predominio de
        sentimiento negativo y uno positivo, predominio positivo.
      </Text>
    </View>
  );
};

const WordCloud = ({
  title,
  words,
  color,
}: {
  title: string;
  words: WordFrequency[];
  color: string;
}) => (
  <View style={styles.wordCloudPanel}>
    <Text style={styles.subsection}>{title}</Text>
    <View style={styles.wordWrap}>
      {words.map((word) => (
        <Text
          key={word.word}
          style={{
            color,
            fontSize: 7 + word.score * 12,
            marginHorizontal: 3,
            marginVertical: 3,
          }}
        >
          {word.word}
        </Text>
      ))}
    </View>
  </View>
);

export function AnalysisReport({ session }: { session: AnalysisSession }) {
  const isReviewFixture = session.id === "pdf-layout-fixture";
  const metrics = session.metrics;
  const rankings = metrics?.ministerRankings ?? [];
  const byPosts = [...rankings].sort(
    (a, b) =>
      b.postsX + b.postsInstagram - (a.postsX + a.postsInstagram),
  );
  const byEngagement = [...rankings].sort(
    (a, b) => b.engagement - a.engagement,
  );
  const byFollowers = [...rankings].sort(
    (a, b) =>
      (b.followersX ?? 0) +
      (b.followersInstagram ?? 0) -
      (a.followersX ?? 0) -
      (a.followersInstagram ?? 0),
  );
  const byMentions = [...rankings].sort(
    (a, b) =>
      b.mentionsX +
      b.mentionsInstagram -
      (a.mentionsX + a.mentionsInstagram),
  );
  const bySov = [...rankings].sort(
    (a, b) => b.shareOfVoice - a.shareOfVoice,
  );
  const positiveWords = wordFrequencies(
    session.posts,
    session.sentiments,
    "positive",
  );
  const negativeWords = wordFrequencies(
    session.posts,
    session.sentiments,
    "negative",
  );
  const totalWords = wordFrequencies(session.posts);
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
        {isReviewFixture && (
          <Text style={styles.demoBadge}>
            MUESTRA DE DISEÑO · DATOS SINTÉTICOS
          </Text>
        )}
        <Text>
          Período: {session.config.startDate} - {session.config.endDate}
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
        <Text style={styles.section}>Actividad e impacto ministerial</Text>
        <Text style={styles.sectionSubtitle}>
          Rankings considerando X e Instagram; ordenados de mayor a menor.
        </Text>
        <View style={styles.twoColumns}>
          <RankedBars
            title="Ministros que más publicaron"
            items={byPosts.slice(0, 10)}
            mode="posts"
          />
          <RankedBars
            title="Ministros con mayor interacción"
            items={byEngagement.slice(0, 10)}
            mode="engagement"
          />
        </View>
        <Text style={styles.note}>
          Interacción principal = likes + comentarios. El ranking visual muestra
          los primeros 10; el detalle incluye todos los ministros.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Detalle de actividad ministerial</Text>
        <Text style={styles.sectionSubtitle}>
          Publicaciones e interacción de todos los ministros observados.
        </Text>
        <Table
          headers={[
            "Ministro",
            "X",
            "Instagram",
            "Total posts",
            "Interacción",
            "Promedio/post",
          ]}
          rows={byPosts.map((m) => [
            m.name,
            m.postsX,
            m.postsInstagram,
            m.postsX + m.postsInstagram,
            formatNumber(m.engagement),
            formatNumber(Math.round(m.averageEngagement)),
          ])}
          widths={[2.2, 0.6, 0.8, 0.8, 0.9, 0.9]}
          compact
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Actividad vs impacto</Text>
        <Text style={styles.sectionSubtitle}>
          Eje X: publicaciones propias. Eje Y: engagement promedio por
          publicación. Se muestran todos los ministros con actividad observada.
        </Text>
        <ImpactScatter
          items={byPosts.filter(
            (item) => item.postsX + item.postsInstagram > 0,
          ).slice(0, 10)}
        />
        <Text style={styles.note}>
          Cada burbuja lleva el número de su fila en la tabla siguiente. La
          posición refleja actividad e interacción promedio.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Detalle de actividad vs impacto</Text>
        <Text style={styles.sectionSubtitle}>
          Valores utilizados para construir el gráfico de dispersión.
        </Text>
        <Table
          headers={[
            "N°",
            "Ministro",
            "Publicaciones",
            "Engagement/post",
            "Menciones",
            "Seguidores agregados",
          ]}
          rows={byPosts.map((m, index) => [
            index + 1,
            m.name,
            m.postsX + m.postsInstagram,
            formatNumber(Math.round(m.averageEngagement)),
            m.mentionsX + m.mentionsInstagram,
            m.followersX == null && m.followersInstagram == null
              ? "N/D"
              : formatNumber((m.followersX ?? 0) + (m.followersInstagram ?? 0)),
          ])}
          widths={[0.35, 2.2, 0.9, 1, 0.8, 1.2]}
          compact
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Seguidores</Text>
        <Text style={styles.sectionSubtitle}>
          Agregados por plataforma; una persona puede seguir al ministro en más
          de una red.
        </Text>
        <Table
          headers={[
            "Ministro",
            "Seguidores X",
            "Seguidores Instagram",
            "Total agregado",
          ]}
          rows={byFollowers.map((m) => [
            m.name,
            m.followersX == null ? "N/D" : formatNumber(m.followersX),
            m.followersInstagram == null
              ? "N/D"
              : formatNumber(m.followersInstagram),
            m.followersX == null && m.followersInstagram == null
              ? "N/D"
              : formatNumber((m.followersX ?? 0) + (m.followersInstagram ?? 0)),
          ])}
          widths={[2.3, 1, 1.2, 1]}
          compact
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Conversación ministerial</Text>
        <Text style={styles.sectionSubtitle}>
          Rankings y participación en menciones ministeriales.
        </Text>
        <View style={styles.twoColumns}>
          <RankedBars
            title="Ministros más mencionados"
            items={byMentions.slice(0, 10)}
            mode="mentions"
          />
          <RankedBars
            title="Participación en la conversación"
            items={bySov.slice(0, 10)}
            mode="sov"
          />
        </View>
        <Text style={styles.note}>
          El ranking visual muestra los primeros 10. La participación se calcula
          sobre el total de menciones ministeriales recuperadas.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Detalle de conversación ministerial</Text>
        <Text style={styles.sectionSubtitle}>
          Menciones, participación y autores únicos de todos los ministros.
        </Text>
        <Table
          headers={[
            "Ministro",
            "X",
            "Instagram",
            "Total",
            "SOV",
            "Usuarios",
          ]}
          rows={byMentions.map((m) => [
            m.name,
            m.mentionsX,
            m.mentionsInstagram,
            m.mentionsX + m.mentionsInstagram,
            formatPercent(m.shareOfVoice),
            m.uniqueAuthors,
          ])}
          widths={[2.2, 0.6, 0.8, 0.7, 0.8, 0.8]}
          compact
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Sentimiento</Text>
        <Text style={styles.subsection}>Sentimiento general hacia el Gobierno</Text>
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
        <Text style={[styles.subsection, { marginTop: 16 }]}>Sentimiento por ministro</Text>
        <Table
          headers={["Ministro", "+", "-", "Neutral", "Incierto", "Net"]}
          rows={byMentions.map((m) => [
            m.name,
            m.positive,
            m.negative,
            m.neutral,
            m.uncertain,
            formatPercent(m.netSentiment),
          ])}
          widths={[2.4, 0.5, 0.5, 0.7, 0.7, 0.8]}
          compact
        />
        <Text style={styles.note}>
          Clasificación automatizada mediante DeepSeek; puede contener errores de interpretación.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Temas principales</Text>
        <Text style={styles.sectionSubtitle}>
          Volumen y sentimiento neto de los principales temas.
        </Text>
        <TopicScatter topics={session.topics} />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Detalle de temas principales</Text>
        <Table
          headers={[
            "N°",
            "Tema",
            "Posts",
            "Comentarios",
            "Usuarios",
            "Interacción",
            "Net sentiment",
          ]}
          rows={session.topics.map((t, index) => [
            index + 1,
            t.topicName,
            t.posts,
            t.comments,
            t.uniqueAuthors,
            t.engagement,
            formatPercent(t.netSentiment),
          ])}
          widths={[0.35, 2.5, 0.6, 0.8, 0.7, 0.8, 0.9]}
        />
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Nubes de palabras</Text>
        <Text style={styles.sectionSubtitle}>
          Términos más frecuentes por pieza; se excluyen palabras funcionales,
          URLs, menciones y hashtags.
        </Text>
        <View style={styles.wordCloudRow}>
          <WordCloud
            title="Nube positiva"
            words={positiveWords}
            color="#176b59"
          />
          <WordCloud
            title="Nube negativa"
            words={negativeWords}
            color="#b34135"
          />
          <WordCloud title="Nube total" words={totalWords} color="#2879d8" />
        </View>
        <Text style={styles.note}>
          El tamaño representa frecuencia relativa dentro de cada nube. La nube
          total considera todas las piezas recuperadas.
        </Text>
        <Footer />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.section}>Metodología y fuentes</Text>
        <Text style={styles.bullet}>
          Publicaciones, perfiles y comentarios se recuperan mediante los
          scrapers locales configurados para X e Instagram. Los duplicados se
          eliminan por plataforma e identificador.
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
          Sentimiento y temas se clasifican mediante DeepSeek; los volúmenes y rankings se calculan en código.
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
