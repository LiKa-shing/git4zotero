import { PREFS } from "./constants.mjs";
import {
  AI_PROMPT_VERSION,
  DeepSeekProvider,
  OpenAICompatibleProvider,
  buildAIChangeChunks,
  mergeAIReviewResults,
  normalizeChangeForAI,
  resolveAIAbortAPI,
  resolveAIFetchImpl,
  validateAIEndpoint
} from "./ai-provider.mjs";
import { AICredentialStore, createAICredentialID, normalizeProviderID } from "./ai-credential-store.mjs";
import { AIInsightStore } from "./ai-insight-store.mjs";

export class AIReviewService {
  constructor({
    platform,
    versionService,
    credentialStore = null,
    insightStore = null,
    fetchImpl = null,
    abortAPI = null
  }) {
    this.platform = platform;
    this.versionService = versionService;
    this.credentialStore = credentialStore ?? new AICredentialStore(platform);
    this.insightStore = insightStore ?? new AIInsightStore(platform);
    this.fetchImpl = fetchImpl;
    this.abortAPI = abortAPI;
    this.controllers = new Set();
    this.inFlightKeys = new Set();
  }

  isAvailable() {
    return this.credentialStore.isSupportedVersion();
  }

  getSettings(overrides = {}) {
    const provider = normalizeProviderID(overrides.provider || this.platform.getPref(PREFS.aiProvider, "deepseek") || "deepseek");
    const baseURL = provider === "deepseek"
      ? "https://api.deepseek.com"
      : (overrides.baseURL || this.platform.getPref(PREFS.aiBaseURL, ""));
    return {
      enabled: overrides.enabled ?? this.platform.getPref(PREFS.aiEnabled, false) === true,
      provider,
      baseURL: validateAIEndpoint(baseURL),
      model: String(overrides.model || this.platform.getPref(PREFS.aiModel, "")).trim(),
      language: String(overrides.language || "zh-CN")
    };
  }

  async listModels(overrides = {}) {
    const settings = this.getSettings({ ...overrides, enabled: true });
    const provider = await this.createProvider(settings);
    return provider.listModels({ signal: overrides.signal });
  }

  async testConnection(overrides = {}) {
    const models = await this.listModels(overrides);
    return { ok: true, models };
  }

  async preview(item, version, options = {}) {
    const prepared = await this.prepare(item, version, options);
    return {
      provider: prepared.settings.provider,
      endpointOrigin: new URL(prepared.settings.baseURL).origin,
      model: prepared.settings.model,
      changeCount: prepared.changes.length,
      characterCount: prepared.chunks.reduce((total, chunk) => total + [...JSON.stringify(chunk)].length, 0),
      batchCount: prepared.chunks.length,
      previewText: prepared.chunks
        .map((chunk, index) => `Batch ${index + 1}/${prepared.chunks.length}\n${JSON.stringify(chunk, null, 2)}`)
        .join("\n\n")
    };
  }

  async generateSummary(item, version, options = {}) {
    const abortAPI = this.getAbortAPI();
    const controller = abortAPI.createController();
    const signal = combineAIReviewSignals(controller.signal, options.signal, abortAPI);
    this.controllers.add(controller);
    try {
      const prepared = await this.prepare(item, version, { ...options, signal });
      const cacheDescriptor = {
        provider: prepared.settings.provider,
        endpoint: prepared.settings.baseURL,
        endpointOrigin: new URL(prepared.settings.baseURL).origin,
        model: prepared.settings.model,
        promptVersion: AI_PROMPT_VERSION,
        diffHash: prepared.diffHash,
        changeIDs: prepared.changeIDs,
        language: prepared.settings.language
      };
      const cacheKey = await this.insightStore.createKey(cacheDescriptor);
      if (options.useCache !== false) {
        const cached = await this.insightStore.read(prepared.context.repoPath, cacheKey);
        if (cached) {
          return { ...cached, cacheKey, cached: true };
        }
      }

      if (this.inFlightKeys.has(cacheKey)) {
        throw new Error("An AI summary for the same selected changes is already in progress.");
      }
      this.inFlightKeys.add(cacheKey);
      try {
        const provider = await this.createProvider(prepared.settings);
        const responses = [];
        const usages = [];
        let responseModel = prepared.settings.model;
        for (const chunk of prepared.chunks) {
          signal?.throwIfAborted?.();
          const response = await provider.createStructuredSummary({
            changes: chunk,
            language: prepared.settings.language,
            signal
          });
          responses.push(response.result);
          usages.push(response.usage);
          responseModel = response.responseModel || responseModel;
        }
        const result = mergeAIReviewResults(responses);
        const insight = {
          provider: prepared.settings.provider,
          endpointOrigin: new URL(prepared.settings.baseURL).origin,
          model: responseModel,
          promptVersion: AI_PROMPT_VERSION,
          versionKey: prepared.versionKey,
          diffHash: prepared.diffHash,
          changeIDs: prepared.changeIDs,
          language: prepared.settings.language,
          usage: mergeUsage(usages),
          result
        };
        try {
          const record = await this.insightStore.write(prepared.context.repoPath, cacheKey, insight);
          return { ...record, cacheKey, cached: false };
        }
        catch (error) {
          this.platform.Zotero?.debug?.(`git4zotero: AI insight cache write failed: ${error?.stack || error}`);
          return {
            ...insight,
            createdAt: new Date().toISOString(),
            cacheKey,
            cached: false,
            cacheStatus: "not-saved"
          };
        }
      }
      finally {
        this.inFlightKeys.delete(cacheKey);
      }
    }
    finally {
      this.controllers.delete(controller);
    }
  }

