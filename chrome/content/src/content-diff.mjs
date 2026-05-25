import { getExtension } from "./attachments.mjs";
import { DocxReader } from "./docx-reader.mjs";

const MAX_STORED_PARAGRAPH_CHANGES = 20;
const MAX_DISPLAY_CHANGES = 3;
const MAX_CHANGE_TEXT_LENGTH = 240;
const SOURCE_LABELS = Object.freeze({
  document: "正文",
  footnotes: "脚注",
  endnotes: "尾注",
  header: "页眉",
  footer: "页脚"
});

export class ContentAnalyzer {
  constructor({ platform, docxReader = null }) {
    this.platform = platform;
    this.docxReader = docxReader ?? new DocxReader(platform);
  }

  async analyze(filePath, previousVersion = null) {
    const extension = getExtension(filePath);
    const fileHash = await this.platform.hashFile(filePath);
    const stat = await this.platform.stat(filePath);
    const previousFileHash = previousVersion?.fileHash ?? null;
    const fileChanged = previousFileHash ? previousFileHash !== fileHash : true;

    if (extension === ".docx") {
      try {
        const snapshot = await this.docxReader.read(filePath);
        const contentHash = await this.platform.hashString(snapshot.normalizedText);
        const contentSummary = createContentSummary(snapshot, false);
        const changeSummary = summarizeDocxChange({
          current: snapshot,
          currentContentHash: contentHash,
          previousVersion,
          fileChanged
        });

        return {
          fileHash,
          fileSize: stat.size,
          contentHash,
          contentSnapshot: snapshot,
          contentSummary,
          changeSummary,
          shouldCreateVersion: changeSummary.changeType !== "no-change"
        };
      }
      catch (error) {
        const readError = normalizeErrorMessage(error);
        const changeSummary = summarizeFileLevelChange({
          extension,
          previousVersion,
          fileChanged,
          readError
        });

        return {
          fileHash,
          fileSize: stat.size,
          contentHash: null,
          contentSnapshot: null,
          contentSummary: createFileOnlySummary(extension, {
            readError,
            readErrorCode: "docx-read-failed"
          }),
          changeSummary,
          shouldCreateVersion: changeSummary.changeType !== "no-change"
        };
      }
    }

    const changeSummary = summarizeFileLevelChange({
      extension,
      previousVersion,
      fileChanged
    });

    return {
      fileHash,
      fileSize: stat.size,
      contentHash: null,
      contentSnapshot: null,
      contentSummary: createFileOnlySummary(extension),
      changeSummary,
      shouldCreateVersion: changeSummary.changeType !== "no-change"
    };
  }
}

export function summarizeDocxChange({ current, currentContentHash, previousVersion, fileChanged }) {
  if (!previousVersion) {
    const paragraphChanges = createInitialParagraphChanges(current);
    const displayChanges = paragraphChanges.slice(0, MAX_DISPLAY_CHANGES);
    const changeGroups = createChangeGroups(paragraphChanges);
    return {
      changeType: "first-version",
      summary: "首次创建版本，将保存当前 .docx 正文内容快照。",
      addedParagraphs: current.paragraphCount,
      deletedParagraphs: 0,
      modifiedParagraphs: 0,
      wordDelta: current.wordCount,
      paragraphChanges,
      displayChanges,
      changeGroups,
      groupedChangeCount: changeGroups.length,
      locationSummary: formatLocationSummary(changeGroups),
      totalParagraphChanges: current.paragraphCount,
      omittedChanges: Math.max(0, current.paragraphCount - displayChanges.length),
      fileChanged,
      contentChanged: true
    };
  }

  const previousSummary = previousVersion.contentSummary;
  const previousSnapshot = {
    paragraphs: previousVersion.contentSnapshot?.paragraphs ?? [],
    paragraphDetails: previousVersion.contentSnapshot?.paragraphDetails ?? null,
    paragraphCount: previousSummary?.paragraphCount ?? 0,
    wordCount: previousSummary?.wordCount ?? 0
  };
  const contentChanged = previousVersion.contentHash !== currentContentHash;

  if (!fileChanged) {
    return {
      changeType: "no-change",
      summary: "未检测到修改。",
      addedParagraphs: 0,
      deletedParagraphs: 0,
      modifiedParagraphs: 0,
      wordDelta: 0,
      paragraphChanges: [],
      displayChanges: [],
      changeGroups: [],
      groupedChangeCount: 0,
      locationSummary: "",
      totalParagraphChanges: 0,
      omittedChanges: 0,
      fileChanged: false,
      contentChanged: false
    };
  }

  if (!contentChanged) {
    return {
      changeType: "file-only",
      summary: "正文内容未变化，仅检测到格式、样式、元数据或 Word 内部状态变化。",
      addedParagraphs: 0,
      deletedParagraphs: 0,
      modifiedParagraphs: 0,
      wordDelta: 0,
      paragraphChanges: [],
      displayChanges: [],
      changeGroups: [],
      groupedChangeCount: 0,
      locationSummary: "",
      totalParagraphChanges: 0,
      omittedChanges: 0,
      fileChanged: true,
      contentChanged: false
    };
  }

  const paragraphDiff = diffParagraphs(
    previousSnapshot.paragraphs,
    current.paragraphs,
    createParagraphDetails(previousSnapshot),
    createParagraphDetails(current)
  );
  const wordDelta = current.wordCount - previousSnapshot.wordCount;
  const totalParagraphChanges = paragraphDiff.paragraphChanges.length;
  const paragraphChanges = paragraphDiff.paragraphChanges.slice(0, MAX_STORED_PARAGRAPH_CHANGES);
  const displayChanges = paragraphChanges.slice(0, MAX_DISPLAY_CHANGES);
  const changeGroups = createChangeGroups(paragraphChanges);
  return {
    changeType: "content",
    summary: [
      "正文内容已修改",
      `新增 ${paragraphDiff.addedParagraphs} 段`,
      `删除 ${paragraphDiff.deletedParagraphs} 段`,
      `修改 ${paragraphDiff.modifiedParagraphs} 段`,
      `字数变化 ${formatSignedNumber(wordDelta)}`
    ].join("；") + "。",
    ...paragraphDiff,
    paragraphChanges,
    displayChanges,
    changeGroups,
    groupedChangeCount: changeGroups.length,
    locationSummary: formatLocationSummary(changeGroups),
    totalParagraphChanges,
    omittedChanges: Math.max(0, totalParagraphChanges - displayChanges.length),
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
        ? "首次创建版本，当前 .docx 暂不可解析，已保存文件级快照。"
        : `首次创建版本，${extension || "该格式"} 将保存文件级快照。`,
      fileChanged: true,
      contentChanged: null,
      readError: readError || null
    };
  }

  if (!fileChanged) {
    return {
      changeType: "no-change",
      summary: "未检测到修改。",
      fileChanged: false,
      contentChanged: null,
      readError: readError || null
    };
  }

  if (docxReadFailed) {
    return {
      changeType: "file-level",
      summary: "当前 .docx 暂不可解析，已按文件级快照保存；请确认文件已由 Word/WPS 完整保存。",
      fileChanged: true,
      contentChanged: null,
      readError
    };
  }

  if (extension === ".doc") {
    return {
      changeType: "file-level",
      summary: ".doc 仅支持文件级跟踪，可创建和恢复版本，但不解析正文差异。",
      fileChanged: true,
      contentChanged: null,
      fileOnlyReason: "doc-binary"
    };
  }

  return {
    changeType: "file-level",
    summary: "当前格式仅支持文件级识别：文件内容已变化，但不解析正文差异。",
    fileChanged: true,
    contentChanged: null
  };
}

