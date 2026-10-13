import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  AI_BATCH_CHAR_LIMIT,
  AI_MAX_CHANGES,
  DeepSeekProvider,
  OpenAICompatibleProvider,
  buildAIChangeChunks,
  normalizeChangeForAI,
  resolveAIAbortAPI,
  resolveAIFetchImpl,
  resolveAITimerAPI,
  validateAIEndpoint,
  validateAIReviewResult
} from "../chrome/content/src/ai-provider.mjs";
import { AICredentialStore, createAICredentialID } from "../chrome/content/src/ai-credential-store.mjs";
import { AIInsightStore, normalizeCacheKey } from "../chrome/content/src/ai-insight-store.mjs";
import { AIReviewService, buildAIReviewMarkdown } from "../chrome/content/src/ai-review-service.mjs";
import { ReviewStateStore } from "../chrome/content/src/review-state-store.mjs";
import { DiffStore } from "../chrome/content/src/diff-store.mjs";
import { VersionService } from "../chrome/content/src/version-service.mjs";
import { PREFS } from "../chrome/content/src/constants.mjs";

class StorePlatform {
  constructor() {
    this.files = new Map();
    this.modified = new Map();
    this.clock = 1;
    this.prefs = new Map();
    this.Zotero = {
      version: "10.0",
      Prefs: {
        get: (key) => this.prefs.get(key),
        set: (key, value) => this.prefs.set(key, value)
      }
    };
  }

  join(...parts) {
    return parts.join("/").replace(/\/+/g, "/");
  }

  async exists(path) {
    if (this.files.has(path)) return true;
    const prefix = `${path.replace(/\/$/, "")}/`;
    return [...this.files.keys()].some((candidate) => candidate.startsWith(prefix));
  }

  async readText(path) {
    return this.files.get(path);
  }

  async writeText(path, value) {
    this.files.set(path, String(value));
    this.modified.set(path, this.clock++);
  }

  async atomicWriteText(path, value) {
    await this.writeText(path, value);
  }

  async listDirectory(directory) {
    const prefix = `${directory.replace(/\/$/, "")}/`;
    const children = new Set();
    for (const path of this.files.keys()) {
      if (!path.startsWith(prefix)) continue;
      const remainder = path.slice(prefix.length);
      if (remainder && !remainder.includes("/")) children.add(path);
    }
    return [...children];
  }

  async isDirectory(path) {
    return !this.files.has(path) && await this.exists(path);
  }

  async stat(path) {
    return {
      size: new TextEncoder().encode(this.files.get(path) || "").byteLength,
      lastModified: this.modified.get(path) || 0
    };
  }

  async removeFile(path) {
    this.files.delete(path);
    this.modified.delete(path);
  }

  async hashString(value) {
    return createHash("sha256").update(String(value ?? "")).digest("hex");
  }

  getPref(key, fallback = null) {
    return this.prefs.has(key) ? this.prefs.get(key) : fallback;
  }

  setPref(key, value) {
    this.prefs.set(key, value);
  }
}

assert.equal(validateAIEndpoint("https://example.test/v1/"), "https://example.test/v1");
assert.equal(validateAIEndpoint("http://localhost:11434/v1"), "http://localhost:11434/v1");
assert.throws(() => validateAIEndpoint("http://example.test/v1"), /HTTPS/);
assert.throws(() => validateAIEndpoint("https://user:secret@example.test/v1"), /credentials/);
assert.throws(() => validateAIEndpoint("https://example.test/v1?token=secret"), /query/);

const longSide = `start-${"😀".repeat(9000)}-end`;
const limitedChange = normalizeChangeForAI({ id: "long", type: "modified", oldText: longSide, newText: longSide });
assert([...limitedChange.oldText].length <= 8000);
assert(limitedChange.oldText.includes("[…truncated locally…]"));
assert(limitedChange.oldText.endsWith("-end"));

