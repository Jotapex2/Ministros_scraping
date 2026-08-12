"use client";
import { useEffect, useState } from "react";
import { Button, Card, Input } from "./ui";
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((v) => {
        setAuth(v.authenticated);
        setReady(true);
      });
  }, []);
  if (!ready)
    return (
      <div className="login">
        <p>Preparando observatorio…</p>
      </div>
    );
  if (auth) return children;
  return (
    <div className="login">
      <Card>
        <p className="eyebrow">Acceso protegido</p>
        <h1>Observatorio Digital del Gobierno</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
          Ingrese la clave de acceso configurada para esta instalación.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const r = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password }),
            });
            if (r.ok) setAuth(true);
            else setError("La clave no es válida.");
          }}
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Clave de acceso"
            autoFocus
          />
          <Button style={{ width: "100%", marginTop: 10 }}>Ingresar</Button>
          {error && <p className="sentiment-negative">{error}</p>}
        </form>
      </Card>
    </div>
  );
}
