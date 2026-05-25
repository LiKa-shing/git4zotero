import { ZipReader } from "./vendor/zip-reader.mjs";
import { formatText } from "./localization.mjs";

const DOCX_SOURCES = [
  { pattern: /^word\/document\.xml$/, source: "document", role: "core", order: 0 },
  { pattern: /^word\/footnotes\.xml$/, source: "footnotes", role: "core", order: 1 },
  { pattern: /^word\/endnotes\.xml$/, source: "endnotes", role: "core", order: 2 },
  { pattern: /^word\/header\d+\.xml$/, source: "header", role: "context", order: 3 },
  { pattern: /^word\/footer\d+\.xml$/, source: "footer", role: "context", order: 4 }
];

const REMOVED_CONTAINER_PATTERN = /<[\w.-]+:(?:del|moveFrom)\b[\s\S]*?<\/[\w.-]+:(?:del|moveFrom)>/g;
const REMOVED_TEXT_PATTERN = /<[\w.-]+:delText\b[^>]*>[\s\S]*?<\/[\w.-]+:delText>/g;
const TEXT_TOKEN_PATTERN = /<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>|<(?:[\w.-]+:)?(tab|br|cr)\b[^>]*\/>/g;
const STRUCTURE_TOKEN_PATTERN = /<(?:[\w.-]+:)?tbl\b[^>]*>|<\/(?:[\w.-]+:)?tbl>|<(?:[\w.-]+:)?p\b[\s\S]*?<\/(?:[\w.-]+:)?p>/g;
const STYLE_PATTERN = /<(?:[\w.-]+:)?pStyle\b[^>]*(?:[\w.-]+:)?val=["']([^"']+)["'][^>]*\/?>/i;

export class DocxReader {
  constructor(platform = null) {
    this.platform = platform;
  }

  async read(path) {
    if (!this.platform?.readFileBytes) {
      throw new Error(formatText("noDocxByteReader"));
    }
    return this.readBytes(await this.platform.readFileBytes(path));
  }

  async readBytes(bytes) {
    const zip = new ZipReader(bytes);
    const names = zip.listNames();
    if (!names.includes("word/document.xml")) {
      throw new Error(formatText("missingDocumentXml"));
    }

    const entries = names
      .map((name) => ({ name, descriptor: describeDocxSource(name) }))
      .filter((entry) => entry.descriptor)
      .sort(sortDocxEntries);

    const sections = [];
    for (const { name, descriptor } of entries) {
      const xml = await zip.readText(name);
      if (!xml) {
        continue;
      }
      const paragraphDetails = extractParagraphsFromXml(xml, descriptor);
      sections.push({
        name,
        source: descriptor.source,
        role: descriptor.role,
        paragraphCount: paragraphDetails.length,
        contentParagraphCount: descriptor.role === "core" ? paragraphDetails.length : 0,
        paragraphs: paragraphDetails
      });
    }

    const paragraphDetails = sections.flatMap((section) => section.paragraphs);
    const contentParagraphDetails = paragraphDetails.filter((paragraph) => paragraph.role === "core");
    if (!contentParagraphDetails.length) {
      throw new Error(formatText("noComparableText"));
    }

    const paragraphs = contentParagraphDetails.map((paragraph) => paragraph.normalizedText);
    const normalizedText = paragraphs.join("\n");
    return {
      paragraphs,
      paragraphDetails,
      normalizedText,
      paragraphCount: paragraphs.length,
      wordCount: countWords(normalizedText),
      sections: sections.map(({ name, source, role, paragraphCount, contentParagraphCount }) => ({
        name,
        source,
        role,
        paragraphCount,
        contentParagraphCount
      }))
    };
  }
}

export function extractParagraphsFromXml(xml, descriptor = { source: "document", role: "core" }) {
  if (typeof DOMParser === "function") {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const parserError = doc.getElementsByTagName("parsererror")[0];
    if (!parserError) {
      return extractParagraphsFromDom(doc, descriptor);
    }
  }

  return extractParagraphsWithRegex(xml, descriptor);
}

