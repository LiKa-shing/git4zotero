import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { AttachmentFinder } from "../chrome/content/src/attachments.mjs";
import { inspectAttachmentOwnership } from "../chrome/content/src/attachment-binding.mjs";
import { MetadataStore, createEmptyMetadata } from "../chrome/content/src/metadata.mjs";
import { RepositoryCleanupService, RepositoryIndexStore } from "../chrome/content/src/cleanup.mjs";
import { RepositoryArchiveService } from "../chrome/content/src/archive.mjs";
import { VersionService } from "../chrome/content/src/version-service.mjs";
import { PaperVersionMenu } from "../chrome/content/src/menu.mjs";
import { ReviewWindowManager } from "../chrome/content/src/review-window-manager.mjs";
import { withRepositoryLock } from "../chrome/content/src/repository-lock.mjs";
import { PREFS, UI_TEXT } from "../chrome/content/src/constants.mjs";

// All items, files, commits and removals are simulated in memory. This suite
// never connects to Zotero, reads a profile or launches a Git executable.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
let fixtureID = 0;
let passed = 0;

await isolationCase("multiple unbound Word attachments require an explicit selection", async () => {
  const f = fixture();
  const candidates = await f.finder.findManageableAttachments(f.parent);
  assert.deepEqual(candidates.map((entry) => entry.attachmentKey), ["WORD_A", "WORD_B"]);
  await assert.rejects(() => f.finder.findManageableAttachment(f.parent));
  assert.equal((await f.finder.findManageableAttachment(f.a)).attachmentKey, "WORD_A");
  assert.equal((await f.finder.findManageableAttachment(f.b)).attachmentKey, "WORD_B");
  await f.noMutation(() => assert.rejects(() => f.service.enableVersionManagement(f.parent)));
});

await isolationCase("a single Word attachment still supports the parent-item workflow", async () => {
  const f = fixture();
  f.parent.getAttachments = () => [f.a.id];
  await f.service.enableVersionManagement(f.parent);
  const created = await f.service.createVersion(f.parent, "single attachment");
  assert.equal(created.zotero.attachmentKey, "WORD_A");
  assert.equal((await f.metadata()).attachment.attachmentKey, "WORD_A");
});

await isolationCase("the menu stays relevant for multiple Word attachments and follows the existing binding", async () => {
  const f = fixture();
  const menu = new PaperVersionMenu({ service: f.service, archiveService: f.archive, platform: f.platform });
  assert.equal(await menu.isMenuRelevant({ items: [f.parent] }), true);
  await f.baseline();
  f.parent.getAttachments = () => [f.b.id, f.a.id];
  assert.equal((await menu.getArchiveTarget(f.parent)).attachment.attachmentKey, "WORD_A");
  const state = await menu.getMenuState({ items: [f.b] });
  for (const action of ["enable", "disable", "check", "create", "restore"]) {
    const entry = state.actions.find((candidate) => candidate.definition.action === action);
    assert.equal(entry.disabled, true, `${action} must be unavailable in read-only history`);
    assert(entry.reason);
  }
  assert.equal(state.actions.find((entry) => entry.definition.action === "export").disabled, false);
  assert.equal(state.actions.find((entry) => entry.definition.action === "exportArchive").disabled, false);
});

await isolationCase("missing translated warning text cannot authorize writes to another attachment's history", async () => {
  const f = fixture();
  await f.baseline();
  const previous = UI_TEXT.attachmentHistoryMismatch;
  try {
    UI_TEXT.attachmentHistoryMismatch = "";
    assert.equal((await f.service.getPanelState(f.b)).historyReadOnly, true);
    await f.noMutation(() => assert.rejects(() => f.service.createVersion(f.b, "must stay blocked")));
  }
  finally { UI_TEXT.attachmentHistoryMismatch = previous; }
});