const manyChanges = Array.from({ length: 40 }, (_, index) => ({
  id: `change-${index}`,
  type: "modified",
  oldText: `old-${index}-${"a".repeat(1800)}`,
  newText: `new-${index}-${"b".repeat(1800)}`
}));
const chunks = buildAIChangeChunks(manyChanges);
assert(chunks.length > 1 && chunks.length <= 8);
assert(chunks.every((chunk) => [...JSON.stringify(chunk)].length <= AI_BATCH_CHAR_LIMIT));
assert.throws(() => buildAIChangeChunks([]), /Select at least one/);
assert.throws(() => buildAIChangeChunks(Array.from({ length: AI_MAX_CHANGES + 1 }, (_, id) => ({ id }))), /no more than/);

const validated = validateAIReviewResult({
  summary: "<b>safe</b><script>alert(1)</script>",
  sectionSummaries: [
    { groupID: "body", summary: "known", changeIDs: ["change-1"] },
    { groupID: "body", summary: "unknown", changeIDs: ["invented"] }
  ],
  keyChanges: [{ importance: "critical", description: "check", changeIDs: ["change-1", "invented"] }],
  risks: [{ severity: "high", category: "statistics", description: "risk", verification: "verify", changeIDs: ["invented"] }],
  suggestedVersionNote: "note",
  limitations: ["limit"]
}, new Set(["change-1"]));
assert(!validated.summary.includes("<"));
assert.deepEqual(validated.sectionSummaries.map((entry) => entry.summary), ["known"]);
assert.deepEqual(validated.keyChanges[0].changeIDs, ["change-1"]);
assert.equal(validated.keyChanges[0].importance, "medium");
assert.equal(validated.risks.length, 0);

const providerRequests = [];
const structuredResponse = {
  summary: "Selected changes summarized.",
  sectionSummaries: [{ groupID: "body", summary: "Body changed.", changeIDs: ["change-1"] }],
  keyChanges: [{ importance: "high", description: "Primary change", changeIDs: ["change-1"] }],
  risks: [{ severity: "medium", category: "number", description: "Verify value", verification: "Check source", changeIDs: ["change-1"] }],
  suggestedVersionNote: "Revise results",
  limitations: []
};
const aiMarkdown = buildAIReviewMarkdown({
  provider: "deepseek",
  model: "deepseek-chat",
  createdAt: "2026-10-02T08:00:00.000Z",
  cached: true,
  changeIDs: ["change-1", "change-2"],
  result: {
    ...structuredResponse,
    keyChanges: [
      { importance: "low", description: "Minor wording", changeIDs: ["change-2"] },
      { importance: "high", description: "Primary change", changeIDs: ["change-1"] }
    ],
    risks: [
      { severity: "low", category: "style", description: "Wording", verification: "Read again", changeIDs: ["change-2"] },
      { severity: "high", category: "statistics", description: "Value changed", verification: "Check source", changeIDs: ["change-1"] }
    ],
    limitations: ["Selected changes only"]
  }
}, {
  aiReviewReportTitle: "AI 审阅报告",
  aiReviewDisclaimer: "请人工核验。",
  aiReviewReportMeta: "{provider} · {model} · {count} · {time} · {source}",
  aiReviewCached: "缓存结果",
  aiReviewSummary: "总体摘要",
  aiReviewSectionSummaries: "分组摘要",
  aiReviewKeyChanges: "关键变化",
  aiReviewRisks: "风险与核验建议",
  aiReviewVerification: "建议核验",
  aiReviewReferences: "相关修改",
  aiReviewSuggestedNote: "建议版本说明",
  aiReviewLimitations: "局限",
  aiLevelHigh: "高",
  aiLevelMedium: "中",
  aiLevelLow: "低"
});
assert(aiMarkdown.startsWith("# AI 审阅报告"));
assert(aiMarkdown.includes("deepseek · deepseek-chat · 2 · 2026-10-02T08:00:00.000Z · 缓存结果"));
assert(aiMarkdown.includes("**建议核验:** Check source"));
assert(aiMarkdown.includes("**相关修改:** `change-1`"));
assert(aiMarkdown.indexOf("Primary change") < aiMarkdown.indexOf("Minor wording"), "high-importance changes must be listed first");
assert(aiMarkdown.indexOf("Value changed") < aiMarkdown.indexOf("Wording"), "high-severity risks must be listed first");
assert(aiMarkdown.includes("## 建议版本说明"));
assert(aiMarkdown.endsWith("\n"));
const providerFetch = async (url, options) => {
  providerRequests.push({ url, options });
  if (url.endsWith("/models")) {
    return { ok: true, json: async () => ({ data: [{ id: "deepseek-flash-current" }, { id: "deepseek-chat" }] }) };
  }
  return {
    ok: true,
    json: async () => ({
      model: "deepseek-flash-current",
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(structuredResponse) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    })
  };
};
const provider = new DeepSeekProvider({ apiKey: "provider-secret", model: "deepseek-flash-current", fetchImpl: providerFetch });
assert.deepEqual(await provider.listModels(), ["deepseek-chat", "deepseek-flash-current"]);
const providerResult = await provider.createStructuredSummary({ changes: [{ id: "change-1", type: "modified", oldText: "old", newText: "new" }] });
assert.equal(providerResult.result.keyChanges[0].changeIDs[0], "change-1");
assert.equal(providerRequests[1].options.redirect, "error");
assert.equal(providerRequests[1].options.headers.Authorization, "Bearer provider-secret");
const providerBody = JSON.parse(providerRequests[1].options.body);
assert.equal(providerBody.stream, false);
assert.equal(providerBody.max_tokens, 4096);
assert.equal(providerBody.response_format.type, "json_object");
assert.equal(providerBody.thinking.type, "disabled");