export function diffParagraphs(oldParagraphs, newParagraphs, oldDetails = [], newDetails = []) {
  return diffParagraphsWithDetails(oldParagraphs, newParagraphs, oldDetails, newDetails);
}

export function diffParagraphsWithDetails(
  oldParagraphs,
  newParagraphs,
  oldDetails = [],
  newDetails = []
) {
  const matches = lcsMatches(oldParagraphs, newParagraphs);
  let oldCursor = 0;
  let newCursor = 0;
  let addedParagraphs = 0;
  let deletedParagraphs = 0;
  let modifiedParagraphs = 0;
  const paragraphChanges = [];

  for (const match of [...matches, { oldIndex: oldParagraphs.length, newIndex: newParagraphs.length }]) {
    const removed = match.oldIndex - oldCursor;
    const added = match.newIndex - newCursor;
    const paired = Math.min(removed, added);
    modifiedParagraphs += paired;
    deletedParagraphs += removed - paired;
    addedParagraphs += added - paired;

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

    oldCursor = match.oldIndex + 1;
    newCursor = match.newIndex + 1;
  }

  return { addedParagraphs, deletedParagraphs, modifiedParagraphs, paragraphChanges };
}

function createInitialParagraphChanges(snapshot) {
  const details = createParagraphDetails(snapshot);
  return snapshot.paragraphs
    .slice(0, MAX_STORED_PARAGRAPH_CHANGES)
    .map((paragraph, index) => createParagraphChange({
      type: "added",
      newIndex: index,
      newText: paragraph,
      newDetail: details[index]
    }));
}

function createParagraphDetails(snapshot) {
  const paragraphs = snapshot?.paragraphs ?? [];
  const details = snapshot?.paragraphDetails?.filter?.((paragraph) => paragraph.role === "core") ?? [];
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
  if (type === "deleted" || type === "modified") {
    change.oldText = truncateChangeText(oldText);
  }
  if (type === "added" || type === "modified") {
    change.newText = truncateChangeText(newText);
  }
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
    group.summary = formatGroupSummary(group);
  }
  return groups;
}

function describeChangeGroup(change) {
  const heading = change.headingPath?.filter(Boolean).join(" / ") || "";
  if (change.areaType === "table") {
    const table = change.tableIndex ? `表格 ${change.tableIndex}` : "表格";
    const label = heading ? `${heading} · ${table}` : table;
    return { key: `table:${heading}:${change.tableIndex ?? ""}`, label };
  }
  if (change.areaType === "footnote") {
    return { key: "footnote", label: "脚注" };
  }
  if (change.areaType === "endnote") {
    return { key: "endnote", label: "尾注" };
  }
  if (heading) {
    return { key: `heading:${heading}`, label: heading };
  }
  return { key: "body:untitled", label: "无标题正文" };
}

function formatGroupSummary(group) {
  const parts = [];
  if (group.addedParagraphs) {
    parts.push(`新增 ${group.addedParagraphs} 段`);
  }
  if (group.deletedParagraphs) {
    parts.push(`删除 ${group.deletedParagraphs} 段`);
  }
  if (group.modifiedParagraphs) {
    parts.push(`修改 ${group.modifiedParagraphs} 段`);
  }
  return `${group.label} · ${parts.join("，") || `${group.totalChanges} 处变化`}`;
}

function formatLocationSummary(groups) {
  return groups.map((group) => group.summary).slice(0, 5).join("；");
}

function labelSource(source) {
  return SOURCE_LABELS[source] || "正文";
}

function truncateChangeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= MAX_CHANGE_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_CHANGE_TEXT_LENGTH - 1)}…`;
}

function lcsMatches(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const matches = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      matches.push({ oldIndex: i, newIndex: j });
      i += 1;
      j += 1;
    }
    else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    }
    else {
      j += 1;
    }
  }
  return matches;
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