await isolationCase("a bound parent follows its attachment even when candidate order changes", async () => {
  const f = fixture();
  await f.baseline();
  f.parent.getAttachments = () => [f.b.id, f.a.id];
  f.editorSave(f.a, "A next draft");
  const state = await f.service.getPanelState(f.parent);
  assert.equal(state.attachment.attachmentKey, "WORD_A");
  const created = await f.service.createVersion(f.parent, "A via parent");
  assert.equal(created.zotero.attachmentKey, "WORD_A");
  assert.equal(f.committedText(created), "A next draft");
  assert((await f.metadata()).versions.every((version) => version.zotero.attachmentKey === "WORD_A"));
});

for (const action of ["enable", "disable", "check", "create", "restore", "compare-current"]) {
  await isolationCase(`a different attachment cannot ${action} the bound history`, async () => {
    const f = fixture();
    const baseline = await f.baseline();
    f.editorSave(f.b, "B unrelated manuscript");
    const operations = {
      enable: () => f.service.enableVersionManagement(f.b),
      disable: () => f.service.disableVersionManagement(f.b),
      check: () => f.service.checkCurrentChange(f.b),
      create: () => f.service.createVersion(f.b, "must not mix"),
      restore: () => f.service.restoreVersion(f.b, baseline),
      "compare-current": () => f.service.compareVersions(f.b, baseline.commitHash, "current")
    };
    await f.noMutation(() => assert.rejects(operations[action]));
    assert.equal((await f.metadata()).attachment.attachmentKey, "WORD_A");
    assert.equal(f.commits.size, 1);
  });
}

await isolationCase("viewing a sibling attachment exposes existing history as read-only", async () => {
  const f = fixture();
  await f.baseline();
  await f.noMutation(async () => {
    const state = await f.service.getPanelState(f.b);
    assert.equal(state.historyReadOnly, true);
    assert(state.ownershipWarning);
    assert.equal(state.versions.length, 1);
    const history = await f.service.getVersionHistory(f.b);
    assert.equal(history[0].zotero.attachmentKey, "WORD_A");
  });
});

await isolationCase("reading a sibling's historical diff never triggers metadata repair", async () => {
  const f = fixture();
  const version = {
    ...f.historical(f.a, "historical content"),
    contentSnapshot: { paragraphs: ["historical paragraph"], paragraphCount: 1, wordCount: 2, sections: [] },
    contentHash: digest(encoder.encode("historical paragraph")),
    changeSummary: { changeType: "first-version", summary: "saved historical content", paragraphChanges: [] }
  };
  await f.seed({ ...f.boundMetadata(f.a), versions: [version] });
  await f.noMutation(async () => {
    await f.service.getVersionDiffIndex(f.b, version);
    await f.service.loadVersionDiffPage(f.b, version);
    await f.service.searchVersionDiff(f.b, version);
    await f.service.loadVersionDiffChanges(f.b, version, { changeIDs: ["absent"] });
    await f.service.buildCompleteVersionMarkdown(f.b, version);
    const repair = await f.service.previewVersionDiffRepair(f.b, version);
    assert.equal(repair.canRebuild, false);
    assert.equal(repair.wouldWrite, false);
  });
});

await isolationCase("read-only review windows retain browsing while blocking derived writes", async () => {
  const f = fixture();
  await f.baseline();
  const [version] = await f.service.getVersionHistory(f.b);
  assert.equal(version.historyReadOnly, true);
  const derivedWrites = [];
  const copied = [];
  f.platform.copyTextToClipboard = (content) => copied.push(content);
  const manager = new ReviewWindowManager({
    platform: f.platform,
    service: f.service,
    reviewStateStore: {
      load: async () => ({ existing: { status: "confirmed" } }),
      update: () => derivedWrites.push("review")
    },
    aiReviewService: {
      isAvailable: () => true,
      preview: () => derivedWrites.push("preview"),
      generateSummary: () => derivedWrites.push("AI"),
      clearCache: () => derivedWrites.push("clear-AI")
    }
  });
  const payload = manager.createPayload(version, "read-only", f.b);
  assert.equal(payload.historyReadOnly, true);
  assert.equal(payload.aiAvailable, false);
  await f.noMutation(async () => {
    await payload.loadIndex();
    await payload.search({});
    await payload.copyMarkdown({});
    await payload.exportMarkdown({});
    assert.deepEqual(await payload.loadReviewStates(["existing"]), { existing: { status: "confirmed" } });
    assert.deepEqual(await payload.loadComparisonCandidates(), { candidates: [] });
    assert.throws(() => payload.saveReviewState("existing", { note: "blocked" }));
    assert.throws(() => payload.previewAI(["existing"]));
    assert.throws(() => payload.generateAI(["existing"]));
    assert.throws(() => payload.clearAI());
    await assert.rejects(() => payload.compareVersions(version.commitHash, "current"));
  });
  assert.deepEqual(derivedWrites, []);
  assert.equal(copied.length, 1);
  assert.equal(f.textExports.length, 1);
});

