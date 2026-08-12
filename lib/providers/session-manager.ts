import fs from "fs";
import path from "path";
import { chromium, type BrowserContext, type Page } from "playwright";

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
  cookieAuthToken?: string; // For X auth_token cookie
  cookieSessionId?: string; // For IG sessionid cookie
}

export async function getSessionStatus(): Promise<SessionStatus> {
  ensureSessionsDir();
  const hasX = fs.existsSync(X_SESSION_PATH);
  const hasIg = fs.existsSync(IG_SESSION_PATH);

  let xUser: string | undefined;
  let igUser: string | undefined;

  if (hasX) {
    try {
      const data = JSON.parse(fs.readFileSync(X_SESSION_PATH, "utf-8"));
      const authCookie = data.cookies?.find((c: { name: string }) => c.name === "auth_token");
      const userCookie = data.cookies?.find((c: { name: string }) => c.name === "twid");
      if (authCookie && authCookie.value) {
        if (userCookie) {
          xUser = decodeURIComponent(userCookie.value);
        }
      }
    } catch {}
  }

  if (hasIg) {
    try {
      const data = JSON.parse(fs.readFileSync(IG_SESSION_PATH, "utf-8"));
      const sessionCookie = data.cookies?.find((c: { name: string }) => c.name === "sessionid");
      const dsUserCookie = data.cookies?.find((c: { name: string }) => c.name === "ds_user_id");
      if (sessionCookie && sessionCookie.value) {
        if (dsUserCookie) {
          igUser = dsUserCookie.value;
        }
      }
    } catch {}
  }

  return {
    x: { authenticated: hasX, username: xUser, lastChecked: new Date().toISOString() },
    instagram: { authenticated: hasIg, username: igUser, lastChecked: new Date().toISOString() },
  };
}

export async function getScraperContext(platform: "x" | "instagram") {
  ensureSessionsDir();
  const sessionPath = platform === "x" ? X_SESSION_PATH : IG_SESSION_PATH;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const options: Record<string, unknown> = {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  };

  if (fs.existsSync(sessionPath)) {
    options.storageState = sessionPath;
  }

  const context = await browser.newContext(options);
  return { browser, context, sessionPath };
}

export async function loginX(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
  ensureSessionsDir();

  // If cookie provided directly:
  if (credentials.cookieAuthToken?.trim()) {
    const cookies = [
      {
        name: "auth_token",
        value: credentials.cookieAuthToken.trim(),
        domain: ".x.com",
        path: "/",
        httpOnly: true,
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
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto("https://x.com/i/flow/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Enter username/email
    const usernameInput = page.locator('input[autocomplete="username"], input[name="text"]');
    await usernameInput.waitFor({ state: "visible", timeout: 15000 });
    await usernameInput.fill(credentials.username);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // Check if X asks for phone/unusual activity confirmation input
    const confirmInput = page.locator('input[data-testid="ocfEnterTextTextInput"]');
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(credentials.username);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    }

    // Enter password
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ state: "visible", timeout: 15000 });
    await passwordInput.fill(credentials.password);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000);

    // Verify logged in
    const cookies = await context.cookies();
    const hasAuthToken = cookies.some((c: any) => c.name === "auth_token");

    if (!hasAuthToken) {
      await browser.close();
      return { success: false, error: "No se pudo completar el login en X. Verifica tus credenciales o usa cookie auth_token." };
    }

    await context.storageState({ path: X_SESSION_PATH });
    await browser.close();
    return { success: true };
  } catch (error) {
    await browser.close();
    return { success: false, error: error instanceof Error ? error.message : "Error durante login en X." };
  }
}

export async function loginInstagram(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
  ensureSessionsDir();

  // If sessionid cookie provided directly:
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
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Accept cookies if dialog appears
    try {
      const acceptBtn = page.locator('button:has-text("Allow all cookies"), button:has-text("Permitir todas las cookies"), button:has-text("De acuerdo")');
      if (await acceptBtn.isVisible()) await acceptBtn.click();
    } catch {}

    const userInput = page.locator('input[name="username"]');
    await userInput.waitFor({ state: "visible", timeout: 15000 });
    await userInput.fill(credentials.username);

    const passInput = page.locator('input[name="password"]');
    await passInput.fill(credentials.password);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(6000);

    const cookies = await context.cookies();
    const hasSessionId = cookies.some((c: any) => c.name === "sessionid");

    if (!hasSessionId) {
      await browser.close();
      return { success: false, error: "No se pudo iniciar sesión en Instagram. Verifica tus credenciales o usa cookie sessionid." };
    }

    await context.storageState({ path: IG_SESSION_PATH });
    await browser.close();
    return { success: true };
  } catch (error) {
    await browser.close();
    return { success: false, error: error instanceof Error ? error.message : "Error durante login en Instagram." };
  }
}
