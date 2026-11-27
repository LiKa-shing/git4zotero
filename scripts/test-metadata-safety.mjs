import assert from "node:assert/strict";
import vm from "node:vm";
import { MetadataStore, createEmptyMetadata } from "../chrome/content/src/metadata.mjs";
import { RepositoryCleanupService, RepositoryIndexStore } from "../chrome/content/src/cleanup.mjs";
import { ZoteroPlatform } from "../chrome/content/src/platform.mjs";
import { buildRuntimeScript } from "./runtime-builder.mjs";

// Actual stores and the production platform run against memory-only IOUtils.
// No manuscript, Zotero profile, filesystem write or Git process is accessed.
let fixtureID = 0;
let scenarios = 0;
const checkpoint = () => new Promise((resolve) => setImmediate(resolve));

await safetyCase("new stores initialize only when both primary and backup are absent", async () => {
  const f = fixture();
  assert.deepEqual((await f.metadata.read(f.repo)).versions, []);
  assert.deepEqual((await f.index.read()).repositories, []);
  assert.equal(f.operations.length, 0);
  await f.metadata.write(f.repo, record("first"));
  assert.equal(JSON.parse(f.files.get(f.metaPath)).generation, "first");
  assert.equal(f.files.get(f.backupPath), f.files.get(f.metaPath));
  assert(f.operations.filter((op) => op.kind === "write").every((op) => op.options.mode === "create" && op.options.flush === true));
  f.assertNoDestructiveReplacement();
});

await safetyCase("each successful save retains the previous complete metadata", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("one"));
  const previous = f.files.get(f.metaPath);
  await f.metadata.write(f.repo, record("two"));
  assert.equal(f.files.get(f.backupPath), previous);
  assert.equal((await f.metadata.read(f.repo)).generation, "two");
  await f.metadata.write(f.repo, record("three"));
  assert.equal(JSON.parse(f.files.get(f.backupPath)).generation, "two");
  f.assertNoDestructiveReplacement();
});

for (const destination of ["backup", "primary"]) {
  for (const phase of ["temporary-write", "replacement"]) {
    await safetyCase(`${destination} ${phase} failure preserves the last complete primary`, async () => {
      const f = fixture();
      await f.metadata.write(f.repo, record("older-backup"));
      await f.metadata.write(f.repo, record("previous"));
      const oldPrimary = f.files.get(f.metaPath);
      const oldBackup = f.files.get(f.backupPath);
      const target = destination === "backup" ? f.backupPath : f.metaPath;
      f.hooks.beforeWrite = (path) => {
        if (phase === "temporary-write" && path.startsWith(`${target}.tmp-`)) {
          f.files.set(path, "{partial");
          throw new Error("injected write interruption");
        }
      };
      f.hooks.beforeMove = (_source, path) => {
        if (phase === "replacement" && path === target) throw new Error("injected replacement failure");
      };
      await assert.rejects(() => f.metadata.write(f.repo, record("new")), /injected/);
      assert.equal(f.files.get(f.metaPath), oldPrimary);
      assert.equal(f.files.get(f.backupPath), destination === "backup" ? oldBackup : oldPrimary);
      assert.equal((await new MetadataStore(f.platform).read(f.repo)).generation, "previous");
      f.assertNoDestructiveReplacement();
    });
  }
}

await safetyCase("interrupted initialization is recognizable from the first valid backup", async () => {
  const f = fixture();
  f.hooks.beforeMove = (_source, path) => {
    if (path === f.metaPath) throw new Error("injected first-primary failure");
  };
  await assert.rejects(() => f.metadata.write(f.repo, record("initial")), /first-primary failure/);
  assert.equal(f.files.has(f.metaPath), false);
  assert.equal(JSON.parse(f.files.get(f.backupPath)).generation, "initial");
  await expectUnreadable(() => f.metadata.read(f.repo), f.metaPath, true);
  f.assertNoDestructiveReplacement();
});

