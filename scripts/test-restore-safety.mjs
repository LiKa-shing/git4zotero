import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MetadataStore } from "../chrome/content/src/metadata.mjs";
import { ZoteroPlatform } from "../chrome/content/src/platform.mjs";
import { VersionService } from "../chrome/content/src/version-service.mjs";
import { PREFS } from "../chrome/content/src/constants.mjs";

// All IO is simulated. File objects are distinct from directory entries so an
// editor's existing handle can keep writing the same object during a restore.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
let fixtureCount = 0;
let scenarioCount = 0;

for (const phase of ["after-backup", "after-staging-hash", "during-output-write", "during-output-validation"]) {
  await restoreCase(`same-length editor save ${phase} survives safe-copy restoration`, async () => {
    const f = fixture();
    const version = await f.baseline();
    f.editorSave("CURRENT");
    const preflight = await f.service.buildRestorePreflight({}, version);
    let injected = false;
    const save = () => { injected = true; f.editorSave("LATEST!"); };
    f.hooks.afterWrite = (path) => {
      if (!injected && phase === "after-backup" && path === preflight.backupPath) save();
    };
    f.hooks.beforeWrite = (path) => {
      if (!injected && phase === "during-output-write" && f.isOutput(path)) save();
    };
    f.hooks.afterRead = (path) => {
      if (!injected && phase === "after-staging-hash" && path === preflight.stagedPath) save();
      if (!injected && phase === "during-output-validation" && f.isOutput(path)) save();
    };
    const result = await f.service.restoreVersion({}, version, { preflight });
    assert(injected, "the intended save point must be exercised");
    assert.equal(f.text(), "LATEST!");
    await assertSafeCopy(f, result, version);
    assert.equal(f.readText(preflight.backupPath), "CURRENT");
    f.assertCurrentUntouched();
  });
}

await restoreCase("Word-style replace and an existing editor handle remain independent of restoration", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const handle = f.openEditorHandle();
  const preflight = await f.service.buildRestorePreflight({}, version);
  let originalHandleSaved = false;
  let replaced = false;
  f.hooks.afterWrite = (path) => {
    if (path === preflight.backupPath) {
      handle.save("HANDLE!");
      originalHandleSaved = true;
      assert.equal(f.text(), "HANDLE!");
    }
  };
  f.hooks.beforeWrite = (path) => {
    if (f.isOutput(path)) {
      f.editorReplace("NEWEST!");
      replaced = true;
    }
  };
  const result = await f.service.restoreVersion({}, version, { preflight });
  assert(originalHandleSaved && replaced);
  assert.equal(f.text(), "NEWEST!");
  assert.equal(handle.text(), "HANDLE!");
  await assertSafeCopy(f, result, version);
  f.assertCurrentUntouched();
});

await restoreCase("the safety commit does not become a source for overwriting newer editor saves", async () => {
  const f = fixture({ safety: true });
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const preflight = await f.service.buildRestorePreflight({}, version);
  f.hooks.afterWrite = (path) => {
    if (path === preflight.backupPath) f.editorSave("LATEST!");
  };
  const result = await f.service.restoreVersion({}, version, { preflight });
  assert.equal(result.safetyVersion.kind, "safety");
  assert.equal(decoder.decode(f.commits.get(result.safetyVersion.commitHash)), "CURRENT");
  assert.equal(f.text(), "LATEST!");
  await assertSafeCopy(f, result, version);
  f.assertCurrentUntouched();
});

await restoreCase("copy validation failure never rolls a backup over a concurrent save", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const preflight = await f.service.buildRestorePreflight({}, version);
  let failedCopyPath = "";
  f.hooks.afterWrite = (path) => {
    if (f.isOutput(path)) {
      failedCopyPath = path;
      f.replaceMemoryFile(path, "CORRUPT");
      f.editorSave("LATEST!");
    }
  };
  await assert.rejects(() => f.service.restoreVersion({}, version, { preflight }));
  assert(failedCopyPath);
  assert.equal(f.text(), "LATEST!");
  assert.equal(f.readText(preflight.backupPath), "CURRENT");
  assert.equal((await f.metadata()).lastRestored, null);
  f.assertCurrentUntouched();
});

