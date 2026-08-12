"use client";
import { useRef, useState } from "react";
import { Download, Ellipsis } from "lucide-react";
import { toPng } from "html-to-image";
import { Button, Card } from "./ui";
import { downloadCsv } from "@/lib/export/csv";

const fileStem = (title: string) =>
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
export function ChartCard({
  title,
  subtitle,
  rows,
  children,
  insight,
}: {
  title: string;
  subtitle?: string;
  rows: Record<string, unknown>[];
  children: React.ReactNode;
  insight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showData, setShowData] = useState(false);
  const [savingPng, setSavingPng] = useState(false);
  const png = async () => {
    if (!ref.current || savingPng) return;
    setSavingPng(true);
    try {
      const dataUrl = await toPng(ref.current, {
        backgroundColor: "#fffefa",
        pixelRatio: 2,
        cacheBust: true,
        filter: (node) =>
          !(node instanceof HTMLElement) ||
          !node.hasAttribute("data-export-ignore"),
      });
      const link = document.createElement("a");
      link.download = `${fileStem(title)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error(`No se pudo capturar el gráfico "${title}".`, error);
      alert("No fue posible generar la captura PNG de este gráfico.");
    } finally {
      setSavingPng(false);
    }
  };
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <Card className="chart-card" ref={ref}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <div>
          <h3 className="chart-title">{title}</h3>
          {subtitle && <p className="chart-subtitle">{subtitle}</p>}
        </div>
        <div className="toolbar" data-export-ignore>
          <Button
            variant="ghost"
            title="Descargar CSV"
            onClick={() =>
              downloadCsv(
                rows,
                `${fileStem(title)}.csv`,
              )
            }
          >
            <Download size={14} /> CSV
          </Button>
          <Button
            variant="ghost"
            title="Descargar captura PNG"
            onClick={png}
            disabled={savingPng}
          >
            <Ellipsis size={15} /> {savingPng ? "Guardando…" : "PNG"}
          </Button>
          <Button variant="ghost" onClick={() => setShowData(!showData)}>
            Ver datos
          </Button>
        </div>
      </div>
      {children}
      {showData && (
        <div className="table-wrap" data-export-ignore>
          <table className="data-table">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {headers.map((h) => (
                    <td key={h}>{String(row[h] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {insight && (
        <div className="insight">
          <strong>LECTURA</strong>
          <br />
          {insight}
        </div>
      )}
    </Card>
  );
}
