import { ZipReader } from "./vendor/zip-reader.mjs";

const DOCX_SOURCES = [
  { pattern: /^word\/document\.xml$/, source: "document", role: "core", order: 0 },
  { pattern: /^word\/footnotes\.xml$/, source: "footnotes", role: "core", order: 1 },
  { pattern: /^word\/endnotes\.xml$/, source: "endnotes", role: "core", order: 2 },
  { pattern: /^word\/header\d+\.xml$/, source: "header", role: "context", order: 3 },
  { pattern: /^word\/footer\d+\.xml$/, source: "footer", role: "context", order: 4 }
];

const REMOVED_CONTAINER_PATTERN = /<[\w.-]+:(?:del|moveFrom)\b[\s\S]*?<\/[\w.-]+:(?:del|moveFrom)>/g;
const REMOVED_TEXT_PATTERN = /<[\w.-]+:delText\b[^>]*>[\s\S]*?<\/[\w.-]+:delText>/g;
const PARAGRAPH_PATTERN = /<(?:[\w.-]+:)?p\b[\s\S]*?<\/(?:[\w.-]+:)?p>/g;
const TEXT_TOKEN_PATTERN = /<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>|<(?:[\w.-]+:)?(tab|br|cr)\b[^>]*\/>/g;

export class DocxReader {
  constructor(platform = null) {
    this.platform = platform;
  }

  async read(path) {
    if (!this.platform?.readFileBytes) {
      throw new Error("当前环境无法读取 docx 文件字节。");
    }
    return this.readBytes(await this.platform.readFileBytes(path));
  }

  async readBytes(bytes) {
    const zip = new ZipReader(bytes);
    const names = zip.listNames();
    if (!names.includes("word/document.xml")) {
      throw new Error("无法识别 docx 正文：缺少 word/document.xml。");
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
      throw new Error("未在 docx 正文、脚注或尾注中识别到可比对文本。请确认文件已保存且包含正文。");
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
      return [...doc.getElementsByTagNameNS("*", "p")]
        .map((paragraph, index) => createParagraphRecord(
          collectParagraphText(paragraph),
          descriptor,
          index
        ))
        .filter(Boolean);
    }
  }

  return extractParagraphsWithRegex(xml, descriptor);
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

  for (const paragraphMatch of cleaned.matchAll(PARAGRAPH_PATTERN)) {
    const parts = [];
    for (const tokenMatch of paragraphMatch[0].matchAll(TEXT_TOKEN_PATTERN)) {
      if (tokenMatch[1] !== undefined) {
        parts.push(decodeXml(tokenMatch[1]));
      }
      else if (tokenMatch[2] === "tab") {
        parts.push("\t");
      }
      else if (tokenMatch[2] === "br" || tokenMatch[2] === "cr") {
        parts.push("\n");
      }
    }
    const record = createParagraphRecord(parts.join(""), descriptor, index);
    if (record) {
      paragraphs.push(record);
      index += 1;
    }
  }
  return paragraphs;
}

function createParagraphRecord(text, descriptor, index) {
  const normalizedText = normalizeParagraph(text);
  if (!normalizedText) {
    return null;
  }
  return {
    text: String(text ?? ""),
    normalizedText,
    source: descriptor.source,
    role: descriptor.role,
    index
  };
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
