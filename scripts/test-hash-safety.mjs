import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";
import { buildRuntimeScript } from "./runtime-builder.mjs";

// The runtime is evaluated in isolated VM contexts without starting Zotero.
// All manuscript files, Git snapshots and restore copies below stay in memory.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
let fixtureID = 0;
let testCount = 0;
const runtimeSource = await buildRuntimeScript();
const noCrypto = loadHashRuntime();
let rejectedDigestCalls = 0;
const rejectedCrypto = loadHashRuntime({
  subtle: { digest: async () => { rejectedDigestCalls += 1; throw new Error("unavailable in chrome scope"); } }
});

await hashCase("portable hashing matches standard SHA-256 vectors", async () => {
  const vectors = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ["a".repeat(1000000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"]
  ];
  const platform = memoryFixture(noCrypto).platform;
  for (const [text, expected] of vectors) {
    assert.equal(await platform.hashBytes(encoder.encode(text)), expected);
  }
});

await hashCase("padding boundaries, Unicode and byte views match Node SHA-256", async () => {
  for (const runtime of [noCrypto, rejectedCrypto]) {
    const platform = memoryFixture(runtime).platform;
    for (const length of [0, 1, 31, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 4097, 1048579]) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 137 + 19) & 255);
      const expected = sha256(bytes);
      assert.equal(await platform.hashBytes(bytes), expected, `length ${length}`);
      assert.equal(await platform.hashBytes(bytes.buffer), expected, `ArrayBuffer length ${length}`);
    }
    const padded = encoder.encode("prefix论文 n=100 🧬 suffix");
    const start = encoder.encode("prefix").length;
    const length = encoder.encode("论文 n=100 🧬").length;
    const expected = sha256(padded.subarray(start, start + length));
    assert.equal(await platform.hashBytes(padded.subarray(start, start + length)), expected);
    assert.equal(await platform.hashBytes(new DataView(padded.buffer, start, length)), expected);
    const words = new Uint32Array([0x12345678, 0x90abcdef, 0x11223344]);
    assert.equal(await platform.hashBytes(words.subarray(1, 2)), sha256(new Uint8Array(words.buffer, 4, 4)));
    assert.equal(await platform.hashString("等长正文 n=100 🧬"), sha256(encoder.encode("等长正文 n=100 🧬")));
  }
  assert(rejectedDigestCalls > 0, "the rejecting provider must actually have been exercised");
});

await hashCase("Web Crypto and unavailable or malformed providers preserve the hash contract", async () => {
  const bytes = encoder.encode("same-length data");
  const expected = sha256(bytes);
  let nativeCalls = 0;
  const nativeRuntime = loadHashRuntime({
    subtle: { digest: async (...args) => { nativeCalls += 1; return webcrypto.subtle.digest(...args); } }
  });
  assert.equal(await memoryFixture(nativeRuntime).platform.hashBytes(bytes), expected);
  assert.equal(nativeCalls, 1);
  for (const provider of [null, {}, { subtle: {} }, { subtle: { digest: async () => new ArrayBuffer(1) } }]) {
    assert.equal(await memoryFixture(loadHashRuntime(provider)).platform.hashBytes(bytes), expected);
  }
  const throwingProvider = {};
  Object.defineProperty(throwingProvider, "subtle", { get() { throw new Error("capability denied"); } });
  assert.equal(await memoryFixture(loadHashRuntime(throwingProvider)).platform.hashBytes(bytes), expected);
  const platform = memoryFixture(noCrypto).platform;
  for (const invalid of [null, undefined, "abc", [1, 2], {}, { byteLength: 3 }, { [Symbol.toStringTag]: "ArrayBuffer", byteLength: 0 }]) {
    await assert.rejects(() => platform.hashBytes(invalid), (error) => error.name === "TypeError");
  }
  const detached = new ArrayBuffer(4);
  structuredClone(detached, { transfer: [detached] });
  await assert.rejects(() => platform.hashBytes(detached), (error) => error.name === "TypeError");
});