for (const damage of ["corrupt", "missing", "invalid-shape", "future-schema"]) {
  await safetyCase(`${damage} metadata does not silently revert to a backup or empty history`, async () => {
    const f = fixture();
    await f.metadata.write(f.repo, record("valid"));
    if (damage === "missing") f.files.delete(f.metaPath);
    else f.files.set(f.metaPath, damage === "corrupt" ? "{broken"
      : damage === "invalid-shape" ? JSON.stringify({ versions: "invalid" })
      : JSON.stringify({ schemaVersion: 99, versions: [] }));
    const primary = f.files.get(f.metaPath);
    const backup = f.files.get(f.backupPath);
    const operationCount = f.operations.length;
    await expectUnreadable(() => f.metadata.read(f.repo), f.metaPath, true);
    await expectUnreadable(() => f.metadata.write(f.repo, record("overwrite")), f.metaPath, true);
    assert.equal(f.files.get(f.metaPath), primary);
    assert.equal(f.files.get(f.backupPath), backup);
    assert.equal(f.operations.length, operationCount, "damage detection must be read-only");
  });
}

await safetyCase("unreadable primary and backup are preserved with an explicit error", async () => {
  const f = fixture();
  f.files.set(f.metaPath, "{broken-primary");
  f.files.set(f.backupPath, "{broken-backup");
  await expectUnreadable(() => f.metadata.read(f.repo), f.metaPath, false);
  await expectUnreadable(() => f.metadata.write(f.repo, record("replacement")), f.metaPath, false);
  assert.equal(f.files.get(f.metaPath), "{broken-primary");
  assert.equal(f.files.get(f.backupPath), "{broken-backup");
  assert.equal(f.operations.length, 0);
});

await safetyCase("read permission errors do not erase or reinitialize history", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("valid"));
  const writes = f.operations.length;
  f.hooks.beforeRead = (path) => {
    if (path === f.metaPath) throw new Error("injected access denied");
  };
  await expectUnreadable(() => f.metadata.read(f.repo), f.metaPath, true);
  await expectUnreadable(() => f.metadata.write(f.repo, record("overwrite")), f.metaPath, true);
  assert.equal(f.operations.length, writes);
});

await safetyCase("a corrupt backup can be replaced from a valid primary", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("valid"));
  const previous = f.files.get(f.metaPath);
  f.files.set(f.backupPath, "{broken-backup");
  await f.metadata.write(f.repo, record("new"));
  assert.equal(f.files.get(f.backupPath), previous);
  assert.equal((await f.metadata.read(f.repo)).generation, "new");
});

await safetyCase("temporary-file verification failure never publishes damaged JSON", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("previous"));
  const previous = f.files.get(f.metaPath);
  f.hooks.afterWrite = (path) => { f.files.set(path, "{damaged-temporary"); };
  await assert.rejects(() => f.metadata.write(f.repo, record("new")));
  assert.equal(f.files.get(f.metaPath), previous);
  assert.equal(f.files.get(f.backupPath), previous);
  f.assertNoDestructiveReplacement();
});

await safetyCase("backup readback failure stops before publishing the new primary", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("previous"));
  const previous = f.files.get(f.metaPath);
  let backupPublished = false;
  f.hooks.afterMove = (_source, target) => { if (target === f.backupPath) backupPublished = true; };
  f.hooks.beforeRead = (path) => {
    if (backupPublished && path === f.backupPath) throw new Error("injected backup readback failure");
  };
  await assert.rejects(() => f.metadata.write(f.repo, record("new")), /backup readback failure/);
  assert.equal(f.files.get(f.metaPath), previous);
  assert.equal(f.files.get(f.backupPath), previous);
});

await safetyCase("post-replacement corruption remains recoverable from the valid backup", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("previous"));
  f.hooks.afterMove = (_source, target) => {
    if (target === f.metaPath) f.files.set(target, "{injected storage corruption");
  };
  await assert.rejects(() => f.metadata.write(f.repo, record("new")));
  assert.equal(JSON.parse(f.files.get(f.backupPath)).generation, "previous");
  await expectUnreadable(() => f.metadata.read(f.repo), f.metaPath, true);
});

