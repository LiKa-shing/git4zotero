import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import vm from "node:vm";
import { constants as zlibConstants, deflateRawSync } from "node:zlib";
import {
  buildRepoRelativePath,
  buildTrackedFileName,
  AttachmentFinder,
  getExtension,
  getFileName,
  isManageablePath,
  sanitizeForPath
} from "../chrome/content/src/attachments.mjs";
import { ContentAnalyzer } from "../chrome/content/src/content-diff.mjs";
import { PREFS, SECTION_ID, UI_TEXT } from "../chrome/content/src/constants.mjs";
import { DocxReader } from "../chrome/content/src/docx-reader.mjs";
import { inflateRaw } from "../chrome/content/src/vendor/zip-reader.mjs";
import {
  createEmptyMetadata,
  createVersionRecord,
  METADATA_SCHEMA_VERSION,
  MetadataStore,
  normalizeVersionNote,
  sortNewestFirst
} from "../chrome/content/src/metadata.mjs";
import { assertSafeCommitHash, GitBackend } from "../chrome/content/src/git-backend.mjs";
import { PaperVersionMenu } from "../chrome/content/src/menu.mjs";
import { normalizeJoinParts, ZoteroPlatform } from "../chrome/content/src/platform.mjs";
import { PaperVersionPane } from "../chrome/content/src/ui.mjs";
import { VersionService } from "../chrome/content/src/version-service.mjs";

let CRC_TABLE = null;

class TestPlatform {
  constructor(files) {
    this.files = files;
  }

  async readFileBytes(path) {
    return this.files[path];
  }

  async stat(path) {
    return { size: this.files[path].byteLength };
  }

  async hashFile(path) {
    return this.hashBytes(this.files[path]);
  }

  async hashString(value) {
    return this.hashBytes(new TextEncoder().encode(String(value ?? "")));
  }

  async hashBytes(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
  }
}

class FakeNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.childNodes = [];
    this.parentNode = null;
    this._textContent = "";
  }

  append(...children) {
    for (const child of children) {
      const node = typeof child === "string"
        ? this.ownerDocument.createTextNode(child)
        : child;
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  remove() {
    if (!this.parentNode) {
      return;
    }
    this.parentNode.childNodes = this.parentNode.childNodes.filter((child) => child !== this);
    this.parentNode = null;
  }

  replaceChildren(...children) {
    this.childNodes = [];
    this._textContent = "";
    this.append(...children);
  }

  get children() {
    return this.childNodes.filter((child) => child instanceof FakeElement);
  }

  get textContent() {
    return this._textContent + this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.childNodes = [];
    this._textContent = String(value ?? "");
  }
}

class FakeText extends FakeNode {
  constructor(ownerDocument, text) {
    super(ownerDocument);
    this.textContent = text;
  }
}

class FakeElement extends FakeNode {
  constructor(ownerDocument, tagName) {
    super(ownerDocument);
    this.tagName = tagName;
    this.localName = tagName;
    this.className = "";
    this.id = "";
    this.listeners = new Map();
    this.disabled = false;
    this.attributes = new Map();
    this.hidden = false;
    this.open = false;
    this.expanded = false;
    this.collapsed = false;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(handler);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") {
      this.id = String(value);
    }
    if (name === "class") {
      this.className = String(value);
    }
  }

  getAttribute(name) {
    if (name === "id") {
      return this.id;
    }
    if (name === "class") {
      return this.className;
    }
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "id") {
      this.id = "";
    }
    if (name === "class") {
      this.className = "";
    }
  }

  removeEventListener(type, handler) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== handler));
  }

  async click() {
    for (const handler of this.listeners.get("click") ?? []) {
      await handler({ target: this });
    }
  }

  querySelector(selector) {
    const attributeMatch = selector.match(/^\[([^=\]]+)='([^']*)'\]$/);
    if (attributeMatch) {
      return findByAttribute(this, attributeMatch[1], attributeMatch[2]);
    }
    if (!selector.startsWith(".")) {
      return null;
    }

    const className = selector.slice(1);
    return findByClass(this, className);
  }

  closest(selector) {
    for (let node = this; node; node = node.parentNode) {
      if (!(node instanceof FakeElement)) {
        continue;
      }
      if (selector.startsWith(".")) {
        if (String(node.className ?? "").split(/\s+/).includes(selector.slice(1))) {
          return node;
        }
      }
      else if (node.localName === selector || node.tagName === selector) {
        return node;
      }
    }
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement(this, "root");
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  createXULElement(tagName) {
    return new FakeElement(this, tagName);
  }

  createElementNS(_namespace, tagName) {
    return new FakeElement(this, tagName);
  }

  createTextNode(text) {
    return new FakeText(this, text);
  }

  getElementById(id) {
    return findById(this.documentElement, id);
  }
}

assert.equal(getFileName("C:\\Users\\A\\paper.docx"), "paper.docx");
assert.equal(getFileName("/tmp/paper.odt"), "paper.odt");
assert.equal(getExtension("paper.DOCX"), ".docx");
assert.equal(isManageablePath("paper.docx"), true);
assert.equal(isManageablePath("paper.doc"), true);
assert.equal(isManageablePath("paper.odt"), false);
assert.equal(isManageablePath("paper.pdf"), false);
assert.equal(isManageablePath("paper"), false);
assert.equal(buildTrackedFileName("draft.final.docx"), "document.docx");
assert.equal(buildTrackedFileName("draft.final.doc"), "document.doc");
assert.throws(() => buildTrackedFileName("paper.odt"), /Unsupported manuscript extension/);
assert.equal(sanitizeForPath("group:中文 key"), "group_key");
assert.equal(buildRepoRelativePath(1, "ABC123"), "library-1/item-ABC123");
assert.equal(normalizeVersionNote("  "), "论文版本");
assert.doesNotThrow(() => assertSafeCommitHash("0123abcd"));
assert.throws(() => assertSafeCommitHash("../HEAD"));

{
  const [manifest, packageJson] = await Promise.all([
    fs.readFile("manifest.json", "utf8").then(JSON.parse),
    fs.readFile("package.json", "utf8").then(JSON.parse)
  ]);
  assert.equal(manifest.author, "Li Ka-shing");
  assert.equal(packageJson.author, "Li Ka-shing");
}

{
  const pathUtilsCalls = [];
  const strictPathUtils = {
    join(...parts) {
      for (const part of parts.slice(1)) {
        if (/[\\/]/.test(part)) {
          throw new Error(`strict PathUtils rejected composite segment: ${part}`);
        }
      }
      pathUtilsCalls.push(parts);
      return parts.join("\\");
    }
  };
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      dirsvc: {
        get: () => ({ path: "C:\\Profile" })
      },
      prompt: {}
    },
    Cc: {},
    Ci: { nsIFile: function nsIFile() {} },
    ChromeUtils: {},
    IOUtils: null,
    PathUtils: strictPathUtils
  });

  assert.deepEqual(
    normalizeJoinParts(["base", "library-1/item-ABC123", "tracked\\document.docx", ".", ""]),
    ["base", "library-1", "item-ABC123", "tracked", "document.docx"]
  );
  assert.equal(platform.getRepoPath(1, "ABC123"), "C:\\Profile\\git4zotero\\library-1\\item-ABC123");
  assert(pathUtilsCalls.some((parts) => parts.includes("library-1") && parts.includes("item-ABC123")));
  assert.throws(() => platform.join("C:\\Profile", "../escape"), /路径片段不能包含 \.\./);
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      dirsvc: {
        get: () => ({ path: "/tmp/profile" })
      },
      prompt: {}
    },
    Cc: {},
    Ci: { nsIFile: function nsIFile() {} },
    ChromeUtils: {},
    IOUtils: null,
    PathUtils: {
      join(...parts) {
        for (const part of parts.slice(1)) {
          if (/[\\/]/.test(part)) {
            throw new Error(`strict PathUtils rejected composite segment: ${part}`);
          }
        }
        return parts.join("/");
      }
    }
  });
  assert.equal(platform.join("/tmp/profile", "tracked/document.docx"), "/tmp/profile/tracked/document.docx");
}

{
  const prefs = new Map();
  const subprocessCalls = [];
  const discoveredGit = "C:\\Program Files\\Git\\cmd\\git.exe";
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: {
        get: (key) => prefs.get(key) ?? "",
        set: (key, value) => prefs.set(key, value)
      },
      debug() {}
    },
    Services: {
      appinfo: { OS: "WINNT" },
      dirsvc: {
        get: (key) => ({ path: key === "ProfD" ? "C:\\Profile" : "C:\\Users\\Tester" })
      },
      prompt: {}
    },
    Cc: {},
    Ci: { nsIFile: function nsIFile() {} },
    ChromeUtils: {
      importESModule: () => ({
        Subprocess: {
          call: async ({ command, arguments: args }) => {
            subprocessCalls.push({ command, args });
            return makeSubprocessProc({ exitCode: 0, stdout: "git version 2.44.0\n" });
          }
        }
      })
    },
    IOUtils: {
      exists: async (target) => target === discoveredGit
    },
    PathUtils: null
  });
  const result = await platform.checkGitAvailability("", { persist: true });
  assert.equal(result.available, true);
  assert.equal(result.command, discoveredGit);
  assert.equal(result.source, "auto");
  assert.equal(result.version, "git version 2.44.0");
  assert.equal(prefs.get(PREFS.gitPath), discoveredGit);
  assert.equal(subprocessCalls[0].command, discoveredGit);
}

{
  const prefs = new Map([[PREFS.gitPath, "C:\\Old\\Git\\cmd\\git.exe"]]);
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: {
        get: (key) => prefs.get(key) ?? "",
        set: (key, value) => prefs.set(key, value)
      },
      debug() {}
    },
    Services: {
      appinfo: { OS: "WINNT" },
      dirsvc: {
        get: (key) => ({ path: key === "ProfD" ? "C:\\Profile" : "C:\\Users\\Tester" })
      },
      prompt: {}
    },
    Cc: {},
    Ci: { nsIFile: function nsIFile() {} },
    ChromeUtils: {
      importESModule: () => ({
        Subprocess: {
          call: async ({ command }) => {
            if (command === "C:\\Bad\\git.exe") {
              throw new Error("bad executable");
            }
            return makeSubprocessProc({ exitCode: 0, stdout: "git version 2.45.0\n" });
          }
        }
      })
    },
    IOUtils: {
      exists: async () => false
    },
    PathUtils: null
  });
  const failed = await platform.checkGitAvailability("C:\\Bad\\git.exe", { persist: true });
  assert.equal(failed.available, false);
  assert.equal(prefs.get(PREFS.gitPath), "C:\\Old\\Git\\cmd\\git.exe");

  const success = await platform.checkGitAvailability("C:\\Good\\git.exe", { persist: true });
  assert.equal(success.available, true);
  assert.equal(success.command, "C:\\Good\\git.exe");
  assert.equal(prefs.get(PREFS.gitPath), "C:\\Good\\git.exe");
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      appinfo: { OS: "WINNT" },
      dirsvc: {
        get: (key) => ({ path: key === "ProfD" ? "C:\\Profile" : "C:\\Users\\Tester" })
      },
      prompt: {}
    },
    Cc: {},
    Ci: { nsIFile: function nsIFile() {} },
    ChromeUtils: {
      importESModule: () => ({
        Subprocess: {
          call: async ({ command }) => {
            throw new Error(`File at path "${command}" does not exist, or is not executable`);
          }
        }
      })
    },
    IOUtils: {
      exists: async () => false
    },
    PathUtils: null
  });
  const result = await platform.checkGitAvailability();
  assert.equal(result.available, false);
  assert.equal(result.command, "git");
  assert.equal(result.error, UI_TEXT.gitPathNotFound);
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      prompt: {
        select(_parent, title, message, list, selected) {
          assert.equal(title, "选择版本");
          assert.equal(message, "请选择");
          assert.deepEqual(list, ["版本 A", "版本 B"]);
          selected.value = 1;
          return true;
        }
      }
    },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  assert.equal(platform.selectFromList("选择版本", "请选择", ["版本 A", "版本 B"]), 1);
}

{
  let calls = 0;
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      prompt: {
        select(_parent, _title, _message, countOrList, listOrSelected, selected) {
          calls += 1;
          if (calls === 1) {
            assert.deepEqual(countOrList, ["版本 A", "版本 B"]);
            throw new Error("Cannot convert primitive JavaScript value into an array arg 3");
          }
          assert.equal(countOrList, 2);
          assert.deepEqual(listOrSelected, ["版本 A", "版本 B"]);
          selected.value = 1;
          return true;
        }
      }
    },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  assert.equal(platform.selectFromList("选择版本", "请选择", ["版本 A", "版本 B"]), 1);
  assert.equal(calls, 2);
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      prompt: {
        select(_parent, _title, _message, _list, _selected) {
          return false;
        }
      }
    },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  assert.equal(platform.selectFromList("选择版本", "请选择", ["版本 A"]), -1);
}

