import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setImmediate as nextTurn } from "node:timers/promises";
import vm from "node:vm";
import { buildRuntimeScript } from "./runtime-builder.mjs";
import { PREFS } from "../chrome/content/src/constants.mjs";
import { GitBackend } from "../chrome/content/src/git-backend.mjs";
import { MetadataStore } from "../chrome/content/src/metadata.mjs";
import { VersionService } from "../chrome/content/src/version-service.mjs";
import { withRepositoryLock } from "../chrome/content/src/repository-lock.mjs";

// Every file, attachment and Git command below lives in memory. No Zotero
// process or Git executable is started by these regression tests.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
let environmentID = 0;
let testsPassed = 0;

await run("create/check keep committed bytes and metadata together", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  await env.baseline(item);
  env.set(item, "draft A");
  const gate = env.pauseNext("beforeAdd");
  const creating = env.service.createVersion(item, "A");
  await gate.entered;
  env.set(item, "draft B");
  const checking = observe(env.service.checkCurrentChange(item));
  try {
    await nextTurn();
    assert.equal(checking.settled, false, "check must wait for the entire create operation");
    assert.equal(env.tracked(item), "draft A");
  }
  finally {
    gate.release();
  }
  const [created, check] = await Promise.all([creating, checking.promise]);
  assert.equal(env.committedText(created), "draft A");
  assert.equal(created.fileHash, digest(encoder.encode("draft A")));
  assert.equal(check.previousVersion.commitHash, created.commitHash);
  const metadata = await env.metadata(item);
  assert.equal(metadata.versions.length, 2);
  assert.equal(metadata.lastCheck.fileHash, digest(encoder.encode("draft B")));
  await env.assertConsistent(item);
});

await run("two service instances serialize creates without losing history", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  await env.baseline(item);
  env.set(item, "draft A");
  const gate = env.pauseNext("beforeAdd");
  const first = env.service.createVersion(item, "A");
  await gate.entered;
  env.set(item, "draft B");
  const second = observe(env.newService().createVersion(item, "B"));
  try {
    await nextTurn();
    assert.equal(second.settled, false, "locks must be shared across service instances");
    assert.equal(env.tracked(item), "draft A");
  }
  finally {
    gate.release();
  }
  const [a, b] = await Promise.all([first, second.promise]);
  assert.equal(env.committedText(a), "draft A");
  assert.equal(env.committedText(b), "draft B");
  assert.deepEqual((await env.metadata(item)).versions.map((version) => version.note), ["B", "A", "baseline"]);
  await env.assertConsistent(item);
});

await run("duplicate concurrent creates recheck the latest committed version", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  await env.baseline(item);
  env.set(item, "same draft");
  const gate = env.pauseNext("beforeAdd");
  const first = env.service.createVersion(item, "first click");
  await gate.entered;
  const second = env.service.createVersion(item, "second click");
  const rejected = assert.rejects(second);
  gate.release();
  await Promise.all([first, rejected]);
  assert.equal(env.commits.size, 2, "the second click must not create an extra commit");
  assert.equal((await env.metadata(item)).versions.length, 2);
  await env.assertConsistent(item);
});

await run("the repository stays locked after commit until metadata is saved", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  await env.baseline(item);
  env.set(item, "draft A");
  const gate = env.pauseNext("beforeMetadataWrite");
  const first = env.service.createVersion(item, "A");
  await gate.entered;
  assert.equal(env.commits.size, 2, "the first commit already exists while its metadata is pending");
  env.set(item, "draft B");
  const second = observe(env.service.createVersion(item, "B"));
  try {
    await nextTurn();
    assert.equal(second.settled, false);
    assert.equal(env.commits.size, 2, "no later commit may start before metadata persistence finishes");
    assert.equal(env.tracked(item), "draft A");
  }
  finally {
    gate.release();
  }
  await Promise.all([first, second.promise]);
  assert.deepEqual((await env.metadata(item)).versions.map((version) => version.note), ["B", "A", "baseline"]);
  await env.assertConsistent(item);
});

await run("a rejected operation releases its repository queue", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  await env.baseline(item);
  env.set(item, "failed draft");
  const gate = env.pauseNext("beforeAdd", new Error("injected add failure"));
  const failed = assert.rejects(env.service.createVersion(item, "fails"), /injected add failure/);
  await gate.entered;
  env.set(item, "later draft");
  const next = env.service.createVersion(item, "succeeds");
  gate.release();
  await failed;
  const created = await next;
  assert.equal(env.committedText(created), "later draft");
  assert.deepEqual((await env.metadata(item)).versions.map((version) => version.note), ["succeeds", "baseline"]);
  await env.assertConsistent(item);
});

