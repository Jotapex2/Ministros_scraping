"use client";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileArchive,
  FileText,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { useObservatory } from "@/lib/store";
import { AppHeader } from "./app-header";
import { Badge, Button, Card, Input, Select } from "./ui";
import { Dashboard } from "./dashboard";
import { downloadBlob, downloadCsv, postsRows } from "@/lib/export/csv";
import { buildZip } from "@/lib/export/zip";
import { generatePdf } from "./report/analysis-report";
import type { AnalysisSession } from "@/types/analysis";
import { ComparisonPanel } from "./comparison-panel";
import { ScraperLoginModal } from "./scraper-login-modal";
import { OllamaModelField } from "./ollama-model-field";
export function HomeClient() {
  const {
    config,
    session,
    hydrated,
    setConfig,
    hydrate,
    run,
    cancel,
    reset,
    importSession,
  } = useObservatory();
  const [busy, setBusy] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [missingPlatform, setMissingPlatform] = useState<"x" | "instagram">("x");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return <div className="login">Cargando sesión local…</div>;

  const running =
    !!session && ["running", "partial"].includes(session.status) && busy;

  const days = Math.max(
    1,
    Math.ceil(
      (new Date(config.endDate).getTime() -
        new Date(config.startDate).getTime()) /
        86400000,
    ) + 1,
  );

  const execute = async () => {
    // Check if session exists for active platforms before running
    try {
      const res = await fetch("/api/scraper/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      });
      const data = await res.json();

      if (res.ok && data.ok && data.data) {
        if (config.platforms.includes("x") && !data.data.x?.authenticated) {
          setMissingPlatform("x");
          setLoginModalOpen(true);
          return;
        }
        if (config.platforms.includes("instagram") && !data.data.instagram?.authenticated) {
          setMissingPlatform("instagram");
          setLoginModalOpen(true);
          return;
        }
      }
    } catch {}

    setBusy(true);
    await run();
    setBusy(false);
  };
  const periodName = `${config.startDate}_${config.endDate}`;
  return (
    <div className="shell">
      {process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" && (
        <div className="demo">DATOS DE DEMOSTRACIÓN</div>
      )}
      <AppHeader />
      <section className="hero">
        <div>
          <p className="eyebrow">Inteligencia política y comunicacional</p>
          <h1>Observatorio Digital del Gobierno</h1>
        </div>
        <div>
          <p>
            Análisis bajo demanda de conversación y desempeño digital del
            Gobierno de Chile en X e Instagram.
          </p>
          <div className="notice">
            Los resultados corresponden a la ejecución actual y no se almacenan
            en el servidor.
          </div>
        </div>
      </section>
      <Card>
        <div className="section-heading">
          <h2>Período de análisis</h2>
          <p>
            {days} días · {config.accounts.filter((a) => a.active).length}{" "}
            cuentas activas
          </p>
        </div>
        <div className="config-grid">
          <div className="field">
            <label>Desde</label>
            <Input
              type="date"
              value={config.startDate}
              onChange={(e) => setConfig({ startDate: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Hasta</label>
            <Input
              type="date"
              value={config.endDate}
              onChange={(e) => setConfig({ endDate: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Plataformas</label>
            <div className="check-row">
              <label>
                <input
                  type="checkbox"
                  checked={config.platforms.includes("x")}
                  onChange={(e) =>
                    setConfig({
                      platforms: e.target.checked
                        ? ([
                            ...new Set([...config.platforms, "x"]),
                          ] as typeof config.platforms)
                        : config.platforms.filter((p) => p !== "x"),
                    })
                  }
                />{" "}
                X
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.platforms.includes("instagram")}
                  onChange={(e) =>
                    setConfig({
                      platforms: e.target.checked
                        ? ([
                            ...new Set([...config.platforms, "instagram"]),
                          ] as typeof config.platforms)
                        : config.platforms.filter((p) => p !== "instagram"),
                    })
                  }
                />{" "}
                Instagram
              </label>
            </div>
          </div>
          <div className="field">
            <label>Proveedor IA</label>
            <Select
              value={config.llmProvider || "deepseek"}
              onChange={(e) => {
                const provider = e.target.value as "deepseek" | "ollama";
                setConfig({
                  llmProvider: provider,
                  ...(provider === "ollama"
                    ? {
                        ollamaHost:
                          config.ollamaHost || "http://127.0.0.1:11434",
                        ollamaModel: config.ollamaModel || "llama3",
                      }
                    : {}),
                });
              }}
            >
              <option value="deepseek">DeepSeek API (Cloud)</option>
              <option value="ollama">Ollama (Modelos Locales)</option>
            </Select>
          </div>
          {config.llmProvider === "ollama" && (
            <>
              <div className="field">
                <label>URL Host de Ollama</label>
                <Input
                  placeholder="http://127.0.0.1:11434"
                  value={config.ollamaHost || "http://127.0.0.1:11434"}
                  onChange={(e) => setConfig({ ollamaHost: e.target.value })}
                />
                <p className="kpi-meta">
                  En Docker usar: http://host.docker.internal:11434
                </p>
              </div>
              <div className="field">
                <label>Modelo local</label>
                <OllamaModelField
                  host={config.ollamaHost}
                  value={config.ollamaModel || "llama3"}
                  onChange={(ollamaModel) => setConfig({ ollamaModel })}
                />
              </div>
            </>
          )}
          <div className="field">
            <label>Límite Análisis IA</label>
            <Select
              value={config.deepseekMode}
              onChange={(e) => {
                const mode = e.target.value as typeof config.deepseekMode;
                setConfig({
                  deepseekMode: mode,
                  limits: {
                    ...config.limits,
                    deepseekItems:
                      mode === "all"
                        ? 10000
                        : mode === "5000"
                          ? 5000
                          : mode === "sample"
                            ? 500
                            : 1000,
                  },
                });
              }}
            >
              <option value="1000">Máximo 1.000</option>
              <option value="5000">Máximo 5.000</option>
              <option value="sample">Muestra representativa</option>
              <option value="all">Analizar todos</option>
            </Select>
          </div>
          <div className="field">
            <label>Estimación</label>
            <div className="check-row">
              <strong>
                {config.platforms.includes("x")
                  ? config.accounts.filter((a) => a.active && a.xUsername)
                      .length
                  : 0}
              </strong>{" "}
              X ·{" "}
              <strong>
                {config.platforms.includes("instagram")
                  ? config.accounts.filter(
                      (a) => a.active && a.instagramUsername,
                    ).length
                  : 0}
              </strong>{" "}
              IG
            </div>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 18 }}>
          <Button
            onClick={execute}
            disabled={running || !config.platforms.length}
          >
            <Play size={15} /> Ejecutar análisis
          </Button>
          {running && (
            <Button variant="danger" onClick={cancel}>
              <Square size={14} /> Cancelar análisis
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              if (
                !session ||
                confirm(
                  "Los resultados actuales serán eliminados. Puede exportarlos previamente a CSV o PDF.",
                )
              )
                await reset();
            }}
          >
            <RotateCcw size={14} /> Nuevo análisis
          </Button>
          <a href="/configuracion">
            <Button variant="ghost">Editar cuentas y límites</Button>
          </a>
        </div>
        {running && (
          <>
            <div className="progress">
              <span />
            </div>
            <p className="kpi-meta">{session?.stage}</p>
          </>
        )}
      </Card>
      {session && (
        <>
          <section className="section">
            <div className="section-heading">
              <h2>Ejecución actual</h2>
              <p>{new Date(session.createdAt).toLocaleString("es-CL")}</p>
            </div>
            <div className="toolbar">
              <Badge>{session.status}</Badge>
              <Badge>{session.config.platforms.join(" + ")}</Badge>
              <Badge>{session.posts.length} piezas</Badge>
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    postsRows(session),
                    `observatorio_gobierno_${periodName}.csv`,
                  )
                }
              >
                <Download size={14} /> Exportar CSV
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const blob = await generatePdf(session);
                  downloadBlob(
                    blob,
                    `informe_observatorio_digital_${periodName}.pdf`,
                    `application/pdf`,
                  );
                }}
              >
                <FileText size={14} /> Generar informe PDF
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const pdf = await generatePdf(session);
                  const zip = await buildZip(session, pdf);
                  downloadBlob(
                    zip,
                    `observatorio_gobierno_${periodName}.zip`,
                    `application/zip`,
                  );
                }}
              >
                <FileArchive size={14} /> Exportar todo
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  downloadBlob(
                    JSON.stringify(session, null, 2),
                    `observatorio_session_${config.endDate}.json`,
                    `application/json`,
                  )
                }
              >
                Exportar sesión
              </Button>
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                Importar sesión
              </Button>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    importSession(
                      JSON.parse(await f.text()) as AnalysisSession,
                    );
                  } catch (error) {
                    alert(
                      error instanceof Error
                        ? error.message
                        : "Sesión inválida",
                    );
                  }
                }}
              />
            </div>
            {session.errors.length > 0 && (
              <div className="error-list" style={{ marginTop: 12 }}>
                <strong>Incidencias de la ejecución</strong>
                <ul>
                  {session.errors.slice(0, 8).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <Dashboard session={session} />
          <ComparisonPanel current={session} />
        </>
      )}
      {!session && (
        <section className="section">
          <Card>
            <h2 style={{ fontFamily: "Georgia,serif", fontWeight: 500 }}>
              Aún no hay un análisis en esta sesión.
            </h2>
            <p>
              Complete las cuentas de X y las cuentas institucionales en
              Configuración. Luego ejecute el análisis para comenzar a ver
              resultados reales por etapas.
            </p>
          </Card>
        </section>
      )}
      <section className="section" id="metodologia">
        <div className="section-heading">
          <h2>Metodología</h2>
        </div>
        <div className="grid grid-3">
          <Card>
            <h3>Métricas</h3>
            <p className="kpi-meta">
              Engagement principal: likes + comentarios. El ampliado agrega
              shares, reposts y quotes. SOV: menciones del ministro / menciones
              ministeriales totales.
            </p>
          </Card>
          <Card>
            <h3>Sentimiento y temas</h3>
            <p className="kpi-meta">
              DeepSeek identifica el objeto evaluado y agrupa acontecimientos.
              Los números se calculan en código; el modelo no calcula métricas.
            </p>
          </Card>
          <Card>
            <h3>Alcance</h3>
            <p className="kpi-meta">
              Las métricas de X e Instagram representan mecanismos distintos y
              son descriptivas, no equivalencias exactas.
            </p>
          </Card>
        </div>
      </section>
      <footer className="footer-note">
        Este dashboard analiza contenido público recuperado mediante las fuentes
        configuradas. No constituye una encuesta ni una medición representativa
        de la opinión pública chilena. La clasificación automatizada puede
        contener errores. No se identifican personas anónimas ni se infieren
        atributos privados.
      </footer>
      <ScraperLoginModal
        isOpen={loginModalOpen}
        initialPlatform={missingPlatform}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => {
          setLoginModalOpen(false);
          execute();
        }}
      />
    </div>
  );
}