{
  const writes = [];
  const directories = [];
  const picker = {
    file: { path: "C:\\Exports\\summary.md" },
    init(_parent, title, mode) {
      assert.equal(title, UI_TEXT.menuExportSummary);
      assert.equal(mode, 1);
    },
    appendFilter(label, pattern) {
      assert.equal(label, "Markdown");
      assert.equal(pattern, "*.md");
    },
    appendFilters(filter) {
      assert.equal(filter, 99);
    },
    open(resolve) {
      resolve(0);
    }
  };
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      dirsvc: { get: () => ({ path: "C:\\Profile" }) },
      prompt: {}
    },
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance: () => picker
      }
    },
    Ci: {
      nsIFile: function nsIFile() {},
      nsIFilePicker: {
        modeSave: 1,
        returnCancel: 2,
        filterAll: 99
      }
    },
    ChromeUtils: {},
    IOUtils: {
      makeDirectory: async (target) => directories.push(target),
      writeUTF8: async (target, content) => writes.push([target, content])
    },
    PathUtils: null
  });
  const savedPath = await platform.saveTextFile({
    title: UI_TEXT.menuExportSummary,
    defaultFileName: "summary.md",
    content: "# Summary\n"
  });
  assert.equal(savedPath, "C:\\Exports\\summary.md");
  assert.deepEqual(writes, [["C:\\Exports\\summary.md", "# Summary\n"]]);
  assert.deepEqual(directories, ["C:\\Exports"]);
}

{
  const writes = [];
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      dirsvc: { get: () => ({ path: "C:\\Profile" }) },
      prompt: {}
    },
    Cc: {},
    Ci: { nsIFile: function nsIFile() {} },
    ChromeUtils: {},
    IOUtils: {
      makeDirectory: async () => {},
      writeUTF8: async (target, content) => writes.push([target, content])
    },
    PathUtils: null
  });
  const savedPath = await platform.saveTextFile({
    defaultFileName: "fallback.txt",
    content: "fallback"
  });
  assert.equal(savedPath, "C:\\Profile\\git4zotero\\exports\\fallback.txt");
  assert.deepEqual(writes, [["C:\\Profile\\git4zotero\\exports\\fallback.txt", "fallback"]]);
}

{
  const parentItem = {
    id: 10,
    key: "PARENT",
    libraryID: 1,
    getAttachments: () => [20],
    isAttachment: () => false
  };
  const attachmentItem = {
    id: 20,
    key: "ATTACH",
    parentItemID: 10,
    libraryID: 1,
    isAttachment: () => true,
    getFilePathAsync: async () => "C:\\papers\\draft.docx"
  };
  const finder = new AttachmentFinder({
    Zotero: {
      Items: {
        get: (id) => id === 10 ? parentItem : attachmentItem
      }
    }
  });
  const fromParent = await finder.findManageableAttachment(parentItem);
  assert.equal(fromParent.itemKey, "PARENT");
  assert.equal(fromParent.attachmentKey, "ATTACH");
  const fromAttachment = await finder.findManageableAttachment(attachmentItem);
  assert.equal(fromAttachment.itemKey, "PARENT");
  assert.equal(fromAttachment.attachmentKey, "ATTACH");
}

{
  const gitCalls = [];
  const backend = new GitBackend({
    getGitExecutable: () => "git",
    join: (...parts) => parts.join("/"),
    exists: async (target) => target.endsWith(".git"),
    runProcess: async (_command, args) => {
      gitCalls.push(args);
      if (args[0] === "--version") {
        return { exitCode: 0, stdout: "git version 2.44.0\n", stderr: "" };
      }
      if (args[0] === "rev-parse") {
        return { exitCode: 0, stdout: "0123456789abcdef\n", stderr: "" };
      }
      if (args[0] === "log") {
        const firstBody = JSON.stringify({
          sourceFileName: "paper.docx",
          trackedRelativePath: "tracked/document.docx",
          kind: "manual",
          createdAt: "2026-05-20T19:30:00+08:00",
          changeSummary: "首次创建版本"
        }, null, 2);
        const secondBody = JSON.stringify({
          sourceFileName: "legacy.docx",
          trackedRelativePath: "document.docx",
          kind: "safety",
          createdAt: "2026-05-19T19:30:00+08:00",
          changeSummary: "自动备份"
        }, null, 2);
        return {
          exitCode: 0,
          stdout: [
            `0123456789abcdef\t2026-05-20T19:30:00+08:00\tgit4zotero\tgit4zotero: 初稿\x1f${firstBody}\x1e`,
            `fedcba9876543210\t2026-05-19T19:30:00+08:00\tgit4zotero\tgit4zotero: 自动备份\x1f${secondBody}\x1e`,
            "89abcdef01234567\t2026-05-18T19:30:00+08:00\tgit4zotero\tgit4zotero: legacy body\x1fnot-json\x1e"
          ].join("\n"),
          stderr: ""
        };
      }
      if (args[0] === "status") {
        return { exitCode: 0, stdout: " M tracked/document.docx\n", stderr: "" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  });
  assert.equal((await backend.checkAvailability()).detail, "git version 2.44.0");
  assert.equal((await backend.commitSnapshot("repo", {
    note: "初稿",
    sourceFileName: "paper.docx",
    trackedRelativePath: "tracked/document.docx",
    kind: "manual",
    createdAt: "2026-05-20T19:30:00+08:00",
    changeSummary: { summary: "首次创建版本" }
  })).hash, "0123456789abcdef");
  const history = await backend.listHistory("repo");
  assert.equal(history.length, 3);
  assert.equal(history[0].hash, "0123456789abcdef");
  assert.equal(history[0].subject, "git4zotero: 初稿");
  assert.equal(history[0].trackedRelativePath, "tracked/document.docx");
  assert.equal(history[0].sourceFileName, "paper.docx");
  assert.equal(history[0].kind, "manual");
  assert.equal(history[0].changeSummary, "首次创建版本");
  assert.equal(history[1].trackedRelativePath, "document.docx");
  assert.equal(history[1].kind, "safety");
  assert.equal(history[2].trackedRelativePath, null);
  const workingTree = await backend.getWorkingTreeStatus("repo");
  assert.equal(workingTree.clean, false);
  assert.deepEqual(workingTree.entries, [" M tracked/document.docx"]);
  assert(gitCalls.some((args) => args[0] === "rev-parse"));
  assert(!gitCalls.find((args) => args[0] === "log").includes("tracked"));
}

const metadata = createEmptyMetadata();
assert.equal(metadata.schemaVersion, METADATA_SCHEMA_VERSION);
assert.equal(metadata.enabled, false);
assert.deepEqual(metadata.versions, []);
assert.equal(metadata.lastCheck, null);

const older = createVersionRecord({
  id: "old",
  commitHash: "0123abcd",
  createdAt: "2026-01-01T00:00:00.000Z",
  kind: "manual",
  note: "旧版本",
  fileName: "paper.docx",
  fileHash: "sha256-old",
  fileSize: 10,
  contentHash: "content-old",
  contentSummary: { mode: "docx-content", paragraphCount: 2, wordCount: 10, fileOnly: false },
  contentSnapshot: { paragraphs: ["第一段", "第二段"], paragraphCount: 2, wordCount: 6, sections: [] },
  changeSummary: { changeType: "first-version", summary: "首次创建版本。" },
  trackedRelativePath: "tracked/document.docx",
  libraryID: 1,
  itemID: 2,
  itemKey: "ITEM",
  attachmentID: 3,
  attachmentKey: "ATT",
  pluginVersion: "0.2.1"
});
const newer = {
  ...older,
  id: "new",
  commitHash: "abcdef0123456789",
  shortHash: "abcdef01",
  createdAt: "2026-01-02T00:00:00.000Z"
};
const oldest = {
  ...older,
  id: "oldest",
  commitHash: "0011223344556677",
  shortHash: "00112233",
  createdAt: "2025-12-31T00:00:00.000Z",
  note: "Oldest version",
  fileName: "legacy.docx",
  trackedRelativePath: "legacy/document.docx"
};
const metadataOnly = { ...oldest, id: "metadata-only" };
assert.deepEqual(sortNewestFirst([older, newer]).map((record) => record.id), ["new", "old"]);

const legacyMetadataStore = new MetadataStore({
  join: (...parts) => parts.join("/"),
  exists: async () => true,
  readText: async () => JSON.stringify({ versions: [older] })
});
assert.equal((await legacyMetadataStore.read("legacy-repo")).enabled, true);
const explicitlyDisabledStore = new MetadataStore({
  join: (...parts) => parts.join("/"),
  exists: async () => true,
  readText: async () => JSON.stringify({ enabled: false, versions: [older] })
});
assert.equal((await explicitlyDisabledStore.read("disabled-repo")).enabled, false);

const service = new VersionService({});
const merged = service.mergeHistoryWithMetadata(
  [
    {
      hash: "89abcdef",
      shortHash: "89abcdef",
      createdAt: "2026-01-03T00:00:00.000Z",
      subject: "git4zotero: 从 Git 历史恢复",
      trackedRelativePath: "document.docx",
      sourceFileName: "legacy.docx",
      kind: "manual",
      changeSummary: "Git-only summary"
    },
    {
      hash: older.commitHash,
      shortHash: older.shortHash,
      createdAt: older.createdAt,
      subject: "git4zotero: 旧版本"
    }
  ],
  {
    trackedFile: { trackedRelativePath: "tracked/document.docx" },
    versions: [older, metadataOnly]
  },
  {
    filePath: "paper.docx",
    fileName: "paper.docx",
    libraryID: 1,
    itemID: 2,
    itemKey: "ITEM",
    attachmentID: 3,
    attachmentKey: "ATT"
  }
);
assert.equal(merged[0].note, "从 Git 历史恢复");
assert.equal(merged[0].source, "git");
assert.equal(merged[0].trackedRelativePath, "document.docx");
assert.equal(merged[0].fileName, "legacy.docx");
assert.equal(merged[0].changeSummary.summary, "Git-only summary");
assert.equal(merged[1].id, "old");
assert.equal(merged[1].source, "metadata");
assert.equal(merged[2].id, "metadata-only");
assert.equal(merged[2].trackedRelativePath, "legacy/document.docx");

const managedAttachment = {
  filePath: "paper.docx",
  fileName: "paper.docx",
  libraryID: 1,
  itemID: 2,
  itemKey: "ITEM",
  attachmentID: 3,
  attachmentKey: "ATT"
};
const disabledService = new VersionService({
  platform: {
    getRepoPath: () => "repo"
  },
  attachmentFinder: {
    findManageableAttachment: async () => managedAttachment
  },
  gitBackend: {
    checkAvailability: async () => {
      throw new Error("disabled item must not call Git");
    },
    listHistory: async () => {
      throw new Error("disabled item must not read Git history");
    }
  },
  metadataStore: {
    read: async () => createEmptyMetadata(),
    write: async () => {
      throw new Error("panel state must not write metadata");
    }
  },
  pluginVersion: "0.2.1",
  contentAnalyzer: {
    analyze: async () => {
      throw new Error("disabled item must not analyze content");
    }
  }
});
const disabledState = await disabledService.getPanelState({});
assert.equal(disabledState.enabled, false);
assert.equal(disabledState.attachment.fileName, "paper.docx");
await assert.rejects(() => disabledService.checkCurrentChange({}), /尚未启用/);
await assert.rejects(() => disabledService.createVersion({}, "draft"), /尚未启用/);
await assert.rejects(() => disabledService.restoreVersion({}, older), /尚未启用/);

const fullHistoryService = new VersionService({
  platform: {
    getRepoPath: () => "repo"
  },
  attachmentFinder: {
    findManageableAttachment: async () => managedAttachment
  },
  gitBackend: {
    checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
    listHistory: async () => [
      {
        hash: "89abcdef",
        shortHash: "89abcdef",
        createdAt: "2026-01-03T00:00:00.000Z",
        subject: "git4zotero: git-only",
        trackedRelativePath: "document.docx"
      },
      {
        hash: newer.commitHash,
        shortHash: newer.shortHash,
        createdAt: newer.createdAt,
        subject: "git4zotero: newer"
      },
      {
        hash: older.commitHash,
        shortHash: older.shortHash,
        createdAt: older.createdAt,
        subject: "git4zotero: older"
      }
    ],
    getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: UI_TEXT.workingTreeClean })
  },
  metadataStore: {
    read: async () => ({
      ...createEmptyMetadata(),
      enabled: true,
      trackedFile: { trackedRelativePath: "tracked/document.docx" },
      versions: [older, metadataOnly]
    }),
    write: async () => {
      throw new Error("history reads must not write metadata");
    }
  },
  pluginVersion: "0.2.1"
});
const versionHistory = await fullHistoryService.getVersionHistory({});
assert.equal(versionHistory.length, 4);
assert(versionHistory.some((version) => version.source === "git" && version.trackedRelativePath === "document.docx"));
assert(versionHistory.some((version) => version.id === "metadata-only"));
const fullPanelState = await fullHistoryService.getPanelState({});
assert.equal(fullPanelState.versions.length, 4);

const exportedFiles = [];
const exportService = new VersionService({
  platform: {
    getRepoPath: () => "repo",
    saveTextFile: async (request) => {
      exportedFiles.push(request);
      return `exports/${request.defaultFileName}`;
    }
  },
  attachmentFinder: {
    findManageableAttachment: async () => managedAttachment
  },
  gitBackend: {
    checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
    listHistory: async () => [{
      hash: older.commitHash,
      shortHash: older.shortHash,
      createdAt: older.createdAt,
      subject: "git4zotero: 旧版本",
      trackedRelativePath: older.trackedRelativePath
    }]
  },
  metadataStore: {
    read: async () => ({
      ...createEmptyMetadata(),
      enabled: true,
      trackedFile: { trackedRelativePath: "tracked/document.docx" },
      versions: [{
        ...older,
        changeSummary: {
          summary: "正文内容已修改；修改 1 段。",
          changeGroups: [{
            key: "heading:引言",
            label: "引言",
            summary: "引言 · 修改 1 段",
            totalChanges: 1,
            changes: [{
              type: "modified",
              oldText: "旧引言段",
              newText: "新引言段",
              locationLabel: "引言 · 第 1 段"
            }]
          }],
          paragraphChanges: [{
            type: "modified",
            oldText: "旧引言段",
            newText: "新引言段",
            locationLabel: "引言 · 第 1 段"
          }],
          totalParagraphChanges: 1
        }
      }],
      lastCheck: {
        checkedAt: "2026-05-20T12:00:00.000Z",
        fileName: "paper.docx",
        fileSize: 42,
        changeSummary: {
          summary: "正文内容已修改；修改 1 段。",
          paragraphChanges: [{ type: "modified", oldText: "旧", newText: "新", locationLabel: "引言 · 第 1 段" }]
        }
      }
    })
  },
  pluginVersion: "0.2.1"
});
const historyExport = await exportService.exportVersionSummary({}, { scope: "history", format: "markdown" });
assert(historyExport.path.includes("git4zotero-history-ITEM"));
assert(exportedFiles.at(-1).content.includes("# git4zotero 版本历史"));
assert(exportedFiles.at(-1).content.includes("Hash：0123abcd"));
assert(exportedFiles.at(-1).content.includes("位置摘要"));
assert(exportedFiles.at(-1).content.includes("引言 · 修改 1 段"));
const diffExport = await exportService.exportVersionSummary({}, { scope: "last-check", format: "text" });
assert(diffExport.path.endsWith(".txt"));
assert(exportedFiles.at(-1).content.includes("git4zotero 最近检查差异"));
assert(exportedFiles.at(-1).content.includes("引言 · 第 1 段"));
await assert.rejects(
  () => new VersionService({
    platform: { getRepoPath: () => "repo", saveTextFile: async () => "unused" },
    attachmentFinder: { findManageableAttachment: async () => managedAttachment },
    metadataStore: { read: async () => ({ ...createEmptyMetadata(), enabled: true }) },
    gitBackend: { checkAvailability: async () => ({ available: true }) }
  }).exportVersionSummary({}, { scope: "last-check" }),
  /尚未检查修改/
);

const healthyService = new VersionService({
  platform: {
    getRepoPath: () => "repo",
    join: (...parts) => parts.join("/"),
    exists: async (target) => [
      "paper.docx",
      "repo/.git",
      "repo/tracked/document.docx"
    ].includes(target)
  },
  attachmentFinder: {
    findManageableAttachment: async () => managedAttachment
  },
  gitBackend: {
    checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
    listHistory: async () => [{
      hash: older.commitHash,
      shortHash: older.shortHash,
      createdAt: older.createdAt,
      subject: "git4zotero: older",
      trackedRelativePath: older.trackedRelativePath
    }],
    getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: UI_TEXT.workingTreeClean })
  },
  metadataStore: {
    read: async () => ({
      ...createEmptyMetadata(),
      enabled: true,
      trackedFile: { trackedRelativePath: "tracked/document.docx" },
      versions: [older]
    })
  }
});
const healthy = await healthyService.checkRepositoryHealth({});
assert.equal(healthy.errorCount, 0);
assert.equal(healthy.checks.find((check) => check.id === "tracked-file").status, "ok");