for (const [name, runtime] of [["missing crypto", noCrypto], ["rejected crypto", rejectedCrypto]]) {
  await hashCase(`equal-length DOC changes create distinct versions with ${name}`, async () => {
    const f = memoryFixture(runtime, ".doc");
    const first = await f.baseline(encoder.encode("n=100"));
    await f.service.checkCurrentChange({});
    f.set(encoder.encode("n=200"));
    const checked = await f.service.checkCurrentChange({});
    assert.equal(checked.fileSize, first.fileSize);
    assert.equal(checked.shouldCreateVersion, true);
    assert.equal(checked.changeSummary.fileChanged, true);
    assert.notEqual(checked.fileHash, first.fileHash);
    const saved = await f.service.createVersion({}, "equal-length revision");
    assert.equal(saved.fileHash, sha256(encoder.encode("n=200")));
    assert.equal(decoder.decode(f.commits.get(saved.commitHash)), "n=200");
    assert.equal((await f.metadata()).versions.length, 2);
  });

  await hashCase(`equal-length DOCX edits bypass old analysis and XML caches with ${name}`, async () => {
    const f = memoryFixture(runtime, ".docx");
    const before = storedDocx("n=100");
    const after = storedDocx("n=200");
    assert.equal(before.byteLength, after.byteLength);
    const first = await f.baseline(before);
    const unchanged = await f.service.checkCurrentChange({});
    assert.equal(unchanged.shouldCreateVersion, false);
    f.set(after);
    const changed = await f.service.checkCurrentChange({});
    assert.equal(changed.shouldCreateVersion, true);
    assert.equal(changed.changeSummary.changeType, "content");
    assert.equal(changed.contentSnapshot.normalizedText, "n=200");
    assert.equal(changed.fileHash, sha256(after));
    assert.notEqual(changed.fileHash, first.fileHash);
    assert.notEqual(changed.contentHash, first.contentHash);
    assert.equal(changed.contentHash, sha256(encoder.encode("n=200")));
    assert.equal((await new runtime.DocxReader(f.platform).readBytes(changed.fileBytes)).normalizedText, "n=200");
    const saved = await f.service.createVersion({}, "n=200");
    assert.equal(saved.contentSnapshot.paragraphs.join("\n"), "n=200");
    assert.equal(saved.fileHash, sha256(f.commits.get(saved.commitHash)));
    assert.equal((await f.metadata()).versions.length, 2);
  });
}

await hashCase("XML cache does not hide equal-length text edits when ZIP length also changes", async () => {
  const f = memoryFixture(noCrypto, ".docx");
  const first = await f.baseline(storedDocx("n=100"));
  f.set(storedDocx("n=200", true));
  const changed = await f.service.checkCurrentChange({});
  assert.notEqual(changed.fileSize, first.fileSize);
  assert.equal(changed.changeSummary.changeType, "content");
  assert.equal(changed.contentSnapshot.normalizedText, "n=200");
  assert.notEqual(changed.contentSnapshot.partHashes["word/document.xml"], first.contentSnapshot.partHashes["word/document.xml"]);
});

await hashCase("standalone readers and weak injected hash providers cannot alias XML cache entries", async () => {
  for (const provider of [null, { hashString: async (text) => `size-${encoder.encode(text).byteLength}` }]) {
    const reader = new noCrypto.DocxReader(provider);
    const before = await reader.readBytes(storedDocx("n=100"));
    const after = await reader.readBytes(storedDocx("n=200"));
    assert.equal(after.normalizedText, "n=200");
    assert.match(after.partHashes["word/document.xml"], /^[0-9a-f]{64}$/);
    assert.notEqual(before.partHashes["word/document.xml"], after.partHashes["word/document.xml"]);
  }
});

