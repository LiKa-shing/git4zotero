import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));

assert.equal(packageJson.version, manifest.version, "package.json and manifest.json versions must match.");
assert(manifest.homepage_url, "manifest.json must define homepage_url.");
assert(manifest.applications?.zotero?.id, "manifest.json must define applications.zotero.id.");
assert(manifest.applications?.zotero?.strict_min_version, "manifest.json must define applications.zotero.strict_min_version.");
assert(manifest.applications?.zotero?.strict_max_version, "manifest.json must define applications.zotero.strict_max_version.");

const version = manifest.version;
const tagName = `v${version}`;
const xpiName = "git4zotero.xpi";
const xpiPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "dist", xpiName);
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(root, "dist", "updates.json");

const xpiBytes = await fs.readFile(xpiPath);
const updateHash = createHash("sha256").update(xpiBytes).digest("hex");
const repositoryUrl = normalizeRepositoryUrl(manifest.homepage_url);
const updateLink = `${repositoryUrl}/releases/download/${tagName}/${xpiName}`;

const updates = {
  addons: {
    [manifest.applications.zotero.id]: {
      updates: [
        {
          version,
          update_link: updateLink,
          update_hash: `sha256:${updateHash}`,
          applications: {
            zotero: {
              strict_min_version: manifest.applications.zotero.strict_min_version,
              strict_max_version: manifest.applications.zotero.strict_max_version
            }
          }
        }
      ]
    }
  }
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(updates, null, 2)}\n`, "utf8");

console.log(`Update manifest complete: ${path.relative(root, outputPath)}`);
console.log(`Update link: ${updateLink}`);
console.log(`Update hash: sha256:${updateHash}`);

function normalizeRepositoryUrl(value) {
  const normalized = String(value ?? "").trim().replace(/\/+$/g, "");
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/i.test(normalized)) {
    throw new Error(`manifest.json homepage_url must be a GitHub repository URL: ${value}`);
  }
  return normalized;
}