await run("different repositories can make progress independently", async () => {
  const env = createEnvironment();
  const firstItem = env.item("FIRST");
  const secondItem = env.item("SECOND");
  await env.baseline(firstItem);
  await env.baseline(secondItem);
  env.set(firstItem, "first draft");
  env.set(secondItem, "second draft");
  const gate = env.pauseNext("beforeAdd", null, env.repo(firstItem));
  const first = env.service.createVersion(firstItem, "first");
  await gate.entered;
  try {
    const second = await env.service.createVersion(secondItem, "second");
    assert.equal(env.committedText(second), "second draft");
  }
  finally {
    gate.release();
  }
  await first;
  await env.assertConsistent(firstItem);
  await env.assertConsistent(secondItem);
});

await run("restore includes its safety version and protects checkout until completion", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  const baseline = await env.baseline(item, "historic draft");
  env.set(item, "current draft");
  const preflight = await env.service.buildRestorePreflight(item, baseline);
  const gate = env.pauseNext("afterCheckout");
  const restoring = env.service.restoreVersion(item, baseline, { preflight });
  await gate.entered;
  const checking = observe(env.service.checkCurrentChange(item));
  const creating = observe(env.newService().createVersion(item, "after restore"));
  const unchangedCreate = assert.rejects(creating.promise);
  try {
    await nextTurn();
    assert.equal(checking.settled, false);
    assert.equal(creating.settled, false);
    assert.equal(env.tracked(item), "historic draft", "queued writers must not replace the checkout source");
  }
  finally {
    gate.release();
  }
  const [restored, check] = await Promise.all([restoring, checking.promise, unchangedCreate]);
  assert.equal(restored.safetyVersion.kind, "safety");
  assert.equal(env.committedText(restored.safetyVersion), "current draft");
  assert.equal(env.text(restored.backupPath), "current draft");
  assert.equal(env.get(item), "current draft");
  assert.equal(restored.mode, "copy");
  assert.equal(env.text(restored.restoredCopyPath), "historic draft");
  assert.equal(check.previousVersion.commitHash, restored.safetyVersion.commitHash);
  assert.equal(check.shouldCreateVersion, false);
  const metadata = await env.metadata(item);
  assert.equal(metadata.versions.length, 2);
  assert.equal(metadata.lastRestored.commitHash, baseline.commitHash);
  await env.assertConsistent(item);
});

await run("queued disable preserves the version that finished before it", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  await env.baseline(item);
  env.set(item, "draft A");
  const gate = env.pauseNext("beforeAdd");
  const creating = env.service.createVersion(item, "A");
  await gate.entered;
  const disabling = observe(env.service.disableVersionManagement(item));
  try {
    await nextTurn();
    assert.equal(disabling.settled, false);
  }
  finally {
    gate.release();
  }
  await Promise.all([creating, disabling.promise]);
  const metadata = await env.metadata(item);
  assert.equal(metadata.enabled, false);
  assert.equal(metadata.versions.length, 2);
  await assert.rejects(() => env.service.createVersion(item, "after disable"));
  await env.assertConsistent(item);
});

await run("diff repair rereads metadata after waiting instead of replacing newer history", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  const baseline = await env.baseline(item);
  const metadata = await env.metadata(item);
  const snapshot = {
    paragraphs: ["Baseline paragraph"],
    comparisonParagraphs: ["Baseline paragraph"],
    normalizedText: "Baseline paragraph",
    comparisonNormalizedText: "Baseline paragraph",
    paragraphCount: 1,
    wordCount: 2,
    sections: []
  };
  metadata.versions[0].contentSnapshot = snapshot;
  metadata.versions[0].contentHash = digest(encoder.encode(snapshot.normalizedText));
  metadata.versions[0].contentSummary = { paragraphCount: 1, wordCount: 2 };
  await env.metadataStore.write(env.repo(item), metadata);
  const staleMetadata = await env.metadata(item);
  env.set(item, "new draft");
  const gate = env.pauseNext("beforeAdd");
  const creating = env.service.createVersion(item, "new version");
  await gate.entered;
  const repairing = observe(env.service.rebuildVersionDiff(env.repo(item), staleMetadata, staleMetadata.versions[0]));
  try {
    await nextTurn();
    assert.equal(repairing.settled, false, "repair also writes versions.json and must wait");
  }
  finally {
    gate.release();
  }
  const [created, repaired] = await Promise.all([creating, repairing.promise]);
  const finalMetadata = await env.metadata(item);
  assert.equal(finalMetadata.versions.length, 2);
  assert.equal(finalMetadata.versions[0].commitHash, created.commitHash);
  assert.equal(finalMetadata.versions.find((version) => version.commitHash === baseline.commitHash).diffRef.status, "complete");
  assert.equal(repaired.index.totalChanges, 1);
  await env.assertConsistent(item);
});

const classicRuntime = await loadClassicRuntime();

