import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { browserPool, type PooledContext } from "./browser-pool";

const SESSIONS_DIR = path.join(process.cwd(), ".sessions");
const X_SESSION_PATH = path.join(SESSIONS_DIR, "x_session.json");
const IG_SESSION_PATH = path.join(SESSIONS_DIR, "instagram_session.json");

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export interface SessionStatus {
  x: { authenticated: boolean; username?: string; lastChecked?: string };
  instagram: { authenticated: boolean; username?: string; lastChecked?: string };
}

export interface LoginCredentials {
  username?: string;
  password?: string;
  cookieAuthToken?: string;
  cookieSessionId?: string;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  ensureSessionsDir();
  let hasX = fs.existsSync(X_SESSION_PATH);
  let hasIg = fs.existsSync(IG_SESSION_PATH);

  let xUser: string | undefined;
  let igUser: string | undefined;

  if (hasX) {
    try {
      const data = JSON.parse(fs.readFileSync(X_SESSION_PATH, "utf-8"));
      const authCookie = data.cookies?.find((c: { name: string }) => c.name === "auth_token");
      const userCookie = data.cookies?.find((c: { name: string }) => c.name === "twid");
      if (authCookie && authCookie.value && authCookie.value.trim().length > 5) {
        if (userCookie) {
          xUser = decodeURIComponent(userCookie.value);
        }
      } else {
        hasX = false;
      }
    } catch {
      hasX = false;
    }
  }

  if (hasIg) {
    try {
      const data = JSON.parse(fs.readFileSync(IG_SESSION_PATH, "utf-8"));
      const sessionCookie = data.cookies?.find((c: { name: string }) => c.name === "sessionid");
      const dsUserCookie = data.cookies?.find((c: { name: string }) => c.name === "ds_user_id");
      if (sessionCookie && sessionCookie.value && sessionCookie.value.trim().length > 5) {
        if (dsUserCookie) {
          igUser = dsUserCookie.value;
        }
      } else {
        hasIg = false;
      }
    } catch {
      hasIg = false;
    }
  }

  return {
    x: { authenticated: hasX, username: xUser, lastChecked: new Date().toISOString() },
    instagram: { authenticated: hasIg, username: igUser, lastChecked: new Date().toISOString() },
  };
}

export async function getScraperContext(
  platform: "x" | "instagram",
): Promise<PooledContext> {
  ensureSessionsDir();
  const sessionPath = platform === "x" ? X_SESSION_PATH : IG_SESSION_PATH;
  const storageState = fs.existsSync(sessionPath) ? sessionPath : undefined;
  return browserPool.getPooledContext(storageState);
}

export async function loginX(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
  ensureSessionsDir();

  if (credentials.cookieAuthToken?.trim()) {
    const token = credentials.cookieAuthToken.trim();
    const cookies = [
      {
        name: "auth_token",
        value: token,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax" as const,
      },
      {
        name: "ct0",
        value: "0123456789abcdef0123456789abcdef",
        domain: ".x.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      },
    ];
    const storageState = { cookies, origins: [] };
    fs.writeFileSync(X_SESSION_PATH, JSON.stringify(storageState, null, 2));
    return { success: true };
  }

  if (!credentials.username || !credentials.password) {
    return { success: false, error: "Usuario/email y contraseña requeridos para X." };
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto("https://x.com/login", { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(3000);

    const usernameInput = page.locator('input[autocomplete="username"], input[name="text"], input[type="text"]').first();
    try {
      await usernameInput.waitFor({ state: "visible", timeout: 10000 });
    } catch {
      await browser.close();
      return {
        success: false,
        error: "X detectó la automatización de inicio de sesión. Por favor selecciona la opción 'Cookie (auth_token)' e ingresa el valor copiado desde F12 en x.com.",
      };
    }

    await usernameInput.fill(credentials.username);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);

    const confirmInput = page.locator('input[data-testid="ocfEnterTextTextInput"]');
    if (await confirmInput.isVisible().catch(() => false)) {
      await confirmInput.fill(credentials.username);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2500);
    }

    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(credentials.password);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000);

    const cookies = await context.cookies();
    const hasAuthToken = cookies.some((c: any) => c.name === "auth_token");

    if (!hasAuthToken) {
      await browser.close();
      return {
        success: false,
        error: "X requiere verificación adicional. Por favor selecciona la opción 'Cookie (auth_token)' e ingresa tu cookie auth_token.",
      };
    }

    await context.storageState({ path: X_SESSION_PATH });
    await browser.close();
    return { success: true };
  } catch (error) {
    await browser.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error durante login en X. Te recomendamos usar la opción 'Cookie (auth_token)'.",
    };
  }
}

export async function loginInstagram(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
  ensureSessionsDir();

  if (credentials.cookieSessionId?.trim()) {
    const cookies = [
      {
        name: "sessionid",
        value: credentials.cookieSessionId.trim(),
        domain: ".instagram.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax" as const,
      },
    ];
    const storageState = { cookies, origins: [] };
    fs.writeFileSync(IG_SESSION_PATH, JSON.stringify(storageState, null, 2));
    return { success: true };
  }

  if (!credentials.username || !credentials.password) {
    return { success: false, error: "Usuario y contraseña requeridos para Instagram." };
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(3000);

    try {
      const acceptBtn = page.locator('button:has-text("Allow all cookies"), button:has-text("Permitir todas las cookies"), button:has-text("De acuerdo"), button:has-text("Accept All")').first();
      if (await acceptBtn.isVisible()) await acceptBtn.click();
    } catch {}

    const userInput = page.locator('input[name="username"]').first();
    try {
      await userInput.waitFor({ state: "visible", timeout: 10000 });
    } catch {
      await browser.close();
      return {
        success: false,
        error: "Instagram bloqueó el formulario de inicio de sesión automatizado. Por favor selecciona la opción 'Cookie (sessionid)' e ingresa tu cookie copiada desde F12 en instagram.com.",
      };
    }

    await userInput.fill(credentials.username);

    const passInput = page.locator('input[name="password"]').first();
    await passInput.fill(credentials.password);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(6000);

    const cookies = await context.cookies();
    const hasSessionId = cookies.some((c: any) => c.name === "sessionid");

    if (!hasSessionId) {
      await browser.close();
      return {
        success: false,
        error: "Instagram requiere verificación adicional. Por favor selecciona la opción 'Cookie (sessionid)' e ingresa la cookie de sesión.",
      };
    }

    await context.storageState({ path: IG_SESSION_PATH });
    await browser.close();
    return { success: true };
  } catch (error) {
    await browser.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error durante login en Instagram. Te recomendamos usar la opción 'Cookie (sessionid)'.",
    };
  }
}
