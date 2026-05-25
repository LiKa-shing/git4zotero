import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = process.argv[2] || path.join("dist", "release-notes.md");

const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const changelog = await fs.readFile(path.join(root, "CHANGELOG.md"), "utf8");
const version = manifest.version;

assert(version, "manifest.json must contain a version before release notes can be created.");

const section = extractVersionSection(changelog, version);
assert(section, `CHANGELOG.md does not contain a section for version ${version}.`);
assert(section.body.trim(), `CHANGELOG.md section ${version} is empty.`);
assert(
  /^###\s+中文\s*$/m.test(section.body),
  `CHANGELOG.md section ${version} must contain a "### 中文" subsection.`
);
assert(
  /^###\s+English\s*$/m.test(section.body),
  `CHANGELOG.md section ${version} must contain a "### English" subsection.`
);

await fs.mkdir(path.dirname(path.resolve(root, outputPath)), { recursive: true });
await fs.writeFile(path.resolve(root, outputPath), `${section.text.trim()}\n`, "utf8");

console.log(`Release notes written to ${outputPath} from CHANGELOG.md section ${version}.`);

function extractVersionSection(text, version) {
  const headingPattern = /^##\s+(.+?)\s*$/gm;
  const headings = [];
  let match;
  while ((match = headingPattern.exec(text)) !== null) {
    headings.push({
      title: match[1].trim(),
      index: match.index
    });
  }

  const headingIndex = headings.findIndex((heading) => heading.title === version);
  if (headingIndex < 0) {
    return null;
  }

  const start = headings[headingIndex].index;
  const end = headingIndex + 1 < headings.length ? headings[headingIndex + 1].index : text.length;
  const rawSection = text.slice(start, end).trim();
  const body = rawSection.replace(/^##\s+.+?\s*$/m, "").trim();

  return {
    text: rawSection,
    body
  };
}
