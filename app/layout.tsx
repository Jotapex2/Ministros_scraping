import type { Metadata } from "next";
import "./globals.css";

const appName =
  process.env.NEXT_PUBLIC_APP_NAME || "Observatorio Digital del Gobierno";

export const metadata: Metadata = {
  title: appName,
  description:
    "Análisis ejecutivo de conversación y desempeño digital del Gobierno de Chile en X e Instagram.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