for (const phase of ["backup", "staged", "output"]) {
  await restoreCase(`${phase} write failure preserves concurrent editor content`, async () => {
    const f = fixture();
    const version = await f.baseline();
    f.editorSave("CURRENT");
    const preflight = await f.service.buildRestorePreflight({}, version);
    let writes = 0;
    f.hooks.beforeWrite = (path) => {
      const target = phase === "backup" ? path === preflight.backupPath
        : phase === "staged" ? path === preflight.stagedPath : f.isOutput(path);
      if (target) {
        writes += 1;
        f.editorSave("LATEST!");
        throw new Error(`injected ${phase} disk failure`);
      }
    };
    await assert.rejects(() => f.service.restoreVersion({}, version, { preflight }), /disk failure/);
    assert.equal(writes, 1, "non-collision errors should not retry the write");
    assert.equal(f.text(), "LATEST!");
    assert.equal((await f.metadata()).lastRestored, null);
    f.assertCurrentUntouched();
  });
}

for (const phase of ["backup", "staged"]) {
  await restoreCase(`existing ${phase} files are neither overwritten nor removed`, async () => {
    const f = fixture();
    const version = await f.baseline();
    f.editorSave("CURRENT");
    const preflight = await f.service.buildRestorePreflight({}, version);
    const path = phase === "backup" ? preflight.backupPath : preflight.stagedPath;
    f.replaceMemoryFile(path, "EXISTING RETAINED CONTENT");
    await assert.rejects(() => f.service.restoreVersion({}, version, { preflight }));
    assert.equal(f.readText(path), "EXISTING RETAINED CONTENT");
    assert.equal(f.text(), "CURRENT");
    assert.equal((await f.metadata()).lastRestored, null);
    f.assertCurrentUntouched();
  });
}

await restoreCase("an output name collision retries without replacing the existing file", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const preflight = await f.service.buildRestorePreflight({}, version);
  assert(preflight.restoredCopyPath);
  f.replaceMemoryFile(preflight.restoredCopyPath, "EXISTING COPY");
  const result = await f.service.restoreVersion({}, version, { preflight });
  assert.notEqual(result.restoredCopyPath, preflight.restoredCopyPath);
  assert.equal(f.readText(preflight.restoredCopyPath), "EXISTING COPY");
  assert.equal(f.text(), "CURRENT");
  await assertSafeCopy(f, result, version);
  f.assertCurrentUntouched();
});

await restoreCase("collisions arising at exclusive creation are bounded and preserve every existing file", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const preflight = await f.service.buildRestorePreflight({}, version);
  const collided = [];
  f.hooks.beforeWrite = (path) => {
    if (f.isOutput(path)) {
      collided.push(path);
      f.replaceMemoryFile(path, `EXISTING-${collided.length}`);
      f.editorSave("LATEST!");
    }
  };
  await assert.rejects(() => f.service.restoreVersion({}, version, { preflight }));
  assert(collided.length > 1 && collided.length <= 5);
  assert.equal(new Set(collided).size, collided.length);
  collided.forEach((path, index) => assert.equal(f.readText(path), `EXISTING-${index + 1}`));
  assert.equal(f.text(), "LATEST!");
  assert.equal((await f.metadata()).lastRestored, null);
  f.assertCurrentUntouched();
});

await restoreCase("missing exclusive-write capability fails closed", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const preflight = await f.service.buildRestorePreflight({}, version);
  f.platform.writeNewFile = undefined;
  await assert.rejects(() => f.service.restoreVersion({}, version, { preflight }));
  assert.equal(f.text(), "CURRENT");
  assert.equal((await f.metadata()).lastRestored, null);
  assert.equal(f.operations.filter((entry) => f.isOutput(entry.path)).length, 0);
  f.assertCurrentUntouched();
});

await restoreCase("preflight probe collision never removes an existing file", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  let probePath = "";
  f.hooks.beforeWrite = (path, options) => {
    if (path.includes("/.git4zotero/restored-copies/.write-test-") && path.endsWith(".tmp")) {
      probePath = path;
      assert.equal(options.mode, "create");
      f.replaceMemoryFile(path, "EXISTING PROBE NAME");
    }
  };
  const preflight = await f.service.buildRestorePreflight({}, version);
  assert(probePath, "the preflight must test the restore-copy directory");
  assert.equal(preflight.ok, false);
  assert.equal(preflight.checks.find((check) => check.id === "writable").status, "error");
  assert.equal(f.readText(probePath), "EXISTING PROBE NAME");
  assert(!f.operations.some((entry) => entry.kind === "remove" && entry.path === probePath));
  assert.equal(f.text(), "CURRENT");
  f.assertCurrentUntouched();
});