  async clearCache(item, version = null) {
    const context = version
      ? await this.versionService.resolveDiffContext(item, version)
      : item;
    return this.insightStore.clear(context.repoPath, version ? { versionKey: createAIVersionKey(context.version) } : {});
  }

  async prepare(item, version, options) {
    if (!this.isAvailable()) {
      throw new Error("AI review requires Zotero 9 or later.");
    }
    const settings = this.getSettings(options);
    if (!settings.enabled) {
      throw new Error("AI review is disabled in git4zotero settings.");
    }
    if (!settings.model) {
      throw new Error("Select an AI model in git4zotero settings.");
    }
    const changeIDs = [...new Set((options.changeIDs ?? []).map(String).filter(Boolean))];
    const context = await this.versionService.resolveDiffContext(item, version);
    const changes = await this.versionService.loadVersionDiffChanges(
      { repoPath: context.repoPath, metadata: context.metadata },
      context.version,
      { changeIDs }
    );
    if (changes.length !== changeIDs.length) {
      throw new Error("One or more selected changes are no longer available. Refresh the comparison and try again.");
    }
    const chunks = buildAIChangeChunks(changes);
    const canonicalChanges = changes.map(normalizeChangeForAI)
      .sort((left, right) => left.id.localeCompare(right.id));
    const diffHash = await this.platform.hashString(JSON.stringify(canonicalChanges));
    return {
      settings,
      context,
      changes,
      chunks,
      diffHash,
      changeIDs: [...changeIDs].sort(),
      versionKey: createAIVersionKey(context.version)
    };
  }

  async createProvider(settings) {
    const apiKey = await this.credentialStore.get(createAICredentialID(settings.provider, settings.baseURL));
    const common = {
      apiKey,
      model: settings.model,
      fetchImpl: this.getFetchImpl(),
      abortAPI: this.getAbortAPI()
    };
    return settings.provider === "deepseek"
      ? new DeepSeekProvider(common)
      : new OpenAICompatibleProvider({ ...common, baseURL: settings.baseURL });
  }

  shutdown() {
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
    this.inFlightKeys.clear();
    this.credentialStore.clearSession();
  }

  getAbortAPI() {
    this.abortAPI ??= resolveAIAbortAPI(this.platform);
    return this.abortAPI;
  }

  createAbortController() {
    return this.getAbortAPI().createController();
  }

  formatMarkdown(record, labels = {}) {
    return buildAIReviewMarkdown(record, labels);
  }

  getFetchImpl() {
    this.fetchImpl ??= resolveAIFetchImpl(this.platform);
    return this.fetchImpl;
  }
}

export function createAIVersionKey(version) {
  return String(version?.commitHash || version?.id || version?.diffRef?.path || "current");
}