const limitedProvider = new OpenAICompatibleProvider({
  baseURL: "https://example.test/v1",
  apiKey: "key",
  model: "model",
  fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) })
});
await assert.rejects(() => limitedProvider.listModels(), (error) => error.code === "http-429" && error.status === 429);
for (const status of [401, 403, 500, 503]) {
  const failingProvider = new OpenAICompatibleProvider({
    baseURL: "https://example.test/v1",
    apiKey: "key",
    model: "model",
    fetchImpl: async () => ({ ok: false, status, json: async () => ({}) })
  });
  await assert.rejects(() => failingProvider.listModels(), (error) => error.code === `http-${status}` && error.status === status);
}
const invalidJSONProvider = new OpenAICompatibleProvider({
  baseURL: "https://example.test/v1",
  apiKey: "key",
  model: "model",
  fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "not json" } }] }) })
});
await assert.rejects(() => invalidJSONProvider.createStructuredSummary({ changes: [{ id: "change-1" }] }), (error) => error.code === "invalid-json");
const emptyProvider = new OpenAICompatibleProvider({
  baseURL: "https://example.test/v1",
  apiKey: "key",
  model: "model",
  fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "" } }] }) })
});
await assert.rejects(() => emptyProvider.createStructuredSummary({ changes: [{ id: "change-1" }] }), (error) => error.code === "empty-response");
const truncatedProvider = new OpenAICompatibleProvider({
  baseURL: "https://example.test/v1",
  apiKey: "key",
  model: "model",
  fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }) })
});
await assert.rejects(() => truncatedProvider.createStructuredSummary({ changes: [{ id: "change-1" }] }), (error) => error.code === "response-truncated");
const cancellation = new AbortController();
const cancellableProvider = new OpenAICompatibleProvider({
  baseURL: "https://example.test/v1",
  apiKey: "key",
  model: "model",
  fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
  })
});
const cancelledRequest = cancellableProvider.createStructuredSummary({ changes: [{ id: "change-1" }], signal: cancellation.signal });
cancellation.abort();
await assert.rejects(() => cancelledRequest, (error) => error.name === "AbortError");

