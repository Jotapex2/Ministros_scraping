"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { AnalysisSession } from "@/types/analysis";
import { formatNumber, formatPercent, numeric } from "@/lib/utils";
import { ChartCard } from "./chart-card";
import { Card } from "./ui";
import { wordFrequencies } from "@/lib/social/wordcloud";
const COLORS = {
  positive: "#2f7d68",
  neutral: "#8a9490",
  negative: "#a9433a",
  uncertain: "#c8cecb",
};
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
export function Dashboard({ session }: { session: AnalysisSession }) {
  const m = session.metrics;
  if (!m) return null;
  const rankPosts = [...m.ministerRankings]
    .sort((a, b) => b.postsX + b.postsInstagram - a.postsX - a.postsInstagram)
    .slice(0, 10);
  const rankEng = [...m.ministerRankings]
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);
  const mentions = [...m.ministerRankings]
    .sort(
      (a, b) =>
        b.mentionsX + b.mentionsInstagram - a.mentionsX - a.mentionsInstagram,
    )
    .slice(0, 10);
  const sentiment = Object.entries(m.governmentSentiment).map(
    ([name, value]) => ({ name, value }),
  );
  const topicScatter = session.topics.map((t) => ({
    name: t.topicName,
    x: t.netSentiment,
    y: t.posts + t.comments,
    z: Math.max(30, t.engagement),
  }));
  const impact = m.ministerRankings.map((x) => ({
    name: x.name,
    x: x.postsX + x.postsInstagram,
    y: x.averageEngagement,
    z: Math.max(50, (x.followersX ?? 0) + (x.followersInstagram ?? 0)),
  }));
  const positive = wordFrequencies(
    session.posts,
    session.sentiments,
    "positive",
  );
  const negative = wordFrequencies(
    session.posts,
    session.sentiments,
    "negative",
  );
  return (
    <>
      <Section
        title="Calidad de datos"
        subtitle="Cobertura y errores de la ejecución actual"
      >
        <div className="grid grid-3">
          {(
            [
              ["X", session.quality.x],
              ["Instagram", session.quality.instagram],
            ] as const
          ).map(([name, q]) => (
            <Card key={name}>
              <span className="kpi-label">{name}</span>
              <div className="kpi-value">
                {q.succeeded}/{q.requested}
              </div>
              <span className="kpi-meta">
                cuentas exitosas · {q.posts} posts · {q.errors} errores
              </span>
            </Card>
          ))}
          <Card>
            <span className="kpi-label">DeepSeek</span>
            <div className="kpi-value">
              {session.quality.deepseek.processed}
            </div>
            <span className="kpi-meta">
              procesados · {session.quality.deepseek.uncertain} inciertos ·{" "}
              {session.quality.deepseek.omitted} omitidos
            </span>
          </Card>
        </div>
      </Section>
      <Section
        title="Resumen ejecutivo"
        subtitle="Lectura descriptiva basada en métricas calculadas"
      >
        <Card>
          {session.executiveSummary.length ? (
            <ul>
              {session.executiveSummary.map((x, i) => (
                <li key={i} style={{ marginBottom: 10, lineHeight: 1.45 }}>
                  {x}
                </li>
              ))}
            </ul>
          ) : (
            <p>El resumen aparecerá al avanzar el análisis.</p>
          )}
        </Card>
      </Section>
      <Section title="Indicadores generales">
        <div className="grid grid-4">
          {[
            ["Publicaciones", m.publications],
            ["Interacciones", m.interactionsBasic],
            ["Menciones al Gobierno", m.governmentMentions],
            ["Menciones a ministros", m.ministerMentions],
            ["Usuarios únicos", m.uniqueUsers],
            ["Sentimiento positivo", m.governmentSentiment.positive],
            ["Sentimiento negativo", m.governmentSentiment.negative],
            ["Sentimiento neutral", m.governmentSentiment.neutral],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <span className="kpi-label">{label}</span>
              <div className="kpi-value">{formatNumber(value as number)}</div>
              <span className="kpi-meta">ejecución actual</span>
            </Card>
          ))}
        </div>
      </Section>
      <Section
        title="X vs Instagram"
        subtitle="Comparación descriptiva; las interacciones no son equivalencias exactas"
      >
        <div className="grid grid-2">
          <ChartCard
            title="Desempeño por plataforma"
            rows={(["x", "instagram"] as const).map((p) => ({
              plataforma: p,
              ...m.platformMetrics[p],
            }))}
          >
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={(["x", "instagram"] as const).map((p) => ({
                  name: p === "x" ? "X" : "Instagram",
                  publicaciones: m.platformMetrics[p].posts,
                  interacciones: m.platformMetrics[p].interactions,
                  menciones: m.platformMetrics[p].mentions,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="publicaciones" fill="#263d48" />
                <Bar dataKey="menciones" fill="#8d5265" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard
            title="Sentimiento por plataforma"
            rows={(["x", "instagram"] as const).map((p) => ({
              plataforma: p,
              ...m.platformMetrics[p].sentiment,
            }))}
          >
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={(["x", "instagram"] as const).map((p) => ({
                  name: p === "x" ? "X" : "Instagram",
                  ...m.platformMetrics[p].sentiment,
                }))}
                stackOffset="expand"
              >
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip />
                <Legend />
                <Bar dataKey="positive" stackId="a" fill={COLORS.positive} />
                <Bar dataKey="neutral" stackId="a" fill={COLORS.neutral} />
                <Bar dataKey="negative" stackId="a" fill={COLORS.negative} />
                <Bar dataKey="uncertain" stackId="a" fill={COLORS.uncertain} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>
      <Section title="Actividad e impacto ministerial">
        <div className="grid grid-2">
          <ChartCard
            title="Ministros que más publicaron"
            rows={rankPosts.map((x) => ({
              ministro: x.name,
              x: x.postsX,
              instagram: x.postsInstagram,
              total: x.postsX + x.postsInstagram,
            }))}
            insight={
              rankPosts[0]
                ? `${rankPosts[0].name} registró la mayor actividad digital del período.`
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height={330}>
              <BarChart
                layout="vertical"
                data={rankPosts.map((x) => ({
                  name: x.name.split(" ").slice(0, 2).join(" "),
                  X: x.postsX,
                  Instagram: x.postsInstagram,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="X" stackId="a" fill="#263d48" />
                <Bar dataKey="Instagram" stackId="a" fill="#8d5265" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard
            title="Ministros con mayor interacción"
            rows={rankEng.map((x) => ({
              ministro: x.name,
              interaccion: x.engagement,
              promedio: x.averageEngagement,
            }))}
          >
            <ResponsiveContainer width="100%" height={330}>
              <BarChart
                layout="vertical"
                data={rankEng.map((x) => ({
                  name: x.name.split(" ").slice(0, 2).join(" "),
                  Interacción: x.engagement,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="Interacción" fill="#205e50" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div style={{ marginTop: 14 }}>
          <ChartCard
            title="Actividad vs impacto"
            rows={impact.map((x) => ({
              ministro: x.name,
              publicaciones: x.x,
              engagement_promedio: x.y,
              seguidores: x.z,
            }))}
          >
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart>
                <CartesianGrid />
                <XAxis type="number" dataKey="x" name="Publicaciones" />
                <YAxis type="number" dataKey="y" name="Engagement/post" />
                <ZAxis type="number" dataKey="z" range={[70, 700]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={impact} fill="#a97939" />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>
      <Section
        title="Seguidores"
        subtitle="Agregados por plataforma; una persona puede seguir al ministro en más de una red"
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ministro</th>
                <th>Seguidores X</th>
                <th>Seguidores Instagram</th>
                <th>Total agregado</th>
              </tr>
            </thead>
            <tbody>
              {[...m.ministerRankings]
                .sort(
                  (a, b) =>
                    (b.followersX ?? 0) +
                    (b.followersInstagram ?? 0) -
                    (a.followersX ?? 0) -
                    (a.followersInstagram ?? 0),
                )
                .map((x) => (
                  <tr key={x.accountId}>
                    <td>{x.name}</td>
                    <td>{formatNumber(x.followersX)}</td>
                    <td>{formatNumber(x.followersInstagram)}</td>
                    <td>
                      {x.followersX == null && x.followersInstagram == null
                        ? "N/D"
                        : formatNumber(
                            (x.followersX ?? 0) + (x.followersInstagram ?? 0),
                          )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Conversación ministerial">
        <div className="grid grid-2">
          <ChartCard
            title="Ministros más mencionados"
            rows={mentions.map((x) => ({
              ministro: x.name,
              x: x.mentionsX,
              instagram: x.mentionsInstagram,
              total: x.mentionsX + x.mentionsInstagram,
              usuarios: x.uniqueAuthors,
              net_sentiment: x.netSentiment,
            }))}
          >
            <ResponsiveContainer width="100%" height={330}>
              <BarChart
                layout="vertical"
                data={mentions.map((x) => ({
                  name: x.name.split(" ").slice(0, 2).join(" "),
                  X: x.mentionsX,
                  Instagram: x.mentionsInstagram,
                }))}
              >
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="X" stackId="a" fill="#263d48" />
                <Bar dataKey="Instagram" stackId="a" fill="#8d5265" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard
            title="Participación en la conversación ministerial"
            rows={mentions.map((x) => ({
              ministro: x.name,
              share_of_voice: x.shareOfVoice,
            }))}
          >
            <ResponsiveContainer width="100%" height={330}>
              <BarChart
                layout="vertical"
                data={mentions.map((x) => ({
                  name: x.name.split(" ").slice(0, 2).join(" "),
                  SOV: x.shareOfVoice,
                }))}
              >
                <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Bar dataKey="SOV" fill="#a97939" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>
      <Section title="Sentimiento">
        <div className="grid grid-2">
          <ChartCard
            title="Sentimiento general hacia el Gobierno"
            rows={sentiment}
          >
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={sentiment}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  label
                >
                  {sentiment.map((x) => (
                    <Cell
                      key={x.name}
                      fill={COLORS[x.name as keyof typeof COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <Card>
            <h3 className="chart-title">Sentimiento por ministro</h3>
            <div className="table-wrap" style={{ maxHeight: 290 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ministro</th>
                    <th>+</th>
                    <th>-</th>
                    <th>Neutral</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {mentions.map((x) => (
                    <tr key={x.accountId}>
                      <td>{x.name}</td>
                      <td>{x.positive}</td>
                      <td>{x.negative}</td>
                      <td>{x.neutral}</td>
                      <td>{formatPercent(x.netSentiment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </Section>
      <Section title="Temas principales">
        <div className="grid grid-2">
          <Card>
            <h3 className="chart-title">Top 10 temas de la conversación</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tema</th>
                    <th>Posts</th>
                    <th>Comentarios</th>
                    <th>Interacción</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {session.topics.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.topicName}</strong>
                        <br />
                        <span className="kpi-meta">{t.summary}</span>
                      </td>
                      <td>{t.posts}</td>
                      <td>{t.comments}</td>
                      <td>{t.engagement}</td>
                      <td>{formatPercent(t.netSentiment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <ChartCard
            title="Volumen y sentimiento de los principales temas"
            rows={topicScatter.map((x) => ({
              tema: x.name,
              net_sentiment: x.x,
              volumen: x.y,
              engagement: x.z,
            }))}
          >
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-100, 100]}
                  name="Net Sentiment"
                />
                <YAxis type="number" dataKey="y" name="Volumen" />
                <ZAxis type="number" dataKey="z" range={[80, 800]} />
                <Tooltip />
                <Scatter data={topicScatter} fill="#205e50" />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>
      <Section title="Publicaciones institucionales destacadas">
        <div className="grid grid-3">
          {(["x", "instagram", "general"] as const).map((key) => {
            const p = m.topPosts[key];
            return (
              <Card key={key}>
                <span className="kpi-label">Top post {key}</span>
                {p ? (
                  <>
                    <h3>{p.authorName}</h3>
                    <p style={{ fontSize: 13, lineHeight: 1.45 }}>
                      {p.text.slice(0, 240)}
                      {p.text.length > 240 ? "…" : ""}
                    </p>
                    <p>
                      <strong>{formatNumber(numeric(p.likes))}</strong> likes ·{" "}
                      {formatNumber(numeric(p.comments))} comentarios
                    </p>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        Ver publicación ↗
                      </a>
                    )}
                  </>
                ) : (
                  <p>
                    N/D · agregue cuentas institucionales y ejecute el análisis.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </Section>
      <Section title="Nubes de palabras">
        <div className="grid grid-2">
          <Card>
            <h3 className="chart-title">Nube positiva</h3>
            <div className="wordcloud">
              {positive.map((w) => (
                <span
                  key={w.word}
                  title={`${w.frequency}`}
                  style={{ fontSize: 12 + w.score * 28, color: "var(--green)" }}
                >
                  {w.word}
                </span>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="chart-title">Nube negativa</h3>
            <div className="wordcloud">
              {negative.map((w) => (
                <span
                  key={w.word}
                  title={`${w.frequency}`}
                  style={{ fontSize: 12 + w.score * 28, color: "var(--red)" }}
                >
                  {w.word}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}
