"use client";

import { useState } from "react";
import { Button, Card, Input } from "./ui";
import { KeyRound, LogIn, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPlatform?: "x" | "instagram";
}

export function ScraperLoginModal({ isOpen, onClose, onSuccess, initialPlatform = "x" }: Props) {
  const [platform, setPlatform] = useState<"x" | "instagram">(initialPlatform);
  const [loginMethod, setLoginMethod] = useState<"credentials" | "cookie">("credentials");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookieToken, setCookieToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const action = platform === "x" ? "login_x" : "login_instagram";
      const payload =
        loginMethod === "credentials"
          ? { action, username, password }
          : platform === "x"
          ? { action, cookieAuthToken: cookieToken }
          : { action, cookieSessionId: cookieToken };

      const res = await fetch("/api/scraper/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Falló la autenticación en ${platform.toUpperCase()}`);
      }

      setSuccessMsg(`¡Sesión guardada exitosamente para ${platform.toUpperCase()}!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error durante el proceso de login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md bg-neutral-900 border border-neutral-800 text-white p-6 rounded-xl shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold">Iniciar Sesión de Scraping</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          Para realizar webscraping local en {platform.toUpperCase()}, el sistema requiere guardar una sesión autenticada activa.
        </p>

        {/* Tab switcher for Platform */}
        <div className="flex bg-neutral-800 p-1 rounded-lg">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              platform === "x" ? "bg-blue-600 text-white" : "text-neutral-400 hover:text-white"
            }`}
            onClick={() => {
              setPlatform("x");
              setError("");
            }}
          >
            X (Twitter)
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
              platform === "instagram" ? "bg-pink-600 text-white" : "text-neutral-400 hover:text-white"
            }`}
            onClick={() => {
              setPlatform("instagram");
              setError("");
            }}
          >
            Instagram
          </button>
        </div>

        {/* Tab switcher for Login Method */}
        <div className="flex space-x-4 text-xs border-b border-neutral-800 pb-2">
          <button
            type="button"
            className={`font-semibold pb-1 border-b-2 ${
              loginMethod === "credentials" ? "border-blue-400 text-blue-400" : "border-transparent text-neutral-400"
            }`}
            onClick={() => setLoginMethod("credentials")}
          >
            Usuario y Contraseña
          </button>
          <button
            type="button"
            className={`font-semibold pb-1 border-b-2 ${
              loginMethod === "cookie" ? "border-blue-400 text-blue-400" : "border-transparent text-neutral-400"
            }`}
            onClick={() => setLoginMethod("cookie")}
          >
            Cookie de Sesión ({platform === "x" ? "auth_token" : "sessionid"})
          </button>
        </div>

        {error && (
          <div className="flex items-center space-x-2 bg-red-950/80 border border-red-800 text-red-300 text-xs p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center space-x-2 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs p-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {loginMethod === "credentials" ? (
            <>
              <div className="space-y-1">
                <label className="text-xs text-neutral-300">Usuario / Email de {platform.toUpperCase()}</label>
                <Input
                  type="text"
                  required
                  placeholder={platform === "x" ? "usuario_x" : "usuario_ig"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-300">Contraseña</label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-neutral-300">
                Valor Cookie {platform === "x" ? "auth_token" : "sessionid"}
              </label>
              <Input
                type="text"
                required
                placeholder={platform === "x" ? "1a2b3c4d5e..." : "6789012345..."}
                value={cookieToken}
                onChange={(e) => setCookieToken(e.target.value)}
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                Copia el valor de la cookie desde las herramientas de desarrollador (F12) de tu navegador en {platform === "x" ? "x.com" : "instagram.com"}.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                "Autenticando..."
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-1 inline" /> Guardar y Autenticar
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