let clearedTimer = null;
const privilegedTimers = resolveAITimerAPI({
  setTimeout: () => { throw new Error("unpaired global timer must not be used"); },
  ChromeUtils: {
    importESModule: (resource) => {
      assert.equal(resource, "resource://gre/modules/Timer.sys.mjs");
      return {
        setTimeout: (_callback, _delay) => 73,
        clearTimeout: (timer) => { clearedTimer = timer; }
      };
    }
  }
});
const privilegedTimerProvider = new OpenAICompatibleProvider({
  baseURL: "https://example.test/v1",
  apiKey: "key",
  model: "model",
  timerAPI: privilegedTimers,
  fetchImpl: async () => ({ ok: true, json: async () => ({ data: [] }) })
});
await privilegedTimerProvider.listModels();
assert.equal(clearedTimer, 73);
assert.throws(() => resolveAITimerAPI({}), (error) => error.code === "timer-unavailable");

let hiddenControllerCount = 0;
class HiddenAbortController {
  constructor() {
    hiddenControllerCount += 1;
    this.signal = { aborted: false, reason: undefined };
  }

  abort(reason) {
    this.signal.aborted = true;
    this.signal.reason = reason;
  }
}
class HiddenDOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name;
  }
}
const hiddenAbortAPI = resolveAIAbortAPI({
  Services: {
    appShell: {
      hiddenDOMWindow: {
        AbortController: HiddenAbortController,
        DOMException: HiddenDOMException
      }
    }
  }
});
const hiddenController = hiddenAbortAPI.createController();
const hiddenAbortError = hiddenAbortAPI.createAbortError("Stopped");
assert.equal(hiddenControllerCount, 1, "the Mozilla hidden DOM window must provide cancellation when the module global cannot");
assert.equal(hiddenAbortError.name, "AbortError");
hiddenController.abort(hiddenAbortError);
assert.equal(hiddenController.signal.reason, hiddenAbortError);
assert.equal(hiddenAbortAPI.any, null);

let zoteroHTTPRequest = null;
const zoteroFetch = resolveAIFetchImpl({
  Zotero: {
    HTTP: {
      async request(method, url, options) {
        zoteroHTTPRequest = { method, url, options };
        options.cancellerReceiver(() => {});
        return { status: 200, responseText: JSON.stringify({ data: [{ id: "zotero-http-model" }] }) };
      }
    }
  }
});
const zoteroHTTPResponse = await zoteroFetch("https://example.test/v1/models", {
  method: "GET",
  redirect: "error",
  headers: { Authorization: "Bearer secret" }
});
assert.equal(zoteroHTTPResponse.ok, true);
assert.deepEqual(await zoteroHTTPResponse.json(), { data: [{ id: "zotero-http-model" }] });
assert.equal(zoteroHTTPRequest.method, "GET");
assert.equal(zoteroHTTPRequest.options.followRedirects, false);
assert.equal(zoteroHTTPRequest.options.successCodes, false);
assert.equal(zoteroHTTPRequest.options.timeout, 0);
assert.deepEqual(zoteroHTTPRequest.options.errorDelayIntervals, []);
assert.equal(zoteroHTTPRequest.options.errorDelayMax, 0);
assert.equal(zoteroHTTPRequest.options.debug, false);
assert.equal(zoteroHTTPRequest.options.logBodyLength, 0);

let zoteroHTTPCancelled = false;
const cancellableZoteroFetch = resolveAIFetchImpl({
  Zotero: {
    HTTP: {
      request(_method, _url, options) {
        return new Promise((_resolve, reject) => {
          options.cancellerReceiver(() => {
            zoteroHTTPCancelled = true;
            reject(new Error("Zotero HTTP request cancelled"));
          });
        });
      }
    }
  }
});
const zoteroHTTPCancellation = new AbortController();
const cancelledZoteroRequest = cancellableZoteroFetch("https://example.test/v1/models", {
  signal: zoteroHTTPCancellation.signal
});
zoteroHTTPCancellation.abort();
await assert.rejects(() => cancelledZoteroRequest, (error) => error.name === "AbortError");
assert.equal(zoteroHTTPCancelled, true);