const brokenHealth = await healthyService.buildRepositoryHealth({
  attachment: managedAttachment,
  repoPath: "repo",
  metadata: {
    ...createEmptyMetadata(),
    schemaVersion: 1,
    enabled: true,
    versions: [{ ...older, trackedRelativePath: "../escape" }]
  },
  git: { available: false, detail: "git missing" },
  versions: [],
  workingTree: null
});
assert(brokenHealth.errorCount >= 2);
assert(brokenHealth.checks.some((check) => check.id === "tracked-paths" && check.status === "error"));

const disabledPaneText = await renderPaneText({
  attachment: managedAttachment,
  enabled: false,
  git: null,
  versions: []
});
assert(disabledPaneText.includes("当前论文文件"));
assert(disabledPaneText.includes("尚未启用版本管理"));
assert(disabledPaneText.includes("右键条目或附件"));
assert(disabledPaneText.includes("工作流"));
assert(disabledPaneText.includes("检查修改"));

const noAttachmentPaneText = await renderPaneText({
  attachment: null,
  enabled: false,
  git: null,
  versions: []
});
assert(noAttachmentPaneText.includes("未找到可管理的论文文件"));
assert(noAttachmentPaneText.includes("工作流"));
assert(noAttachmentPaneText.includes("添加论文附件"));

const gitUnavailablePaneText = await renderPaneText({
  attachment: managedAttachment,
  enabled: true,
  git: { available: false, detail: "missing git" },
  versions: []
});
assert(gitUnavailablePaneText.includes("Git 不可用"));
assert(gitUnavailablePaneText.includes("missing git"));
assert(gitUnavailablePaneText.includes("配置 Git"));

const gitAvailablePaneText = await renderPaneText({
  attachment: managedAttachment,
  enabled: true,
  git: { available: true, detail: "git version 2.44.0" },
  lastCheck: {
    checkedAt: "2026-05-20T12:00:00.000Z",
    fileName: "paper.docx",
    fileSize: 42,
    changeSummary: {
      summary: "正文内容已修改；新增 1 段。",
      paragraphChanges: [
        { type: "modified", oldText: "旧方法段", newText: "新方法段", oldIndex: 1, newIndex: 1, source: "document" },
        { type: "added", newText: "新增结论段", newIndex: 3, source: "document" }
      ],
      totalParagraphChanges: 2,
      omittedChanges: 0
    },
    contentSummary: { mode: "docx-content", paragraphCount: 4, wordCount: 120 },
    workingTree: { clean: false, entries: [" M tracked/document.docx"], summary: " M tracked/document.docx" }
  },
  workingTree: { clean: false, entries: [" M tracked/document.docx"], summary: " M tracked/document.docx" },
  health: {
    errorCount: 0,
    warningCount: 1,
    summary: UI_TEXT.repositoryHealthWarning,
    checks: [
      {
        id: "tracked-file",
        label: "当前 tracked 文件",
        status: "warning",
        detail: "当前工作树中未找到 tracked 文件。"
      }
    ]
  },
  versions: []
});
assert(gitAvailablePaneText.includes("最近检查"));
assert(gitAvailablePaneText.includes("正文内容已修改"));
assert(gitAvailablePaneText.includes("Git 工作树"));
assert(gitAvailablePaneText.includes("仓库健康"));
assert(gitAvailablePaneText.includes("当前 tracked 文件"));
assert(gitAvailablePaneText.includes("M tracked/document.docx"));
assert(gitAvailablePaneText.includes("版本历史"));
assert(gitAvailablePaneText.includes("尚未创建版本"));
assert(gitAvailablePaneText.includes("工作流"));
assert(gitAvailablePaneText.includes("检查并创建首个版本"));
assert(gitAvailablePaneText.includes("修改前：旧方法段"));
assert(gitAvailablePaneText.includes("修改后：新方法段"));
assert(gitAvailablePaneText.includes("新增：新增结论段"));

const docPaneText = await renderPaneText({
  attachment: { ...managedAttachment, fileName: "legacy.doc", extension: ".doc" },
  enabled: true,
  git: { available: true, detail: "git version 2.44.0" },
  lastCheck: {
    checkedAt: "2026-05-20T12:00:00.000Z",
    fileName: "legacy.doc",
    fileSize: 42,
    changeSummary: { summary: UI_TEXT.docFileOnlyTracking },
    contentSummary: { mode: "file-only", extension: ".doc", fileOnly: true },
    workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
  },
  workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
  versions: [{
    ...older,
    fileName: "legacy.doc",
    contentSummary: { mode: "file-only", extension: ".doc", fileOnly: true },
    changeSummary: { summary: UI_TEXT.docFileOnlyTracking }
  }]
});
assert(docPaneText.includes(UI_TEXT.docFileOnlyTracking));
assert(docPaneText.includes("文件级跟踪"));

const summaryHarness = await renderPaneHarness({
  stateProvider: () => ({
    attachment: managedAttachment,
    enabled: true,
    git: { available: true, detail: "git version 2.44.0" },
    workingTree: { clean: false, entries: [" M tracked/document.docx"], summary: " M tracked/document.docx" },
    versions: [older, newer]
  })
});
assert(summaryHarness.sectionSummary.includes("2 个版本"));
assert(summaryHarness.sectionSummary.includes("最新"));
assert(summaryHarness.sectionSummary.includes(older.shortHash));
assert(summaryHarness.sectionSummary.includes("有未提交修改"));

const historyPaneText = await renderPaneText({
  attachment: managedAttachment,
  enabled: true,
  git: { available: true, detail: "git version 2.44.0" },
  workingTree: { clean: true, entries: [], summary: "工作树无未提交修改。" },
  versions: [{
    ...older,
    changeSummary: {
      summary: "正文内容已修改；修改 1 段。",
      paragraphChanges: [
        { type: "modified", oldText: "旧引言段", newText: "新引言段", oldIndex: 0, newIndex: 0, source: "document" }
      ],
      totalParagraphChanges: 1,
      omittedChanges: 0
    }
  }]
});
assert(historyPaneText.includes("工作树无未提交修改"));
assert(!historyPaneText.includes("恢复此版本"));
assert(historyPaneText.includes("恢复历史版本"));
assert(historyPaneText.includes("旧版本"));
assert(historyPaneText.includes("版本详情"));
assert(historyPaneText.includes("Git hash"));
assert(historyPaneText.includes(older.commitHash));
assert(historyPaneText.includes("修改前：旧引言段"));
assert(historyPaneText.includes("修改后：新引言段"));

const fiveVersions = Array.from({ length: 5 }, (_value, index) => ({
  ...older,
  id: `timeline-${index}`,
  commitHash: `abcdef0${index}23456789`,
  shortHash: `abcdef0${index}`,
  createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
  kind: index === 3 ? "safety" : "manual",
  source: index === 2 ? "git" : "metadata",
  note: `Timeline version ${index}`,
  fileName: `paper-${index}.docx`
}));
const timelineHarness = await renderPaneHarness({
  stateProvider: () => ({
    attachment: managedAttachment,
    enabled: true,
    git: { available: true, detail: "git version 2.44.0" },
    workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
    versions: fiveVersions
  })
});
const timeline = findByClass(timelineHarness.body, "git4zotero-timeline");
assert(timeline, "history should render as a timeline");
assert.equal(findAllByClass(timeline, "git4zotero-timeline-item").length, 5);
assert(timelineHarness.body.textContent.includes("Timeline version 4"));
assert(timelineHarness.body.textContent.includes("自动备份"));
assert(timelineHarness.body.textContent.includes("Git 历史"));
assert(timelineHarness.body.textContent.includes("工作流"));
assert(timelineHarness.body.textContent.includes("Git 工作树"));
const timelineText = timelineHarness.body.textContent;
assert(timelineText.indexOf(UI_TEXT.versionHistory) < timelineText.indexOf("工作流"));
assert(timelineText.indexOf(UI_TEXT.versionHistory) < timelineText.indexOf(UI_TEXT.lastCheck));
assert(timelineText.indexOf(UI_TEXT.versionHistory) < timelineText.indexOf(UI_TEXT.workingTree));
assert(timelineText.includes(UI_TEXT.refreshPanel));
const timelinePanel = findByClass(timelineHarness.body, "git4zotero-panel");
const timelineRoot = findByClass(timelineHarness.body, "git4zotero-panel-root");
const scopedStyle = findByAttribute(timelineHarness.body, "data-git4zotero-scoped-style", "true");
assert.equal(timelineHarness.body.getAttribute("data-git4zotero-body"), "true");
assert.equal(timelineHarness.body.getAttribute("data-git4zotero-style-injected"), "true");
assert.equal(timelineRoot.getAttribute("data-git4zotero-root"), "true");
assert.equal(timelineRoot.getAttribute("data-git4zotero-status"), "ready");
assert.equal(timelineRoot.getAttribute("data-git4zotero-version-count"), "5");

let refreshStateVersion = "刷新前版本";
let refreshReads = 0;
const refreshHarness = await renderPaneHarness({
  stateProvider: () => {
    refreshReads += 1;
    return {
      attachment: managedAttachment,
      enabled: true,
      git: { available: true, detail: "git version 2.44.0" },
      workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
      versions: [{
        ...older,
        id: `refresh-${refreshReads}`,
        note: refreshStateVersion,
        commitHash: `abcdef0${refreshReads}23456789`,
        shortHash: `abcdef0${refreshReads}`
      }]
    };
  }
});
assert(refreshHarness.body.textContent.includes("刷新前版本"));
refreshStateVersion = "刷新后版本";
await findButton(refreshHarness.body, UI_TEXT.refreshPanel).click();
await waitForScheduledPaneRender();
assert(refreshHarness.body.textContent.includes("刷新后版本"));
assert(refreshReads >= 2);

