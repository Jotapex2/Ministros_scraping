"use client";
import { useEffect, useRef, useState } from "react";
import { KeyRound, Plus, RotateCcw, Save, Upload, CheckCircle2, XCircle } from "lucide-react";
import { AppHeader } from "./app-header";
import { Button, Card, Input, Select } from "./ui";
import { useObservatory } from "@/lib/store";
import type { AccountConfig } from "@/types/social";
import { accountRows, downloadCsv, parseAccountCsv } from "@/lib/export/csv";
import { defaultAccounts } from "@/config/accounts";
import { clearAccounts } from "@/lib/session/accounts";
import { ScraperLoginModal } from "./scraper-login-modal";
import { OllamaModelField } from "./ollama-model-field";

export function ConfigurationClient() {
  const { config, hydrated, hydrate, setConfig, setAccounts } =
    useObservatory();
  const [draft, setDraft] = useState<AccountConfig[]>([]);
  const [authStatus, setAuthStatus] = useState<{ x?: boolean; instagram?: boolean }>({});
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginPlatform, setLoginPlatform] = useState<"x" | "instagram">("x");
  const [ollamaTesting, setOllamaTesting] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<{
    success: boolean;
    models?: string[];
    error?: string;
  } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/scraper/auth");
      const data = await res.json();
      if (res.ok && data.ok && data.data) {
        setAuthStatus({
          x: data.data.x?.authenticated,
          instagram: data.data.instagram?.authenticated,
        });
      }
    } catch {}
  };

  const testOllama = async () => {
    setOllamaTesting(true);
    setOllamaResult(null);
    try {
      const response = await fetch("/api/deepseek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_ollama",
          ollamaHost: config.ollamaHost,
          refresh: true,
        }),
      });
      const result = await response.json();
      if (response.ok && result.ok) {
        setOllamaResult({ success: true, models: result.data?.models ?? [] });
      } else {
        setOllamaResult({
          success: false,
          error: result.error || "No se pudo conectar a Ollama.",
        });
      }
    } catch (error) {
      setOllamaResult({
        success: false,
        error: error instanceof Error ? error.message : "Error de conexión.",
      });
    } finally {
      setOllamaTesting(false);
    }
  };

  useEffect(() => {
    hydrate().then(() => setDraft(useObservatory.getState().config.accounts));
    checkAuth();
  }, [hydrate]);
  if (!hydrated) return <div className="login">Cargando configuración…</div>;
  const edit = (index: number, patch: Partial<AccountConfig>) =>
    setDraft(draft.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  return (
    <div className="shell">
      <AppHeader />
      <section className="hero">
        <div>
          <p className="eyebrow">Configuración temporal</p>
          <h1>Cuentas y límites</h1>
        </div>
        <p>
          Los cambios se guardan en este navegador y siguen disponibles al
          recargar la app desplegada. Exporte el CSV para moverlos a otro
          dispositivo.
        </p>
      </section>
      <div className="toolbar">
        <Button
          onClick={async () => {
            await setAccounts(draft);
            alert("Cuentas guardadas en este navegador.");
          }}
        >
          <Save size={14} /> Guardar cambios
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(accountRows(draft), "configuracion_cuentas.csv")
          }
        >
          Exportar configuración CSV
        </Button>
        <Button variant="outline" onClick={() => file.current?.click()}>
          <Upload size={14} /> Importar configuración CSV
        </Button>
        <input
          ref={file}
          hidden
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setDraft(parseAccountCsv(await f.text()));
            } catch (error) {
              alert(error instanceof Error ? error.message : "CSV inválido");
            }
          }}
        />
        <Button
          variant="ghost"
          onClick={() => {
            const account: AccountConfig = {
              id: crypto.randomUUID(),
              name: "Nueva cuenta",
              position: "",
              ministry: "",
              accountType: "institutional",
              xUsername: "",
              instagramUsername: "",
              aliases: [],
              active: true,
            };
            setDraft([...draft, account]);
          }}
        >
          <Plus size={14} /> Agregar cuenta
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            if (confirm("¿Restaurar las 22 cuentas originales del CSV?")) {
              await clearAccounts();
              setDraft(defaultAccounts);
              await setAccounts(defaultAccounts);
            }
          }}
        >
          <RotateCcw size={14} /> Restaurar CSV inicial
        </Button>
      </div>
      <section className="section">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Activa</th>
                <th>Nombre</th>
                <th>Cargo / ministerio</th>
                <th>Tipo</th>
                <th>Usuario X</th>
                <th>Instagram</th>
                <th>Aliases</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draft.map((a, i) => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={a.active}
                      onChange={(e) => edit(i, { active: e.target.checked })}
                    />
                  </td>
                  <td>
                    <Input
                      value={a.name}
                      onChange={(e) => edit(i, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      value={a.ministry}
                      onChange={(e) =>
                        edit(i, {
                          ministry: e.target.value,
                          position: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <Select
                      value={a.accountType}
                      onChange={(e) =>
                        edit(i, {
                          accountType: e.target
                            .value as AccountConfig["accountType"],
                        })
                      }
                    >
                      <option value="minister">Ministro</option>
                      <option value="institutional">Institucional</option>
                      <option value="president">Presidencia</option>
                    </Select>
                  </td>
                  <td>
                    <Input
                      placeholder="sin @"
                      value={a.xUsername}
                      onChange={(e) =>
                        edit(i, { xUsername: e.target.value.replace(/^@/, "") })
                      }
                    />
                    {a.xUsername && (
                      <a
                        className="kpi-meta"
                        href={`https://x.com/${a.xUsername}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir perfil X ↗
                      </a>
                    )}
                  </td>
                  <td>
                    <Input
                      placeholder="sin @"
                      value={a.instagramUsername}
                      onChange={(e) =>
                        edit(i, {
                          instagramUsername: e.target.value.replace(/^@/, ""),
                        })
                      }
                    />
                    {a.instagramUsername && (
                      <a
                        className="kpi-meta"
                        href={`https://www.instagram.com/${a.instagramUsername}/`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir Instagram ↗
                      </a>
                    )}
                  </td>
                  <td>
                    <Input
                      value={a.aliases.join(" | ")}
                      onChange={(e) =>
                        edit(i, {
                          aliases: e.target.value
                            .split("|")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => setDraft(draft.filter((_, x) => x !== i))}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>Consultas y límites</h2>
        </div>
        <div className="grid grid-3">
          <Card>
            <div className="field">
              <label>Queries, una por línea</label>
              <textarea
                className="input"
                rows={8}
                value={config.queries.join("\n")}
                onChange={(e) =>
                  setConfig({
                    queries: e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </Card>
          <Card>
            {Object.entries(config.limits).map(([key, value]) => (
              <div className="field" key={key} style={{ marginBottom: 10 }}>
                <label>{key}</label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={value}
                  onChange={(e) =>
                    setConfig({
                      limits: {
                        ...config.limits,
                        [key]: Math.max(1, Number(e.target.value)),
                      },
                    })
                  }
                />
              </div>
            ))}
          </Card>
          <Card>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm flex items-center space-x-1">
                  <KeyRound size={16} className="text-blue-400 mr-1" />
                  Estado Autenticación Scraping Local
                </h3>
                <p className="kpi-meta">
                  Las publicaciones y comentarios se extraen localmente desde navegadores autenticados.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-neutral-950/60 rounded-lg border border-neutral-800">
                  <div className="flex items-center space-x-2">
                    {authStatus.x ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                    <span className="text-xs font-semibold">X (Twitter)</span>
                  </div>
                  <Button
                    variant={authStatus.x ? "outline" : "default"}
                    onClick={() => {
                      setLoginPlatform("x");
                      setLoginModalOpen(true);
                    }}
                  >
                    {authStatus.x ? "Reautenticar" : "Iniciar Sesión"}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-neutral-950/60 rounded-lg border border-neutral-800">
                  <div className="flex items-center space-x-2">
                    {authStatus.instagram ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                    <span className="text-xs font-semibold">Instagram</span>
                  </div>
                  <Button
                    variant={authStatus.instagram ? "outline" : "default"}
                    onClick={() => {
                      setLoginPlatform("instagram");
                      setLoginModalOpen(true);
                    }}
                  >
                    {authStatus.instagram ? "Reautenticar" : "Iniciar Sesión"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm">Proveedor de Inteligencia Artificial (LLM)</h3>
                <p className="kpi-meta">
                  Clasificación local y reproducible de sentimiento y temas.
                </p>
              </div>
              <div className="field">
                <label>Proveedor</label>
                <Select
                  value={config.llmProvider || "ollama"}
                  onChange={(event) =>
                    setConfig({
                      llmProvider: event.target.value as "deepseek" | "ollama",
                    })
                  }
                >
                  <option value="ollama">Ollama local</option>
                  <option value="deepseek">DeepSeek API</option>
                </Select>
              </div>
              {(config.llmProvider || "ollama") === "ollama" && (
                <>
                  <div className="field">
                    <label>Host de Ollama</label>
                    <Input
                      value={config.ollamaHost || "http://127.0.0.1:11434"}
                      onChange={(event) =>
                        setConfig({ ollamaHost: event.target.value })
                      }
                    />
                    <p className="kpi-meta">
                      En Docker se resuelve mediante host.docker.internal.
                    </p>
                  </div>
                  <div className="field">
                    <label>Modelo</label>
                    <OllamaModelField
                      host={config.ollamaHost}
                      value={config.ollamaModel || "gemma3:1b"}
                      onChange={(ollamaModel) => setConfig({ ollamaModel })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testOllama}
                    disabled={ollamaTesting}
                  >
                    {ollamaTesting ? "Conectando…" : "Probar Ollama"}
                  </Button>
                  {ollamaResult && (
                    <p className="kpi-meta">
                      {ollamaResult.success
                        ? `Conexión correcta. Modelos: ${ollamaResult.models?.join(", ") || "ninguno"}.`
                        : ollamaResult.error}
                    </p>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </section>

      <ScraperLoginModal
        isOpen={loginModalOpen}
        initialPlatform={loginPlatform}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => {
          setLoginModalOpen(false);
          checkAuth();
        }}
      />
    </div>
  );
}
