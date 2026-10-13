import { getExtension } from "./attachments.mjs";
import { DocxReader } from "./docx-reader.mjs";
import { UI_TEXT } from "./constants.mjs";
import { formatText } from "./localization.mjs";
import { alignParagraphs, createTokenDiff } from "./scalable-diff.mjs";

const MAX_DISPLAY_CHANGES = 3;
const MAX_CHANGE_TEXT_LENGTH = 240;
const ANALYSIS_CACHE_TTL = 5 * 60 * 1000;
const ANALYSIS_CACHE_LIMIT = 4;
const SOURCE_LABELS = Object.freeze({
  document: "sourceDocument",
  footnotes: "sourceFootnotes",
  endnotes: "sourceEndnotes",
  comments: "sourceComments",
  header: "sourceHeader",
  footer: "sourceFooter"
});

export class ContentAnalyzer {
  constructor({ platform, docxReader = null }) {
    this.platform = platform;
    this.docxReader = docxReader ?? new DocxReader(platform);
    this.cache = new Map();
    this.controllers = new Set();
  }

  async analyze(filePath, previousVersion = null, options = {}) {
    const controller = createAnalysisController();
    const signal = combineSignals(controller.signal, options.signal);
    this.controllers.add(controller);
    try {
      return await this.analyzeFile(filePath, previousVersion, { ...options, signal });
    }
    finally {
      this.controllers.delete(controller);
    }
  }