let itemChangeVersion = "切换前版本";
let itemChangeReads = 0;
const itemChangeHarness = await renderPaneHarness({
  stateProvider: () => {
    itemChangeReads += 1;
    return {
      attachment: managedAttachment,
      enabled: true,
      git: { available: true, detail: "git version 2.44.0" },
      workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
      versions: [{
        ...older,
        id: `item-change-${itemChangeReads}`,
        note: itemChangeVersion,
        commitHash: `bcdef0${itemChangeReads}23456789`,
        shortHash: `bcdef0${itemChangeReads}`
      }]
    };
  }
});
let itemChangeEnabled = null;
itemChangeVersion = "切换后版本";
assert.equal(itemChangeHarness.pane.handleItemChange({
  body: itemChangeHarness.body,
  item: {},
  setEnabled: (value) => {
    itemChangeEnabled = value;
  },
  setSectionSummary: () => {}
}), true);
await waitForScheduledPaneRender();
assert.equal(itemChangeEnabled, true);
assert(itemChangeHarness.body.textContent.includes("切换后版本"));
assert(itemChangeReads >= 2);
assert.equal(timelineRoot.getAttribute("data-git4zotero-render-phase"), "state");
assert.equal(timelineRoot.getAttribute("data-git4zotero-style-injected"), "true");
assert.equal(timelinePanel.getAttribute("data-git4zotero-status"), "ready");
assert.equal(timelinePanel.getAttribute("data-git4zotero-version-count"), "5");
assert.equal(timelinePanel.getAttribute("data-git4zotero-render-phase"), "state");
assert.equal(timelinePanel.getAttribute("data-git4zotero-style-injected"), "true");
assert(scopedStyle, "item pane should inject scoped CSS into the section body");
assert(scopedStyle.textContent.includes("CanvasText"));
assert(scopedStyle.textContent.includes("ButtonBorder"));
assert(scopedStyle.textContent.includes(".git4zotero-timeline-item"));
assert(timelineRoot.getAttribute("style").includes("display:block"));
assert(timelinePanel.getAttribute("style").includes("CanvasText"));
assert(findByClass(timelineHarness.body, "git4zotero-timeline-note").getAttribute("style").includes("CanvasText"));

{
  const doc = new FakeDocument();
  const body = doc.createElement("div");
  doc.documentElement.append(body);
  const debugMessages = [];
  let panelStateCalls = 0;
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async () => {
        panelStateCalls += 1;
        return {
          attachment: managedAttachment,
          enabled: true,
          git: { available: true, detail: "git version 2.44.0" },
          versions: fiveVersions,
          workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
        };
      }
    },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });
  const renderContext = { body, item: {}, setSectionSummary: () => {} };
  pane.render(renderContext);
  const officialRender = pane.renderAsync(renderContext, { source: "zotero-onAsyncRender" });
  await officialRender;
  await waitForScheduledPaneRender();
  assert.equal(panelStateCalls, 1);
  assert.equal(findAllByClass(body, "git4zotero-timeline-item").length, 5);
  assert(debugMessages.some((message) => message.includes("item pane self async render scheduled")));
  assert(debugMessages.some((message) => message.includes("item pane async render start source=zotero-onAsyncRender")));
  assert(debugMessages.some((message) => message.includes("item pane self async render stale before start")));
}

{
  const doc = new FakeDocument();
  const body = doc.createElement("div");
  doc.documentElement.append(body);
  let panelStateCalls = 0;
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async () => {
        panelStateCalls += 1;
        return {
          attachment: managedAttachment,
          enabled: true,
          git: { available: true, detail: "git version 2.44.0" },
          versions: fiveVersions,
          workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
        };
      }
    },
    platform: makePanePlatform()
  });
  pane.render({ body, item: {}, setSectionSummary: () => {} }, { reason: "toggle" });
  await waitForScheduledPaneRender();
  assert.equal(panelStateCalls, 1);
  assert.equal(findAllByClass(body, "git4zotero-timeline-item").length, 5);
}

{
  const doc = new FakeDocument();
  const section = doc.createElement("collapsible-section");
  const body = doc.createElement("div");
  let expandCalls = 0;
  section.className = "collapsed hidden";
  section.setAttribute("collapsed", "true");
  section.setAttribute("hidden", "true");
  section.expand = () => {
    expandCalls += 1;
  };
  section.append(body);
  const pane = new PaperVersionPane({
    service: { getPanelState: async () => ({ attachment: null, enabled: false, versions: [] }) },
    platform: makePanePlatform()
  });
  pane.renderShell({ body, item: {}, setSectionSummary: () => {} });
  const root = findByClass(body, "git4zotero-panel-root");
  const shellPanel = findByClass(body, "git4zotero-panel");
  const shellStyle = findByAttribute(body, "data-git4zotero-scoped-style", "true");
  assert(root, "renderShell should create a stable panel root");
  assert(shellPanel, "renderShell should create a visible panel");
  assert(shellStyle, "renderShell should inject scoped CSS");
  assert(body.textContent.includes(UI_TEXT.loading));
  assert.equal(root.getAttribute("data-git4zotero-status"), "loading");
  assert.equal(root.getAttribute("data-git4zotero-render-phase"), "shell");
  assert.equal(root.getAttribute("data-git4zotero-style-injected"), "true");
  assert(shellPanel.getAttribute("style").includes("display:flex"));
  assert.equal(section.open, true);
  assert.equal(section.expanded, true);
  assert.equal(section.hidden, false);
  assert.equal(section.collapsed, false);
  assert.equal(section.getAttribute("collapsed"), null);
  assert.equal(section.getAttribute("hidden"), null);
  assert.equal(section.className, "");
  assert.equal(expandCalls, 1);
}

{
  const doc = new FakeDocument();
  const actualPaneID = "git4zotero\\@paper-version\\.local-git4zotero-paper-versions";
  const itemDetails = doc.createElement("item-details");
  const section = doc.createElement("item-pane-custom-section");
  const body = doc.createElement("div");
  const sidenavButton = doc.createElement("button");
  const scrollCalls = [];
  const debugMessages = [];
  let sectionSummary = "";
  section.setAttribute("data-pane", actualPaneID);
  section.setAttribute("hidden", "true");
  section.setAttribute("collapsed", "true");
  section.hidden = true;
  section.collapsed = true;
  sidenavButton.className = "btn";
  sidenavButton.setAttribute("data-pane", actualPaneID);
  itemDetails.scrollToPane = (paneID, behavior) => {
    scrollCalls.push([paneID, behavior]);
  };
  section.append(body);
  itemDetails.append(sidenavButton, section);
  doc.documentElement.append(itemDetails);
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async () => ({
        attachment: managedAttachment,
        enabled: true,
        git: { available: true, detail: "git version 2.44.0" },
        versions: fiveVersions,
        workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
      })
    },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });

  pane.render({
    body,
    item: {},
    paneID: actualPaneID,
    setSectionSummary(value) {
      sectionSummary = value;
    }
  });
  await waitForScheduledPaneRender();
  assert(scrollCalls.some((call) => call[0] === actualPaneID && call[1] === "instant"));
  assert.equal(section.hidden, false);
  assert.equal(section.collapsed, false);
  assert.equal(section.getAttribute("hidden"), null);
  assert.equal(section.getAttribute("collapsed"), null);
  assert.equal(body.getAttribute("data-git4zotero-visible-probe"), "true");
  assert.equal(section.getAttribute("data-git4zotero-visible-probe"), "true");
  assert(sectionSummary.includes("5 个版本"));
  assert(sectionSummary.includes("最新"));
  assert(sectionSummary.includes(fiveVersions[0].shortHash));
  assert(debugMessages.some((message) => message.includes("item pane reveal attempted")));
  assert(debugMessages.some((message) => message.includes(`actualPaneID=${actualPaneID}`)));
  assert(debugMessages.some((message) => message.includes("method=itemDetails.scrollToPane")));
  assert(debugMessages.some((message) => message.includes("bodyConnected=true")));
  assert(debugMessages.some((message) => message.includes("sidenav=true")));
}

{
  const doc = new FakeDocument();
  const actualPaneID = "git4zotero\\@paper-version\\.local-git4zotero-paper-versions";
  const item = { libraryID: 1, key: "same-item", itemID: 3 };
  const itemDetails = doc.createElement("item-details");
  const section = doc.createElement("item-pane-custom-section");
  section.setAttribute("data-pane", actualPaneID);
  itemDetails.append(section);
  doc.documentElement.append(itemDetails);
  const oldBody = doc.createElement("div");
  const liveBody = doc.createElement("div");
  const debugMessages = [];
  section.append(oldBody);
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async () => ({
        attachment: managedAttachment,
        enabled: true,
        git: { available: true, detail: "git version 2.44.0" },
        versions: fiveVersions,
        workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
      })
    },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });
  pane.setActualPaneID(actualPaneID);
  pane.renderShell({ body: oldBody, item, paneID: actualPaneID, setSectionSummary: () => {} });
  oldBody.remove();
  section.append(liveBody);
  pane.renderShell({ body: liveBody, item, paneID: actualPaneID, setSectionSummary: () => {} });
  await pane.renderAsync({ body: oldBody, item, paneID: actualPaneID, setSectionSummary: () => {} }, { source: "detached-test" });
  assert.equal(findAllByClass(liveBody, "git4zotero-timeline-item").length, 5);
  assert.equal(findAllByClass(oldBody, "git4zotero-timeline-item").length, 0);
  assert(debugMessages.some((message) => message.includes("item pane detached async target source=detached-test")));
  assert(debugMessages.some((message) => message.includes("item pane live body rebound source=detached-test")));
  assert(debugMessages.some((message) => message.includes(`actualPaneID=${actualPaneID}`)));
}

{
  const doc = new FakeDocument();
  const actualPaneID = "git4zotero\\@paper-version\\.local-git4zotero-paper-versions";
  const firstItem = { libraryID: 1, key: "first-item", itemID: 3 };
  const secondItem = { libraryID: 1, key: "second-item", itemID: 4 };
  const section = doc.createElement("item-pane-custom-section");
  const oldBody = doc.createElement("div");
  const liveBody = doc.createElement("div");
  const debugMessages = [];
  section.setAttribute("data-pane", actualPaneID);
  doc.documentElement.append(section);
  section.append(oldBody);
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async () => ({
        attachment: { ...managedAttachment, fileName: "first.docx" },
        enabled: true,
        git: { available: true, detail: "git version 2.44.0" },
        versions: fiveVersions,
        workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
      })
    },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });
  pane.setActualPaneID(actualPaneID);
  pane.renderShell({ body: oldBody, item: firstItem, paneID: actualPaneID, setSectionSummary: () => {} });
  oldBody.remove();
  section.append(liveBody);
  pane.renderShell({ body: liveBody, item: secondItem, paneID: actualPaneID, setSectionSummary: () => {} });
  await pane.renderAsync({ body: oldBody, item: firstItem, paneID: actualPaneID, setSectionSummary: () => {} }, { source: "detached-mismatch" });
  assert.equal(findAllByClass(liveBody, "git4zotero-timeline-item").length, 0);
  assert.equal(findAllByClass(oldBody, "git4zotero-timeline-item").length, 0);
  assert(debugMessages.some((message) => message.includes("live body candidate rejected")));
  assert(debugMessages.some((message) => message.includes("detached async target unresolved")));
}

{
  const doc = new FakeDocument();
  const actualPaneID = "git4zotero\\@paper-version\\.local-git4zotero-paper-versions";
  const item = { libraryID: 1, key: "cached-item", itemID: 7 };
  const otherItem = { libraryID: 1, key: "other-item", itemID: 8 };
  const body = doc.createElement("div");
  const nextBody = doc.createElement("div");
  const otherBody = doc.createElement("div");
  const debugMessages = [];
  let refreshCount = 0;
  doc.documentElement.append(body);
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async () => ({
        attachment: managedAttachment,
        enabled: true,
        git: { available: true, detail: "git version 2.44.0" },
        versions: fiveVersions,
        workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
      })
    },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });
  pane.init({
    doc,
    paneID: actualPaneID,
    refresh() {
      refreshCount += 1;
    }
  });
  pane.renderShell({ body, item, paneID: actualPaneID, setSectionSummary: () => {} });
  body.remove();
  await pane.renderAsync({ body, item, paneID: actualPaneID, setSectionSummary: () => {} }, { source: "detached-cache" });
  await waitForScheduledPaneRender();
  assert.equal(refreshCount, 1);
  assert.equal(findAllByClass(body, "git4zotero-timeline-item").length, 0);
  assert(debugMessages.some((message) => message.includes("item pane state cached")));
  assert(debugMessages.some((message) => message.includes("item pane pending cached state")));
  assert(debugMessages.some((message) => message.includes("item pane refresh requested")));
  doc.documentElement.append(nextBody);
  pane.renderShell({ body: nextBody, item, paneID: actualPaneID, setSectionSummary: () => {} });
  assert.equal(findAllByClass(nextBody, "git4zotero-timeline-item").length, 5);
  assert(debugMessages.some((message) => message.includes("item pane cached state rendered in shell")));
  doc.documentElement.append(otherBody);
  pane.renderShell({ body: otherBody, item: otherItem, paneID: actualPaneID, setSectionSummary: () => {} });
  assert.equal(findAllByClass(otherBody, "git4zotero-timeline-item").length, 0);
}

