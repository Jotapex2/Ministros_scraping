import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const ollamaHost = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(
  /\/+$/,
  "",
);
const attempts = Math.max(
  1,
  Number.parseInt(process.env.OLLAMA_STARTUP_RETRIES || "10", 10) || 10,
);
const cachePath = path.join(process.cwd(), ".sessions", "ollama-models.json");

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function detectModels() {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${ollamaHost}/api/tags`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const models = Array.isArray(payload.models)
        ? payload.models
            .map((model) => String(model?.name || "").trim())
            .filter(Boolean)
        : [];

      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(
        cachePath,
        JSON.stringify(
          { host: ollamaHost, models, detectedAt: new Date().toISOString() },
          null,
          2,
        ),
        "utf8",
      );

      if (models.length) {
        console.log(`[ollama] Modelos detectados: ${models.join(", ")}`);
        if (!models.includes(process.env.OLLAMA_MODEL || "")) {
          process.env.OLLAMA_MODEL = models[0];
          console.log(`[ollama] Modelo predeterminado: ${models[0]}`);
        }
      } else {
        console.warn("[ollama] El servidor respondió, pero no tiene modelos instalados.");
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `[ollama] Consulta ${attempt}/${attempts} falló en ${ollamaHost}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (attempt < attempts) await delay(2_000);
    }
  }

  console.warn(
    `[ollama] Se iniciará la aplicación sin caché de modelos: ${lastError instanceof Error ? lastError.message : "Ollama no disponible"}`,
  );
}

await detectModels();

const child = spawn("npm", ["start"], {
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