await run("ESM and classic runtime services share the same repository queue", async () => {
  const env = createEnvironment();
  const item = env.item("MAIN");
  await env.baseline(item);
  env.set(item, "ESM draft");
  const gate = env.pauseNext("beforeAdd");
  const esmCreate = env.service.createVersion(item, "ESM");
  await gate.entered;
  env.set(item, "classic draft");
  const classicCreate = observe(env.newService(classicRuntime.VersionService).createVersion(item, "classic"));
  try {
    await nextTurn();
    assert.equal(classicCreate.settled, false, "classic and preference-page ESM callers must not have separate locks");
    assert.equal(env.tracked(item), "ESM draft");
  }
  finally {
    gate.release();
  }
  const [esmVersion, classicVersion] = await Promise.all([esmCreate, classicCreate.promise]);
  assert.equal(env.committedText(esmVersion), "ESM draft");
  assert.equal(env.committedText(classicVersion), "classic draft");
  await env.assertConsistent(item);
});

await run("cross-realm locks normalize Windows aliases and release after failure", async () => {
  // An ordinary object stands in for the shared Zotero host. No app APIs exist.
  const host = {};
  const entered = deferred();
  const release = deferred();
  const order = [];
  const failing = assert.rejects(classicRuntime.withRepositoryLock(
    "C:\\Profile\\Git4Zotero\\library-1\\item-MAIN\\",
    async () => {
      order.push("classic");
      entered.resolve();
      await release.promise;
      throw new Error("cross-realm injected failure");
    },
    host
  ), /cross-realm injected failure/);
  await entered.promise;
  const next = observe(withRepositoryLock("c:/profile/git4zotero/library-1/item-main", async () => {
    order.push("ESM");
    return "released";
  }, host));
  const anotherRuntime = await loadClassicRuntime();
  const final = observe(anotherRuntime.withRepositoryLock("C:/PROFILE/GIT4ZOTERO/library-1/item-MAIN/", async () => {
    order.push("second classic");
  }, host));
  try {
    await nextTurn();
    assert.equal(next.settled, false);
    assert.equal(final.settled, false);
    assert.deepEqual(order, ["classic"]);
  }
  finally {
    release.resolve();
  }
  await failing;
  assert.equal(await next.promise, "released");
  await final.promise;
  assert.deepEqual(order, ["classic", "ESM", "second classic"]);
});

console.log(`仓库并发回归测试通过：${testsPassed} 个纯内存场景，无真实 Git 或 Zotero 调用。`);