for (const capability of ["writeUTF8", "readUTF8", "move", "stat"]) {
  await safetyCase(`missing ${capability} capability never enables destructive fallback`, async () => {
    const f = fixture();
    f.files.set(f.metaPath, JSON.stringify(record("previous")));
    const previous = f.files.get(f.metaPath);
    f.io[capability] = undefined;
    await assert.rejects(() => f.platform.atomicWriteText(f.metaPath, "new"));
    assert.equal(f.files.get(f.metaPath), previous);
    assert.equal(f.operations.length, 0);
  });
}

await safetyCase("stores refuse a platform without atomic writes", async () => {
  const f = fixture();
  f.platform.atomicWriteText = undefined;
  await assert.rejects(() => f.metadata.write(f.repo, record("new")));
  await assert.rejects(() => f.index.upsertAttachment(f.attachment, { enabled: true }));
  assert.equal(f.operations.length, 0);
});

await safetyCase("temporary-name collisions never alter or remove existing files", async () => {
  const f = fixture();
  const collided = [];
  f.files.set(f.metaPath, "original");
  f.hooks.beforeWrite = (path) => {
    collided.push(path);
    f.files.set(path, `existing-${collided.length}`);
  };
  await assert.rejects(() => f.platform.atomicWriteText(f.metaPath, "new"));
  assert.equal(collided.length, 5);
  assert.equal(new Set(collided).size, 5);
  collided.forEach((path, i) => assert.equal(f.files.get(path), `existing-${i + 1}`));
  assert.equal(f.files.get(f.metaPath), "original");
  assert.equal(f.operations.filter((op) => op.kind === "remove").length, 0);
});

await safetyCase("a single temporary-name collision is retried without changing the collided file", async () => {
  const f = fixture();
  let collisionPath = "";
  f.hooks.beforeWrite = (path) => {
    if (!collisionPath) {
      collisionPath = path;
      f.files.set(path, "pre-existing temporary file");
    }
  };
  await f.platform.atomicWriteText(f.metaPath, "published");
  assert.equal(f.files.get(f.metaPath), "published");
  assert.equal(f.files.get(collisionPath), "pre-existing temporary file");
  assert.equal(f.operations.filter((op) => op.kind === "write").length, 2);
  f.assertNoDestructiveReplacement();
});

await safetyCase("cleanup errors retain the original replacement failure and release the write guard", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("previous"));
  f.hooks.beforeMove = () => { throw new Error("original replacement failure"); };
  f.io.remove = async () => { throw new Error("secondary cleanup failure"); };
  await assert.rejects(() => f.metadata.write(f.repo, record("failed")), /original replacement failure/);
  assert.equal((await f.metadata.read(f.repo)).generation, "previous");
  f.hooks.beforeMove = null;
  await f.metadata.write(f.repo, record("retry"));
  assert.equal((await f.metadata.read(f.repo)).generation, "retry");
});

await safetyCase("a directory destination is rejected before any file is created", async () => {
  const f = fixture();
  f.directories.add(f.metaPath);
  await assert.rejects(() => f.platform.atomicWriteText(f.metaPath, "new"));
  assert.equal(f.operations.length, 0);
});

await safetyCase("invalid new records and future schema are rejected before backup rotation", async () => {
  const f = fixture();
  await f.metadata.write(f.repo, record("previous"));
  const previous = f.files.get(f.metaPath);
  const writes = f.operations.length;
  for (const value of [null, [], {}, { versions: "bad" }, { schemaVersion: 99, versions: [] }]) {
    await assert.rejects(() => f.metadata.write(f.repo, value));
  }
  assert.equal(f.files.get(f.metaPath), previous);
  assert.equal(f.files.get(f.backupPath), previous);
  assert.equal(f.operations.length, writes);
});