const credentialPlatform = new StorePlatform();
const credentials = new AICredentialStore(credentialPlatform);
assert.equal(createAICredentialID("deepseek", "https://ignored.example"), "deepseek");
assert.notEqual(
  createAICredentialID("openai-compatible", "https://one.example/v1"),
  createAICredentialID("openai-compatible", "https://two.example/v1")
);
assert.deepEqual(credentials.capability(), { supported: true, persistent: true, reason: "" });
credentialPlatform.Zotero.Prefs.set("extensions.zotero.zoterogpt.secretKey", "foreign-plugin-secret");
assert.equal(await credentials.get("deepseek"), "");
await credentials.set("deepseek", "plain-secret-in-zotero-preferences");
assert.equal(credentialPlatform.Zotero.Prefs.get(PREFS.secretKey), "plain-secret-in-zotero-preferences");
assert.equal(await credentials.get("deepseek"), "plain-secret-in-zotero-preferences");
const reopenedCredentials = new AICredentialStore(credentialPlatform);
assert.equal(await reopenedCredentials.get("deepseek"), "plain-secret-in-zotero-preferences");
assert.equal(await reopenedCredentials.get(createAICredentialID("openai-compatible", "https://one.example/v1")), "plain-secret-in-zotero-preferences");
await credentials.forget("deepseek");
assert.equal(await credentials.get("deepseek"), "");
assert.equal(credentialPlatform.Zotero.Prefs.get(PREFS.secretKey), "");
assert.equal(credentialPlatform.Zotero.Prefs.get("extensions.zotero.zoterogpt.secretKey"), "foreign-plugin-secret");
assert.throws(() => createAICredentialID("__proto__", "https://example.test/v1"), /Invalid AI provider/);
credentials.clearSession();
const zoteroEightPlatform = new StorePlatform();
zoteroEightPlatform.Zotero.version = "8.0.1";
const zoteroEightCredentials = new AICredentialStore(zoteroEightPlatform);
assert.equal(zoteroEightCredentials.isSupportedVersion(), false);
await assert.rejects(() => zoteroEightCredentials.set("deepseek", "not-supported"), /Zotero 9/);
const missingPreferencesPlatform = new StorePlatform();
delete missingPreferencesPlatform.Zotero.Prefs;
const missingPreferencesCredentials = new AICredentialStore(missingPreferencesPlatform);
assert.deepEqual(missingPreferencesCredentials.capability(), { supported: true, persistent: false, reason: "zotero-preferences" });
await assert.rejects(() => missingPreferencesCredentials.set("deepseek", "cannot-save"), /preferences are unavailable/);

const storagePlatform = new StorePlatform();
const insightStore = new AIInsightStore(storagePlatform, { maxEntries: 2, maxBytes: 1024 * 1024 });
const cacheKeyA = await insightStore.createKey({ model: "a", ids: ["1"] });
const cacheKeyB = await insightStore.createKey({ model: "b", ids: ["2"] });
const cacheKeyC = await insightStore.createKey({ model: "c", ids: ["3"] });
assert.equal(normalizeCacheKey(cacheKeyA), cacheKeyA);
assert.throws(() => normalizeCacheKey("../escape"), /Invalid AI insight cache key/);
for (const [key, versionKey] of [[cacheKeyA, "v1"], [cacheKeyB, "v1"], [cacheKeyC, "v2"]]) {
  await insightStore.write("repo", key, { provider: "deepseek", model: "model", versionKey, result: { summary: key } });
}
assert.equal((await storagePlatform.listDirectory(insightStore.directory("repo"))).length, 2);
const remaining = await insightStore.read("repo", cacheKeyC);
assert.equal(remaining.result.summary, cacheKeyC);
assert.equal(await insightStore.clear("repo", { versionKey: "v2" }), 1);

const reviewStore = new ReviewStateStore(storagePlatform);
await Promise.all([
  reviewStore.update("repo", "version-a", "change-1", { status: "confirmed", note: "checked" }),
  reviewStore.update("repo", "version-a", "change-2", { status: "action-required", bookmarked: true })
]);
const reviewStates = await reviewStore.load("repo", "version-a", ["change-1", "change-2", "change-3"]);
assert.equal(reviewStates["change-1"].status, "confirmed");
assert.equal(reviewStates["change-2"].bookmarked, true);
assert.equal(reviewStates["change-3"].status, "unreviewed");
await assert.rejects(() => reviewStore.update("repo", "../escape", "change", {}), /Invalid/);

