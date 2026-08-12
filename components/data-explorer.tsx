"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./app-header";
import { Button, Card, Input, Select } from "./ui";
import { useObservatory } from "@/lib/store";
import { downloadCsv, postsRows } from "@/lib/export/csv";
import { engagementBasic } from "@/lib/social/metrics";
import { formatNumber } from "@/lib/utils";

export function DataExplorer() {
  const { session, hydrated, hydrate } = useObservatory();
  const [platform, setPlatform] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [author, setAuthor] = useState("");
  const [word, setWord] = useState("");
  const [minimumEngagement, setMinimumEngagement] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const sentiments = useMemo(
    () => new Map(session?.sentiments.map((item) => [item.itemId, item])),
    [session],
  );

  const filtered = useMemo(() => {
    if (!session) return [];
    return session.posts.filter((post) => {
      const result = sentiments.get(post.id);
      return (
        (platform === "all" || post.platform === platform) &&
        (sentiment === "all" || result?.sentiment === sentiment) &&
        (!author ||
          `${post.authorName} ${post.username}`
            .toLowerCase()
            .includes(author.toLowerCase())) &&
        (!word || post.text.toLowerCase().includes(word.toLowerCase())) &&
        engagementBasic(post) >= minimumEngagement
      );
    });
  }, [
    session,
    sentiments,
    platform,
    sentiment,
    author,
    word,
    minimumEngagement,
  ]);

  if (!hydrated) return <div className="login">Cargando datos locales…</div>;

  return (
    <div className="shell">
      <AppHeader />
      <section className="hero">
        <div>
          <p className="eyebrow">Explorador de datos</p>
          <h1>Publicaciones y comentarios</h1>
        </div>
        <p>
          Filtre los datos de la ejecución actual. Ninguna búsqueda se guarda en
          el servidor.
        </p>
      </section>

      {!session ? (
        <Card>
          No existe una sesión para explorar. Ejecute o importe un análisis.
        </Card>
      ) : (
        <>
          <Card>
            <div className="config-grid">
              <div className="field">
                <label>Plataforma</label>
                <Select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                >
                  <option value="all">Todas</option>
                  <option value="x">X</option>
                  <option value="instagram">Instagram</option>
                </Select>
              </div>
              <div className="field">
                <label>Sentimiento</label>
                <Select
                  value={sentiment}
                  onChange={(event) => setSentiment(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="positive">Positivo</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negativo</option>
                  <option value="uncertain">Incierto</option>
                </Select>
              </div>
              <div className="field">
                <label>Autor</label>
                <Input
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Palabra</label>
                <Input
                  value={word}
                  onChange={(event) => setWord(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Engagement mínimo</label>
                <Input
                  type="number"
                  min={0}
                  value={minimumEngagement}
                  onChange={(event) =>
                    setMinimumEngagement(Number(event.target.value))
                  }
                />
              </div>
            </div>
            <div className="toolbar" style={{ marginTop: 15 }}>
              <strong>{filtered.length} resultados</strong>
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    postsRows({ ...session, posts: filtered }),
                    "resultados_filtrados.csv",
                  )
                }
              >
                Exportar resultados filtrados a CSV
              </Button>
            </div>
          </Card>

          <section className="section">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Plataforma</th>
                    <th>Autor</th>
                    <th>Texto</th>
                    <th>Likes</th>
                    <th>Comentarios</th>
                    <th>Engagement</th>
                    <th>Sentimiento</th>
                    <th>Tema</th>
                    <th>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((post) => {
                    const result = sentiments.get(post.id);
                    return (
                      <tr key={`${post.platform}:${post.id}`}>
                        <td>
                          {new Date(post.createdAt).toLocaleString("es-CL")}
                        </td>
                        <td>{post.platform === "x" ? "X" : "Instagram"}</td>
                        <td>{post.authorName}</td>
                        <td style={{ minWidth: 320 }}>{post.text}</td>
                        <td>{formatNumber(post.likes.value)}</td>
                        <td>{formatNumber(post.comments.value)}</td>
                        <td>{formatNumber(engagementBasic(post))}</td>
                        <td>{result?.sentiment ?? "No analizado"}</td>
                        <td>{result?.topic ?? "N/D"}</td>
                        <td>
                          {post.url ? (
                            <a href={post.url} target="_blank" rel="noreferrer">
                              Abrir ↗
                            </a>
                          ) : (
                            "N/D"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 500 && (
              <p className="kpi-meta">
                La vista muestra 500 filas; la exportación incluye todos los
                resultados filtrados.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