await safetyCase("legacy metadata migrates only in memory and preserves its original backup", async () => {
  const f = fixture();
  const legacy = JSON.stringify({ versions: [{ id: "legacy", commitHash: "a".repeat(40), createdAt: "2020-01-01", fileHash: "size-7" }] });
  f.files.set(f.metaPath, legacy);
  const migrated = await f.metadata.read(f.repo);
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.enabled, true);
  assert.equal(migrated.versions[0].fileHash, "size-7");
  assert.equal(f.operations.length, 0);
  await f.metadata.write(f.repo, migrated);
  assert.equal(f.files.get(f.backupPath), legacy);
  assert.equal((await f.metadata.read(f.repo)).versions[0].fileHash, "size-7");
});

for (const damage of ["corrupt", "missing"]) {
  await safetyCase(`${damage} index cannot become an empty index during upsert`, async () => {
    const f = fixture();
    await f.index.upsertAttachment(f.attachment, { enabled: true });
    if (damage === "corrupt") f.files.set(f.indexPath, "{broken-index");
    else f.files.delete(f.indexPath);
    const oldBackup = f.files.get(`${f.indexPath}.bak`);
    const writes = f.operations.length;
    await expectUnreadable(() => f.index.read(), f.indexPath, true);
    await expectUnreadable(() => f.index.upsertAttachment({ ...f.attachment, itemKey: "OTHER" }, { enabled: true }), f.indexPath, true);
    assert.equal(f.files.get(`${f.indexPath}.bak`), oldBackup);
    assert.equal(f.operations.length, writes);
  });
}

for (const damage of ["corrupt", "absent"]) {
  await safetyCase(`index maintenance preserves entries for ${damage} repository metadata`, async () => {
    const f = fixture();
    await f.metadata.write(f.repo, record("valid", f.attachment));
    await f.index.upsertAttachment(f.attachment, { enabled: true });
    if (damage === "corrupt") f.files.set(f.metaPath, "{broken");
    else { f.files.delete(f.metaPath); f.files.delete(f.backupPath); }
    const cleanup = new RepositoryCleanupService({ platform: f.platform, metadataStore: f.metadata, indexStore: f.index });
    if (damage === "corrupt") await assert.rejects(() => cleanup.ensureIndex());
    else await cleanup.ensureIndex();
    assert.equal((await f.index.read()).repositories[0].itemKey, f.attachment.itemKey);
  });
}

await safetyCase("classic and ES-module stores serialize a complete backup/primary pair", async () => {
  const source = await buildRuntimeScript();
  const marker = "__git4zoteroRuntimeGlobal.Git4Zotero = Git4Zotero;";
  const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, console });
  vm.runInContext(source.replace(marker, `${marker}\n__git4zoteroRuntimeGlobal.__metadataTests = { MetadataStore };`), context);
  const f = fixture();
  await f.metadata.write(f.repo, record("initial"));
  const entered = deferred();
  const release = deferred();
  let waiting = false;
  f.hooks.beforeWrite = async (path) => {
    if (!waiting && path.startsWith(`${f.backupPath}.tmp-`)) {
      waiting = true;
      entered.resolve();
      await release.promise;
    }
  };
  const classic = new context.__metadataTests.MetadataStore(f.platform);
  const first = classic.write(f.repo, record("classic"));
  await entered.promise;
  const writes = f.operations.length;
  let secondFinished = false;
  const second = f.metadata.write(f.repo, record("module")).then(() => { secondFinished = true; });
  await checkpoint();
  assert.equal(secondFinished, false);
  assert.equal(f.operations.length, writes, "the second store must not rotate the backup while the first is writing");
  release.resolve();
  await Promise.all([first, second]);
  assert.equal((await f.metadata.read(f.repo)).generation, "module");
  assert.equal(JSON.parse(f.files.get(f.backupPath)).generation, "classic");
});

console.log(`Metadata safety regression tests passed (${scenarios} scenarios; in-memory only).`);