const aiPlatform = new StorePlatform();
aiPlatform.setPref(PREFS.aiEnabled, true);
aiPlatform.setPref(PREFS.aiProvider, "deepseek");
aiPlatform.setPref(PREFS.aiModel, "deepseek-flash-current");
const selectedChanges = [
  { id: "change-1", type: "modified", oldText: "selected old", newText: "selected new", groupID: "body" },
  { id: "change-2", type: "added", oldText: "", newText: "unselected private text", groupID: "body" }
];
const aiRequests = [];
const aiFetch = async (url, options) => {
  aiRequests.push({ url, options });
  const body = JSON.parse(options.body);
  assert(!options.body.includes("unselected private text"));
  assert(!options.body.includes("C:/private/paper.docx"));
  assert(!options.body.includes("git-hash-secret"));
  assert(!options.body.includes("zotero-item-secret"));
  const sent = JSON.parse(body.messages[1].content.split("\n").slice(1).join("\n"));
  assert.deepEqual(sent.map((change) => change.id), ["change-1"]);
  return {
    ok: true,
    json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(structuredResponse) } }] })
  };
};
const mockVersion = { id: "version-1", commitHash: "git-hash-secret", diffRef: { path: ".git4zotero/diffs/versions/git-hash-secret/index.json" } };
const mockContext = { repoPath: "repo", metadata: { itemID: "zotero-item-secret" }, version: mockVersion };
const mockVersionService = {
  async resolveDiffContext() { return mockContext; },
  async loadVersionDiffChanges(_item, _version, { changeIDs }) {
    return changeIDs.map((id) => selectedChanges.find((change) => change.id === id)).filter(Boolean);
  }
};
const serviceInsightStore = new AIInsightStore(aiPlatform);
const aiService = new AIReviewService({
  platform: aiPlatform,
  versionService: mockVersionService,
  credentialStore: { isSupportedVersion: () => true, get: async () => "api-secret", clearSession() {} },
  insightStore: serviceInsightStore,
  fetchImpl: aiFetch
});
assert.equal(typeof aiService.createAbortController().abort, "function");
const preview = await aiService.preview({}, mockVersion, { changeIDs: ["change-1"] });
assert(preview.previewText.includes("selected old"));
assert(!preview.previewText.includes("unselected private text"));
assert.equal(aiRequests.length, 0, "preflight preview must not perform a provider request");
const generated = await aiService.generateSummary({}, mockVersion, { changeIDs: ["change-1"] });
assert.equal(generated.cached, false);
assert.equal(aiRequests.length, 1);
const cached = await aiService.generateSummary({}, mockVersion, { changeIDs: ["change-1"] });
assert.equal(cached.cached, true);
assert.equal(aiRequests.length, 1, "cached summaries must not be billed twice");
const cacheDiskText = [...aiPlatform.files.values()].join("\n");
assert(!cacheDiskText.includes("selected old"));
assert(!cacheDiskText.includes("api-secret"));
await assert.rejects(() => aiService.preview({}, mockVersion, { changeIDs: ["missing"] }), /no longer available/);
aiService.shutdown();

const unsavedService = new AIReviewService({
  platform: aiPlatform,
  versionService: mockVersionService,
  credentialStore: { isSupportedVersion: () => true, get: async () => "api-secret", clearSession() {} },
  insightStore: {
    createKey: async () => "a".repeat(64),
    read: async () => null,
    write: async () => { throw new Error("disk read-only"); }
  },
  fetchImpl: aiFetch
});
const unsaved = await unsavedService.generateSummary({}, mockVersion, { changeIDs: ["change-1"] });
assert.equal(unsaved.cacheStatus, "not-saved", "a paid response must remain visible when derived-cache persistence fails");
unsavedService.shutdown();

