import fs from "node:fs/promises";
import path from "node:path";

export const runtimeEntry = "chrome/content/runtime/git4zotero-runtime.js";

export const runtimeModuleOrder = [
  "chrome/content/src/constants.mjs",
  "chrome/content/src/localization.mjs",
  "chrome/content/src/attachments.mjs",
  "chrome/content/src/vendor/zip-reader.mjs",
  "chrome/content/src/docx-reader.mjs",
  "chrome/content/src/content-diff.mjs",
  "chrome/content/src/metadata.mjs",
  "chrome/content/src/cleanup.mjs",
  "chrome/content/src/archive.mjs",
  "chrome/content/src/git-backend.mjs",
  "chrome/content/src/platform.mjs",
  "chrome/content/src/diagnostics.mjs",
  "chrome/content/src/version-service.mjs",
  "chrome/content/src/menu.mjs",
  "chrome/content/src/ui.mjs",
  "chrome/content/src/main.mjs"
];

export async function buildRuntimeScript(root = process.cwd()) {
  const chunks = [
    "(function () {",
    "  \"use strict\";",
    "  const __git4zoteroRuntimeGlobal = this;",
    ""
  ];

  for (const relativePath of runtimeModuleOrder) {
    const source = await fs.readFile(path.join(root, relativePath), "utf8");
    chunks.push(`  // ${relativePath}`);
    chunks.push(indentRuntimeSource(transformModuleSource(source, relativePath)));
    chunks.push("");
  }

  chunks.push("  if (typeof Git4Zotero === \"undefined\") {");
  chunks.push("    throw new Error(\"git4zotero runtime did not define Git4Zotero\");");
  chunks.push("  }");
  chunks.push("  __git4zoteroRuntimeGlobal.Git4Zotero = Git4Zotero;");
  chunks.push("}).call(this);");
  chunks.push("");

  return chunks.join("\n");
}

export function transformModuleSource(source, relativePath = "module") {
  let transformed = source
    .replace(/^\s*import(?:\s+|\{)[\s\S]*?;\r?\n/gm, "")
    .replace(/^export\s+(?=(?:const|let|var|function|class)\s)/gm, "");

  if (/^\s*import\s/m.test(transformed)) {
    throw new Error(`Runtime transform left an import statement in ${relativePath}`);
  }
  if (/^\s*export\s/m.test(transformed)) {
    throw new Error(`Runtime transform left an export statement in ${relativePath}`);
  }

  return transformed.trimEnd();
}

function indentRuntimeSource(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line ? `  ${line}` : "")
    .join("\n");
}