{
  const doc = new FakeDocument();
  const actualPaneID = "git4zotero\\@paper-version\\.local-git4zotero-paper-versions";
  const item = { libraryID: 1, key: "orphan-item", itemID: 5 };
  const section = doc.createElement("item-pane-custom-section");
  const body = doc.createElement("div");
  const debugMessages = [];
  section.setAttribute("data-pane", actualPaneID);
  doc.documentElement.append(section);
  section.append(body);
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async () => ({
        attachment: managedAttachment,
        enabled: true,
        git: { available: true, detail: "git version 2.44.0" },
        versions: fiveVersions,
        workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean }
      })
    },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });
  pane.setActualPaneID(actualPaneID);
  pane.renderShell({ body, item, paneID: actualPaneID, setSectionSummary: () => {} });
  body.remove();
  await pane.renderAsync({ body, item, paneID: actualPaneID, setSectionSummary: () => {} }, { source: "detached-orphan" });
  const fallbackBody = findByAttribute(section, "data-git4zotero-fallback-body", "true");
  assert(fallbackBody, "detached async render should create a fallback body in the live custom section");
  assert.equal(findAllByClass(fallbackBody, "git4zotero-timeline-item").length, 5);
  assert.equal(findAllByClass(body, "git4zotero-timeline-item").length, 0);
  assert(debugMessages.some((message) => message.includes("item pane fallback section target created")));
  assert(debugMessages.some((message) => message.includes("item pane fallback section target ready")));
}

{
  const doc = new FakeDocument();
  const section = doc.createElement("item-pane-custom-section");
  const body = doc.createElement("div");
  const scrollCalls = [];
  section.setAttribute("data-pane", SECTION_ID);
  section.scrollIntoView = (options) => {
    scrollCalls.push(options);
  };
  section.append(body);
  doc.documentElement.append(section);
  const pane = new PaperVersionPane({
    service: { getPanelState: async () => ({ attachment: null, enabled: false, versions: [] }) },
    platform: makePanePlatform()
  });
  pane.renderShell({ body, item: {}, setSectionSummary: () => {} });
  assert.equal(scrollCalls.length, 1);
  assert.deepEqual(scrollCalls[0], { block: "nearest" });
}

{
  const doc = new FakeDocument();
  const body = doc.createElement("div");
  const debugMessages = [];
  const pane = new PaperVersionPane({
    service: { getPanelState: async () => ({ attachment: null, enabled: false, versions: [] }) },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });
  pane.renderShell({ body, item: {}, setSectionSummary: () => {} });
  assert(debugMessages.some((message) => message.includes("item pane visibility warning body disconnected from document")));
}

{
  const doc = new FakeDocument();
  const body = doc.createElement("div");
  const debugMessages = [];
  body.closest = () => {
    throw new Error("expand unavailable");
  };
  const pane = new PaperVersionPane({
    service: { getPanelState: async () => ({ attachment: null, enabled: false, versions: [] }) },
    platform: makePanePlatform({
      Zotero: {
        debug(message) {
          debugMessages.push(message);
        }
      }
    })
  });
  pane.renderShell({ body, item: {}, setSectionSummary: () => {} });
  assert(findByClass(body, "git4zotero-panel-root"));
  assert(debugMessages.some((message) => message.includes("item pane section expand skipped")));
}

{
  let resolveFirst;
  const firstState = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const doc = new FakeDocument();
  const body = doc.createElement("div");
  doc.documentElement.append(body);
  const pane = new PaperVersionPane({
    service: {
      getPanelState: async (item) => item.key === "first"
        ? firstState
        : {
          attachment: { ...managedAttachment, fileName: "second.docx" },
          enabled: false,
          git: null,
          versions: []
        }
    },
    platform: makePanePlatform()
  });
  pane.renderShell({ body, item: { key: "first" } });
  const staleRender = pane.renderAsync({ body, item: { key: "first" } });
  pane.renderShell({ body, item: { key: "second" } });
  await pane.renderAsync({ body, item: { key: "second" } });
  resolveFirst({
    attachment: { ...managedAttachment, fileName: "first.docx" },
    enabled: false,
    git: null,
    versions: []
  });
  await staleRender;
  assert(body.textContent.includes("second.docx"));
  assert(!body.textContent.includes("first.docx"));
}

{
  const writes = [];
  const copyCalls = [];
  const checkService = new VersionService({
    platform: {
      getRepoPath: () => "repo",
      exists: async () => true,
      copyFile: async (source, target) => copyCalls.push([source, target]),
      join: (...parts) => parts.join("/"),
      getPref: (_key, fallback) => fallback
    },
    attachmentFinder: {
      findManageableAttachment: async () => managedAttachment
    },
    gitBackend: {
      checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
      ensureRepo: async () => {},
      getWorkingTreeStatus: async () => ({
        clean: false,
        entries: [" M tracked/document.docx"],
        summary: " M tracked/document.docx"
      })
    },
    metadataStore: {
      read: async () => ({
        ...createEmptyMetadata(),
        enabled: true,
        versions: [older],
        lastCheck: { changeSummary: { summary: "上次检查" }, workingTree: null }
      }),
      write: async (_repoPath, metadataToWrite) => writes.push(metadataToWrite)
    },
    pluginVersion: "0.2.1",
    contentAnalyzer: {
      analyze: async () => ({
        fileHash: "new-file",
        fileSize: 20,
        contentHash: "new-content",
        contentSummary: { mode: "docx-content", paragraphCount: 3, wordCount: 20 },
        contentSnapshot: { paragraphs: ["一"], paragraphCount: 1, wordCount: 1, sections: [] },
        changeSummary: { changeType: "content", summary: "正文内容已修改。" },
        shouldCreateVersion: true
      })
    }
  });
  const analysis = await checkService.checkCurrentChange({});
  assert.equal(analysis.lastCheck.changeSummary.summary, "正文内容已修改。");
  assert.equal(writes.at(-1).lastCheck.workingTree.entries[0], " M tracked/document.docx");
  assert.deepEqual(copyCalls[0], ["paper.docx", "repo/tracked/document.docx"]);
}

{
  const writes = [];
  const createService = new VersionService({
    platform: {
      getRepoPath: () => "repo",
      exists: async () => true,
      copyFile: async () => {},
      join: (...parts) => parts.join("/"),
      getPref: (_key, fallback) => fallback
    },
    attachmentFinder: {
      findManageableAttachment: async () => managedAttachment
    },
    gitBackend: {
      checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
      ensureRepo: async () => {},
      commitSnapshot: async () => ({ hash: "abcdef1234567890" }),
      getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: "工作树无未提交修改。" })
    },
    metadataStore: {
      read: async () => ({ ...createEmptyMetadata(), enabled: true, versions: [] }),
      write: async (_repoPath, metadataToWrite) => writes.push(metadataToWrite)
    },
    pluginVersion: "0.2.1",
    contentAnalyzer: {
      analyze: async () => ({
        fileHash: "new-file",
        fileSize: 20,
        contentHash: null,
        contentSummary: { mode: "file-only", extension: ".docx" },
        contentSnapshot: null,
        changeSummary: { changeType: "first-version", summary: "首次创建版本。" },
        shouldCreateVersion: true
      })
    }
  });
  const version = await createService.createVersion({}, "初稿");
  assert.equal(version.note, "初稿");
  assert.equal(writes.at(-1).versions[0].commitHash, "abcdef1234567890");
  assert.equal(writes.at(-1).lastCheck.workingTree.clean, true);
}

{
  const writes = [];
  const copyCalls = [];
  const checkoutCalls = [];
  const files = new Map([
    ["paper.docx", new TextEncoder().encode("current manuscript")],
    ["repo/.git", new Uint8Array()],
    ["repo/tracked/document.docx", new TextEncoder().encode("old tracked")]
  ]);
  const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const restoreService = new VersionService({
    platform: {
      Zotero: { debug() {} },
      getRepoPath: () => "repo",
      exists: async (target) => files.has(target),
      stat: async (target) => ({ size: files.get(target).byteLength }),
      hashFile: async (target) => hashBytes(files.get(target)),
      writeText: async (target, content) => {
        files.set(target, new TextEncoder().encode(content));
      },
      removeFile: async (target) => {
        files.delete(target);
      },
      copyFile: async (source, target) => {
        copyCalls.push([source, target]);
        files.set(target, files.get(source));
      },
      join: (...parts) => parts.join("/"),
      getPref: (key, fallback) => key === PREFS.autoSafetyVersion ? true : fallback
    },
    attachmentFinder: {
      findManageableAttachment: async () => managedAttachment
    },
    gitBackend: {
      checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
      ensureRepo: async () => {},
      commitSnapshot: async (_repoPath, payload) => {
        assert.equal(payload.kind, "safety");
        return { hash: "feedface12345678" };
      },
      checkoutTrackedFile: async (...args) => {
        checkoutCalls.push(args);
        files.set("repo/tracked/document.docx", new TextEncoder().encode("restored manuscript"));
      },
      getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: "工作树无未提交修改。" })
    },
    metadataStore: {
      read: async () => ({
        ...createEmptyMetadata(),
        enabled: true,
        versions: [older],
        lastCheck: { changeSummary: { summary: "上次检查" }, workingTree: null }
      }),
      write: async (_repoPath, metadataToWrite) => writes.push(metadataToWrite)
    },
    pluginVersion: "0.2.1",
    contentAnalyzer: {
      analyze: async () => ({
        fileHash: "safety-file",
        fileSize: 30,
        contentHash: "safety-content",
        contentSummary: { mode: "docx-content", paragraphCount: 2, wordCount: 8 },
        contentSnapshot: { paragraphs: ["安全版本"], paragraphCount: 1, wordCount: 4, sections: [] },
        changeSummary: { changeType: "content", summary: "恢复前自动备份。" },
        shouldCreateVersion: true
      })
    }
  });
  const result = await restoreService.restoreVersion({}, older);
  assert.equal(result.restoredVersion.id, older.id);
  assert.equal(result.safetyVersion.kind, "safety");
  assert.deepEqual(checkoutCalls[0], ["repo", older.commitHash, older.trackedRelativePath]);
  assert.equal(new TextDecoder().decode(files.get("paper.docx")), "restored manuscript");
  assert(result.backupPath.includes("repo/.git4zotero/restore-backups"));
  assert.deepEqual(copyCalls.at(-1)[1], "paper.docx");
  assert.equal(writes.at(-1).lastRestored.commitHash, older.commitHash);
  assert.equal(writes.at(-1).lastRestored.backupPath, result.backupPath);
  assert.equal(writes.at(-1).lastCheck.workingTree.clean, true);
}

{
  const writes = [];
  const files = new Map([
    ["paper.docx", new TextEncoder().encode("current manuscript")],
    ["repo/.git", new Uint8Array()],
    ["repo/tracked/document.docx", new TextEncoder().encode("old tracked")]
  ]);
  const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const restoreService = new VersionService({
    platform: {
      Zotero: { debug() {} },
      getRepoPath: () => "repo",
      exists: async (target) => files.has(target),
      stat: async (target) => ({ size: files.get(target).byteLength }),
      hashFile: async (target) => hashBytes(files.get(target)),
      writeText: async (target, content) => {
        files.set(target, new TextEncoder().encode(content));
      },
      removeFile: async (target) => {
        files.delete(target);
      },
      copyFile: async (source, target) => {
        if (target === "paper.docx" && source.includes("-restore-")) {
          files.delete(target);
          throw new Error("target locked");
        }
        files.set(target, files.get(source));
      },
      join: (...parts) => parts.join("/"),
      getPref: (key, fallback) => key === PREFS.autoSafetyVersion ? false : fallback
    },
    attachmentFinder: {
      findManageableAttachment: async () => managedAttachment
    },
    gitBackend: {
      checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
      checkoutTrackedFile: async () => {
        files.set("repo/tracked/document.docx", new TextEncoder().encode("restored manuscript"));
      },
      getWorkingTreeStatus: async () => ({ clean: true, entries: [], summary: "工作树无未提交修改。" })
    },
    metadataStore: {
      read: async () => ({
        ...createEmptyMetadata(),
        enabled: true,
        versions: [older]
      }),
      write: async (_repoPath, metadataToWrite) => writes.push(metadataToWrite)
    },
    pluginVersion: "0.2.1"
  });

  await assert.rejects(
    () => restoreService.restoreVersion({}, older),
    /恢复失败，当前文件已保留备份/
  );
  assert.equal(new TextDecoder().decode(files.get("paper.docx")), "current manuscript");
  assert.equal(writes.length, 0);
}