await hashCase("legacy size hashes cannot suppress equal-length revisions or upgrade old evidence", async () => {
  const f = memoryFixture(noCrypto, ".docx");
  const before = storedDocx("n=100");
  const after = storedDocx("n=200");
  await f.baseline(before);
  assert.equal((await f.service.checkCurrentChange({})).shouldCreateVersion, false);
  const metadata = await f.metadata();
  metadata.versions[0].fileHash = `size-${before.byteLength}`;
  metadata.versions[0].contentHash = "size-5";
  await f.metadataStore.write(f.repo, metadata);
  const unverifiedBaseline = await f.service.checkCurrentChange({});
  assert.equal(unverifiedBaseline.shouldCreateVersion, true,
    "a cached no-change result must not be reused after its baseline hash becomes unverified");
  f.set(after);
  const changed = await f.service.checkCurrentChange({});
  assert.equal(changed.shouldCreateVersion, true);
  assert.equal(changed.changeSummary.changeType, "content");
  assert.equal(changed.contentSnapshot.normalizedText, "n=200");
  const saved = await f.service.createVersion({}, "revision after legacy history");
  assert.equal(saved.fileHash, sha256(after));
  assert.equal(saved.contentHash, sha256(encoder.encode("n=200")));
  const final = await f.metadata();
  assert.equal(final.versions.length, 2);
  const legacy = final.versions.find((version) => version.commitHash === metadata.versions[0].commitHash);
  assert.equal(legacy.fileHash, `size-${before.byteLength}`, "unverified historic bytes must not be relabeled as SHA-256");
  assert.equal(legacy.contentHash, "size-5");
});

await hashCase("matching legacy size content hashes do not imply identical historical text", async () => {
  const f = memoryFixture(noCrypto, ".docx");
  const reader = new noCrypto.DocxReader(f.platform);
  const previous = await reader.readBytes(storedDocx("n=100"));
  const current = await reader.readBytes(storedDocx("n=200"));
  const summary = noCrypto.summarizeDocxChange({
    current, currentContentHash: "size-5", fileChanged: true,
    previousVersion: {
      contentHash: "size-5", contentSnapshot: previous,
      contentSummary: { paragraphCount: previous.paragraphCount, wordCount: previous.wordCount }
    }
  });
  assert.equal(summary.changeType, "content");
  assert.equal(summary.contentChanged, true);
  assert(summary.totalParagraphChanges > 0);
});

await hashCase("restore preflight rejects equal-length changes made after confirmation", async () => {
  const f = memoryFixture(noCrypto);
  const historic = await f.baseline(encoder.encode("VERSION"));
  f.set(encoder.encode("CURRENT"));
  const preflight = await f.service.buildRestorePreflight({}, historic, { stamp: "same-length-preflight" });
  assert.equal(preflight.ok, true);
  assert.equal(preflight.currentFileHash, sha256(encoder.encode("CURRENT")));
  f.set(encoder.encode("CHANGED"));
  await assert.rejects(() => f.service.restoreVersion({}, historic, { preflight }), (error) => {
    assert(error.message.includes(noCrypto.UI_TEXT.restorePreflightChanged));
    return true;
  });
  assert.equal(f.text(), "CHANGED");
  assert.equal(f.checkoutCount(), 0);
  assert.equal((await f.metadata()).lastRestored, null);
});

for (const phase of ["staged", "destination"]) {
  await hashCase(`restore detects equal-length ${phase} corruption and retains the original`, async () => {
    const f = memoryFixture(noCrypto);
    const historic = await f.baseline(encoder.encode("VERSION"));
    f.set(encoder.encode("CURRENT"));
    const preflight = await f.service.buildRestorePreflight({}, historic, { stamp: `corrupt-${phase}` });
    let injected = false;
    f.hooks.afterWrite = (target, options) => {
      const affected = phase === "staged" ? target === preflight.stagedPath : target.includes("/.git4zotero/restored-copies/");
      if (!injected && affected && options?.mode === "create") {
        injected = true;
        assert.equal(f.files.get(target).byteLength, 7);
        f.files.set(target, encoder.encode("CORRUPT"));
      }
    };
    await assert.rejects(() => f.service.restoreVersion({}, historic, { preflight }), (error) => {
      const message = phase === "staged" ? noCrypto.UI_TEXT.restoreStagingHashMismatch : noCrypto.UI_TEXT.restoreCopyHashMismatch;
      assert(error.message.includes(message));
      return true;
    });
    assert.equal(injected, true);
    assert.equal(f.text(), "CURRENT");
    assert.equal(decoder.decode(f.files.get(preflight.backupPath)), "CURRENT");
    assert.equal(f.files.has(preflight.stagedPath), false);
    assert.equal(f.copyCalls.filter(([source, target]) => source === preflight.backupPath && target === f.path).length,
      0, "safe-copy restore never rolls a backup over the current manuscript");
    assert.equal((await f.metadata()).lastRestored, null);
  });
}

