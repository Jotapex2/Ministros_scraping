import { Actor, log } from "apify";

import { normalizeInstagramPost } from "./normalize.js";

const UPSTREAM_ACTOR_ID = "apify/instagram-scraper";
const PAGE_SIZE = 250;

function validateInput(input) {
  if (!input || !Array.isArray(input.directUrls) || input.directUrls.length === 0) {
    throw new Error("directUrls debe contener al menos un perfil de Instagram.");
  }

  const directUrls = [...new Set(input.directUrls.map((url) => String(url).trim()))];
  for (const url of directUrls) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`URL de Instagram inválida: ${url}`);
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== "instagram.com" && host !== "www.instagram.com") {
      throw new Error(`La URL no pertenece a instagram.com: ${url}`);
    }
  }

  return {
    directUrls,
    resultsLimit: Math.min(200, Math.max(1, Number(input.resultsLimit) || 20)),
    onlyPostsNewerThan: input.onlyPostsNewerThan?.trim() || undefined,
    includeComments: input.includeComments !== false,
  };
}

async function copyNormalizedDataset(datasetId, includeComments) {
  const client = Actor.apifyClient.dataset(datasetId);
  let offset = 0;
  let copied = 0;

  while (true) {
    const page = await client.listItems({ offset, limit: PAGE_SIZE, clean: true });
    if (!page.items.length) break;

    const normalized = page.items.map((item) =>
      normalizeInstagramPost(item, includeComments),
    );
    await Actor.pushData(normalized);
    copied += normalized.length;
    offset += page.items.length;

    await Actor.setStatusMessage(`Normalizadas ${copied} publicaciones`, {
      level: "INFO",
    });
    if (offset >= page.total) break;
  }

  return copied;
}

await Actor.init();

try {
  const input = validateInput(await Actor.getInput());
  const upstreamInput = {
    directUrls: input.directUrls,
    resultsType: "posts",
    resultsLimit: input.resultsLimit,
    ...(input.onlyPostsNewerThan
      ? { onlyPostsNewerThan: input.onlyPostsNewerThan }
      : {}),
  };

  await Actor.setStatusMessage(
    `Consultando ${input.directUrls.length} perfiles de Instagram`,
    { level: "INFO" },
  );

  const run = await Actor.apifyClient
    .actor(UPSTREAM_ACTOR_ID)
    .call(upstreamInput, { waitSecs: 3600 });

  if (run.status !== "SUCCEEDED" || !run.defaultDatasetId) {
    throw new Error(
      `El scraper de Instagram terminó con estado ${run.status ?? "desconocido"}.`,
    );
  }

  const itemCount = await copyNormalizedDataset(
    run.defaultDatasetId,
    input.includeComments,
  );
  const output = {
    status: "SUCCEEDED",
    itemCount,
    accountsRequested: input.directUrls.length,
    upstreamActorId: UPSTREAM_ACTOR_ID,
    upstreamRunId: run.id,
    finishedAt: new Date().toISOString(),
  };

  await Actor.setValue("OUTPUT", output);
  await Actor.setStatusMessage(`Listo: ${itemCount} publicaciones normalizadas`, {
    level: "INFO",
  });
  log.info("Extracción terminada", output);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log.exception(error, "Falló el adaptador de Instagram");
  await Actor.setStatusMessage(message, { level: "ERROR" });
  throw error;
} finally {
  await Actor.exit();
}