{
  const item = { id: 1 };
  const calls = [];
  let menuStateCalls = 0;
  let restoreOptions = [];
  const selectResponses = [2, 0, 1];
  const menuPathPlatform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      dirsvc: { get: () => ({ path: "C:\\Profile" }) },
      prompt: {}
    },
    Cc: {},
    Ci: { nsIFile: function nsIFile() {} },
    ChromeUtils: {},
    IOUtils: null,
    PathUtils: {
      join(...parts) {
        for (const part of parts.slice(1)) {
          if (/[\\/]/.test(part)) {
            throw new Error(`strict PathUtils rejected composite segment: ${part}`);
          }
        }
        return parts.join("\\");
      }
    }
  });
  const harness = makeMenuHarness({
    serviceOverrides: {
      enableVersionManagement: async (selected) => {
        calls.push(["enable", selected, menuPathPlatform.getRepoPath(1, "ABC123")]);
        return { attachment: managedAttachment };
      },
      disableVersionManagement: async (selected) => {
        calls.push(["disable", selected]);
      },
      checkCurrentChange: async (selected) => {
        calls.push(["check", selected]);
        return { attachment: managedAttachment, changeSummary: { summary: "正文内容已修改。" } };
      },
      createVersion: async (selected, note) => {
        calls.push(["create", selected, note]);
        return { ...older, changeSummary: { summary: "首次创建版本。" } };
      },
      restoreVersion: async (selected, version) => {
        calls.push(["restore", selected, version.id, version.commitHash, version.trackedRelativePath]);
        return {
          attachment: managedAttachment,
          restoredVersion: version,
          safetyVersion: { shortHash: "safe1234" }
        };
      },
      exportVersionSummary: async (selected, options) => {
        calls.push(["export", selected, options.scope, options.format]);
        return { path: "exports/history.txt" };
      },
      getPanelState: async () => {
        menuStateCalls += 1;
        return {
          attachment: managedAttachment,
          enabled: true,
          git: { available: true, detail: "git version 2.44.0" },
          versions: [older]
        };
      },
      getRestoreCandidates: async () => [newer, older, oldest]
    },
    platformOverrides: {
      selectFromList: (_title, _message, options) => {
        if (options.length === 3) {
          restoreOptions = options;
        }
        return selectResponses.shift() ?? 0;
      }
    }
  });
  harness.menu.register({ id: "git4zotero@paper-version.local", rootURI: "chrome://git4zotero/content/" });
  assert.equal(harness.registered.target, "main/library/item");
  assert.equal(harness.registered.menus.length, 1);
  const rootMenu = harness.registered.menus[0];
  assert.equal(rootMenu.menuType, "submenu");
  assert.equal(rootMenu.menus.length, 7);
  let showingVisible = null;
  await rootMenu.onShowing({}, {
    items: [item],
    setVisible: (value) => {
      showingVisible = value;
    }
  });
  assert.equal(showingVisible, true);
  const menuVisibility = [];
  const menuEnabled = [];
  for (const itemMenu of rootMenu.menus) {
    await itemMenu.onShowing({}, {
      items: [item],
      setVisible: (value) => {
        menuVisibility.push(value);
      },
      setEnabled: (value) => {
        menuEnabled.push(value);
      }
    });
  }
  assert.deepEqual(menuVisibility, [true, true, true, true, true, false, true]);
  assert.deepEqual(menuEnabled, [false, true, true, true, true, false, true]);
  assert.equal(menuStateCalls, 1);
  await rootMenu.menus[0].onCommand({}, { items: [item] });
  await rootMenu.menus[1].onCommand({}, { items: [item] });
  await rootMenu.menus[2].onCommand({}, { items: [item] });
  await rootMenu.menus[3].onCommand({}, { items: [item] });
  await rootMenu.menus[4].onCommand({}, { items: [item] });
  await rootMenu.menus[6].onCommand({}, { items: [item] });
  assert.deepEqual(calls.map((call) => call[0]), ["enable", "check", "create", "restore", "export", "disable"]);
  assert.equal(calls.find((call) => call[0] === "enable")[2], "C:\\Profile\\git4zotero\\library-1\\item-ABC123");
  assert.equal(calls.find((call) => call[0] === "create")[2], "菜单版本");
  assert.equal(restoreOptions.length, 3);
  assert(restoreOptions[2].includes("Oldest version"));
  assert(restoreOptions[2].includes("手动"));
  assert(restoreOptions[2].includes("legacy.docx"));
  const restoreCall = calls.find((call) => call[0] === "restore");
  assert.equal(restoreCall[2], "oldest");
  assert.equal(restoreCall[3], oldest.commitHash);
  assert.equal(restoreCall[4], oldest.trackedRelativePath);
  const exportCall = calls.find((call) => call[0] === "export");
  assert.equal(exportCall[2], "history");
  assert.equal(exportCall[3], "text");
  assert(harness.alerts.some(([_title, message]) => message.includes("目标版本") && message.includes("safe1234")));
  assert(harness.alerts.some(([_title, message]) => message.includes("版本摘要已导出")));
  assert.equal(harness.refreshCount, 5);
  assert.throws(() => harness.menu.requireSingleItem({ context: { items: [item, { id: 2 }] } }), /只选择一个/);

  calls.length = 0;
  harness.platform.Zotero.getActiveZoteroPane = () => ({
    getSelectedItems: () => [item]
  });
  const doc = new FakeDocument();
  const itemPopup = doc.createXULElement("menupopup");
  itemPopup.id = "zotero-itemmenu";
  doc.documentElement.append(itemPopup);
  const win = {
    document: doc,
    setTimeout(callback) {
      callback();
      return 1;
    }
  };
  harness.menu.installFallback(win, { rootURI: "chrome://git4zotero/content/" });
  for (const listener of itemPopup.listeners.get("popupshowing") ?? []) {
    listener({});
  }
  await waitForScheduledPaneRender();
  const fallbackRoot = doc.getElementById("git4zotero-fallback-menu");
  assert(fallbackRoot, "fallback menu root should be created when official menu is missing");
  const fallbackPopup = fallbackRoot.children.find((child) => child.tagName === "menupopup");
  await harness.menu.populateFallbackPopup(fallbackPopup);
  assert.equal(fallbackPopup.children.length, 6);
  assert.equal(fallbackPopup.children.some((child) => child.getAttribute("data-git4zotero-status") === "true"), false);
  assert.equal(fallbackPopup.children.some((child) => child.tagName === "menuseparator"), false);
  assert.equal(doc.getElementById("git4zotero-menu-configure-git-fallback"), null);
  assert.equal(doc.getElementById("git4zotero-menu-enable-fallback").getAttribute("disabled"), "true");
  const fallbackDisable = doc.getElementById("git4zotero-menu-disable-fallback");
  const fallbackCheck = doc.getElementById("git4zotero-menu-check-fallback");
  assert(fallbackDisable);
  assert(fallbackCheck);
  await fallbackCheck.listeners.get("command")[0]({ stopPropagation() {} });
  await fallbackDisable.listeners.get("command")[0]({ stopPropagation() {} });
  assert.deepEqual(calls.map((call) => call[0]), ["check", "disable"]);
  harness.menu.uninstallFallback(win);
  assert.equal(doc.getElementById("git4zotero-fallback-menu"), null);
}

{
  const parentWithDocx = {
    id: 100,
    key: "PARENTDOCX",
    libraryID: 1,
    isAttachment: () => false,
    getAttachments: () => [101]
  };
  const docxAttachment = {
    id: 101,
    key: "ATTACHDOCX",
    parentItemID: 100,
    libraryID: 1,
    isAttachment: () => true,
    getFilePathAsync: async () => "C:\\papers\\draft.docx"
  };
  const parentWithDoc = {
    id: 110,
    key: "PARENTDOC",
    libraryID: 1,
    isAttachment: () => false,
    getAttachments: () => [111]
  };
  const docAttachment = {
    id: 111,
    key: "ATTACHDOC",
    parentItemID: 110,
    libraryID: 1,
    isAttachment: () => true,
    getFilePathAsync: async () => "C:\\papers\\draft.doc"
  };
  const parentWithOdt = {
    id: 120,
    key: "PARENTODT",
    libraryID: 1,
    isAttachment: () => false,
    getAttachments: () => [121]
  };
  const odtAttachment = {
    id: 121,
    key: "ATTACHODT",
    parentItemID: 120,
    libraryID: 1,
    isAttachment: () => true,
    getFilePathAsync: async () => "C:\\papers\\draft.odt"
  };
  const parentWithPdf = {
    id: 130,
    key: "PARENTPDF",
    libraryID: 1,
    isAttachment: () => false,
    getAttachments: () => [131]
  };
  const pdfAttachment = {
    id: 131,
    key: "ATTACHPDF",
    parentItemID: 130,
    libraryID: 1,
    isAttachment: () => true,
    getFilePathAsync: async () => "C:\\papers\\draft.pdf"
  };
  const parentWithoutAttachments = {
    id: 140,
    key: "PARENTEMPTY",
    libraryID: 1,
    isAttachment: () => false,
    getAttachments: () => []
  };
  const ordinaryItem = {
    id: 150,
    key: "REGULAR",
    libraryID: 1,
    isAttachment: () => false
  };
  const itemsByID = new Map([
    parentWithDocx,
    docxAttachment,
    parentWithDoc,
    docAttachment,
    parentWithOdt,
    odtAttachment,
    parentWithPdf,
    pdfAttachment,
    parentWithoutAttachments,
    ordinaryItem
  ].map((item) => [item.id, item]));
  const attachmentFinder = new AttachmentFinder({
    Zotero: {
      Items: {
        get: (id) => itemsByID.get(id)
      }
    }
  });
  const harness = makeMenuHarness({
    serviceOverrides: {
      attachmentFinder
    }
  });

  assert.equal(await harness.menu.isMenuRelevant({ items: [docxAttachment] }), true);
  assert.equal(await harness.menu.isMenuRelevant({ items: [docAttachment] }), true);
  assert.equal(await harness.menu.isMenuRelevant({ items: [parentWithDocx] }), true);
  assert.equal(await harness.menu.isMenuRelevant({ items: [parentWithDoc] }), true);
  assert.equal(await harness.menu.isMenuRelevant({ items: [parentWithOdt] }), false);
  assert.equal(await harness.menu.isMenuRelevant({ items: [parentWithPdf] }), false);
  assert.equal(await harness.menu.isMenuRelevant({ items: [pdfAttachment] }), false);
  assert.equal(await harness.menu.isMenuRelevant({ items: [parentWithoutAttachments] }), false);
  assert.equal(await harness.menu.isMenuRelevant({ items: [ordinaryItem] }), false);
  assert.equal(await harness.menu.isMenuRelevant({ items: [parentWithDocx, parentWithDoc] }), false);
  assert.equal(await harness.menu.isMenuRelevant({ items: [] }), false);
  assert.equal(await harness.menu.isMenuRelevant({ item: parentWithDocx, items: [] }), true);

  harness.menu.register({ id: "git4zotero@paper-version.local", rootURI: "chrome://git4zotero/content/" });
  const rootMenu = harness.registered.menus[0];
  let visible = null;
  await rootMenu.onShowing({}, {
    items: [parentWithDocx],
    setVisible: (value) => {
      visible = value;
    }
  });
  assert.equal(visible, true);
  await rootMenu.onShowing({}, {
    items: [parentWithOdt],
    setVisible: (value) => {
      visible = value;
    }
  });
  assert.equal(visible, false);
  await rootMenu.onShowing({}, {
    items: [parentWithDocx, parentWithDoc],
    setVisible: (value) => {
      visible = value;
    }
  });
  assert.equal(visible, false);

  const doc = new FakeDocument();
  const itemPopup = doc.createXULElement("menupopup");
  itemPopup.id = "zotero-itemmenu";
  doc.documentElement.append(itemPopup);
  const win = {
    document: doc,
    setTimeout(callback) {
      callback();
      return 1;
    }
  };
  harness.platform.Zotero.getActiveZoteroPane = () => ({
    getSelectedItems: () => [parentWithOdt]
  });
  harness.menu.installFallback(win, { rootURI: "chrome://git4zotero/content/" });
  for (const listener of itemPopup.listeners.get("popupshowing") ?? []) {
    listener({});
  }
  await waitForScheduledPaneRender();
  assert.equal(doc.getElementById("git4zotero-fallback-menu"), null);

  harness.platform.Zotero.getActiveZoteroPane = () => ({
    getSelectedItems: () => [parentWithDoc]
  });
  for (const listener of itemPopup.listeners.get("popupshowing") ?? []) {
    listener({});
  }
  await waitForScheduledPaneRender();
  assert(doc.getElementById("git4zotero-fallback-menu"));
  harness.menu.uninstallFallback(win);

  const officialDoc = new FakeDocument();
  const officialItemPopup = officialDoc.createXULElement("menupopup");
  officialItemPopup.id = "zotero-itemmenu";
  officialDoc.documentElement.append(officialItemPopup);
  const officialRoot = officialDoc.createXULElement("menu");
  officialRoot.setAttribute("data-l10n-id", "git4zotero-menu-root");
  const officialPopup = officialDoc.createXULElement("menupopup");
  const officialAction = officialDoc.createXULElement("menuitem");
  officialAction.id = "git4zotero-menu-check";
  officialPopup.append(officialAction);
  const staleFallback = officialDoc.createXULElement("menuitem");
  staleFallback.id = "git4zotero-menu-check-fallback";
  staleFallback.setAttribute("data-git4zotero-fallback", "true");
  officialPopup.append(staleFallback);
  officialRoot.append(officialPopup);
  officialItemPopup.append(officialRoot);
  const officialWin = {
    document: officialDoc,
    setTimeout(callback) {
      callback();
      return 1;
    }
  };
  harness.platform.Zotero.getActiveZoteroPane = () => ({
    getSelectedItems: () => [parentWithDoc]
  });
  harness.menu.installFallback(officialWin, { rootURI: "chrome://git4zotero/content/" });
  for (const listener of officialItemPopup.listeners.get("popupshowing") ?? []) {
    listener({});
    listener({});
  }
  await waitForScheduledPaneRender();
  assert.equal(officialDoc.getElementById("git4zotero-fallback-menu"), null);
  assert.equal(officialRoot.hidden, false);
  assert.equal(officialPopup.children.length, 1);
  assert.equal(officialPopup.children[0].id, "git4zotero-menu-check");
  assert.equal(officialPopup.children.some((child) => child.getAttribute("data-git4zotero-fallback") === "true"), false);
  harness.menu.uninstallFallback(officialWin);
}

