"use client";
import Link from "next/link";
import { Button } from "./ui";
export function AppHeader() {
  return (
    <header className="masthead">
      <div className="brand">
        <small>GOBIERNO · CONVERSACIÓN · DATOS</small>Observatorio Digital
      </div>
      <nav className="nav">
        <Link href="/">Dashboard</Link>
        <Link href="/configuracion">Configuración</Link>
        <Link href="/datos">Datos</Link>
        <a href="#metodologia">Metodología</a>
        <Button
          variant="ghost"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            location.reload();
          }}
        >
          Salir
        </Button>
      </nav>
    </header>
  );
}