await isolationCase("deleting an unrelated sibling attachment preserves the bound repository", async () => {
  const f = fixture();
  await f.baseline();
  f.items.delete(f.b.id);
  await f.cleanup.handleItemEvent("delete", "item", [f.b.id]);
  assert.equal(f.removed.length, 0);
  assert.equal((await f.metadata()).versions.length, 1);
  assert.equal((await f.index.read()).repositories.length, 1);
});

await isolationCase("an absent bound attachment cannot silently be replaced by its sibling", async () => {
  const f = fixture();
  await f.baseline();
  f.items.delete(f.a.id);
  f.parent.getAttachments = () => [f.b.id];
  await f.noMutation(() => assert.rejects(() => f.service.enableVersionManagement(f.parent)));
  await f.noMutation(() => assert.rejects(() => f.service.createVersion(f.parent, "replacement")));
  assert.equal((await f.metadata()).attachment.attachmentKey, "WORD_A");
});

await isolationCase("competing first enables bind once instead of replacing ownership", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.service.enableVersionManagement(f.a),
    f.service.enableVersionManagement(f.b)
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const metadata = await f.metadata();
  assert.equal(metadata.attachment.attachmentKey, "WORD_A");
  assert.equal((await f.index.read()).repositories[0].attachmentKey, "WORD_A");
});

await isolationCase("legacy single-owner history remains usable without moving the repository", async () => {
  const f = fixture();
  const old = f.historical(f.a, "legacy A");
  await f.seed({ schemaVersion: 1, enabled: true, versions: [old] });
  assert.equal(inspectAttachmentOwnership(await f.metadata()).status, "single");
  f.editorSave(f.a, "A after upgrade");
  const created = await f.service.createVersion(f.a, "continued legacy history");
  assert.equal(created.repoPath, f.repo);
  const metadata = await f.metadata();
  assert.equal(metadata.versions.length, 2);
  assert.equal(metadata.versions[1].commitHash, old.commitHash);
  assert.equal(metadata.versions[1].fileHash, old.fileHash);
  assert.equal(metadata.attachment.attachmentKey, "WORD_A");
});

await isolationCase("legacy incomplete ownership remains readable but is not automatically deleted", async () => {
  const f = fixture();
  const old = f.historical(f.a, "legacy without identity");
  delete old.zotero;
  await f.seed({ ...f.boundMetadata(f.a), versions: [old] });
  const ownership = inspectAttachmentOwnership(await f.metadata());
  assert.equal(ownership.status, "single");
  assert.equal(ownership.complete, false);
  f.editorSave(f.a, "A new draft");
  const created = await f.service.createVersion(f.a, "compatible legacy continuation");
  assert.equal(created.zotero.attachmentKey, "WORD_A");
  f.items.delete(f.a.id);
  f.items.delete(f.parent.id);
  await f.cleanup.handleItemEvent("delete", "item", [f.a.id, f.parent.id]);
  assert.equal(f.removed.length, 0);
  assert.equal((await f.metadata()).versions.length, 2);
});