await restoreCase("preflight and safe-copy restoration work with a read-only manuscript directory", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const start = f.operations.length;
  const rejectAttachmentDirectoryWrites = (path) => {
    if (!path.startsWith(`${f.repo}/`)) throw new Error("manuscript directory is read-only");
  };
  f.hooks.beforeWrite = rejectAttachmentDirectoryWrites;
  f.hooks.beforeWriteText = rejectAttachmentDirectoryWrites;
  const preflight = await f.service.buildRestorePreflight({}, version);
  assert.equal(preflight.ok, true);
  assert(preflight.checks.find((check) => check.id === "writable").detail.includes("/.git4zotero/restored-copies"));
  const result = await f.service.restoreVersion({}, version, { preflight });
  await assertSafeCopy(f, result, version);
  assert.equal(f.text(), "CURRENT");
  assert(f.operations.slice(start).every((entry) => entry.path.startsWith(`${f.repo}/`)));
  f.assertCurrentUntouched();
});

for (const key of ["backupPath", "stagedPath", "restoredCopyPath"]) {
  await restoreCase(`tampered ${key} cannot redirect recovery writes to the attachment`, async () => {
    const f = fixture();
    const version = await f.baseline();
    f.editorSave("CURRENT");
    const preflight = await f.service.buildRestorePreflight({}, version);
    preflight[key] = f.path;
    const start = f.operations.length;
    await assert.rejects(() => f.service.restoreVersion({}, version, { preflight }));
    assert.equal(f.operations.length, start, "invalid recovery paths must fail before artifact writes");
    assert.equal(f.text(), "CURRENT");
    assert.equal((await f.metadata()).lastRestored, null);
    f.assertCurrentUntouched();
  });
}

await restoreCase("preflight stamps cannot escape the recovery directories", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const preflight = await f.service.buildRestorePreflight({}, version, { stamp: "../outside\\nested" });
  assert.equal(preflight.ok, true);
  for (const key of ["backupPath", "stagedPath", "restoredCopyPath"]) {
    assert(preflight[key].startsWith(`${f.repo}/.git4zotero/`));
    assert(!preflight[key].replace(/\\/g, "/").split("/").includes(".."));
  }
  const result = await f.service.restoreVersion({}, version, { preflight });
  await assertSafeCopy(f, result, version);
  assert.equal(f.text(), "CURRENT");
  f.assertCurrentUntouched();
});

await restoreCase("metadata failure still identifies the verified restored copy", async () => {
  const f = fixture();
  const version = await f.baseline();
  f.editorSave("CURRENT");
  const preflight = await f.service.buildRestorePreflight({}, version);
  let outputPath = "";
  f.hooks.afterWrite = (path) => { if (f.isOutput(path)) outputPath = path; };
  f.hooks.beforeWriteText = (path) => {
    if (path.endsWith("/.git4zotero/versions.json")) {
      f.editorSave("LATEST!");
      throw new Error("injected metadata failure");
    }
  };
  await assert.rejects(() => f.service.restoreVersion({}, version, { preflight }), (error) => {
    assert(outputPath);
    assert(error.message.includes(outputPath), "the completed copy must remain discoverable if recording fails");
    return true;
  });
  assert.equal(f.readText(outputPath), "VERSION");
  assert.equal(f.text(), "LATEST!");
  assert.equal((await f.metadata()).lastRestored, null);
  f.assertCurrentUntouched();
});

console.log(`Restore safety regression tests passed (${scenarioCount} scenarios; in-memory only).`);

