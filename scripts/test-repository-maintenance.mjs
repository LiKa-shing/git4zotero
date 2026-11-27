import assert from "node:assert/strict";
import { RepositoryArchiveService } from "../chrome/content/src/archive.mjs";
import { RepositoryCleanupService, RepositoryIndexStore } from "../chrome/content/src/cleanup.mjs";
import { createEmptyMetadata, MetadataStore } from "../chrome/content/src/metadata.mjs";
import { withRepositoryLock } from "../chrome/content/src/repository-lock.mjs";

// All files and directory removals below are confined to Maps/Sets. No Zotero,
// filesystem or Git process is used by these concurrency regression tests.
const maintenanceEncoder = new TextEncoder();
const maintenanceDecoder = new TextDecoder();
let maintenanceFixtureID = 0;

function maintenanceDeferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const maintenanceCheckpoint = () => new Promise((resolve) => setImmediate(resolve));

async function maintenanceCase(name, operation) {
  let timer;
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Repository maintenance test timed out: ${name}`)), 3000);
      })
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}

function maintenanceFixture() {
  const root = `memory/maintenance-${++maintenanceFixtureID}`;
  const files = new Map();
  const directories = new Set([root]);
  const hooks = {};
  const removed = [];
  const saved = [];
  const join = (...parts) => parts.join("/");
  const mkdir = (path) => {
    const parts = path.split("/");
    for (let i = 1; i <= parts.length; i += 1) {
      directories.add(parts.slice(0, i).join("/"));
    }
  };
  const write = async (path, bytes) => {
    await hooks.beforeWrite?.(path, bytes);
    mkdir(path.slice(0, path.lastIndexOf("/")));
    files.set(path, new Uint8Array(bytes));
  };
  const platform = {
    Zotero: { Items: { get: () => null }, debug() {} },
    join,
    getPluginDataDirectory: () => root,
    exists: async (path) => files.has(path) || directories.has(path),
    isDirectory: async (path) => directories.has(path),
    makeDirectory: async (path) => mkdir(path),
    writeBytes: write,
    writeText: async (path, text) => write(path, maintenanceEncoder.encode(text)),
    atomicWriteText: async (path, text) => write(path, maintenanceEncoder.encode(text)),
    readText: async (path) => maintenanceDecoder.decode(files.get(path)),
    readFileBytes: async (path) => {
      await hooks.beforeReadBytes?.(path);
      assert(files.has(path), `Missing in-memory file: ${path}`);
      return new Uint8Array(files.get(path));
    },
    listDirectory: async (path) => {
      const entries = [...new Set([...directories, ...files.keys()])]
        .filter((entry) => entry.slice(0, entry.lastIndexOf("/")) === path)
        .sort();
      await hooks.afterList?.(path, entries);
      return entries;
    },
    removeDirectory: async (path) => {
      removed.push(path);
      for (const key of files.keys()) {
        if (key.startsWith(`${path}/`)) files.delete(key);
      }
      for (const key of directories) {
        if (key === path || key.startsWith(`${path}/`)) directories.delete(key);
      }
    },
    saveBinaryFile: async (options) => {
      saved.push({ ...options, bytes: new Uint8Array(options.bytes) });
      await hooks.onSave?.(options);
      return `${root}/exports/${options.defaultFileName}`;
    }
  };
  const metadataStore = new MetadataStore(platform);
  const indexStore = new RepositoryIndexStore(platform);
  const cleanup = new RepositoryCleanupService({ platform, metadataStore, indexStore });
  const archive = new RepositoryArchiveService({ platform, cleanupService: cleanup, pluginVersion: "0.7.0" });
  const attachment = (key, itemID = 2) => ({
    libraryID: 1, itemID, itemKey: key, attachmentID: itemID + 1,
    attachmentKey: `${key}-ATT`, fileName: "paper.doc", extension: ".doc"
  });
  const relativePath = (key) => `library-1/item-${key}`;
  const repoPath = (key) => join(root, relativePath(key));
  const metadata = (target, enabled = true, generation = "initial") => ({
    ...createEmptyMetadata(), enabled, generation,
    item: { libraryID: target.libraryID, itemID: target.itemID, itemKey: target.itemKey },
    attachment: { attachmentID: target.attachmentID, attachmentKey: target.attachmentKey, fileName: target.fileName }
  });
  const seed = async (target, enabled = true) => {
    await metadataStore.write(repoPath(target.itemKey), metadata(target, enabled));
    await write(join(repoPath(target.itemKey), "tracked/document.doc"), maintenanceEncoder.encode("initial"));
    await indexStore.upsertAttachment(target, { enabled });
  };
  const preparedImport = (target, text) => {
    const source = relativePath("SOURCE");
    const sourceMetadata = metadata(attachment("SOURCE"));
    return {
      dataDir: root, picked: { path: "memory/source.zip" },
      sourceRepoRelativePath: source, sourceMetadata,
      sourceEntries: [
        { name: `${source}/.git4zotero/versions.json`, bytes: maintenanceEncoder.encode(JSON.stringify(sourceMetadata)) },
        { name: `${source}/tracked/document.doc`, bytes: maintenanceEncoder.encode(text) }
      ],
      targetRepoRelativePath: relativePath(target.itemKey),
      targetRepoPath: repoPath(target.itemKey), attachment: target
    };
  };
  return {
    root, files, hooks, removed, saved, platform, metadataStore, indexStore, cleanup, archive,
    attachment, relativePath, repoPath, metadata, seed, preparedImport
  };
}

await maintenanceCase("concurrent imports recheck the target under the same lock", async () => {
  const f = maintenanceFixture();
  const target = f.attachment("IMPORT");
  const started = maintenanceDeferred();
  const release = maintenanceDeferred();
  const metadataPath = f.metadataStore.getMetadataPath(f.repoPath(target.itemKey));
  let metadataWrites = 0;
  f.hooks.beforeWrite = async (path) => {
    if (path !== metadataPath) return;
    metadataWrites += 1;
    if (metadataWrites === 1) {
      started.resolve();
      await release.promise;
    }
  };
  const first = f.archive.commitItemRepositoryArchiveImport(f.preparedImport(target, "first"));
  await started.promise;
  const second = f.archive.commitItemRepositoryArchiveImport(f.preparedImport(target, "second"));
  await maintenanceCheckpoint();
  assert.equal(metadataWrites, 1, "second import must wait before checking or writing an absent target");
  release.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a.imported, [f.relativePath(target.itemKey)]);
  assert.equal(b.imported.length, 0);
  assert.equal(b.skipped.length, 1);
  assert.equal(metadataWrites, 1);
  assert.equal(maintenanceDecoder.decode(f.files.get(`${f.repoPath(target.itemKey)}/tracked/document.doc`)), "first");
});

await maintenanceCase("export snapshots wait for repository writes but not the save dialog", async () => {
  const f = maintenanceFixture();
  const target = f.attachment("EXPORT");
  const repo = f.repoPath(target.itemKey);
  await f.seed(target);
  const started = maintenanceDeferred();
  const release = maintenanceDeferred();
  const saving = maintenanceDeferred();
  const finishSave = maintenanceDeferred();
  let reads = 0;
  f.hooks.beforeReadBytes = async () => { reads += 1; };
  f.hooks.onSave = async () => { saving.resolve(); await finishSave.promise; };
  const writer = withRepositoryLock(repo, async () => {
    started.resolve();
    await release.promise;
    await f.platform.writeText(`${repo}/tracked/document.doc`, "committed");
    await f.metadataStore.write(repo, f.metadata(target, true, "committed"));
  }, f.platform.Zotero);
  await started.promise;
  const exported = f.archive.exportItemRepositoryArchive({
    repoPath: repo, repoRelativePath: f.relativePath(target.itemKey), attachment: target
  });
  await maintenanceCheckpoint();
  assert.equal(reads, 0, "export must not read a partially updated repository");
  release.resolve();
  await writer;
  await saving.promise;
  await withRepositoryLock(repo, () => f.platform.writeText(`${repo}/tracked/document.doc`, "later"), f.platform.Zotero);
  const entries = f.archive.readArchiveEntries(f.saved[0].bytes);
  assert.equal(maintenanceDecoder.decode(entries.find((entry) => entry.name.endsWith("/tracked/document.doc")).bytes), "committed");
  const capturedMetadata = JSON.parse(maintenanceDecoder.decode(entries.find((entry) => entry.name.endsWith("/.git4zotero/versions.json")).bytes));
  assert.equal(capturedMetadata.generation, "committed");
  finishSave.resolve();
  await exported;
});

await maintenanceCase("cleanup waits and checks current ownership before deletion", async () => {
  const f = maintenanceFixture();
  const target = f.attachment("CLEANUP");
  const repo = f.repoPath(target.itemKey);
  await f.seed(target);
  const entry = (await f.indexStore.read()).repositories[0];
  const started = maintenanceDeferred();
  const release = maintenanceDeferred();
  const replacement = f.attachment(target.itemKey, 99);
  const writer = withRepositoryLock(repo, async () => {
    started.resolve();
    await release.promise;
    await f.metadataStore.write(repo, f.metadata(replacement));
    await f.indexStore.upsertAttachment(replacement, { enabled: true });
  }, f.platform.Zotero);
  await started.promise;
  const cleaning = f.cleanup.cleanupRepository(entry, new Set([target.itemID]), { removeMissing: true });
  await maintenanceCheckpoint();
  assert.equal(f.removed.length, 0);
  release.resolve();
  await writer;
  const result = await cleaning;
  assert.equal(result.cleaned, false, "cleanup must not delete a repository whose metadata changed while queued");
  assert.equal(await f.platform.exists(repo), true);
  assert.equal((await f.indexStore.read()).repositories[0].itemID, replacement.itemID);
  const currentEntry = (await f.indexStore.read()).repositories[0];
  const removed = await f.cleanup.cleanupRepository(currentEntry, new Set([replacement.itemID]));
  assert.equal(removed.cleaned, true);
  assert.equal((await f.indexStore.read()).repositories.length, 0);
});

await maintenanceCase("concurrent repository index updates preserve both repositories", async () => {
  const f = maintenanceFixture();
  const started = maintenanceDeferred();
  const release = maintenanceDeferred();
  let writes = 0;
  f.hooks.beforeWrite = async (path) => {
    if (path !== f.indexStore.getIndexPath()) return;
    writes += 1;
    if (writes === 1) { started.resolve(); await release.promise; }
  };
  const first = f.indexStore.upsertAttachment(f.attachment("A"), { enabled: true });
  await started.promise;
  const second = f.indexStore.upsertAttachment(f.attachment("B", 4), { enabled: false });
  await maintenanceCheckpoint();
  assert.equal(writes, 1, "index updates must serialize their entire read-modify-write");
  release.resolve();
  await Promise.all([first, second]);
  const entries = (await f.indexStore.read()).repositories;
  assert.deepEqual(entries.map((entry) => entry.itemKey).sort(), ["A", "B"]);
  assert.equal(entries.find((entry) => entry.itemKey === "B").enabled, false);
});

await maintenanceCase("index rebuild preserves new repositories and queued enable changes", async () => {
  const f = maintenanceFixture();
  const original = f.attachment("A");
  const added = f.attachment("B", 4);
  await f.seed(original);
  const holding = maintenanceDeferred();
  const releaseWriter = maintenanceDeferred();
  const listed = maintenanceDeferred();
  const releaseList = maintenanceDeferred();
  f.hooks.afterList = async (path) => {
    if (path === `${f.root}/library-1`) { listed.resolve(); await releaseList.promise; }
  };
  const writer = withRepositoryLock(f.repoPath(original.itemKey), async () => {
    holding.resolve();
    await releaseWriter.promise;
    await f.metadataStore.write(f.repoPath(original.itemKey), f.metadata(original, false));
    await f.indexStore.upsertAttachment(original, { enabled: false });
  }, f.platform.Zotero);
  await holding.promise;
  let rebuildFinished = false;
  const rebuild = f.cleanup.rebuildIndexFromRepositories().then((result) => {
    rebuildFinished = true;
    return result;
  });
  await listed.promise;
  await withRepositoryLock(f.repoPath(added.itemKey), () => f.seed(added), f.platform.Zotero);
  releaseList.resolve();
  await maintenanceCheckpoint();
  assert.equal(rebuildFinished, false, "rebuild must wait before reading a repository being changed");
  releaseWriter.resolve();
  await writer;
  await rebuild;
  const entries = (await f.indexStore.read()).repositories;
  assert.deepEqual(entries.map((entry) => entry.itemKey).sort(), ["A", "B"]);
  assert.equal(entries.find((entry) => entry.itemKey === "A").enabled, false);
  assert.equal(entries.find((entry) => entry.itemKey === "B").enabled, true);
});

console.log("Repository maintenance concurrency tests passed (5 scenarios; in-memory only).");