await isolationCase("ID-only legacy ownership supports continuation without authorizing deletion", async () => {
  const f = fixture();
  const old = f.historical(f.a, "legacy local attachment ID");
  delete old.zotero.attachmentKey;
  await f.seed({
    ...f.boundMetadata(f.a),
    attachment: { attachmentID: f.a.id },
    versions: [old]
  });
  const ownership = inspectAttachmentOwnership(await f.metadata());
  assert.equal(ownership.status, "single");
  assert.equal(ownership.complete, false);
  assert.equal((await f.service.getPanelState(f.a)).historyReadOnly, false);
  f.items.delete(f.a.id);
  await f.cleanup.handleItemEvent("delete", "item", [f.a.id]);
  assert.equal((await f.cleanup.scanOrphanRepositories()).count, 0);
  await f.cleanup.cleanupOrphanRepositories();
  assert.equal(f.removed.length, 0);
  f.items.set(f.a.id, f.a);
  f.editorSave(f.a, "continued ID-only history");
  const created = await f.service.createVersion(f.a, "compatible continuation");
  assert.equal(created.zotero.attachmentKey, "WORD_A");
  assert.equal((await f.metadata()).versions[1].commitHash, old.commitHash);
});

await isolationCase("an attachment key without a known library cannot authorize deletion", async () => {
  const f = fixture();
  const old = f.historical(f.a, "legacy without library identity");
  delete old.zotero.libraryID;
  const metadata = { ...f.boundMetadata(f.a), versions: [old] };
  delete metadata.item.libraryID;
  await f.seed(metadata);
  const ownership = inspectAttachmentOwnership(await f.metadata());
  assert.equal(ownership.status, "single");
  assert.equal(ownership.complete, false);
  assert.equal(ownership.owner.libraryID, null);
  f.items.clear();
  await f.cleanup.handleItemEvent("delete", "item", [f.parent.id, f.a.id]);
  assert.equal((await f.cleanup.scanOrphanRepositories()).count, 0);
  assert.equal(f.removed.length, 0);
});

await isolationCase("mixed legacy history stays readable and exportable without being rebound", async () => {
  const f = fixture();
  const a = f.historical(f.a, "A legacy version");
  const b = f.historical(f.b, "B legacy version");
  await f.seed({ ...f.boundMetadata(f.b), versions: [b, a] });
  assert.equal(inspectAttachmentOwnership(await f.metadata()).status, "mixed");
  await f.noMutation(async () => {
    const state = await f.service.getPanelState(f.a);
    assert.equal(state.historyReadOnly, true);
    assert(state.ownershipWarning);
    assert.equal(state.versions.length, 2);
    assert.equal((await f.service.getVersionHistory(f.b)).length, 2);
    await f.service.exportVersionSummary(f.a);
    assert(f.textExports[0].content.includes("A legacy version"));
    assert(f.textExports[0].content.includes("B legacy version"));
    await assert.rejects(() => f.service.enableVersionManagement(f.a));
    await assert.rejects(() => f.service.createVersion(f.b, "must not continue mixed history"));
    await assert.rejects(() => f.service.restoreVersion(f.a, a));
  });
});

for (const ids of [[20], [30], [10, 20, 30]]) {
  await isolationCase(`mixed legacy history is retained for deletion event ${ids.join(",")}`, async () => {
    const f = fixture();
    await f.seed({ ...f.boundMetadata(f.b), versions: [f.historical(f.b, "B"), f.historical(f.a, "A")] });
    ids.forEach((id) => f.items.delete(id));
    await f.cleanup.handleItemEvent("delete", "item", ids);
    assert.equal(f.removed.length, 0);
    assert.equal((await f.metadata()).versions.length, 2);
    assert.equal((await f.cleanup.scanOrphanRepositories()).count, 0);
    await f.cleanup.cleanupOrphanRepositories();
    assert.equal(f.removed.length, 0);
  });
}