async function safetyCase(name, operation) {
  let timer;
  try {
    await Promise.race([operation(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Metadata safety test timed out: ${name}`)), 4000);
    })]);
    scenarios += 1;
  }
  catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
  finally { clearTimeout(timer); }
}

async function expectUnreadable(operation, path, backupAvailable) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.name, "ProtectedJSONError");
    assert.equal(error.code, "PROTECTED_JSON_UNREADABLE");
    assert.equal(error.path, path);
    assert.equal(error.backupPath, `${path}.bak`);
    assert.equal(error.backupAvailable, backupAvailable);
    assert(error.message.includes(path));
    if (backupAvailable) assert(error.message.includes(`${path}.bak`));
    return true;
  });
}

function record(generation, attachment = null) {
  return {
    ...createEmptyMetadata(), enabled: true, generation,
    item: attachment ? { libraryID: attachment.libraryID, itemID: attachment.itemID, itemKey: attachment.itemKey } : null,
    attachment: attachment ? { attachmentID: attachment.attachmentID, attachmentKey: attachment.attachmentKey } : null
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const root = `memory/metadata-safety-${++fixtureID}`;
  const repo = `${root}/git4zotero/library-1/item-PAPER`;
  const files = new Map();
  const directories = new Set();
  const operations = [];
  const hooks = {};
  const missing = () => Object.assign(new Error("missing in-memory file"), { name: "NotFoundError" });
  const io = {
    exists: async (path) => files.has(path) || directories.has(path),
    makeDirectory: async (path) => {
      const parts = path.split("/");
      for (let index = 1; index <= parts.length; index += 1) directories.add(parts.slice(0, index).join("/"));
    },
    getChildren: async (path) => [...new Set([...directories, ...files.keys()])].filter((entry) => entry.slice(0, entry.lastIndexOf("/")) === path),
    stat: async (path) => {
      if (directories.has(path)) return { type: "directory", size: 0 };
      if (!files.has(path)) throw missing();
      return { type: "regular", size: files.get(path).length };
    },
    readUTF8: async (path) => {
      await hooks.beforeRead?.(path);
      if (!files.has(path)) throw missing();
      return files.get(path);
    },
    writeUTF8: async (path, content, options = {}) => {
      operations.push({ kind: "write", path, options });
      await hooks.beforeWrite?.(path, content, options);
      if (options.mode === "create" && files.has(path)) throw Object.assign(new Error("destination exists"), { name: "NoModificationAllowedError" });
      files.set(path, content);
      await hooks.afterWrite?.(path, content, options);
    },
    move: async (source, path, options = {}) => {
      operations.push({ kind: "move", source, path, options });
      await hooks.beforeMove?.(source, path);
      assert.equal(source.slice(0, source.lastIndexOf("/")), path.slice(0, path.lastIndexOf("/")), "atomic replacement must stay in the same directory");
      assert.equal(options.noOverwrite, false);
      assert(files.has(source));
      files.set(path, files.get(source));
      files.delete(source);
      await hooks.afterMove?.(source, path);
    },
    remove: async (path) => {
      operations.push({ kind: "remove", path });
      files.delete(path);
    },
    copy: async () => assert.fail("atomic writes must not fall back to copy")
  };
  const platform = new ZoteroPlatform({
    Zotero: {}, Services: { dirsvc: { get: () => ({ path: root }) } },
    Cc: {}, Ci: { nsIFile: null }, IOUtils: io, PathUtils: null
  });
  const metadata = new MetadataStore(platform);
  const index = new RepositoryIndexStore(platform);
  const metaPath = metadata.getMetadataPath(repo);
  const indexPath = index.getIndexPath();
  return {
    files, directories, operations, hooks, io, platform, metadata, index, repo, metaPath,
    backupPath: `${metaPath}.bak`, indexPath,
    attachment: { libraryID: 1, itemID: 2, itemKey: "PAPER", attachmentID: 3, attachmentKey: "WORD" },
    assertNoDestructiveReplacement: () => {
      for (const op of operations) {
        if (op.kind === "remove") assert(op.path.includes(".tmp-"), `must never remove a primary or backup: ${op.path}`);
        if (op.kind === "write") assert(op.path.includes(".tmp-"), `must never directly overwrite a primary or backup: ${op.path}`);
      }
    }
  };
}