{
  let restored = false;
  const harness = makeMenuHarness({
    serviceOverrides: {
      restoreVersion: async () => {
        restored = true;
      },
      getPanelState: async () => ({
        attachment: managedAttachment,
        enabled: true,
        git: { available: true, detail: "git version 2.44.0" },
        versions: [older]
      })
    },
    platformOverrides: {
      selectFromList: () => -1
    }
  });
  await harness.menu.restore({ items: [{ id: 1 }] });
  assert.equal(restored, false);
  assert.equal(harness.refreshCount, 0);
}

{
  const item = { id: 1 };
  const harness = makeMenuHarness({
    serviceOverrides: {
      getPanelState: async () => ({
        attachment: managedAttachment,
        enabled: true,
        git: { available: false, detail: "git missing" },
        versions: []
      })
    }
  });
  harness.platform.Zotero.getActiveZoteroPane = () => ({
    getSelectedItems: () => [item]
  });
  harness.menu.register({ id: "git4zotero@paper-version.local", rootURI: "chrome://git4zotero/content/" });
  const rootMenu = harness.registered.menus[0];
  const gitMissingVisibility = [];
  const gitMissingEnabled = [];
  for (const itemMenu of rootMenu.menus) {
    await itemMenu.onShowing({}, {
      items: [item],
      setVisible: (value) => {
        gitMissingVisibility.push(value);
      },
      setEnabled: (value) => {
        gitMissingEnabled.push(value);
      }
    });
  }
  assert.deepEqual(gitMissingVisibility, [true, true, true, true, true, true, true]);
  assert.deepEqual(gitMissingEnabled, [false, false, false, false, false, true, true]);
  const doc = new FakeDocument();
  const popup = doc.createXULElement("menupopup");
  doc.documentElement.append(popup);
  await harness.menu.populateFallbackPopup(popup);
  const configure = doc.getElementById("git4zotero-menu-configure-git-fallback");
  const check = doc.getElementById("git4zotero-menu-check-fallback");
  assert(configure);
  assert(check);
  assert.equal(check.getAttribute("disabled"), "true");
  assert(check.getAttribute("label").includes(UI_TEXT.gitPathActionRequired));
  assert.equal(configure.getAttribute("disabled"), null);
  await configure.listeners.get("command")[0]({ stopPropagation() {} });
  assert.equal(harness.promptGitCount, 1);
  assert.equal(harness.refreshCount, 1);
}

{
  const harness = makeMenuHarness({
    platformOverrides: {
      promptGitPath: async () => ({
        available: true,
        command: "C:\\Git\\cmd\\git.exe",
        version: "git version 2.46.0"
      })
    }
  });
  await harness.menu.configureGit();
  assert.equal(harness.refreshCount, 1);
  assert.equal(harness.alerts.at(-1)[0], UI_TEXT.gitConfigured);
  assert(harness.alerts.at(-1)[1].includes("C:\\Git\\cmd\\git.exe"));
}

{
  const harness = makeMenuHarness({
    platformOverrides: {
      promptGitPath: async () => ({
        available: false,
        error: UI_TEXT.gitPathNotFound
      })
    }
  });
  await assert.rejects(() => harness.menu.configureGit(), /未找到 Git 可执行文件/);
  assert.equal(harness.refreshCount, 0);
}

{
  const successPrefs = await runPreferencesScript({
    autoGitPath: "C:\\Program Files\\Git\\cmd\\git.exe",
    subprocessResult: { exitCode: 0, stdout: "git version 2.44.0\n", stderr: "" }
  });
  assert.equal(successPrefs.elements["git4zotero-git-status"].textContent, "尚未测试 Git。");
  await successPrefs.context.window.Git4ZoteroPreferences.testGit();
  assert(successPrefs.elements["git4zotero-git-status"].textContent.includes("Git 可用"));
  assert(successPrefs.elements["git4zotero-git-status"].textContent.includes("已测试路径：C:\\Program Files\\Git\\cmd\\git.exe"));
  assert.equal(successPrefs.prefs.get(PREFS.gitPath), "C:\\Program Files\\Git\\cmd\\git.exe");
  assert.equal(successPrefs.elements["git4zotero-git-path"].value, "C:\\Program Files\\Git\\cmd\\git.exe");
  assert.equal(successPrefs.elements["git4zotero-test-git"].disabled, false);

  const savedPrefs = await runPreferencesScript({
    prefValue: "C:\\Saved\\Git\\cmd\\git.exe"
  });
  assert.equal(savedPrefs.elements["git4zotero-git-path"].value, "C:\\Saved\\Git\\cmd\\git.exe");
  assert.equal(savedPrefs.elements["git4zotero-current-git"].textContent, "C:\\Saved\\Git\\cmd\\git.exe");

  const failedPrefs = await runPreferencesScript({
    prefValue: "C:\\Old\\git.exe",
    subprocessResult: { exitCode: 1, stdout: "", stderr: "not found" }
  });
  failedPrefs.elements["git4zotero-git-path"].value = "C:\\Bad\\git.exe";
  await failedPrefs.context.window.Git4ZoteroPreferences.testGit();
  assert(failedPrefs.elements["git4zotero-git-status"].textContent.includes("Git 不可用"));
  assert.equal(failedPrefs.prefs.get(PREFS.gitPath), "C:\\Old\\git.exe");

  const thrownPrefs = await runPreferencesScript({
    subprocessError: new Error("Subprocess missing")
  });
  await thrownPrefs.context.window.Git4ZoteroPreferences.testGit();
  assert(thrownPrefs.elements["git4zotero-git-status"].textContent.includes("Git 不可用"));
  assert(thrownPrefs.elements["git4zotero-git-status"].textContent.includes("未找到 Git 可执行文件"));

  const delayedPrefs = await runPreferencesScript({ missingInitially: true });
  assert.equal(delayedPrefs.context.window.Git4ZoteroPreferences.initialized, false);
  delayedPrefs.releaseElements();
  assert.equal(delayedPrefs.context.window.Git4ZoteroPreferences.initialized, true);
  assert.equal(delayedPrefs.elements["git4zotero-git-status"].textContent, "尚未测试 Git。");
}

let enabledMetadata = null;
const enablingService = new VersionService({
  platform: {
    getRepoPath: () => "repo"
  },
  attachmentFinder: {
    findManageableAttachment: async () => managedAttachment
  },
  metadataStore: {
    read: async () => createEmptyMetadata(),
    write: async (repoPath, metadataToWrite) => {
      enabledMetadata = metadataToWrite;
    }
  }
});
await enablingService.enableVersionManagement({});
assert.equal(enabledMetadata.enabled, true);
await enablingService.disableVersionManagement({});
assert.equal(enabledMetadata.enabled, false);

const firstDocx = makeDocx({
  "word/document.xml": wordDocument(["引言第一段", "方法第二段"]),
  "word/footnotes.xml": wordDocument(["脚注内容"]),
  "docProps/core.xml": "<core><modified>2026-01-01</modified></core>"
});
const secondDocx = makeDocx({
  "word/document.xml": wordDocument(["引言第一段", "方法第二段已修改", "新增结论段"]),
  "word/footnotes.xml": wordDocument(["脚注内容"]),
  "docProps/core.xml": "<core><modified>2026-01-02</modified></core>"
});
const deletedDocx = makeDocx({
  "word/document.xml": wordDocument(["引言第一段"]),
  "word/footnotes.xml": wordDocument(["脚注内容"]),
  "docProps/core.xml": "<core><modified>2026-01-04</modified></core>"
});
const styleOnlyDocx = makeDocx({
  "word/document.xml": wordDocument(["引言第一段", "方法第二段"]),
  "word/footnotes.xml": wordDocument(["脚注内容"]),
  "docProps/core.xml": "<core><modified>2026-01-03</modified><style>changed</style></core>"
});
const revisedDocx = makeDocx({
  "word/document.xml": wordDocumentRaw(`
    <w:p>
      <w:r><w:t>保留文本</w:t></w:r>
      <w:del><w:r><w:delText>删除文本</w:delText></w:r></w:del>
      <w:moveFrom><w:r><w:t>移走文本</w:t></w:r></w:moveFrom>
      <w:ins><w:r><w:t>插入文本</w:t></w:r></w:ins>
      <w:r><w:tab/><w:t>制表</w:t><w:br/><w:t>换行</w:t></w:r>
    </w:p>
  `),
  "word/footnotes.xml": wordDocument(["脚注内容"]),
  "word/endnotes.xml": wordDocument(["尾注内容"]),
  "word/comments.xml": wordDocument(["批注不应参与正文差异"]),
  "word/header1.xml": wordDocument(["页眉上下文"])
});
const structuredOldDocx = makeDocx({
  "word/document.xml": wordDocumentRaw(`
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>引言</w:t></w:r></w:p>
    <w:p><w:r><w:t>旧正文段</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>旧表格段</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
  `),
  "word/footnotes.xml": wordDocument(["旧脚注"]),
  "word/endnotes.xml": wordDocument(["旧尾注"])
});
const structuredNewDocx = makeDocx({
  "word/document.xml": wordDocumentRaw(`
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>引言</w:t></w:r></w:p>
    <w:p><w:r><w:t>新正文段</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>新表格段</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
  `),
  "word/footnotes.xml": wordDocument(["新脚注"]),
  "word/endnotes.xml": wordDocument(["新尾注"])
});
const storedDeflateDocx = makeDocx({
  "word/document.xml": wordDocument(["stored block"])
}, { deflateOptions: { level: 0 } });
const fixedDeflateDocx = makeDocx({
  "word/document.xml": wordDocument(["fixed huffman block"])
}, { deflateOptions: { strategy: zlibConstants.Z_FIXED } });

const reader = new DocxReader();
const snapshot = await reader.readBytes(firstDocx);
assert.deepEqual(snapshot.paragraphs, ["引言第一段", "方法第二段", "脚注内容"]);
assert.equal(snapshot.paragraphCount, 3);
assert(snapshot.wordCount > 0);
const revisedSnapshot = await reader.readBytes(revisedDocx);
assert.deepEqual(revisedSnapshot.paragraphs, ["保留文本插入文本 制表 换行", "脚注内容", "尾注内容"]);
assert(!revisedSnapshot.normalizedText.includes("删除文本"));
assert(!revisedSnapshot.normalizedText.includes("移走文本"));
assert(!revisedSnapshot.normalizedText.includes("批注"));
assert(revisedSnapshot.paragraphDetails.some((paragraph) => paragraph.source === "header"));
const structuredSnapshot = await reader.readBytes(structuredNewDocx);
assert(structuredSnapshot.paragraphDetails.some((paragraph) => paragraph.headingPath?.includes("引言")));
assert(structuredSnapshot.paragraphDetails.some((paragraph) => paragraph.areaType === "table" && paragraph.tableIndex === 1));
assert(structuredSnapshot.paragraphDetails.some((paragraph) => paragraph.areaType === "footnote" && paragraph.sourceLabel === "脚注"));
assert(structuredSnapshot.paragraphDetails.some((paragraph) => paragraph.areaType === "endnote" && paragraph.sourceLabel === "尾注"));
assert.equal((await reader.readBytes(storedDeflateDocx)).paragraphs[0], "stored block");
assert.equal((await reader.readBytes(fixedDeflateDocx)).paragraphs[0], "fixed huffman block");
assert.throws(() => inflateRaw(new Uint8Array([0x07])), /reserved/);
await assert.rejects(
  () => reader.readBytes(makeDocx({ "word/comments.xml": wordDocument(["批注"]) })),
  /缺少 word\/document\.xml/
);

const platform = new TestPlatform({
  "first.docx": firstDocx,
  "second.docx": secondDocx,
  "deleted.docx": deletedDocx,
  "style-only.docx": styleOnlyDocx,
  "structured-old.docx": structuredOldDocx,
  "structured-new.docx": structuredNewDocx,
  "legacy.doc": new Uint8Array([1, 2, 3])
});
const analyzer = new ContentAnalyzer({ platform, docxReader: new DocxReader(platform) });
const firstAnalysis = await analyzer.analyze("first.docx", null);
assert.equal(firstAnalysis.changeSummary.changeType, "first-version");
assert.equal(firstAnalysis.contentSummary.mode, "docx-content");
assert.equal(firstAnalysis.changeSummary.paragraphChanges[0].type, "added");
assert(firstAnalysis.changeSummary.paragraphChanges[0].newText.includes("引言第一段"));

const previousVersion = {
  fileHash: firstAnalysis.fileHash,
  contentHash: firstAnalysis.contentHash,
  contentSummary: firstAnalysis.contentSummary,
  contentSnapshot: firstAnalysis.contentSnapshot
};
const contentAnalysis = await analyzer.analyze("second.docx", previousVersion);
assert.equal(contentAnalysis.changeSummary.changeType, "content");
assert.equal(contentAnalysis.changeSummary.addedParagraphs, 1);
assert.equal(contentAnalysis.changeSummary.modifiedParagraphs, 1);
assert(contentAnalysis.changeSummary.summary.includes("正文内容已修改"));
assert(contentAnalysis.changeSummary.paragraphChanges.some((change) => change.type === "modified" && change.oldText.includes("方法第二段") && change.newText.includes("方法第二段已修改")));
assert(contentAnalysis.changeSummary.paragraphChanges.some((change) => change.type === "added" && change.newText.includes("新增结论段")));
assert(contentAnalysis.changeSummary.displayChanges.length > 0);

