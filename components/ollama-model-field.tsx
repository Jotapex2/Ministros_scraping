"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Select } from "./ui";

export function OllamaModelField({
  host,
  value,
  onChange,
}: {
  host?: string;
  value?: string;
  onChange: (model: string) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedAt, setDetectedAt] = useState<string | null>(null);

  const load = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deepseek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_ollama",
          ollamaHost: host || "http://127.0.0.1:11434",
          refresh,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.data?.models)) {
        const nextModels = data.data.models as string[];
        setModels(nextModels);
        setDetectedAt(data.data.detectedAt || null);
        if (nextModels.length > 0 && !nextModels.includes(value || "")) {
          onChange(nextModels[0]);
        }
      } else {
        setError(data.error || "No se pudieron listar los modelos de Ollama.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con Ollama.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, [host]);

  return (
    <div className="space-y-2">
      {models.length > 0 ? (
        <div className="flex items-center space-x-2">
          <Select
            className="flex-1"
            value={models.includes(value || "") ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>
              Selecciona un modelo instalado...
            </option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(true)}
            disabled={loading}
            style={{ padding: "2px 10px", fontSize: 12 }}
            title="Recargar modelos instalados"
          >
            {loading ? "..." : <RefreshCw size={13} />}
          </Button>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="kpi-meta">No se encontraron modelos instalados.</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(true)}
            disabled={loading}
            style={{ padding: "2px 10px", fontSize: 12 }}
            title="Buscar modelos instalados"
          >
            {loading ? "..." : <RefreshCw size={13} />}
          </Button>
        </div>
      )}

      {models.length > 0 && (
        <p className="kpi-meta">
          {models.length} modelo{models.length === 1 ? "" : "s"} detectado
          {models.length === 1 ? "" : "s"} por Docker
          {detectedAt
            ? ` · ${new Date(detectedAt).toLocaleString("es-CL")}`
            : ""}
        </p>
      )}

      {error && (
        <p className="kpi-meta" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
    </div>
  );
}