let releaseRepeatedRequest;
let markRepeatedRequestStarted;
const repeatedRequestStarted = new Promise((resolve) => { markRepeatedRequestStarted = resolve; });
const repeatedFetch = async () => {
  markRepeatedRequestStarted();
  await new Promise((resolve) => { releaseRepeatedRequest = resolve; });
  return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(structuredResponse) } }] }) };
};
const repeatedService = new AIReviewService({
  platform: aiPlatform,
  versionService: mockVersionService,
  credentialStore: { isSupportedVersion: () => true, get: async () => "api-secret", clearSession() {} },
  insightStore: {
    createKey: async () => "b".repeat(64),
    read: async () => null,
    write: async (_repo, _key, record) => record
  },
  fetchImpl: repeatedFetch
});
const firstRepeated = repeatedService.generateSummary({}, mockVersion, { changeIDs: ["change-1"] });
await repeatedRequestStarted;
await assert.rejects(
  () => repeatedService.generateSummary({}, mockVersion, { changeIDs: ["change-1"] }),
  /already in progress/
);
releaseRepeatedRequest();
await firstRepeated;
repeatedService.shutdown();

const comparisonPlatform = new StorePlatform();
const comparisonStore = new DiffStore(comparisonPlatform);
const oldVersion = {
  id: "old",
  commitHash: "oldhash",
  shortHash: "oldhash",
  note: "Old",
  contentHash: "old-content",
  contentSnapshot: { paragraphs: ["Old paragraph"], paragraphDetails: [{ normalizedText: "Old paragraph", role: "core", source: "document", groupID: "body", groupLabel: "Body" }] }
};
const newVersion = {
  id: "new",
  commitHash: "newhash",
  shortHash: "newhash",
  note: "New",
  contentHash: "new-content",
  contentSnapshot: { paragraphs: ["New paragraph"], paragraphDetails: [{ normalizedText: "New paragraph", role: "core", source: "document", groupID: "body", groupLabel: "Body" }] }
};
let currentComparedAgainst = null;
const comparisonService = new VersionService({
  platform: comparisonPlatform,
  attachmentFinder: {},
  gitBackend: {},
  metadataStore: {},
  pluginVersion: "0.7.0",
  diffStore: comparisonStore,
  contentAnalyzer: {
    async analyze(_path, previous) {
      currentComparedAgainst = previous;
      return {
        changeSummary: { changeType: "content", addedParagraphs: 1, deletedParagraphs: 0, modifiedParagraphs: 0, movedParagraphs: 0, wordDelta: 2, paragraphChanges: [] },
        completeDiff: { quality: "exact", counts: { added: 1, deleted: 0, modified: 0, moved: 0 }, groups: [{ id: "body", label: "Body", changes: [{ id: "current-1", type: "added", oldText: "", newText: "Current paragraph" }] }] }
      };
    }
  }
});
comparisonService.requireEnabledAttachment = async () => ({
  attachment: { filePath: "C:/private/paper.docx", fileName: "paper.docx" },
  repoPath: "repo-compare",
  metadata: { enabled: true, versions: [newVersion, oldVersion] }
});
comparisonService.loadVersionHistory = async () => [newVersion, oldVersion];
const candidates = await comparisonService.getComparisonCandidates({});
assert.deepEqual(candidates.candidates.map((entry) => entry.id), ["current", "newhash", "oldhash", "empty"]);
const historicalComparison = await comparisonService.compareVersions({}, "oldhash", "newhash");
assert.equal(historicalComparison.comparison, true);
assert.equal((await comparisonStore.readIndex("repo-compare", historicalComparison.diffRef)).scope, "comparison");
const currentComparison = await comparisonService.compareVersions({}, "newhash", "current");
assert.equal(currentComparison.targetVersionID, "current");
assert.equal(currentComparedAgainst, newVersion);
await assert.rejects(() => comparisonService.compareVersions({}, "newhash", "newhash"), /same|相同/i);

console.log("AI 与跨版本审阅测试通过：隐私预览、请求契约、Zotero preferences 密钥保存、派生缓存、审阅状态和任意版本比较均已验证。");