await isolationCase("unknown legacy ownership is retained without inventing a new attachment", async () => {
  const f = fixture();
  const old = f.historical(f.a, "unknown legacy owner");
  delete old.zotero;
  await f.seed({ ...createEmptyMetadata(), enabled: true, versions: [old] });
  assert.equal(inspectAttachmentOwnership(await f.metadata()).status, "unknown");
  await f.noMutation(async () => {
    assert.equal((await f.service.getPanelState(f.a)).historyReadOnly, true);
    await assert.rejects(() => f.service.enableVersionManagement(f.a));
    await assert.rejects(() => f.service.createVersion(f.a, "must not adopt unknown"));
  });
  f.items.clear();
  await f.cleanup.handleItemEvent("delete", "item", [f.parent.id, f.a.id]);
  assert.equal(f.removed.length, 0);
});

for (const invalidID of [true, [3]]) {
  await isolationCase(`invalid attachment identity ${JSON.stringify(invalidID)} cannot authorize cleanup`, async () => {
    const f = fixture();
    const version = f.historical(f.a, "invalid legacy attachment identity");
    version.zotero = { libraryID: 1, attachmentID: invalidID };
    await f.seed({
      ...f.boundMetadata(f.a),
      attachment: { attachmentID: invalidID },
      versions: [version]
    });
    const ownership = inspectAttachmentOwnership(await f.metadata());
    assert.equal(ownership.status, "unknown");
    assert.equal(ownership.complete, false);
    f.items.clear();
    await f.cleanup.handleItemEvent("delete", "item", [f.parent.id, f.a.id, 1, 3]);
    assert.equal((await f.cleanup.scanOrphanRepositories()).count, 0);
    await f.cleanup.cleanupOrphanRepositories();
    assert.equal(f.removed.length, 0);
    assert.equal((await f.metadata()).versions.length, 1);
  });
}

await isolationCase("a complete single-owner history can be cleaned only after its attachment disappears", async () => {
  const f = fixture();
  await f.baseline();
  await f.cleanup.handleItemEvent("delete", "item", [f.a.id]);
  assert.equal(f.removed.length, 0, "a stale delete event cannot remove a live attachment's repository");
  f.items.delete(f.a.id);
  await f.cleanup.handleItemEvent("delete", "item", [f.a.id]);
  assert.deepEqual(f.removed, [f.repo]);
  assert.equal((await f.index.read()).repositories.length, 0);
  assert.equal(f.items.has(f.b.id), true);
});

await isolationCase("deleting the parent does not remove the history of an attachment that still exists", async () => {
  const f = fixture();
  await f.baseline();
  f.items.delete(f.parent.id);
  await f.cleanup.handleItemEvent("delete", "item", [f.parent.id]);
  assert.equal(f.removed.length, 0);
  assert.equal((await f.metadata()).versions.length, 1);
});

for (const failure of ["throw", "undefined", "missing-api"]) {
  await isolationCase(`item lookup ${failure} never authorizes cleanup`, async () => {
    const f = fixture();
    await f.baseline();
    if (failure === "missing-api") f.platform.Zotero.Items = {};
    else f.hooks.lookup = () => {
      if (failure === "throw") throw new Error("injected item lookup failure");
      return undefined;
    };
    await f.cleanup.handleItemEvent("delete", "item", [f.a.id, f.parent.id]);
    assert.equal(f.removed.length, 0);
    assert.equal((await f.cleanup.scanOrphanRepositories()).count, 0);
    await f.cleanup.cleanupOrphanRepositories();
    assert.equal(f.removed.length, 0);
  });
}

await isolationCase("cleanup rechecks all historical owners after waiting for the repository lock", async () => {
  const f = fixture();
  const first = await f.baseline();
  const entry = (await f.index.read()).repositories[0];
  const held = deferred();
  const release = deferred();
  const writer = withRepositoryLock(f.repo, async () => {
    held.resolve();
    await release.promise;
    await f.metadataStore.write(f.repo, { ...f.boundMetadata(f.a), versions: [first, f.historical(f.b, "other owner")] });
  }, f.platform.Zotero);
  await held.promise;
  f.items.delete(f.a.id);
  const cleaning = f.cleanup.cleanupRepository(entry, new Set([f.a.id]));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.removed.length, 0);
  release.resolve();
  await writer;
  assert.equal((await cleaning).cleaned, false);
  assert.equal(f.removed.length, 0);
});

