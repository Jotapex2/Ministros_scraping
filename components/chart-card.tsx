"use client";
import { useRef, useState } from "react";
import { Download, Ellipsis } from "lucide-react";
import { Button, Card } from "./ui";
import { downloadCsv } from "@/lib/export/csv";
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
  const png = () => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.clientWidth * 3;
      canvas.height = svg.clientHeight * 3;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(3, 3);
      ctx.fillStyle = "#fffefa";
      ctx.fillRect(0, 0, svg.clientWidth, svg.clientHeight);
      ctx.drawImage(image, 0, 0);
      const link = document.createElement("a");
      link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
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
        <div className="toolbar">
          <Button
            variant="ghost"
            title="Descargar CSV"
            onClick={() =>
              downloadCsv(
                rows,
                `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`,
              )
            }
          >
            <Download size={14} /> CSV
          </Button>
          <Button variant="ghost" title="Descargar PNG" onClick={png}>
            <Ellipsis size={15} /> PNG
          </Button>
          <Button variant="ghost" onClick={() => setShowData(!showData)}>
            Ver datos
          </Button>
        </div>
      </div>
      {children}
      {showData && (
        <div className="table-wrap">
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