async function run(name, test) {
  let timer;
  try {
    await Promise.race([
      test(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Concurrency test timed out: ${name}`)), 5000);
      })
    ]);
    testsPassed += 1;
  }
  catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
  finally {
    clearTimeout(timer);
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function observe(promise) {
  const result = { settled: false, promise: null };
  result.promise = promise.finally(() => { result.settled = true; });
  return result;
}

async function loadClassicRuntime() {
  const runtime = await buildRuntimeScript();
  const marker = "__git4zoteroRuntimeGlobal.Git4Zotero = Git4Zotero;";
  assert(runtime.includes(marker));
  const context = vm.createContext({ TextEncoder, TextDecoder });
  vm.runInContext(runtime.replace(marker,
    `${marker}\n__git4zoteroRuntimeGlobal.__lockTestExports = { VersionService, withRepositoryLock };`), context);
  return context.__lockTestExports;
}

function createEnvironment() {
  const root = `memory/concurrency-${++environmentID}`;
  const files = new Map();
  const directories = new Set();
  const commits = new Map();
  const heads = new Map();
  const staged = new Map();
  const hooks = new Map();
  const pathFor = (item) => `${root}/attachments/${item.key}.doc`;
  const repoFor = (item) => `${root}/library-1/item-${item.key}`;
  const trackedFor = (item) => `${repoFor(item)}/tracked/document.doc`;
  const read = (path) => {
    assert(files.has(path), `memory file missing: ${path}`);
    return files.get(path).slice();
  };
  const callHook = async (name, repoPath) => {
    const hook = hooks.get(name);
    if (!hook || (hook.repoPath && hook.repoPath !== repoPath)) {
      return;
    }
    hooks.delete(name);
    hook.entered.resolve();
    await hook.resume.promise;
    if (hook.error) {
      throw hook.error;
    }
  };
  const platform = {
    Zotero: {},
    join: (...parts) => parts.join("/"),
    getRepoPath: (_libraryID, itemKey) => `${root}/library-1/item-${itemKey}`,
    getPref: (key, fallback) => key === PREFS.autoSafetyVersion ? true : fallback,
    getGitExecutable: () => "IN_MEMORY_GIT_ONLY",
    exists: async (path) => files.has(path) || directories.has(path),
    makeDirectory: async (path) => { directories.add(path); },
    stat: async (path) => ({ size: read(path).byteLength }),
    readFileBytes: async (path) => read(path),
    readText: async (path) => decoder.decode(read(path)),
    writeBytes: async (path, bytes) => { files.set(path, bytes.slice()); },
    writeNewFile: async (path, bytes) => {
      assert(!files.has(path), "restore must not overwrite an existing output");
      files.set(path, bytes.slice());
    },
    writeText: async (path, content) => {
      const metadataSuffix = "/.git4zotero/versions.json";
      if (path.endsWith(metadataSuffix)) {
        await callHook("beforeMetadataWrite", path.slice(0, -metadataSuffix.length));
      }
      files.set(path, encoder.encode(content));
    },
    atomicWriteText: async (path, content) => platform.writeText(path, content),
    removeFile: async (path) => { files.delete(path); },
    copyFile: async (source, target) => { files.set(target, read(source)); },
    hashFile: async (path) => digest(read(path)),
    hashBytes: async (bytes) => digest(bytes),
    hashString: async (text) => digest(encoder.encode(text)),
    runProcess: async (command, args, options = {}) => {
      assert.equal(command, "IN_MEMORY_GIT_ONLY");
      const repoPath = options.cwd;
      const result = { exitCode: 0, stdout: "", stderr: "" };
      switch (args[0]) {
        case "--version":
          result.stdout = "git version memory-test";
          break;
        case "init":
          directories.add(`${repoPath}/.git`);
          break;
        case "config":
        case "status":
          break;
        case "add": {
          await callHook("beforeAdd", repoPath);
          const snapshot = new Map();
          for (const [path, bytes] of files) {
            if (path.startsWith(`${repoPath}/tracked/`) || path === `${repoPath}/.gitignore`) {
              snapshot.set(path.slice(repoPath.length + 1), bytes.slice());
            }
          }
          staged.set(repoPath, snapshot);
          break;
        }
        case "commit": {
          const hash = createHash("sha1").update(`${root}:${commits.size + 1}`).digest("hex");
          commits.set(hash, { repoPath, files: staged.get(repoPath), body: args.at(-1) });
          heads.set(repoPath, hash);
          break;
        }
        case "rev-parse":
          result.stdout = heads.get(repoPath);
          break;
        case "checkout": {
          const [, hash, , relativePath] = args;
          const commit = commits.get(hash);
          assert.equal(commit.repoPath, repoPath);
          files.set(`${repoPath}/${relativePath}`, commit.files.get(relativePath).slice());
          await callHook("afterCheckout", repoPath);
          break;
        }
        default:
          assert.fail(`Unexpected simulated Git command: ${args.join(" ")}`);
      }
      return result;
    }
  };
  const metadataStore = new MetadataStore(platform);
  const makeService = (ServiceClass = VersionService) => new ServiceClass({
    platform,
    metadataStore,
    gitBackend: new GitBackend(platform),
    attachmentFinder: {
      findManageableAttachment: async (item) => ({
        libraryID: 1,
        itemID: item.id,
        itemKey: item.key,
        attachmentID: item.id + 100,
        attachmentKey: `ATTACHMENT-${item.key}`,
        fileName: `${item.key}.doc`,
        filePath: pathFor(item),
        extension: ".doc"
      })
    },
    pluginVersion: "0.7.0"
  });
  const service = makeService();
  return {
    service,
    newService: makeService,
    metadataStore,
    commits,
    item: (key) => ({ id: key.length, key }),
    repo: repoFor,
    set: (item, text) => files.set(pathFor(item), encoder.encode(text)),
    get: (item) => decoder.decode(read(pathFor(item))),
    text: (path) => decoder.decode(read(path)),
    tracked: (item) => decoder.decode(read(trackedFor(item))),
    metadata: (item) => metadataStore.read(repoFor(item)),
    committedText: (version) => decoder.decode(commits.get(version.commitHash).files.get(version.trackedRelativePath)),
    async baseline(item, text = "baseline draft") {
      files.set(pathFor(item), encoder.encode(text));
      await service.enableVersionManagement(item);
      return service.createVersion(item, "baseline");
    },
    pauseNext(name, error = null, repoPath = null) {
      const entered = deferred();
      const resume = deferred();
      hooks.set(name, { entered, resume, error, repoPath });
      return { entered: entered.promise, release: resume.resolve };
    },
    async assertConsistent(item) {
      const metadata = await metadataStore.read(repoFor(item));
      const repositoryCommits = [...commits].filter(([, commit]) => commit.repoPath === repoFor(item));
      assert.equal(metadata.versions.length, repositoryCommits.length, "every successful commit must have a metadata record");
      for (const version of metadata.versions) {
        const commit = commits.get(version.commitHash);
        assert(commit, "metadata must reference a real simulated commit");
        assert.equal(version.fileHash, digest(commit.files.get(version.trackedRelativePath)), "record hash must describe its committed bytes");
      }
    }
  };
}