for (const kind of ["single", "mixed", "unknown", "incomplete"]) {
  await isolationCase(`item archive import and re-export preserve ${kind} ownership`, async () => {
    const source = fixture();
    const versions = [source.historical(source.a, "source A")];
    if (kind === "mixed") versions.push(source.historical(source.b, "source B"));
    if (kind === "unknown" || kind === "incomplete") delete versions[0].zotero;
    const sourceMetadata = { ...source.boundMetadata(source.a), versions };
    if (kind === "unknown") sourceMetadata.attachment = null;
    await source.seed(sourceMetadata);
    await source.archive.exportItemRepositoryArchive({ repoPath: source.repo, repoRelativePath: source.relativePath, attachment: source.descriptor(source.a) });
    const target = fixture();
    target.a.key = "TARGET_WORD";
    target.editorSave(target.a, "target manuscript");
    target.openZip = source.binaryExports[0].bytes;
    const prepared = await target.archive.prepareItemRepositoryArchiveImport({
      targetRepoPath: target.repo, targetRepoRelativePath: target.relativePath,
      attachment: target.descriptor(target.a)
    });
    const result = await target.archive.commitItemRepositoryArchiveImport(prepared);
    assert.equal(result.failed.length, 0);
    assert.equal(result.imported.length, 1);
    const imported = await target.metadata();
    if (kind === "mixed" || kind === "unknown") {
      assert.equal(inspectAttachmentOwnership(imported).status, kind);
      if (kind === "mixed") assert.deepEqual(imported.versions.map((version) => version.zotero.attachmentKey).sort(), ["WORD_A", "WORD_B"]);
      await target.noMutation(() => assert.rejects(() => target.service.createVersion(target.a, "must remain protected")));
    }
    else {
      assert.equal(inspectAttachmentOwnership(imported).status, "single");
      assert.equal(imported.versions[0].zotero.attachmentKey, "TARGET_WORD");
      target.editorSave(target.a, "after import");
      assert.equal((await target.service.createVersion(target.a, "continue imported history")).zotero.attachmentKey, "TARGET_WORD");
    }
    if (kind === "incomplete") assert.equal(inspectAttachmentOwnership(await target.metadata()).complete, false);

    await target.archive.exportItemRepositoryArchive({ repoPath: target.repo, repoRelativePath: target.relativePath, attachment: target.descriptor(target.a) });
    const second = fixture();
    second.a.key = "SECOND_TARGET";
    second.editorSave(second.a, "second target manuscript");
    second.openZip = target.binaryExports[0].bytes;
    const secondPrepared = await second.archive.prepareItemRepositoryArchiveImport({
      targetRepoPath: second.repo, targetRepoRelativePath: second.relativePath,
      attachment: second.descriptor(second.a)
    });
    assert.equal((await second.archive.commitItemRepositoryArchiveImport(secondPrepared)).failed.length, 0);
    const secondOwnership = inspectAttachmentOwnership(await second.metadata());
    assert.equal(secondOwnership.status, kind === "incomplete" ? "single" : kind);
    if (kind !== "single") assert.equal(secondOwnership.complete, false);
    if (kind === "mixed" || kind === "unknown") {
      await second.noMutation(() => assert.rejects(() => second.service.createVersion(second.a, "must not launder protection")));
    }
    second.items.clear();
    await second.cleanup.handleItemEvent("delete", "item", [second.a.id, second.parent.id]);
    if (kind !== "single") assert.equal(second.removed.length, 0);
  });
}

console.log(`Attachment ownership regression tests passed (${passed} scenarios; in-memory only).`);