async function restoreCase(name, operation) {
  try {
    await operation();
    scenarioCount += 1;
  }
  catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

async function assertSafeCopy(f, result, version) {
  assert.equal(result.mode, "copy");
  assert(result.restoredCopyPath.includes("/.git4zotero/restored-copies/"));
  assert.equal(f.readText(result.restoredCopyPath), "VERSION");
  assert.equal(result.restoredFileHash, digest(encoder.encode("VERSION")));
  const recorded = (await f.metadata()).lastRestored;
  assert.equal(recorded.mode, "copy");
  assert.equal(recorded.restoredCopyPath, result.restoredCopyPath);
  assert.equal(recorded.commitHash, version.commitHash);
  assert.equal(recorded.restoredFileHash, result.restoredFileHash);
}

function fixture({ safety = false } = {}) {
  const root = `memory/restore-safety-${++fixtureCount}`;
  const path = `${root}/paper.doc`;
  const repo = `${root}/git4zotero/library-1/item-PAPER`;
  const files = new Map();
  const directories = new Set();
  const commits = new Map();
  const hooks = {};
  const operations = [];
  const isOutput = (value) => value.includes("/.git4zotero/restored-copies/") && !value.endsWith(".tmp");
  const bytesAt = (value) => {
    assert(files.has(value), `Missing in-memory file: ${value}`);
    return files.get(value).bytes.slice();
  };
  const mutation = (kind, target) => {
    operations.push({ kind, path: target });
    assert.notEqual(target, path, `restore must not ${kind} the current manuscript`);
  };
  const io = {
    exists: async (target) => files.has(target) || directories.has(target),
    makeDirectory: async (target) => directories.add(target),
    stat: async (target) => {
      if (directories.has(target)) return { type: "directory", size: 0 };
      if (!files.has(target)) {
        const error = new Error("memory file missing");
        error.name = "NotFoundError";
        throw error;
      }
      return { type: "regular", size: bytesAt(target).byteLength };
    },
    read: async (target) => {
      const bytes = bytesAt(target);
      await hooks.afterRead?.(target, bytes);
      return bytes;
    },
    readUTF8: async (target) => decoder.decode(bytesAt(target)),
    write: async (target, bytes, options = {}) => {
      mutation("write", target);
      await hooks.beforeWrite?.(target, options);
      if (options.mode === "create" && files.has(target)) {
        const error = new Error(`Already exists: ${target}`);
        error.name = "NoModificationAllowedError";
        throw error;
      }
      if (target.includes("/.git4zotero/restore-backups/") || isOutput(target)) {
        assert.equal(options.mode, "create", "recovery artifacts require exclusive creation");
        assert.equal(options.flush, true);
      }
      files.set(target, { bytes: new Uint8Array(bytes) });
      await hooks.afterWrite?.(target, options);
    },
    writeUTF8: async (target, content, options = {}) => {
      mutation("writeText", target);
      await hooks.beforeWriteText?.(target.replace(/\.tmp-.*$/, ""));
      if (options.mode === "create" && files.has(target)) {
        const error = new Error("destination exists");
        error.name = "NoModificationAllowedError";
        throw error;
      }
      files.set(target, { bytes: encoder.encode(content) });
    },
    copy: async (source, target) => {
      mutation("copy", target);
      files.set(target, { bytes: bytesAt(source) });
    },
    move: async (source, target) => {
      mutation("move", target);
      mutation("move-source", source);
      assert(files.has(source));
      files.set(target, files.get(source));
      files.delete(source);
    },
    remove: async (target) => { mutation("remove", target); files.delete(target); }
  };
  const platform = new ZoteroPlatform({
    Zotero: { Prefs: { get: (key) => key === PREFS.autoSafetyVersion ? safety : undefined } },
    Services: { dirsvc: { get: () => ({ path: root }) } },
    Cc: {}, Ci: { nsIFile: null }, IOUtils: io, PathUtils: null
  });
  const metadataStore = new MetadataStore(platform);
  const attachment = {
    libraryID: 1, itemID: 1, itemKey: "PAPER", attachmentID: 2, attachmentKey: "WORD",
    fileName: "paper.doc", filePath: path, extension: ".doc"
  };
  const service = new VersionService({
    platform, metadataStore, pluginVersion: "0.7.1",
    attachmentFinder: { findManageableAttachment: async () => attachment },
    gitBackend: {
      checkAvailability: async () => ({ available: true, detail: "simulated Git only" }),
      ensureRepo: async () => directories.add(`${repo}/.git`),
      getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: "clean" }),
      commitSnapshot: async (_repo, snapshot) => {
        const hash = createHash("sha1").update(`${root}:${commits.size}`).digest("hex");
        commits.set(hash, bytesAt(`${repo}/${snapshot.trackedRelativePath}`));
        return { hash };
      },
      checkoutTrackedFile: async (_repo, hash, relativePath) => {
        assert(commits.has(hash));
        files.set(`${repo}/${relativePath}`, { bytes: commits.get(hash).slice() });
      }
    }
  });
  return {
    platform, service, metadataStore, commits, hooks, operations, path, repo, isOutput,
    readText: (target) => decoder.decode(bytesAt(target)),
    text: () => decoder.decode(bytesAt(path)),
    metadata: () => metadataStore.read(repo),
    editorSave(text) { files.get(path).bytes = encoder.encode(text); },
    editorReplace(text) { files.set(path, { bytes: encoder.encode(text) }); },
    replaceMemoryFile(target, text) { files.set(target, { bytes: encoder.encode(text) }); },
    openEditorHandle() {
      const node = files.get(path);
      return { save: (text) => { node.bytes = encoder.encode(text); }, text: () => decoder.decode(node.bytes) };
    },
    async baseline() {
      files.set(path, { bytes: encoder.encode("VERSION") });
      await service.enableVersionManagement({});
      return service.createVersion({}, "historic version");
    },
    assertCurrentUntouched() { assert(operations.every((entry) => entry.path !== path)); }
  };
}