function extractParagraphsFromDom(doc, descriptor) {
  const context = createExtractionContext(descriptor);
  return [...doc.getElementsByTagNameNS("*", "p")]
    .map((paragraph, index) => {
      const location = createParagraphLocation({
        descriptor,
        context,
        paragraphXml: "",
        paragraphNode: paragraph
      });
      return createParagraphRecord(
        collectParagraphText(paragraph),
        descriptor,
        index,
        location
      );
    })
    .filter(Boolean);
}

function collectParagraphText(node, skip = false) {
  const localName = node.localName;
  const shouldSkip = skip
    || localName === "del"
    || localName === "delText"
    || localName === "moveFrom";

  if (shouldSkip) {
    return "";
  }
  if (localName === "t") {
    return node.textContent ?? "";
  }
  if (localName === "tab") {
    return "\t";
  }
  if (localName === "br" || localName === "cr") {
    return "\n";
  }

  let text = "";
  for (const child of node.childNodes ?? []) {
    text += collectParagraphText(child, shouldSkip);
  }
  return text;
}

function extractParagraphsWithRegex(xml, descriptor) {
  const cleaned = String(xml)
    .replace(REMOVED_CONTAINER_PATTERN, "")
    .replace(REMOVED_TEXT_PATTERN, "");
  const paragraphs = [];
  let index = 0;
  const context = createExtractionContext(descriptor);

  for (const tokenMatch of cleaned.matchAll(STRUCTURE_TOKEN_PATTERN)) {
    const token = tokenMatch[0];
    if (/^<(?:[\w.-]+:)?tbl\b/i.test(token)) {
      context.tableDepth += 1;
      if (context.tableDepth === 1) {
        context.currentTableIndex += 1;
      }
      continue;
    }
    if (/^<\/(?:[\w.-]+:)?tbl>/i.test(token)) {
      context.tableDepth = Math.max(0, context.tableDepth - 1);
      continue;
    }

    const parts = [];
    for (const textMatch of token.matchAll(TEXT_TOKEN_PATTERN)) {
      if (textMatch[1] !== undefined) {
        parts.push(decodeXml(textMatch[1]));
      }
      else if (textMatch[2] === "tab") {
        parts.push("\t");
      }
      else if (textMatch[2] === "br" || textMatch[2] === "cr") {
        parts.push("\n");
      }
    }
    const location = createParagraphLocation({
      descriptor,
      context,
      paragraphXml: token,
      paragraphNode: null
    });
    const record = createParagraphRecord(parts.join(""), descriptor, index, location);
    if (record) {
      paragraphs.push(record);
      index += 1;
    }
  }
  return paragraphs;
}

function createParagraphRecord(text, descriptor, index, location = {}) {
  const normalizedText = normalizeParagraph(text);
  if (!normalizedText) {
    return null;
  }
  const heading = location.headingLevel
    ? updateHeadingContext(location.context, location.headingLevel, normalizedText)
    : location.headingPath;
  return {
    text: String(text ?? ""),
    normalizedText,
    source: descriptor.source,
    role: descriptor.role,
    index,
    sourceLabel: location.sourceLabel,
    areaType: location.areaType,
    tableIndex: location.tableIndex ?? null,
    headingLevel: location.headingLevel ?? null,
    headingPath: heading ?? [],
    locationLabel: formatLocationLabel({
      sourceLabel: location.sourceLabel,
      areaType: location.areaType,
      tableIndex: location.tableIndex,
      headingPath: heading ?? [],
      index
    })
  };
}

function createExtractionContext(descriptor) {
  return {
    descriptor,
    headingPath: [],
    currentTableIndex: 0,
    tableDepth: 0,
    tableMap: typeof WeakMap === "function" ? new WeakMap() : null
  };
}