async function isolationCase(name, operation) {
  let timer;
  try {
    await Promise.race([operation(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Attachment isolation test timed out: ${name}`)), 4000);
    })]);
    passed += 1;
  }
  catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
  finally { clearTimeout(timer); }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const root = `memory/attachment-isolation-${++fixtureID}`;
  const relativePath = "library-1/item-PARENT";
  const repo = `${root}/${relativePath}`;
  const files = new Map();
  const directories = new Set([root]);
  const operations = [];
  const removed = [];
  const commits = new Map();
  const hooks = {};
  const textExports = [];
  const binaryExports = [];
  const parent = { id: 10, key: "PARENT", libraryID: 1, isAttachment: () => false, getAttachments: () => [20, 30] };
  const makeItem = (id, key) => ({ id, key, libraryID: 1, parentItemID: parent.id, isAttachment: () => true, async getFilePathAsync() { return `${root}/documents/${this.key}.doc`; } });
  const a = makeItem(20, "WORD_A");
  const b = makeItem(30, "WORD_B");
  const items = new Map([[parent.id, parent], [a.id, a], [b.id, b]]);
  const lookup = (operation) => hooks.lookup ? hooks.lookup() : operation();
  const mkdir = (path) => {
    const parts = path.split("/");
    for (let count = 1; count <= parts.length; count += 1) directories.add(parts.slice(0, count).join("/"));
  };
  const write = async (path, bytes) => {
    operations.push({ type: "write", path });
    mkdir(path.slice(0, path.lastIndexOf("/")));
    files.set(path, new Uint8Array(bytes));
  };
  const read = (path) => {
    assert(files.has(path), `Missing in-memory file: ${path}`);
    return files.get(path).slice();
  };
  const descriptor = (item) => ({
    item: parent, attachment: item, libraryID: 1, itemID: parent.id, itemKey: parent.key,
    attachmentID: item.id, attachmentKey: item.key, fileName: `${item.key}.doc`,
    filePath: `${root}/documents/${item.key}.doc`, extension: ".doc"
  });
  const platform = {
    Zotero: {
      Items: {
        get: (id) => lookup(() => items.get(id) ?? null),
        getByLibraryAndKey: (libraryID, key) => lookup(() => [...items.values()].find((item) => item.libraryID === libraryID && item.key === key) ?? null)
      }, debug() {}
    },
    join: (...parts) => parts.join("/"), dirname: (path) => path.replace(/\/[^/]+$/, ""),
    getPluginDataDirectory: () => root, getRepoPath: () => repo,
    getPref: (key, fallback) => key === PREFS.autoSafetyVersion ? false : fallback,
    exists: async (path) => files.has(path) || directories.has(path),
    isDirectory: async (path) => directories.has(path), makeDirectory: async (path) => mkdir(path),
    stat: async (path) => ({ size: read(path).byteLength }),
    readFileBytes: async (path) => read(path), readText: async (path) => decoder.decode(read(path)),
    writeBytes: write, writeText: async (path, text) => write(path, encoder.encode(text)),
    atomicWriteText: async (path, text) => write(path, encoder.encode(text)),
    writeNewFile: async (path, bytes) => {
      if (files.has(path)) throw Object.assign(new Error("exists"), { name: "NoModificationAllowedError" });
      await write(path, bytes);
    },
    removeFile: async (path) => { operations.push({ type: "remove-file", path }); files.delete(path); },
    copyFile: async (source, path) => write(path, read(source)),
    hashBytes: async (bytes) => digest(bytes), hashFile: async (path) => digest(read(path)),
    hashString: async (text) => digest(encoder.encode(text)),
    listDirectory: async (path) => [...new Set([...directories, ...files.keys()])].filter((entry) => entry.slice(0, entry.lastIndexOf("/")) === path),
    removeDirectory: async (path) => {
      removed.push(path);
      operations.push({ type: "remove-directory", path });
      for (const candidate of files.keys()) if (candidate.startsWith(`${path}/`)) files.delete(candidate);
      for (const candidate of directories) if (candidate === path || candidate.startsWith(`${path}/`)) directories.delete(candidate);
    },
    saveTextFile: async (request) => { textExports.push(request); return `${root}/exports/report.md`; },
    saveBinaryFile: async (request) => { binaryExports.push({ ...request, bytes: request.bytes.slice() }); return `${root}/exports/history.zip`; },
    openBinaryFile: async () => ({ path: "memory/history.zip", bytes: f.openZip })
  };
  const metadataStore = new MetadataStore(platform);
  const index = new RepositoryIndexStore(platform);
  const finder = new AttachmentFinder(platform);
  const gitBackend = {
    checkAvailability: async () => ({ available: true, detail: "in-memory Git" }),
    ensureRepo: async () => mkdir(`${repo}/.git`),
    getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: "clean" }),
    listHistory: async () => [],
    commitSnapshot: async (path, snapshot) => {
      assert.equal(path, repo);
      const hash = createHash("sha1").update(`${root}:${commits.size}`).digest("hex");
      commits.set(hash, read(`${repo}/${snapshot.trackedRelativePath}`));
      return { hash };
    },
    checkoutTrackedFile: async (path, hash, relative) => {
      assert.equal(path, repo);
      assert(commits.has(hash));
      await write(`${repo}/${relative}`, commits.get(hash));
    }
  };
  const service = new VersionService({ platform, attachmentFinder: finder, metadataStore, indexStore: index, gitBackend, pluginVersion: "0.7.1" });
  const cleanup = new RepositoryCleanupService({ platform, metadataStore, indexStore: index });
  const archive = new RepositoryArchiveService({ platform, cleanupService: cleanup, pluginVersion: "0.7.1" });
  const boundMetadata = (item) => ({
    ...createEmptyMetadata(), enabled: true,
    item: { libraryID: 1, itemID: parent.id, itemKey: parent.key },
    attachment: { attachmentID: item.id, attachmentKey: item.key, fileName: `${item.key}.doc` }
  });
  let historicalCounter = 0;
  const historical = (item, note) => {
    const hash = createHash("sha1").update(`${root}:legacy:${++historicalCounter}`).digest("hex");
    const text = encoder.encode(note);
    commits.set(hash, text);
    return {
      id: hash, commitHash: hash, shortHash: hash.slice(0, 8),
      createdAt: `2020-01-0${historicalCounter}T00:00:00.000Z`, kind: "manual", note,
      fileName: `${item.key}.doc`, fileHash: digest(text), fileSize: text.byteLength,
      trackedRelativePath: "tracked/document.doc", zotero: {
        libraryID: 1, itemID: parent.id, itemKey: parent.key, attachmentID: item.id, attachmentKey: item.key
      }
    };
  };
  const editorSave = (item, text) => files.set(descriptor(item).filePath, encoder.encode(text));
  editorSave(a, "A manuscript");
  editorSave(b, "B manuscript");
  const f = {
    root, repo, relativePath, files, directories, operations, removed, commits, hooks, textExports, binaryExports,
    parent, a, b, items, platform, finder, service, metadataStore, index, cleanup, archive,
    descriptor, editorSave, boundMetadata, historical,
    metadata: () => metadataStore.read(repo),
    committedText: (version) => decoder.decode(commits.get(version.commitHash)),
    async baseline() { await service.enableVersionManagement(a); return service.createVersion(a, "A baseline"); },
    async seed(metadata) {
      mkdir(`${repo}/.git`);
      await metadataStore.write(repo, metadata);
      await index.upsertAttachment(descriptor(metadata.attachment?.attachmentKey === b.key ? b : a), { enabled: true });
    },
    async noMutation(operation) {
      const before = operations.length;
      const beforeFiles = [...files].map(([path, bytes]) => [path, [...bytes]]);
      await operation();
      assert.equal(operations.length, before, "a rejected/read-only action must not write or delete data");
      assert.deepEqual([...files].map(([path, bytes]) => [path, [...bytes]]), beforeFiles);
    }
  };
  return f;
}
