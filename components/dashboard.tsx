"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import type { AnalysisSession, MinisterMetric } from "@/types/analysis";
import { formatNumber, formatPercent, numeric } from "@/lib/utils";
import { ChartCard } from "./chart-card";
import { Button, Card, Select } from "./ui";
import { wordFrequencies } from "@/lib/social/wordcloud";

const COLORS = {
  positive: "#2f7d68",
  neutral: "#8a9490",
  negative: "#a9433a",
  uncertain: "#5f6f69",
};

const PIE_COLORS = [
  "#263d48", "#8d5265", "#a97939", "#205e50", "#3b82f6",
  "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1",
  "#14b8a6", "#f43f5e", "#84cc16", "#06b6d4", "#a855f7"
];

function chartDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return name;
  const initials = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toLocaleUpperCase(
    "es-CL",
  );
  return `${initials} ${parts[2]}`;
}

// Regla de no colisión para los labels de torta: solo se etiquetan las porciones
// con participación suficiente (>= SOV_MIN_LABEL_PERCENT). Las porciones más pequeñas
// quedan identificables en la leyenda y el tooltip, evitando que los textos se solapen.
const SOV_MIN_LABEL_PERCENT = 5;
const SOV_LABEL_GAP = 22;

function sovLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  innerRadius,
  percent,
  name,
  value,
  chartWidth,
  chartHeight,
  rightBoundary,
  compact,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  innerRadius?: number;
  percent?: number;
  name?: string;
  value?: number;
  chartWidth: number;
  chartHeight: number;
  rightBoundary?: number;
  compact?: boolean;
}) {
  if ((percent ?? 0) * 100 < SOV_MIN_LABEL_PERCENT) return null;
  const RADIAN = Math.PI / 180;
  const angle = (midAngle ?? 0) * RADIAN;
  const outer = outerRadius ?? 0;
  if (compact) {
    const radius = ((innerRadius ?? 0) + outer) / 2;
    return (
      <text
        x={(cx ?? 0) + radius * Math.cos(-angle)}
        y={(cy ?? 0) + radius * Math.sin(-angle)}
        fill="#ffffff"
        fontSize={8}
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {`${Number(value ?? 0).toFixed(0)}%`}
      </text>
    );
  }
  const labelR = outer + SOV_LABEL_GAP;
  const centerX = cx ?? 0;
  const edgeX = centerX + outer * Math.cos(-angle);
  const edgeY = (cy ?? 0) + outer * Math.sin(-angle);
  const label = `${chartDisplayName(String(name ?? ""))} ${Number(value ?? 0).toFixed(1)}%`;
  const estimatedTextWidth = Math.min(145, label.length * 6.2);
  const onRight = centerX + labelR * Math.cos(-angle) >= centerX;
  const anchor = onRight ? "start" : "end";
  const rawTextX = centerX + labelR * Math.cos(-angle);
  const rawTextY = (cy ?? 0) + labelR * Math.sin(-angle);
  const safeRight = rightBoundary ?? chartWidth - 10;
  const textX = onRight
    ? Math.min(rawTextX, safeRight - estimatedTextWidth)
    : Math.max(rawTextX, estimatedTextWidth + 10);
  const textY = Math.min(chartHeight - 16, Math.max(16, rawTextY));
  return (
    <g>
      <line
        x1={edgeX}
        y1={edgeY}
        x2={onRight ? textX - 4 : textX + 4}
        y2={textY}
        stroke="#52525b"
        strokeWidth={1}
      />
      <text
        x={textX}
        y={textY}
        fill="#263d48"
        fontSize={11}
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight={600}
        textAnchor={anchor}
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}

type SovDonutDatum = {
  name: string;
  fullName: string;
  value: number;
  accountId: string;
};

function SovDonutChart({
  data,
  total,
}: {
  data: SovDonutDatum[];
  total: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(560);
  const compact = chartWidth < 520;
  const chartHeight = Math.max(compact ? 470 : 390, data.length * 26);
  const centerX = compact ? "50%" : "40%";
  const centerY = compact ? "42%" : "50%";
  const labelRightBoundary = compact ? chartWidth - 10 : chartWidth * 0.76;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setChartWidth(Math.max(320, host.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="sov-donut-chart">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart margin={{ top: 28, right: 24, bottom: 28, left: 24 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx={centerX}
            cy={centerY}
            innerRadius={compact ? "42%" : "47%"}
            outerRadius={compact ? "58%" : "66%"}
            paddingAngle={3}
            isAnimationActive={false}
            labelLine={false}
            label={(props) =>
              sovLabel({
                ...props,
                chartWidth,
                chartHeight,
                rightBoundary: labelRightBoundary,
                compact,
              })
            }
          >
            {data.map((item, index) => (
              <Cell
                key={item.accountId}
                fill={
                  item.name === "Otros"
                    ? "#64748b"
                    : PIE_COLORS[index % PIE_COLORS.length]
                }
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => [
              `${Number(value).toFixed(1)}%`,
              item.payload.fullName,
            ]}
          />
          <Legend
            verticalAlign={compact ? "bottom" : "middle"}
            align={compact ? "center" : "right"}
            layout={compact ? "horizontal" : "vertical"}
            wrapperStyle={compact ? { paddingTop: 14, lineHeight: "22px" } : undefined}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="sov-donut-total">
        <strong>{formatNumber(total)}</strong>
        <span>menciones</span>
      </div>
    </div>
  );
}

function sentimentSliceLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  value,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
}) {
  if ((percent ?? 0) < 0.04) return null;
  const radius = ((innerRadius ?? 0) + (outerRadius ?? 0)) / 2;
  const angle = -((midAngle ?? 0) * Math.PI) / 180;
  const x = (cx ?? 0) + radius * Math.cos(angle);
  const y = (cy ?? 0) + radius * Math.sin(angle);
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize={11}
      fontWeight={700}
    >
      {formatNumber(value ?? 0)}
    </text>
  );
}

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

function FilterBar({
  platformFilter,
  setPlatformFilter,
  ministerLimit,
  setMinisterLimit,
  sortOrder,
  setSortOrder,
}: {
  platformFilter: "all" | "x" | "instagram";
  setPlatformFilter: (v: "all" | "x" | "instagram") => void;
  ministerLimit: number | "all";
  setMinisterLimit: (v: number | "all") => void;
  sortOrder: "desc" | "asc";
  setSortOrder: (v: "desc" | "asc") => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="flex items-center space-x-2">
        <span className="text-xs font-semibold text-neutral-400">Filtrar plataforma:</span>
        <div className="flex space-x-1">
          <Button
            variant={platformFilter === "all" ? "default" : "outline"}
            onClick={() => setPlatformFilter("all")}
          >
            Todas
          </Button>
          <Button
            variant={platformFilter === "x" ? "default" : "outline"}
            onClick={() => setPlatformFilter("x")}
          >
            X
          </Button>
          <Button
            variant={platformFilter === "instagram" ? "default" : "outline"}
            onClick={() => setPlatformFilter("instagram")}
          >
            Instagram
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-neutral-400">Ministros visibles:</span>
          <Select
            value={String(ministerLimit)}
            onChange={(e) => {
              const val = e.target.value;
              setMinisterLimit(val === "all" ? "all" : Number(val));
            }}
          >
            <option value="5">Top 5</option>
            <option value="10">Top 10</option>
            <option value="15">Top 15</option>
            <option value="all">Todos</option>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-neutral-400">Orden:</span>
          <Select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
          >
            <option value="desc">Mayor a menor</option>
            <option value="asc">Menor a mayor</option>
          </Select>
        </div>
      </div>
    </div>
  );
}

const renderCustomScatterLabel = (props: any) => {
  const { x, y, value } = props;
  if (!value) return null;

  // If point is close to the top boundary of SVG canvas, place label below point
  const isNearTop = y < 50;
  const dy = isNearTop ? 26 : -14;

  return (
    <text
      x={x}
      y={y + dy}
      fill="#17231f"
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
      style={{
        pointerEvents: "none",
        paintOrder: "stroke",
        stroke: "#fffefa",
        strokeWidth: 4,
        strokeLinejoin: "round",
      }}
    >
      {value}
    </text>
  );
};

export function Dashboard({ session }: { session: AnalysisSession }) {
  const m = session.metrics;

  // Interactive controls state for "Actividad e impacto ministerial"
  const [actPlatformFilter, setActPlatformFilter] = useState<"all" | "x" | "instagram">("all");
  const [actMinisterLimit, setActMinisterLimit] = useState<number | "all">(5);
  const [actSortOrder, setActSortOrder] = useState<"desc" | "asc">("desc");

  // Interactive controls state for "Conversación ministerial"
  const [convPlatformFilter, setConvPlatformFilter] = useState<"all" | "x" | "instagram">("all");
  const [convMinisterLimit, setConvMinisterLimit] = useState<number | "all">(10);
  const [convSortOrder, setConvSortOrder] = useState<"desc" | "asc">("desc");

  if (!m) return null;

  // Helper functions for dynamic calculation based on platform filter (Actividad e Impacto)
  const getActPosts = (x: MinisterMetric) => {
    if (actPlatformFilter === "x") return x.postsX;
    if (actPlatformFilter === "instagram") return x.postsInstagram;
    return x.postsX + x.postsInstagram;
  };

  const getActEngagement = (x: MinisterMetric) => {
    if (actPlatformFilter === "x") return x.likesX + x.commentsX;
    if (actPlatformFilter === "instagram") return x.likesInstagram + x.commentsInstagram;
    return x.engagement;
  };

  const getActAverageEngagement = (x: MinisterMetric) => {
    const posts = getActPosts(x);
    const eng = getActEngagement(x);
    return posts > 0 ? Number((eng / posts).toFixed(1)) : 0;
  };

  // Filter & sort minister rankings for Actividad e Impacto
  const limitNumAct = actMinisterLimit === "all" ? m.ministerRankings.length : actMinisterLimit;

  const rankPosts = [...m.ministerRankings]
    .sort((a, b) =>
      actSortOrder === "desc"
        ? getActPosts(b) - getActPosts(a)
        : getActPosts(a) - getActPosts(b)
    )
    .slice(0, limitNumAct);

  const rankEng = [...m.ministerRankings]
    .sort((a, b) =>
      actSortOrder === "desc"
        ? getActEngagement(b) - getActEngagement(a)
        : getActEngagement(a) - getActEngagement(b)
    )
    .slice(0, limitNumAct);

  const impact = [...m.ministerRankings]
    .sort((a, b) =>
      actSortOrder === "desc"
        ? getActPosts(b) - getActPosts(a)
        : getActPosts(a) - getActPosts(b)
    )
    .slice(0, limitNumAct)
    .map((x) => ({
      name: x.name,
      shortName: chartDisplayName(x.name),
      x: getActPosts(x),
      y: getActAverageEngagement(x),
      z: Math.max(50, (x.followersX ?? 0) + (x.followersInstagram ?? 0)),
      mentions: x.mentionsX + x.mentionsInstagram,
    }));

  // Helper functions for dynamic calculation based on platform & filters (Conversación Ministerial)
  const getConvMentions = (x: MinisterMetric) => {
    if (convPlatformFilter === "x") return x.mentionsX;
    if (convPlatformFilter === "instagram") return x.mentionsInstagram;
    return x.mentionsX + x.mentionsInstagram;
  };

  const totalConvMentionsFiltered = m.ministerRankings.reduce(
    (sum, x) => sum + getConvMentions(x),
    0
  );

  const limitNumConv = convMinisterLimit === "all" ? m.ministerRankings.length : convMinisterLimit;

  const mentions = [...m.ministerRankings]
    .sort((a, b) =>
      convSortOrder === "desc"
        ? getConvMentions(b) - getConvMentions(a)
        : getConvMentions(a) - getConvMentions(b)
    )
    .slice(0, limitNumConv)
    .map((x) => {
      const mentionsVal = getConvMentions(x);
      const sov = totalConvMentionsFiltered > 0
        ? (mentionsVal / totalConvMentionsFiltered) * 100
        : 0;
      return {
        ...x,
        filteredMentions: mentionsVal,
        filteredSOV: sov,
      };
    });

  const sentiment = Object.entries(m.governmentSentiment).map(
    ([name, value]) => ({ name, value }),
  );

  const selectedSOV = mentions.reduce((sum, x) => sum + x.filteredSOV, 0);
  const otherSOV = Math.max(0, 100 - selectedSOV);
  const sovDonutData = [
    ...mentions.map((x) => ({
      name: chartDisplayName(x.name),
      fullName: x.name,
      value: x.filteredSOV,
      accountId: x.accountId,
    })),
    ...(totalConvMentionsFiltered > 0 && otherSOV > 0.05
      ? [{ name: "Otros", fullName: "Otros", value: otherSOV, accountId: "other" }]
      : []),
  ];

  const topicScatter = session.topics.map((t, index) => ({
    rank: index + 1,
    name: t.topicName,
    x: t.netSentiment,
    y: t.posts + t.comments,
    z: Math.max(30, t.engagement),
  }));

  // Three word clouds as specified in graficos.md
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
  const totalWords = wordFrequencies(session.posts);

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
            <span className="kpi-label">
              {(session.config.llmProvider || "ollama") === "ollama"
                ? "Ollama"
                : "DeepSeek"}
            </span>
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
                margin={{ top: 12, right: 20, bottom: 8, left: 8 }}
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
                margin={{ top: 12, right: 20, bottom: 8, left: 8 }}
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

      <Section
        title="Actividad e impacto ministerial"
        subtitle="Rankings y gráfico de dispersión de ministros"
      >
        <FilterBar
          platformFilter={actPlatformFilter}
          setPlatformFilter={setActPlatformFilter}
          ministerLimit={actMinisterLimit}
          setMinisterLimit={setActMinisterLimit}
          sortOrder={actSortOrder}
          setSortOrder={setActSortOrder}
        />

        <div className="grid grid-2">
          <ChartCard
            title="Ministros que más publicaron"
            rows={rankPosts.map((x) => ({
              ministro: x.name,
              x: x.postsX,
              instagram: x.postsInstagram,
              total: getActPosts(x),
            }))}
            insight={
              rankPosts[0]
                ? `${rankPosts[0].name} registró la mayor actividad digital (${getActPosts(rankPosts[0])} publicaciones).`
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height={Math.max(250, rankPosts.length * 45)}>
              <BarChart
                layout="vertical"
                margin={{ top: 12, right: 24, bottom: 8, left: 8 }}
                data={rankPosts.map((x) => ({
                  name: chartDisplayName(x.name),
                  fullName: x.name,
                  ...(actPlatformFilter === "all"
                    ? { X: x.postsX, Instagram: x.postsInstagram }
                    : actPlatformFilter === "x"
                    ? { X: x.postsX }
                    : { Instagram: x.postsInstagram }),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={110} />
                <Tooltip
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.fullName ?? label
                  }
                />
                <Legend />
                {(actPlatformFilter === "all" || actPlatformFilter === "x") && (
                  <Bar dataKey="X" stackId="a" fill="#263d48" />
                )}
                {(actPlatformFilter === "all" || actPlatformFilter === "instagram") && (
                  <Bar dataKey="Instagram" stackId="a" fill="#8d5265" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Ministros con mayor interacción"
            rows={rankEng.map((x) => ({
              ministro: x.name,
              interaccion: getActEngagement(x),
              promedio: getActAverageEngagement(x),
            }))}
          >
            <ResponsiveContainer width="100%" height={Math.max(250, rankEng.length * 45)}>
              <BarChart
                layout="vertical"
                margin={{ top: 12, right: 24, bottom: 8, left: 8 }}
                data={rankEng.map((x) => ({
                  name: chartDisplayName(x.name),
                  fullName: x.name,
                  Interacción: getActEngagement(x),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={110} />
                <Tooltip
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.fullName ?? label
                  }
                />
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
              menciones: x.mentions,
            }))}
          >
            <ResponsiveContainer width="100%" height={460}>
              <ScatterChart margin={{ top: 40, right: 50, bottom: 45, left: 50 }}>
                <CartesianGrid stroke="#cbd5e1" strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Publicaciones"
                  tick={{ fill: "#334155", fontSize: 11 }}
                  axisLine={{ stroke: "#64748b" }}
                  tickLine={{ stroke: "#64748b" }}
                  domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.15)]}
                  label={{
                    value: "Eje X: Publicaciones propias (Nº de posts)",
                    position: "insideBottom",
                    offset: -20,
                    style: { fill: "#334155", fontSize: 12, fontWeight: 700 }
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Engagement/post"
                  tick={{ fill: "#334155", fontSize: 11 }}
                  axisLine={{ stroke: "#64748b" }}
                  tickLine={{ stroke: "#64748b" }}
                  domain={[0, (dataMax: number) => Math.ceil((dataMax || 10) * 1.25)]}
                  label={{
                    value: "Eje Y: Engagement promedio por publicación",
                    angle: -90,
                    position: "insideLeft",
                    offset: -10,
                    style: { fill: "#334155", fontSize: 12, fontWeight: 700, textAnchor: "middle" }
                  }}
                />
                <ZAxis type="number" dataKey="z" range={[90, 800]} name="Seguidores" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-neutral-900 border border-neutral-700 rounded-lg text-xs shadow-xl space-y-1">
                          <p className="font-bold text-sm text-neutral-100">{data.name}</p>
                          <p className="text-neutral-300">
                            📌 <span className="font-medium text-neutral-400">Publicaciones propias:</span> <strong>{data.x}</strong>
                          </p>
                          <p className="text-neutral-300">
                            📊 <span className="font-medium text-neutral-400">Engagement promedio / post:</span> <strong>{data.y}</strong>
                          </p>
                          <p className="text-neutral-300">
                            💬 <span className="font-medium text-neutral-400">Menciones totales:</span> <strong>{data.mentions}</strong>
                          </p>
                          <p className="text-neutral-300">
                            👥 <span className="font-medium text-neutral-400">Seguidores acumulados:</span> <strong>{formatNumber(data.z)}</strong>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter
                  data={impact}
                  fill="#0f766e"
                  stroke="#fffefa"
                  strokeWidth={2}
                >
                  <LabelList
                    dataKey="shortName"
                    content={renderCustomScatterLabel}
                  />
                </Scatter>
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
                    <td>{x.followersX == null ? "N/D" : formatNumber(x.followersX)}</td>
                    <td>{x.followersInstagram == null ? "N/D" : formatNumber(x.followersInstagram)}</td>
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

      <Section
        title="Conversación ministerial"
        subtitle="Rankings y participación en menciones ministeriales"
      >
        <FilterBar
          platformFilter={convPlatformFilter}
          setPlatformFilter={setConvPlatformFilter}
          ministerLimit={convMinisterLimit}
          setMinisterLimit={setConvMinisterLimit}
          sortOrder={convSortOrder}
          setSortOrder={setConvSortOrder}
        />

        <div className="grid grid-2">
          <ChartCard
            title="Ministros más mencionados"
            rows={mentions.map((x) => ({
              ministro: x.name,
              x: x.mentionsX,
              instagram: x.mentionsInstagram,
              total: x.filteredMentions,
              usuarios: x.uniqueAuthors,
              net_sentiment: x.netSentiment,
            }))}
          >
            <ResponsiveContainer width="100%" height={Math.max(250, mentions.length * 45)}>
              <BarChart
                layout="vertical"
                margin={{ top: 12, right: 24, bottom: 8, left: 8 }}
                data={mentions.map((x) => ({
                  name: chartDisplayName(x.name),
                  fullName: x.name,
                  ...(convPlatformFilter === "all"
                    ? { X: x.mentionsX, Instagram: x.mentionsInstagram }
                    : convPlatformFilter === "x"
                    ? { X: x.mentionsX }
                    : { Instagram: x.mentionsInstagram }),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.fullName ?? label
                  }
                />
                <Legend />
                {(convPlatformFilter === "all" || convPlatformFilter === "x") && (
                  <Bar dataKey="X" stackId="a" fill="#263d48" />
                )}
                {(convPlatformFilter === "all" || convPlatformFilter === "instagram") && (
                  <Bar dataKey="Instagram" stackId="a" fill="#8d5265" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Participación en la conversación ministerial"
            rows={sovDonutData.map((x) => ({
              ministro: x.fullName,
              share_of_voice: x.value,
            }))}
          >
            <SovDonutChart
              data={sovDonutData}
              total={totalConvMentionsFiltered}
            />
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
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Pie
                  data={sentiment}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  labelLine={false}
                  label={sentimentSliceLabel}
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
            subtitle="Cada número corresponde a la misma fila numerada en Ver datos."
            rows={topicScatter.map((x) => ({
              numero: x.rank,
              tema: x.name,
              net_sentiment: x.x,
              volumen: x.y,
              engagement: x.z,
            }))}
            insight="Eje X: Net Sentiment (%) = porcentaje positivo menos porcentaje negativo. Un valor negativo indica predominio negativo y uno positivo, predominio positivo. Eje Y: volumen total del tema (publicaciones + comentarios). El tamaño de la burbuja representa interacción."
          >
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 28, right: 40, bottom: 62, left: 56 }}>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-100, 100]}
                  name="Net Sentiment"
                  tickFormatter={(value) => `${value}%`}
                  label={{
                    value: "Eje X: Net Sentiment (%) = % positivo - % negativo",
                    position: "insideBottom",
                    offset: -32,
                    style: { fill: "#334155", fontSize: 11, fontWeight: 600 },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Volumen"
                  label={{
                    value: "Eje Y: publicaciones + comentarios",
                    angle: -90,
                    position: "insideLeft",
                    offset: -28,
                    style: { fill: "#334155", fontSize: 11, fontWeight: 600 },
                  }}
                />
                <ZAxis type="number" dataKey="z" range={[80, 800]} name="Interacción" />
                <Tooltip />
                <Scatter data={topicScatter} fill="#205e50">
                  <LabelList
                    dataKey="rank"
                    position="center"
                    fill="#ffffff"
                    fontSize={11}
                    fontWeight={700}
                  />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      {/* Three Word Clouds as specified in graficos.md section 6 */}
      <Section title="Nubes de palabras">
        <div className="grid grid-3">
          <Card>
            <h3 className="chart-title">Nube positiva</h3>
            <div className="wordcloud">
              {positive.map((w) => (
                <span
                  key={w.word}
                  title={`${w.frequency}`}
                  style={{ fontSize: 12 + w.score * 24, color: "var(--green)" }}
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
                  style={{ fontSize: 12 + w.score * 24, color: "var(--red)" }}
                >
                  {w.word}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="chart-title">Nube total</h3>
            <div className="wordcloud">
              {totalWords.map((w) => (
                <span
                  key={w.word}
                  title={`${w.frequency}`}
                  style={{ fontSize: 12 + w.score * 24, color: "var(--blue, #3b82f6)" }}
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
