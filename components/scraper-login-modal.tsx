"use client";

import { useState } from "react";
import { Button, Card, Input } from "./ui";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPlatform?: "x" | "instagram";
}

export function ScraperLoginModal({ isOpen, onClose, onSuccess }: Props) {
  // Independent states for X (Twitter)
  const [xMethod, setXMethod] = useState<"credentials" | "cookie">("credentials");
  const [xUsername, setXUsername] = useState("");
  const [xPassword, setXPassword] = useState("");
  const [xCookie, setXCookie] = useState("");
  const [xLoading, setXLoading] = useState(false);
  const [xStatus, setXStatus] = useState<{ success?: boolean; msg?: string }>({});

  // Independent states for Instagram
  const [igMethod, setIgMethod] = useState<"credentials" | "cookie">("credentials");
  const [igUsername, setIgUsername] = useState("");
  const [igPassword, setIgPassword] = useState("");
  const [igCookie, setIgCookie] = useState("");
  const [igLoading, setIgLoading] = useState(false);
  const [igStatus, setIgStatus] = useState<{ success?: boolean; msg?: string }>({});

  if (!isOpen) return null;

  const handleSubmitX = async (e: React.FormEvent) => {
    e.preventDefault();
    setXLoading(true);
    setXStatus({});

    try {
      const payload =
        xMethod === "credentials"
          ? { action: "login_x", username: xUsername, password: xPassword }
          : { action: "login_x", cookieAuthToken: xCookie };

      const res = await fetch("/api/scraper/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Falló la autenticación en X.");
      }

      setXStatus({ success: true, msg: "¡Sesión guardada para X!" });
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setXStatus({ success: false, msg: err instanceof Error ? err.message : "Error al iniciar sesión en X." });
    } finally {
      setXLoading(false);
    }
  };

  const handleSubmitIg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIgLoading(true);
    setIgStatus({});

    try {
      const payload =
        igMethod === "credentials"
          ? { action: "login_instagram", username: igUsername, password: igPassword }
          : { action: "login_instagram", cookieSessionId: igCookie };

      const res = await fetch("/api/scraper/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Falló la autenticación en Instagram.");
      }

      setIgStatus({ success: true, msg: "¡Sesión guardada para Instagram!" });
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setIgStatus({ success: false, msg: err instanceof Error ? err.message : "Error al iniciar sesión en Instagram." });
    } finally {
      setIgLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(23, 35, 31, 0.75)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 860, width: "100%", margin: "auto" }}>
        <Card style={{ padding: 28, background: "var(--surface)", position: "relative" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Autenticación de Scraping Local</p>
              <h2 style={{ margin: "4px 0 0 0", fontFamily: "Georgia, serif", fontSize: 22 }}>Iniciar Sesión en Redes Sociales</h2>
            </div>
            <Button variant="ghost" onClick={onClose} style={{ fontSize: 18, padding: "4px 12px" }}>
              ✕
            </Button>
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            Ingresa tus credenciales o cookies de sesión para X (Twitter) e Instagram. Se guardarán en el volumen persistente local para realizar la extracción de publicaciones.
          </p>

          {/* 2-Column Separate Forms: X vs Instagram */}
          <div className="grid grid-2" style={{ gap: 24 }}>
            {/* Formulario X (Twitter) */}
            <div style={{ background: "#f8f9f8", border: "1px solid var(--line)", borderRadius: 8, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--x)" }}>1. Cuenta de X (Twitter)</h3>
                <span className="badge" style={{ background: "var(--x)", color: "#fff" }}>X.com</span>
              </div>

              {/* Method Selector */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="xMethod"
                    checked={xMethod === "credentials"}
                    onChange={() => setXMethod("credentials")}
                  />
                  Usuario / Pass
                </label>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="xMethod"
                    checked={xMethod === "cookie"}
                    onChange={() => setXMethod("cookie")}
                  />
                  Cookie (`auth_token`)
                </label>
              </div>

              <form onSubmit={handleSubmitX}>
                {xMethod === "credentials" ? (
                  <>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12 }}>Usuario X (sin @)</label>
                      <Input
                        type="text"
                        required
                        placeholder="ejemplo_x"
                        value={xUsername}
                        onChange={(e) => setXUsername(e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12 }}>Contraseña X</label>
                      <Input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={xPassword}
                        onChange={(e) => setXPassword(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12 }}>Cookie `auth_token`</label>
                    <Input
                      type="text"
                      required
                      placeholder="abcdef123456..."
                      value={xCookie}
                      onChange={(e) => setXCookie(e.target.value)}
                    />
                    <span className="kpi-meta" style={{ display: "block", marginTop: 4 }}>
                      Obtenida desde F12 en x.com
                    </span>
                  </div>
                )}

                {xStatus.msg && (
                  <p className={xStatus.success ? "sentiment-positive" : "sentiment-negative"} style={{ fontSize: 12, margin: "6px 0 10px" }}>
                    {xStatus.msg}
                  </p>
                )}

                <Button type="submit" disabled={xLoading} style={{ width: "100%" }}>
                  {xLoading ? "Autenticando en X..." : "Guardar Sesión de X"}
                </Button>
              </form>
            </div>

            {/* Formulario Instagram */}
            <div style={{ background: "#fdf8f9", border: "1px solid var(--line)", borderRadius: 8, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--instagram)" }}>2. Cuenta de Instagram</h3>
                <span className="badge" style={{ background: "var(--instagram)", color: "#fff" }}>Instagram</span>
              </div>

              {/* Method Selector */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="igMethod"
                    checked={igMethod === "credentials"}
                    onChange={() => setIgMethod("credentials")}
                  />
                  Usuario / Pass
                </label>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="igMethod"
                    checked={igMethod === "cookie"}
                    onChange={() => setIgMethod("cookie")}
                  />
                  Cookie (`sessionid`)
                </label>
              </div>

              <form onSubmit={handleSubmitIg}>
                {igMethod === "credentials" ? (
                  <>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12 }}>Usuario Instagram (sin @)</label>
                      <Input
                        type="text"
                        required
                        placeholder="ejemplo_ig"
                        value={igUsername}
                        onChange={(e) => setIgUsername(e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12 }}>Contraseña Instagram</label>
                      <Input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={igPassword}
                        onChange={(e) => setIgPassword(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12 }}>Cookie `sessionid`</label>
                    <Input
                      type="text"
                      required
                      placeholder="6789012345..."
                      value={igCookie}
                      onChange={(e) => setIgCookie(e.target.value)}
                    />
                    <span className="kpi-meta" style={{ display: "block", marginTop: 4 }}>
                      Obtenida desde F12 en instagram.com
                    </span>
                  </div>
                )}

                {igStatus.msg && (
                  <p className={igStatus.success ? "sentiment-positive" : "sentiment-negative"} style={{ fontSize: 12, margin: "6px 0 10px" }}>
                    {igStatus.msg}
                  </p>
                )}

                <Button type="submit" disabled={igLoading} style={{ width: "100%" }}>
                  {igLoading ? "Autenticando en IG..." : "Guardar Sesión de IG"}
                </Button>
              </form>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