  async analyzeFile(filePath, previousVersion = null, options = {}) {
    const extension = getExtension(filePath);
    const fileBytes = await this.platform.readFileBytes(filePath);
    const fileHash = await this.platform.hashBytes(fileBytes);
    const previousFileHash = previousVersion?.fileHash ?? null;
    const fileChanged = previousFileHash ? previousFileHash !== fileHash : true;
    const previousIdentity = previousVersion?.id || previousVersion?.commitHash || previousVersion?.contentHash || "first";
    const cacheKey = `${options.repoPath || filePath}:${fileHash}:${previousIdentity}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return { ...cached, fileBytes };
    }

    if (extension === ".docx") {
      try {
        options.onProgress?.({ phase: "parse", completed: 0, total: 1 });
        const snapshot = await this.docxReader.readBytes(fileBytes);
        checkAnalysisCancelled(options.signal);
        await this.yieldParagraphChunks(snapshot.comparisonParagraphs?.length ?? snapshot.paragraphCount, options);
        const contentHash = await this.platform.hashString(snapshot.comparisonNormalizedText ?? snapshot.normalizedText);
        const contentSummary = createContentSummary(snapshot, false);
        const changeSummary = summarizeDocxChange({
          current: snapshot,
          currentContentHash: contentHash,
          previousVersion,
          fileChanged,
          signal: options.signal,
          onProgress: options.onProgress
        });
        const result = {
          fileHash,
          fileSize: fileBytes.byteLength,
          contentHash,
          contentSnapshot: snapshot,
          contentSummary,
          changeSummary,
          completeDiff: createCompleteDiff(changeSummary, previousVersion),
          shouldCreateVersion: changeSummary.changeType !== "no-change"
        };
        this.setCached(cacheKey, result);
        options.onProgress?.({ phase: "complete", completed: 1, total: 1 });
        return { ...result, fileBytes };
      }
      catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }
        const readError = normalizeErrorMessage(error);
        const changeSummary = summarizeFileLevelChange({
          extension,
          previousVersion,
          fileChanged,
          readError
        });

        const result = {
          fileHash,
          fileSize: fileBytes.byteLength,
          contentHash: null,
          contentSnapshot: null,
          contentSummary: createFileOnlySummary(extension, {
            readError,
            readErrorCode: "docx-read-failed"
          }),
          changeSummary,
          completeDiff: null,
          shouldCreateVersion: changeSummary.changeType !== "no-change"
        };
        this.setCached(cacheKey, result);
        return { ...result, fileBytes };
      }
    }

    const changeSummary = summarizeFileLevelChange({
      extension,
      previousVersion,
      fileChanged
    });

    const result = {
      fileHash,
      fileSize: fileBytes.byteLength,
      contentHash: null,
      contentSnapshot: null,
      contentSummary: createFileOnlySummary(extension),
      changeSummary,
      completeDiff: null,
      shouldCreateVersion: changeSummary.changeType !== "no-change"
    };
    this.setCached(cacheKey, result);
    return { ...result, fileBytes };
  }

  invalidate(repoPath = "") {
    for (const key of this.cache.keys()) {
      if (!repoPath || key.startsWith(`${repoPath}:`)) {
        this.cache.delete(key);
      }
    }
  }

  shutdown() {
    for (const controller of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
    this.cache.clear();
  }

  getCached(key) {
    const cached = this.cache.get(key);
    if (!cached || Date.now() - cached.cachedAt > ANALYSIS_CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, cached);
    return cached.value;
  }

  setCached(key, value) {
    this.cache.delete(key);
    this.cache.set(key, { cachedAt: Date.now(), value });
    while (this.cache.size > ANALYSIS_CACHE_LIMIT) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async yieldParagraphChunks(paragraphCount, options = {}) {
    for (let completed = 200; completed < paragraphCount; completed += 200) {
      checkAnalysisCancelled(options.signal);
      options.onProgress?.({ phase: "prepare", completed, total: paragraphCount });
      if (this.platform.Zotero?.Promise?.delay) {
        await this.platform.Zotero.Promise.delay(0);
      }
      else {
        await Promise.resolve();
      }
    }
  }
}

export function summarizeDocxChange({ current, currentContentHash, previousVersion, fileChanged, signal = null, onProgress = null }) {
  if (!previousVersion) {
    const paragraphChanges = createInitialParagraphChanges(current);
    const displayChanges = paragraphChanges.slice(0, MAX_DISPLAY_CHANGES);
    const changeGroups = createChangeGroups(paragraphChanges);
    return {
      changeType: "first-version",
      summary: formatText("firstDocxSummary"),
      addedParagraphs: paragraphChanges.length,
      deletedParagraphs: 0,
      modifiedParagraphs: 0,
      movedParagraphs: 0,
      wordDelta: current.wordCount,
      paragraphChanges,
      displayChanges,
      changeGroups,
      groupedChangeCount: changeGroups.length,
      locationSummary: formatLocationSummary(changeGroups),
      totalParagraphChanges: paragraphChanges.length,
      omittedChanges: Math.max(0, paragraphChanges.length - displayChanges.length),
      quality: "exact",
      fileChanged,
      contentChanged: true
    };
  }

  const previousSummary = previousVersion.contentSummary;
  const previousSnapshot = {
    paragraphs: previousVersion.contentSnapshot?.paragraphs ?? [],
    comparisonParagraphs: previousVersion.contentSnapshot?.comparisonParagraphs ?? previousVersion.contentSnapshot?.paragraphs ?? [],
    paragraphDetails: previousVersion.contentSnapshot?.paragraphDetails ?? null,
    paragraphCount: previousSummary?.paragraphCount ?? 0,
    wordCount: previousSummary?.wordCount ?? 0
  };
  const contentChanged = previousVersion.contentHash !== currentContentHash;

  if (!fileChanged) {
    return {
      changeType: "no-change",
      summary: formatText("noChanges"),
      addedParagraphs: 0,
      deletedParagraphs: 0,
      modifiedParagraphs: 0,
      movedParagraphs: 0,
      wordDelta: 0,
      paragraphChanges: [],
      displayChanges: [],
      changeGroups: [],
      groupedChangeCount: 0,
      locationSummary: "",
      totalParagraphChanges: 0,
      omittedChanges: 0,
      quality: "exact",
      fileChanged: false,
      contentChanged: false
    };
  }

  if (!contentChanged) {
    return {
      changeType: "file-only",
      summary: formatText("fileOnlyFormattingSummary"),
      addedParagraphs: 0,
      deletedParagraphs: 0,
      modifiedParagraphs: 0,
      movedParagraphs: 0,
      wordDelta: 0,
      paragraphChanges: [],
      displayChanges: [],
      changeGroups: [],
      groupedChangeCount: 0,
      locationSummary: "",
      totalParagraphChanges: 0,
      omittedChanges: 0,
      quality: "exact",
      fileChanged: true,
      contentChanged: false
    };
  }

  const paragraphDiff = diffParagraphs(
    getComparisonParagraphs(previousSnapshot),
    getComparisonParagraphs(current),
    createParagraphDetails(previousSnapshot),
    createParagraphDetails(current),
    { signal, onProgress }
  );
  const wordDelta = current.wordCount - previousSnapshot.wordCount;
  const totalParagraphChanges = paragraphDiff.paragraphChanges.length;
  const paragraphChanges = paragraphDiff.paragraphChanges;
  const displayChanges = paragraphChanges.slice(0, MAX_DISPLAY_CHANGES);
  const changeGroups = createChangeGroups(paragraphChanges);
  return {
    changeType: "content",
    summary: [
      formatText("docxContentChanged"),
      formatText("addedParagraphs", { count: paragraphDiff.addedParagraphs }),
      formatText("deletedParagraphs", { count: paragraphDiff.deletedParagraphs }),
      formatText("modifiedParagraphs", { count: paragraphDiff.modifiedParagraphs }),
      ...(paragraphDiff.movedParagraphs ? [formatText("movedParagraphs", { count: paragraphDiff.movedParagraphs })] : []),
      formatText("wordDelta", { value: formatSignedNumber(wordDelta) })
    ].join(UI_TEXT.semicolon) + UI_TEXT.fullStop,
    ...paragraphDiff,
    paragraphChanges,
    displayChanges,
    changeGroups,
    groupedChangeCount: changeGroups.length,
    locationSummary: formatLocationSummary(changeGroups),
    totalParagraphChanges,
    omittedChanges: Math.max(0, totalParagraphChanges - displayChanges.length),
    quality: paragraphDiff.quality,
    wordDelta,
    fileChanged: true,
    contentChanged: true
  };
}

export function summarizeFileLevelChange({ extension, previousVersion, fileChanged, readError = "" }) {
  const docxReadFailed = extension === ".docx" && !!readError;
  if (!previousVersion) {
    return {
      changeType: "first-version",
      summary: docxReadFailed
        ? formatText("firstDocxUnreadableSummary")
        : formatText("firstFileLevelSummary", { extension: extension || formatText("thisFormat") }),
      fileChanged: true,
      contentChanged: null,
      readError: readError || null
    };
  }

  if (!fileChanged) {
    return {
      changeType: "no-change",
      summary: formatText("noChanges"),
      fileChanged: false,
      contentChanged: null,
      readError: readError || null
    };
  }

  if (docxReadFailed) {
    return {
      changeType: "file-level",
      summary: formatText("docxReadFailedSummary"),
      fileChanged: true,
      contentChanged: null,
      readError
    };
  }

  if (extension === ".doc") {
    return {
      changeType: "file-level",
      summary: formatText("docFileOnlyTracking"),
      fileChanged: true,
      contentChanged: null,
      fileOnlyReason: "doc-binary"
    };
  }

  return {
    changeType: "file-level",
    summary: formatText("genericFileLevelSummary"),
    fileChanged: true,
    contentChanged: null
  };
}

export function diffParagraphs(oldParagraphs, newParagraphs, oldDetails = [], newDetails = [], options = {}) {
  return diffParagraphsWithDetails(oldParagraphs, newParagraphs, oldDetails, newDetails, options);
}

export function diffParagraphsWithDetails(
  oldParagraphs,
  newParagraphs,
  oldDetails = [],
  newDetails = [],
  options = {}
) {
  const alignment = alignParagraphs(oldParagraphs, newParagraphs, oldDetails, newDetails, options);
  const matches = alignment.alignments;
  let oldCursor = 0;
  let newCursor = 0;
  let addedParagraphs = 0;
  let deletedParagraphs = 0;
  const paragraphChanges = [];

  for (const match of [...matches, { oldIndex: oldParagraphs.length, newIndex: newParagraphs.length }]) {
    const removed = match.oldIndex - oldCursor;
    const added = match.newIndex - newCursor;
    const approximateGap = alignment.approximateRanges?.some((range) => (
      oldCursor >= range.oldStart
      && match.oldIndex <= range.oldEnd
      && newCursor >= range.newStart
      && match.newIndex <= range.newEnd
    ));
    const paired = approximateGap ? 0 : Math.min(removed, added);
    for (let offset = 0; offset < paired; offset += 1) {
      const oldIndex = oldCursor + offset;
      const newIndex = newCursor + offset;
      paragraphChanges.push(createParagraphChange({
        type: "modified",
        oldIndex,
        newIndex,
        oldText: oldParagraphs[oldIndex],
        newText: newParagraphs[newIndex],
        oldDetail: oldDetails[oldIndex],
        newDetail: newDetails[newIndex]
      }));
    }

    for (let offset = paired; offset < removed; offset += 1) {
      const oldIndex = oldCursor + offset;
      paragraphChanges.push(createParagraphChange({
        type: "deleted",
        oldIndex,
        oldText: oldParagraphs[oldIndex],
        oldDetail: oldDetails[oldIndex]
      }));
    }

    for (let offset = paired; offset < added; offset += 1) {
      const newIndex = newCursor + offset;
      paragraphChanges.push(createParagraphChange({
        type: "added",
        newIndex,
        newText: newParagraphs[newIndex],
        newDetail: newDetails[newIndex]
      }));
    }

    if (match.oldIndex < oldParagraphs.length && match.newIndex < newParagraphs.length && !match.equal) {
      paragraphChanges.push(createParagraphChange({
        type: "modified",
        oldIndex: match.oldIndex,
        newIndex: match.newIndex,
        oldText: oldParagraphs[match.oldIndex],
        newText: newParagraphs[match.newIndex],
        oldDetail: oldDetails[match.oldIndex],
        newDetail: newDetails[match.newIndex]
      }));
    }

    oldCursor = match.oldIndex + 1;
    newCursor = match.newIndex + 1;
  }

  const movedChanges = detectMovedParagraphs(paragraphChanges);
  addedParagraphs = movedChanges.filter((change) => change.type === "added").length;
  deletedParagraphs = movedChanges.filter((change) => change.type === "deleted").length;
  const modifiedParagraphs = movedChanges.filter((change) => change.type === "modified").length;
  const movedParagraphs = movedChanges.filter((change) => change.type === "moved").length;
  return {
    addedParagraphs,
    deletedParagraphs,
    modifiedParagraphs,
    movedParagraphs,
    paragraphChanges: movedChanges,
    quality: alignment.quality
  };
}

function createInitialParagraphChanges(snapshot) {
  const details = createParagraphDetails(snapshot);
  return getComparisonParagraphs(snapshot)
    .map((paragraph, index) => createParagraphChange({
      type: "added",
      newIndex: index,
      newText: paragraph,
      newDetail: details[index]
    }));
}

function createParagraphDetails(snapshot) {
  const paragraphs = getComparisonParagraphs(snapshot);
  const details = snapshot?.paragraphDetails?.filter?.((paragraph) => paragraph.role === "core" || paragraph.role === "annotation") ?? [];
  if (details.length === paragraphs.length) {
    return details;
  }
  return paragraphs.map((text, index) => ({
    normalizedText: text,
    source: "document",
    role: "core",
    index
  }));
}

function getComparisonParagraphs(snapshot) {
  return snapshot?.comparisonParagraphs ?? snapshot?.paragraphs ?? [];
}

function createParagraphChange({
  type,
  oldIndex = null,
  newIndex = null,
  oldText = "",
  newText = "",
  oldDetail = null,
  newDetail = null
}) {
  const change = {
    id: "",
    type,
    oldIndex,
    newIndex,
    source: newDetail?.source || oldDetail?.source || "document"
  };
  const detail = newDetail || oldDetail || {};
  change.sourceLabel = detail.sourceLabel || labelSource(change.source);
  change.locationLabel = detail.locationLabel || "";
  change.headingPath = detail.headingPath ?? [];
  change.areaType = detail.areaType || (change.source === "footnotes" ? "footnote" : (change.source === "endnotes" ? "endnote" : "body"));
  change.tableIndex = detail.tableIndex ?? null;
  change.semantics = {
    old: oldDetail?.semantics ?? null,
    new: newDetail?.semantics ?? null
  };
  if (type === "deleted" || type === "modified" || type === "moved") {
    change.oldText = normalizeChangeText(oldText);
  }
  if (type === "added" || type === "modified" || type === "moved") {
    change.newText = normalizeChangeText(newText);
  }
  change.signals = createSemanticSignals(change, oldDetail, newDetail);
  change.noiseLevel = classifyChangeNoise(change);
  change.id = createChangeID(change);
  return change;
}

function createChangeGroups(changes) {
  const groups = [];
  const groupMap = new Map();
  for (const change of changes) {
    const descriptor = describeChangeGroup(change);
    if (!groupMap.has(descriptor.key)) {
      groupMap.set(descriptor.key, {
        key: descriptor.key,
        label: descriptor.label,
        areaType: change.areaType,
        sourceLabel: change.sourceLabel,
        headingPath: change.headingPath ?? [],
        tableIndex: change.tableIndex ?? null,
        addedParagraphs: 0,
        deletedParagraphs: 0,
        modifiedParagraphs: 0,
        movedParagraphs: 0,
        totalChanges: 0,
        changes: []
      });
      groups.push(groupMap.get(descriptor.key));
    }
    const group = groupMap.get(descriptor.key);
    group.totalChanges += 1;
    group.changes.push(change);
    if (change.type === "added") {
      group.addedParagraphs += 1;
    }
    else if (change.type === "deleted") {
      group.deletedParagraphs += 1;
    }
    else if (change.type === "modified") {
      group.modifiedParagraphs += 1;
    }
    else if (change.type === "moved") {
      group.movedParagraphs += 1;
    }
    group.summary = formatGroupSummary(group);
  }
  return groups;
}

function describeChangeGroup(change) {
  const heading = change.headingPath?.filter(Boolean).join(" / ") || "";
  if (change.areaType === "table") {
    const table = change.tableIndex ? formatText("tableWithIndex", { index: change.tableIndex }) : formatText("tableLabel");
    const label = heading ? `${heading} · ${table}` : table;
    return { key: `table:${heading}:${change.tableIndex ?? ""}`, label };
  }
  if (change.areaType === "footnote") {
    return { key: "footnote", label: formatText("sourceFootnotes") };
  }
  if (change.areaType === "endnote") {
    return { key: "endnote", label: formatText("sourceEndnotes") };
  }
  if (change.areaType === "comment") {
    return { key: "comment", label: formatText("sourceComments") };
  }
  if (heading) {
    return { key: `heading:${heading}`, label: heading };
  }
  return { key: "body:untitled", label: formatText("untitledBody") };
}

function formatGroupSummary(group) {
  const parts = [];
  if (group.addedParagraphs) {
    parts.push(formatText("addedParagraphs", { count: group.addedParagraphs }));
  }
  if (group.deletedParagraphs) {
    parts.push(formatText("deletedParagraphs", { count: group.deletedParagraphs }));
  }
  if (group.modifiedParagraphs) {
    parts.push(formatText("modifiedParagraphs", { count: group.modifiedParagraphs }));
  }
  if (group.movedParagraphs) {
    parts.push(formatText("movedParagraphs", { count: group.movedParagraphs }));
  }
  return `${group.label} · ${parts.join(UI_TEXT.listComma) || formatText("changeCount", { count: group.totalChanges })}`;
}

function formatLocationSummary(groups) {
  return groups.map((group) => group.summary).slice(0, 5).join(UI_TEXT.semicolon);
}

function labelSource(source) {
  return formatText(SOURCE_LABELS[source] || "sourceDocument");
}

function truncateChangeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= 240) {
    return text;
  }
  return `${text.slice(0, MAX_CHANGE_TEXT_LENGTH - 1)}…`;
}

function lcsMatches(a, b) {
  return alignParagraphs(a, b).alignments.filter((match) => match.equal);
}

export function diffParagraphTokens(oldText, newText, options = {}) {
  return createTokenDiff(oldText, newText, options);
}

function createCompleteDiff(changeSummary, previousVersion) {
  if (!changeSummary?.totalParagraphChanges) {
    return null;
  }
  return {
    quality: changeSummary.quality === "approximate" ? "approximate" : "exact",
    baseCommitHash: previousVersion?.commitHash ?? null,
    counts: {
      added: changeSummary.addedParagraphs || 0,
      deleted: changeSummary.deletedParagraphs || 0,
      modified: changeSummary.modifiedParagraphs || 0,
      moved: changeSummary.movedParagraphs || 0
    },
    groups: (changeSummary.changeGroups ?? []).map((group, index) => ({
      ...group,
      id: `group-${index + 1}-${simpleTextHash(group.key || group.label || "document")}`
    }))
  };
}

function normalizeChangeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function createSemanticSignals(change, oldDetail, newDetail) {
  const signals = new Set();
  const oldSemantics = oldDetail?.semantics ?? {};
  const newSemantics = newDetail?.semantics ?? {};
  const changedSet = (key) => JSON.stringify(oldSemantics[key] ?? []) !== JSON.stringify(newSemantics[key] ?? []);
  if (changedSet("numbers")) signals.add("numbers");
  if (changedSet("citations") || oldSemantics.zoteroCitation !== newSemantics.zoteroCitation) signals.add("citations");
  if (changedSet("abbreviations")) signals.add("abbreviations");
  if (oldSemantics.caption || newSemantics.caption) signals.add("caption");
  if (oldSemantics.formula || newSemantics.formula) signals.add("formula");
  if (oldSemantics.crossReference || newSemantics.crossReference) signals.add("cross-reference");
  if (oldSemantics.figureReference || newSemantics.figureReference) signals.add("figure-reference");
  if (oldSemantics.trackedInsertion || newSemantics.trackedInsertion || oldSemantics.trackedDeletion || newSemantics.trackedDeletion) {
    signals.add("tracked-revision");
  }
  if (JSON.stringify(oldDetail?.headingPath ?? []) !== JSON.stringify(newDetail?.headingPath ?? [])) signals.add("heading");
  if (change.areaType === "comment") signals.add("comment");
  return [...signals];
}

function classifyChangeNoise(change) {
  if (change.type !== "modified") {
    return "substantive";
  }
  const oldText = String(change.oldText ?? "");
  const newText = String(change.newText ?? "");
  if (oldText.replace(/\s+/g, "") === newText.replace(/\s+/g, "")) {
    return "formatting";
  }
  const stripPunctuation = (value) => value.normalize("NFKC")
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .toLocaleLowerCase();
  if (stripPunctuation(oldText) === stripPunctuation(newText)) {
    return "punctuation";
  }
  return "substantive";
}

function createChangeID(change) {
  const oldPart = Number.isInteger(change.oldIndex) ? change.oldIndex : "x";
  const newPart = Number.isInteger(change.newIndex) ? change.newIndex : "x";
  return `${change.type}-${oldPart}-${newPart}-${simpleTextHash(change.oldText || change.newText || "")}`;
}

function simpleTextHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function detectMovedParagraphs(changes) {
  const deletedByText = new Map();
  const addedByText = new Map();
  for (const change of changes) {
    if (change.type === "deleted" && change.oldText) {
      appendMapValue(deletedByText, change.oldText, change);
    }
    else if (change.type === "added" && change.newText) {
      appendMapValue(addedByText, change.newText, change);
    }
  }
  const replacements = new Map();
  const removed = new Set();
  for (const [text, deleted] of deletedByText) {
    const added = addedByText.get(text) ?? [];
    if (deleted.length !== 1 || added.length !== 1) {
      continue;
    }
    const oldChange = deleted[0];
    const newChange = added[0];
    const moved = createParagraphChange({
      type: "moved",
      oldIndex: oldChange.oldIndex,
      newIndex: newChange.newIndex,
      oldText: text,
      newText: text,
      oldDetail: oldChange,
      newDetail: newChange
    });
    moved.moveFrom = oldChange.locationLabel || oldChange.oldIndex;
    moved.moveTo = newChange.locationLabel || newChange.newIndex;
    replacements.set(oldChange, moved);
    removed.add(newChange);
  }
  return changes.filter((change) => !removed.has(change)).map((change) => replacements.get(change) || change);
}

function appendMapValue(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

function combineSignals(primary, secondary) {
  if (!secondary) {
    return primary;
  }
  return {
    get aborted() {
      return primary?.aborted || secondary?.aborted;
    }
  };
}

function createAnalysisController() {
  if (typeof AbortController === "function") {
    return new AbortController();
  }
  const signal = { aborted: false };
  return {
    signal,
    abort() {
      signal.aborted = true;
    }
  };
}

function checkAnalysisCancelled(signal) {
  if (signal?.aborted) {
    const error = new Error("git4zotero diff analysis was cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function createContentSummary(snapshot, fileOnly) {
  return {
    mode: "docx-content",
    paragraphCount: snapshot.paragraphCount,
    wordCount: snapshot.wordCount,
    sections: snapshot.sections,
    fileOnly
  };
}

function createFileOnlySummary(extension, options = {}) {
  return {
    mode: "file-only",
    extension,
    paragraphCount: null,
    wordCount: null,
    fileOnly: true,
    ...options
  };
}

function normalizeErrorMessage(error) {
  return String(error?.message || error || "").trim();
}

function formatSignedNumber(value) {
  return value > 0 ? `+${value}` : String(value);
}