export function buildAIReviewMarkdown(record, labels = {}) {
  const result = record?.result || {};
  const text = (key, fallback) => String(labels?.[key] || fallback);
  const level = (value) => text(`aiLevel${capitalize(value)}`, capitalize(value || "medium"));
  const references = (changeIDs) => {
    const ids = [...new Set((changeIDs || []).map(String).filter(Boolean))];
    return ids.length
      ? `**${text("aiReviewReferences", "Related changes")}:** ${ids.map((id) => `\`${escapeMarkdownCode(id)}\``).join(", ")}`
      : "";
  };
  const source = record?.cached
    ? text("aiReviewCached", "Cached result")
    : text("aiReviewFresh", "New result");
  const generatedAt = String(record?.createdAt || "");
  const meta = formatAIText(text("aiReviewReportMeta", "{provider} · {model} · {count} selected changes · {time} · {source}"), {
    provider: record?.provider || "—",
    model: record?.model || "—",
    count: Array.isArray(record?.changeIDs) ? record.changeIDs.length : 0,
    time: generatedAt || "—",
    source
  });
  const lines = [
    `# ${text("aiReviewReportTitle", "AI Review Report")}`,
    "",
    `> ${text("aiReviewDisclaimer", "AI-generated. Verify against the exact diff.")}`,
    "",
    meta
  ];

  if (result.summary) {
    lines.push("", `## ${text("aiReviewSummary", "Overall Summary")}`, "", String(result.summary));
  }
  if (result.sectionSummaries?.length) {
    lines.push("", `## ${text("aiReviewSectionSummaries", "Section Summaries")}`);
    for (const entry of result.sectionSummaries) {
      lines.push("", `### ${entry.groupID || "—"}`, "", String(entry.summary || ""));
      const refs = references(entry.changeIDs);
      if (refs) lines.push("", refs);
    }
  }
  if (result.keyChanges?.length) {
    lines.push("", `## ${text("aiReviewKeyChanges", "Key Changes")}`);
    for (const entry of sortAIEntries(result.keyChanges, "importance")) {
      lines.push("", `- **${level(entry.importance)}** — ${String(entry.description || "")}`);
      const refs = references(entry.changeIDs);
      if (refs) lines.push(`  ${refs}`);
    }
  }

  lines.push("", `## ${text("aiReviewRisks", "Risks and Verification")}`);
  if (result.risks?.length) {
    for (const risk of sortAIEntries(result.risks, "severity")) {
      lines.push("", `### ${level(risk.severity)}${risk.category ? ` · ${risk.category}` : ""}`, "", String(risk.description || ""));
      if (risk.verification) {
        lines.push("", `**${text("aiReviewVerification", "Verification")}:** ${risk.verification}`);
      }
      const refs = references(risk.changeIDs);
      if (refs) lines.push("", refs);
    }
  }
  else {
    lines.push("", text("aiReviewNoRisks", "The model listed no separate risks for this selection. Manual verification is still required."));
  }

  if (result.suggestedVersionNote) {
    lines.push("", `## ${text("aiReviewSuggestedNote", "Suggested Version Note")}`, "");
    lines.push(...String(result.suggestedVersionNote).split(/\r?\n/).map((line) => `> ${line}`));
  }
  if (result.limitations?.length) {
    lines.push("", `## ${text("aiReviewLimitations", "Limitations")}`);
    for (const limitation of result.limitations) lines.push(`- ${limitation}`);
  }
  return `${lines.join("\n").trim()}\n`;
}

function sortAIEntries(entries, field) {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...(entries || [])].sort((left, right) => (rank[left?.[field]] ?? 1) - (rank[right?.[field]] ?? 1));
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}

function escapeMarkdownCode(value) {
  return String(value || "").replace(/`/g, "ˋ");
}

function formatAIText(template, values) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => values[key] ?? "");
}

function mergeUsage(usages) {
  return usages.reduce((total, usage) => ({
    promptTokens: total.promptTokens + (Number(usage?.promptTokens) || 0),
    completionTokens: total.completionTokens + (Number(usage?.completionTokens) || 0),
    totalTokens: total.totalTokens + (Number(usage?.totalTokens) || 0)
  }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
}

function combineAIReviewSignals(primary, secondary, abortAPI) {
  if (!secondary) return primary;
  if (typeof abortAPI.any === "function") return abortAPI.any([primary, secondary]);
  const controller = abortAPI.createController();
  const abort = (signal) => controller.abort(signal?.reason);
  if (primary.aborted) abort(primary);
  else primary.addEventListener("abort", () => abort(primary), { once: true });
  if (secondary.aborted) abort(secondary);
  else secondary.addEventListener("abort", () => abort(secondary), { once: true });
  return controller.signal;
}