await hashCase("successful restore records SHA-256 of the restored bytes without Web Crypto", async () => {
  const f = memoryFixture(noCrypto);
  const historic = await f.baseline(encoder.encode("VERSION"));
  f.set(encoder.encode("CURRENT"));
  const result = await f.service.restoreVersion({}, historic);
  assert.equal(f.text(), "CURRENT");
  assert.equal(result.mode, "copy");
  assert.equal(decoder.decode(f.files.get(result.restoredCopyPath)), "VERSION");
  assert.equal(result.restoredFileHash, sha256(encoder.encode("VERSION")));
  assert.equal((await f.metadata()).lastRestored.restoredFileHash, result.restoredFileHash);
});

await hashCase("legacy target hashes warn but restore copies still receive real SHA-256 validation", async () => {
  const f = memoryFixture(noCrypto);
  const baseline = await f.baseline(encoder.encode("VERSION"));
  const legacy = { ...baseline, fileHash: "size-7" };
  const metadata = await f.metadata();
  metadata.versions[0].fileHash = legacy.fileHash;
  await f.metadataStore.write(f.repo, metadata);
  f.set(encoder.encode("CURRENT"));
  const preflight = await f.service.buildRestorePreflight({}, legacy);
  assert.equal(preflight.checks.find((check) => check.id === "target-hash").status, "warning");
  const result = await f.service.restoreVersion({}, legacy, { preflight });
  assert.equal(result.restoredFileHash, sha256(encoder.encode("VERSION")));
  assert.equal(f.text(), "CURRENT");
  assert.equal(decoder.decode(f.files.get(result.restoredCopyPath)), "VERSION");
  assert.equal((await f.metadata()).versions[0].fileHash, "size-7");
});

await hashCase("a strong target hash mismatch blocks replacement of the current manuscript", async () => {
  const f = memoryFixture(noCrypto);
  const historic = await f.baseline(encoder.encode("VERSION"));
  f.set(encoder.encode("CURRENT"));
  f.hooks.afterCheckout = (target) => f.files.set(target, encoder.encode("WRONG!!"));
  const preflight = await f.service.buildRestorePreflight({}, historic);
  await assert.rejects(() => f.service.restoreVersion({}, historic, { preflight }), (error) => {
    assert(error.message.includes(noCrypto.UI_TEXT.restoreTargetHashMismatch));
    return true;
  });
  assert.equal(f.text(), "CURRENT");
  assert.equal(f.files.has(preflight.backupPath), false, "target verification should happen before any replacement work");
  assert.equal((await f.metadata()).lastRestored, null);
});

console.log(`Hash safety regression tests passed (${testCount} scenarios; no real Zotero or Git calls).`);

