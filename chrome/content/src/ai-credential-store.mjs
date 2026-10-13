import { PREFS } from "./constants.mjs";

const RESERVED_PROVIDER_IDS = new Set(["__proto__", "constructor", "prototype"]);

export class AICredentialStore {
  constructor(platform) {
    this.platform = platform;
  }

  isSupportedVersion() {
    const major = Number.parseInt(String(this.platform?.Zotero?.version ?? "0").split(".")[0], 10);
    return Number.isFinite(major) && major >= 9;
  }

  capability() {
    if (!this.isSupportedVersion()) {
      return { supported: false, persistent: false, reason: "zotero-version" };
    }
    const prefs = this.platform?.Zotero?.Prefs;
    const persistent = typeof prefs?.get === "function" && typeof prefs?.set === "function";
    return {
      supported: true,
      persistent,
      reason: persistent ? "" : "zotero-preferences"
    };
  }

  async set(providerID, apiKey) {
    normalizeProviderID(providerID);
    const value = String(apiKey ?? "").trim();
    if (!value) {
      throw new Error("API key is required.");
    }
    if (!this.isSupportedVersion()) {
      throw new Error("AI credentials require Zotero 9 or later.");
    }
    this.assertPreferencesAvailable();
    this.platform.Zotero.Prefs.set(PREFS.secretKey, value);
    return { persisted: true };
  }

  async get(providerID) {
    normalizeProviderID(providerID);
    if (!this.isSupportedVersion()) {
      return "";
    }
    this.assertPreferencesAvailable();
    const value = this.platform.Zotero.Prefs.get(PREFS.secretKey);
    return typeof value === "string" ? value.trim() : "";
  }

  async forget(providerID) {
    normalizeProviderID(providerID);
    if (!this.isSupportedVersion()) {
      return;
    }
    this.assertPreferencesAvailable();
    this.platform.Zotero.Prefs.set(PREFS.secretKey, "");
  }

  // Kept as a lifecycle-compatible no-op for AIReviewService shutdown.
  clearSession() {}

  assertPreferencesAvailable() {
    const prefs = this.platform?.Zotero?.Prefs;
    if (typeof prefs?.get !== "function" || typeof prefs?.set !== "function") {
      throw new Error("Zotero preferences are unavailable.");
    }
  }
}

export function normalizeProviderID(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  if (!normalized || normalized === "." || normalized === ".." || RESERVED_PROVIDER_IDS.has(normalized)) {
    throw new Error("Invalid AI provider identifier.");
  }
  return normalized.slice(0, 100);
}

export function createAICredentialID(providerID, baseURL = "") {
  const provider = normalizeProviderID(providerID);
  if (provider === "deepseek") {
    return provider;
  }
  let endpoint;
  try {
    endpoint = new URL(String(baseURL ?? "").trim()).toString().replace(/\/$/, "");
  }
  catch {
    throw new Error("Invalid AI endpoint for credential storage.");
  }
  let hash = 2166136261;
  for (const character of endpoint) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const host = new URL(endpoint).hostname.replace(/[^a-z0-9.-]+/gi, "-").slice(0, 48);
  return normalizeProviderID(`${provider}.${host}.${(hash >>> 0).toString(16).padStart(8, "0")}`);
}
