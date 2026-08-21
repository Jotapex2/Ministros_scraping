import { chromium, type Browser, type BrowserContext } from "playwright";

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-blink-features=AutomationControlled",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

interface PoolEntry {
  browser: Browser;
  inUse: number;
  lastUsed: number;
}

const MAX_IDLE_MS = 60_000;
const CLEANUP_INTERVAL_MS = 15_000;

let pool: PoolEntry[] = [];
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (let i = pool.length - 1; i >= 0; i--) {
      const entry = pool[i];
      if (
        entry.inUse === 0 &&
        now - entry.lastUsed > MAX_IDLE_MS
      ) {
        pool.splice(i, 1);
        entry.browser.close().catch(() => undefined);
      }
    }
    if (pool.length === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
}

async function acquireBrowser(): Promise<Browser> {
  for (const entry of pool) {
    if (entry.inUse === 0) {
      entry.inUse++;
      entry.lastUsed = Date.now();
      return entry.browser;
    }
  }
  const browser = await chromium.launch({
    headless: true,
    args: BROWSER_ARGS,
  });
  pool.push({ browser, inUse: 1, lastUsed: Date.now() });
  startCleanup();
  return browser;
}

function releaseBrowser(browser: Browser) {
  for (const entry of pool) {
    if (entry.browser === browser) {
      entry.inUse = Math.max(0, entry.inUse - 1);
      entry.lastUsed = Date.now();
      break;
    }
  }
}

async function closeAll() {
  const browsers = pool.map((e) => e.browser);
  pool = [];
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  await Promise.allSettled(browsers.map((b) => b.close()));
}

export interface PooledContext {
  browser: Browser;
  context: BrowserContext;
  release: () => void;
}

export async function getPooledContext(
  storageState?: string,
): Promise<PooledContext> {
  const browser = await acquireBrowser();
  try {
    const options: Record<string, unknown> = {
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
    };
    if (storageState) options.storageState = storageState;
    const context = await browser.newContext(options);
    return {
      browser,
      context,
      release: () => {
        void context
          .close()
          .catch(() => undefined)
          .finally(() => releaseBrowser(browser));
      },
    };
  } catch (error) {
    releaseBrowser(browser);
    throw error;
  }
}

export const browserPool = { getPooledContext, closeAll };