const structuredPreviousAnalysis = await analyzer.analyze("structured-old.docx", null);
const structuredAnalysis = await analyzer.analyze("structured-new.docx", {
  fileHash: structuredPreviousAnalysis.fileHash,
  contentHash: structuredPreviousAnalysis.contentHash,
  contentSummary: structuredPreviousAnalysis.contentSummary,
  contentSnapshot: structuredPreviousAnalysis.contentSnapshot
});
assert(structuredAnalysis.changeSummary.changeGroups.some((group) => group.label === "引言" && group.modifiedParagraphs === 1));
assert(structuredAnalysis.changeSummary.changeGroups.some((group) => group.label === "引言 · 表格 1" && group.modifiedParagraphs === 1));
assert(structuredAnalysis.changeSummary.changeGroups.some((group) => group.label === "脚注" && group.modifiedParagraphs === 1));
assert(structuredAnalysis.changeSummary.changeGroups.some((group) => group.label === "尾注" && group.modifiedParagraphs === 1));
assert(structuredAnalysis.changeSummary.locationSummary.includes("表格 1"));

const deletedAnalysis = await analyzer.analyze("deleted.docx", previousVersion);
assert.equal(deletedAnalysis.changeSummary.deletedParagraphs, 1);
assert(deletedAnalysis.changeSummary.paragraphChanges.some((change) => change.type === "deleted" && change.oldText.includes("方法第二段")));

const styleOnlyAnalysis = await analyzer.analyze("style-only.docx", previousVersion);
assert.equal(styleOnlyAnalysis.changeSummary.changeType, "file-only");
assert(styleOnlyAnalysis.changeSummary.summary.includes("正文内容未变化"));

const noChangeAnalysis = await analyzer.analyze("first.docx", previousVersion);
assert.equal(noChangeAnalysis.changeSummary.changeType, "no-change");
assert.equal(noChangeAnalysis.shouldCreateVersion, false);

const docPrevious = { fileHash: await platform.hashBytes(new Uint8Array([1, 2])) };
const docAnalysis = await analyzer.analyze("legacy.doc", docPrevious);
assert.equal(docAnalysis.contentHash, null);
assert.equal(docAnalysis.changeSummary.changeType, "file-level");
assert(docAnalysis.changeSummary.summary.includes(".doc 仅支持文件级跟踪"));

console.log("逻辑测试通过：附件识别、右键菜单、lastCheck、Git 工作树、只读面板、设置页 Git 测试和正文差异均已验证。");

function wordDocument(paragraphs) {
  return wordDocumentRaw(
    paragraphs.map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`).join("\n")
  );
}

function wordDocumentRaw(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`;
}

function makeDocx(files, options = {}) {
  return createZip(Object.entries(files).map(([name, text]) => ({
    name,
    data: new TextEncoder().encode(text),
    deflateOptions: options.deflateOptions ?? {}
  })));
}

function createZip(items) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const item of items) {
    const compressed = deflateRawSync(item.data, item.deflateOptions ?? {});
    const name = Buffer.from(item.name, "utf8");
    const crc = crc32(item.data);
    const localHeader = Buffer.alloc(30);
    writeLocalHeader(localHeader, crc, compressed.length, item.data.length, name.length);
    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    writeCentralHeader(centralHeader, crc, compressed.length, item.data.length, name.length, offset);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  writeEndHeader(end, items.length, centralSize, offset);
  return new Uint8Array(Buffer.concat([...localParts, ...centralParts, end]));
}

function writeLocalHeader(buffer, crc, compressedSize, uncompressedSize, nameLength) {
  buffer.writeUInt32LE(0x04034b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(0x0800, 6);
  buffer.writeUInt16LE(8, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt32LE(crc, 14);
  buffer.writeUInt32LE(compressedSize, 18);
  buffer.writeUInt32LE(uncompressedSize, 22);
  buffer.writeUInt16LE(nameLength, 26);
  buffer.writeUInt16LE(0, 28);
}

function writeCentralHeader(buffer, crc, compressedSize, uncompressedSize, nameLength, offset) {
  buffer.writeUInt32LE(0x02014b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(20, 6);
  buffer.writeUInt16LE(0x0800, 8);
  buffer.writeUInt16LE(8, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt16LE(0, 14);
  buffer.writeUInt32LE(crc, 16);
  buffer.writeUInt32LE(compressedSize, 20);
  buffer.writeUInt32LE(uncompressedSize, 24);
  buffer.writeUInt16LE(nameLength, 28);
  buffer.writeUInt16LE(0, 30);
  buffer.writeUInt16LE(0, 32);
  buffer.writeUInt16LE(0, 34);
  buffer.writeUInt16LE(0, 36);
  buffer.writeUInt32LE(0, 38);
  buffer.writeUInt32LE(offset, 42);
}

function writeEndHeader(buffer, count, centralSize, centralOffset) {
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt16LE(0, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeUInt16LE(count, 8);
  buffer.writeUInt16LE(count, 10);
  buffer.writeUInt32LE(centralSize, 12);
  buffer.writeUInt32LE(centralOffset, 16);
  buffer.writeUInt16LE(0, 20);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  const table = getCrcTable();
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getCrcTable() {
  if (CRC_TABLE) {
    return CRC_TABLE;
  }
  const table = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  CRC_TABLE = table;
  return CRC_TABLE;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function renderPaneText(state) {
  const { body } = await renderPaneHarness({ stateProvider: () => state });
  return body.textContent;
}

async function renderPaneHarness({
  stateProvider,
  serviceOverrides = {},
  platformOverrides = {}
}) {
  const doc = new FakeDocument();
  const body = doc.createElement("div");
  doc.documentElement.append(body);
  const service = {
    getPanelState: async () => {
      const state = await stateProvider();
      return {
        ...state,
        attachment: state.attachment
          ? { extension: ".docx", ...state.attachment }
          : null
      };
    },
    enableVersionManagement: async () => {},
    disableVersionManagement: async () => {},
    checkCurrentChange: async () => ({
      changeSummary: { summary: "未检测到修改。" },
      contentSummary: null
    }),
    createVersion: async () => ({}),
    restoreVersion: async () => {},
    ...serviceOverrides
  };
  const platform = makePanePlatform(platformOverrides);
  const pane = new PaperVersionPane({
    service,
    platform
  });
  let sectionSummary = "";
  const setSectionSummary = (value) => {
    sectionSummary = value;
  };

  pane.render({ body, item: {}, setSectionSummary });
  await waitForScheduledPaneRender();
  return { body, pane, platform, service, sectionSummary };
}

async function waitForScheduledPaneRender() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

function makePanePlatform(overrides = {}) {
  return {
    Zotero: {
      debug() {}
    },
    alert() {},
    confirm: () => false,
    getPref: (_key, fallback) => fallback,
    promptGitPath: () => false,
    ...overrides
  };
}

function makeMenuHarness({ serviceOverrides = {}, platformOverrides = {} } = {}) {
  let registered = null;
  let refreshCount = 0;
  let promptGitCount = 0;
  const alerts = [];
  const service = {
    attachmentFinder: {
      findManageableAttachment: async () => managedAttachment
    },
    enableVersionManagement: async () => ({ attachment: managedAttachment }),
    disableVersionManagement: async () => {},
    checkCurrentChange: async () => ({ attachment: managedAttachment, changeSummary: { summary: "未检测到修改。" } }),
    createVersion: async () => older,
    restoreVersion: async () => {},
    exportVersionSummary: async () => ({ path: "exports/history.md" }),
    getPanelState: async () => ({
      enabled: true,
      git: { available: true, detail: "git version 2.44.0" },
      versions: [older]
    }),
    ...serviceOverrides
  };
  const platform = {
    Zotero: {
      MenuManager: {
        registerMenu(menu) {
          registered = menu;
        },
        unregisterMenu(menuID) {
          if (registered?.menuID === menuID) {
            registered = null;
          }
        }
      },
      debug() {}
    },
    alert(title, message) {
      alerts.push([title, message]);
    },
    confirm: () => true,
    promptText: () => "菜单版本",
    selectFromList: () => 0,
    getPref: (_key, fallback) => fallback,
    promptGitPath() {
      promptGitCount += 1;
      return true;
    },
    refreshItemPane() {
      refreshCount += 1;
    },
    ...platformOverrides
  };
  const menu = new PaperVersionMenu({ service, platform });
  return {
    alerts,
    get refreshCount() {
      return refreshCount;
    },
    get promptGitCount() {
      return promptGitCount;
    },
    get registered() {
      return registered;
    },
    menu,
    platform,
    service
  };
}

async function runPreferencesScript({
  autoGitPath = "",
  missingInitially = false,
  prefValue = "",
  subprocessResult = null,
  subprocessError = null
} = {}) {
  let elementsReady = !missingInitially;
  const timeouts = [];
  const prefs = new Map([[PREFS.gitPath, prefValue]]);
  const subprocessCalls = [];
  const elements = new Proxy({}, {
    get(target, id) {
      if (!target[id]) {
        target[id] = {
          addEventListener(type, handler) {
            this.listeners[type] = handler;
          },
          dataset: {},
          disabled: false,
          listeners: {},
          textContent: "",
          value: ""
        };
      }
      return target[id];
    }
  });
  const context = {
    ChromeUtils: {
      importESModule(spec) {
        if (spec === "chrome://git4zotero/content/src/platform.mjs") {
          return { ZoteroPlatform };
        }
        return {
          Subprocess: {
            call: async ({ command, arguments: args }) => {
              subprocessCalls.push({ command, args });
              if (subprocessError) {
                throw subprocessError;
              }
              const result = typeof subprocessResult === "function"
                ? await subprocessResult({ command, args })
                : subprocessResult;
              return makeSubprocessProc(result ?? {});
            }
          }
        };
      }
    },
    Ci: { nsIFile: function nsIFile() {} },
    console,
    document: {
      addEventListener() {},
      getElementById(id) {
        return elementsReady ? elements[id] : null;
      },
      readyState: "complete"
    },
    Services: {
      appinfo: { OS: "WINNT" },
      dirsvc: {
        get: (key) => ({
          path: key === "WinD"
            ? "C:\\Windows"
            : (key === "Home" ? "C:\\Users\\Tester" : "C:\\ZoteroProfile")
        })
      }
    },
    IOUtils: {
      exists: async (target) => target === autoGitPath
    },
    PathUtils: null,
    window: {
      addEventListener() {},
      setTimeout(callback) {
        timeouts.push(callback);
        return timeouts.length;
      }
    },
    Zotero: {
      debug() {},
      Prefs: {
        get: (key) => prefs.get(key) ?? "",
        set: (key, value) => prefs.set(key, value)
      }
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.Zotero = context.Zotero;
  vm.createContext(context);
  vm.runInContext(await fs.readFile("chrome/content/preferences.mjs", "utf8"), context);
  return {
    context,
    elements,
    prefs,
    releaseElements() {
      elementsReady = true;
      while (timeouts.length) {
        timeouts.shift()();
      }
    },
    subprocessCalls
  };
}

function makeSubprocessProc({ exitCode = 0, stdout = "", stderr = "" } = {}) {
  return {
    stdout: { readString: async () => stdout },
    stderr: { readString: async () => stderr },
    wait: async () => ({ exitCode })
  };
}

function findButton(node, text) {
  const button = findByTagText(node, "button", text);
  assert(button, `missing button: ${text}`);
  return button;
}

function findByTagText(node, tagName, text) {
  for (const child of node.childNodes ?? []) {
    if (child instanceof FakeElement
      && child.tagName === tagName
      && child.textContent.includes(text)) {
      return child;
    }
    const descendant = findByTagText(child, tagName, text);
    if (descendant) {
      return descendant;
    }
  }
  return null;
}

function findByClass(node, className) {
  for (const child of node.childNodes ?? []) {
    if (String(child.className ?? "").split(/\s+/).includes(className)) {
      return child;
    }
    const descendant = findByClass(child, className);
    if (descendant) {
      return descendant;
    }
  }
  return null;
}

function findAllByClass(node, className, matches = []) {
  for (const child of node.childNodes ?? []) {
    if (String(child.className ?? "").split(/\s+/).includes(className)) {
      matches.push(child);
    }
    findAllByClass(child, className, matches);
  }
  return matches;
}

function findByAttribute(node, name, value) {
  for (const child of node.childNodes ?? []) {
    if (child.getAttribute?.(name) === value) {
      return child;
    }
    const descendant = findByAttribute(child, name, value);
    if (descendant) {
      return descendant;
    }
  }
  return null;
}

function findById(node, id) {
  for (const child of node.childNodes ?? []) {
    if (child.id === id) {
      return child;
    }
    const descendant = findById(child, id);
    if (descendant) {
      return descendant;
    }
  }
  return null;
}

function MemoryPlatform(files) {
  this.files = files;
}

MemoryPlatform.prototype.readFileBytes = async function readFileBytes(path) {
  return this.files[path];
};

MemoryPlatform.prototype.stat = async function stat(path) {
  return { size: this.files[path].byteLength };
};

MemoryPlatform.prototype.hashFile = async function hashFile(path) {
  return this.hashBytes(this.files[path]);
};

MemoryPlatform.prototype.hashString = async function hashString(value) {
  return this.hashBytes(new TextEncoder().encode(String(value ?? "")));
};

MemoryPlatform.prototype.hashBytes = async function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
};