async function hashCase(name, operation) {
  try {
    await operation();
    testCount += 1;
  }
  catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function loadHashRuntime(...cryptoArgument) {
  const globals = { TextEncoder, TextDecoder };
  if (cryptoArgument.length) globals.crypto = cryptoArgument[0];
  const context = vm.createContext(globals);
  const marker = "__git4zoteroRuntimeGlobal.Git4Zotero = Git4Zotero;";
  assert(runtimeSource.includes(marker));
  vm.runInContext(runtimeSource.replace(marker, `${marker}\n__git4zoteroRuntimeGlobal.__hashTests = { ZoteroPlatform, ContentAnalyzer, DocxReader, VersionService, MetadataStore, UI_TEXT, setUILocale, summarizeDocxChange };`), context);
  context.__hashTests.setUILocale("en-US");
  return context.__hashTests;
}

function memoryFixture(runtime, extension = ".doc") {
  const root = `memory/hash-safety-${++fixtureID}`;
  const files = new Map();
  const directories = new Set();
  const commits = new Map();
  const hooks = {};
  const copyCalls = [];
  let checkouts = 0;
  const path = `${root}/paper${extension}`;
  const repo = `${root}/git4zotero/library-1/item-PAPER`;
  const read = (file) => {
    assert(files.has(file), `missing memory file: ${file}`);
    return files.get(file).slice();
  };
  const io = {
    exists: async (file) => files.has(file) || directories.has(file),
    makeDirectory: async (directory) => { directories.add(directory); },
    read: async (file) => read(file),
    readUTF8: async (file) => decoder.decode(read(file)),
    write: async (file, bytes, options = {}) => {
      if (options.mode === "create" && files.has(file)) {
        const error = new Error("destination exists");
        error.name = "NoModificationAllowedError";
        throw error;
      }
      files.set(file, new Uint8Array(bytes));
      await hooks.afterWrite?.(file, options);
    },
    writeUTF8: async (file, text, options = {}) => {
      if (options.mode === "create" && files.has(file)) {
        const error = new Error("destination exists");
        error.name = "NoModificationAllowedError";
        throw error;
      }
      files.set(file, encoder.encode(text));
    },
    remove: async (file) => { files.delete(file); },
    stat: async (file) => {
      if (directories.has(file)) return { type: "directory", size: 0 };
      if (!files.has(file)) {
        const error = new Error("memory file missing");
        error.name = "NotFoundError";
        throw error;
      }
      return { type: "regular", size: read(file).byteLength };
    },
    copy: async (source, target) => {
      copyCalls.push([source, target]);
      files.set(target, read(source));
      await hooks.afterCopy?.(source, target);
    },
    move: async (source, target) => { files.set(target, read(source)); files.delete(source); }
  };
  const platform = new runtime.ZoteroPlatform({
    Zotero: { Prefs: { get: (key) => key.endsWith("autoSafetyVersion") ? false : undefined } },
    Services: { dirsvc: { get: () => ({ path: root }) } },
    Ci: { nsIFile: null }, Cc: {}, IOUtils: io, PathUtils: null
  });
  const attachment = {
    libraryID: 1, itemID: 1, itemKey: "PAPER", attachmentID: 2,
    attachmentKey: "WORD", fileName: `paper${extension}`, filePath: path, extension
  };
  const metadataStore = new runtime.MetadataStore(platform);
  const service = new runtime.VersionService({
    platform, metadataStore, pluginVersion: "0.7.0",
    attachmentFinder: { findManageableAttachment: async () => attachment },
    gitBackend: {
      checkAvailability: async () => ({ available: true, detail: "simulated Git only" }),
      ensureRepo: async () => { directories.add(`${repo}/.git`); },
      getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: "clean" }),
      commitSnapshot: async (_repo, snapshot) => {
        const hash = createHash("sha1").update(`${root}:${commits.size}`).digest("hex");
        commits.set(hash, read(`${repo}/${snapshot.trackedRelativePath}`));
        return { hash };
      },
      checkoutTrackedFile: async (_repo, hash, relativePath) => {
        checkouts += 1;
        assert(commits.has(hash));
        files.set(`${repo}/${relativePath}`, commits.get(hash).slice());
        await hooks.afterCheckout?.(`${repo}/${relativePath}`);
      }
    }
  });
  return {
    platform, service, metadataStore, files, commits, hooks, copyCalls, path, repo,
    set: (bytes) => files.set(path, new Uint8Array(bytes)),
    text: () => decoder.decode(read(path)),
    metadata: () => metadataStore.read(repo),
    checkoutCount: () => checkouts,
    async baseline(bytes) {
      files.set(path, new Uint8Array(bytes));
      await service.enableVersionManagement({});
      return service.createVersion({}, "baseline");
    }
  };
}

function storedDocx(text, extraPart = false) {
  const entries = [["word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`]];
  if (extraPart) entries.push(["docProps/custom.xml", "<properties>extra ZIP entry</properties>"]);
  const local = [];
  const central = [];
  let offset = 0;
  for (const [entryName, text] of entries) {
    const name = Buffer.from(entryName);
    const data = Buffer.from(text);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + data.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.reduce((sum, part) => sum + part.length, 0), 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, ...central, end]));
}