function createParagraphLocation({ descriptor, context, paragraphXml, paragraphNode }) {
  const headingLevel = paragraphNode
    ? getHeadingLevelFromNode(paragraphNode)
    : getHeadingLevelFromXml(paragraphXml);
  const tableIndex = paragraphNode
    ? getTableIndexFromNode(paragraphNode, context)
    : (context.tableDepth > 0 ? context.currentTableIndex : null);
  const areaType = getAreaType(descriptor, tableIndex);
  const sourceLabel = getSourceLabel(descriptor.source, areaType);
  return {
    context,
    areaType,
    sourceLabel,
    tableIndex,
    headingLevel,
    headingPath: context.headingPath
  };
}

function getTableIndexFromNode(node, context) {
  const table = findAncestor(node, "tbl");
  if (!table) {
    return null;
  }
  if (context.tableMap?.has(table)) {
    return context.tableMap.get(table);
  }
  context.currentTableIndex += 1;
  context.tableMap?.set(table, context.currentTableIndex);
  return context.currentTableIndex;
}

function findAncestor(node, localName) {
  for (let current = node?.parentNode; current; current = current.parentNode) {
    if (current.localName === localName) {
      return current;
    }
  }
  return null;
}

function getHeadingLevelFromNode(paragraph) {
  for (const node of paragraph.getElementsByTagNameNS?.("*", "pStyle") ?? []) {
    const value = node.getAttribute("w:val")
      || node.getAttribute("val")
      || node.getAttributeNS?.("*", "val")
      || "";
    const level = parseHeadingLevel(value);
    if (level) {
      return level;
    }
  }
  return null;
}

function getHeadingLevelFromXml(xml) {
  return parseHeadingLevel(STYLE_PATTERN.exec(String(xml ?? ""))?.[1]);
}

function parseHeadingLevel(value) {
  const style = String(value ?? "").trim();
  const match = /^(?:heading|标题)\s*([1-6])$/i.exec(style)
    || /^Heading([1-6])$/i.exec(style);
  return match ? Number(match[1]) : null;
}

function updateHeadingContext(context, level, text) {
  const next = context.headingPath.slice(0, Math.max(0, level - 1));
  next[level - 1] = text;
  context.headingPath = next.filter(Boolean);
  return context.headingPath;
}

function getAreaType(descriptor, tableIndex) {
  if (descriptor.source === "footnotes") {
    return "footnote";
  }
  if (descriptor.source === "endnotes") {
    return "endnote";
  }
  if (tableIndex) {
    return "table";
  }
  return descriptor.source === "document" ? "body" : descriptor.source;
}

function getSourceLabel(source, areaType) {
  if (areaType === "table") {
    return formatText("tableLabel");
  }
  if (source === "footnotes") {
    return formatText("sourceFootnotes");
  }
  if (source === "endnotes") {
    return formatText("sourceEndnotes");
  }
  if (source === "header") {
    return formatText("sourceHeader");
  }
  if (source === "footer") {
    return formatText("sourceFooter");
  }
  return formatText("sourceDocument");
}

function formatLocationLabel({ sourceLabel, areaType, tableIndex, headingPath, index }) {
  const parts = [];
  if (headingPath?.length) {
    parts.push(headingPath.join(" / "));
  }
  if (areaType === "table" && tableIndex) {
    parts.push(formatText("tableWithIndex", { index: tableIndex }));
  }
  else if (sourceLabel && sourceLabel !== formatText("sourceDocument")) {
    parts.push(sourceLabel);
  }
  parts.push(formatText("paragraphIndex", { index: index + 1 }));
  return parts.join(" · ");
}

export function normalizeParagraph(text) {
  return String(text ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

export function countWords(text) {
  const value = String(text ?? "");
  const latinWords = value.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? [];
  const cjkChars = value.match(/[\u3400-\u9fff]/g) ?? [];
  return latinWords.length + cjkChars.length;
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function describeDocxSource(name) {
  return DOCX_SOURCES.find((source) => source.pattern.test(name)) ?? null;
}

function sortDocxEntries(a, b) {
  return a.descriptor.order - b.descriptor.order || a.name.localeCompare(b.name);
}
