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
import {
  RepositoryCleanupService,
  RepositoryIndexStore,
  createEmptyRepositoryIndex,
  isSafeRepoRelativePath
} from "../chrome/content/src/cleanup.mjs";
import { RepositoryArchiveService } from "../chrome/content/src/archive.mjs";
import { PREFS, SECTION_ID, UI_TEXT } from "../chrome/content/src/constants.mjs";
import { DocxReader } from "../chrome/content/src/docx-reader.mjs";
import { inflateRaw } from "../chrome/content/src/vendor/zip-reader.mjs";
import {
  createEmptyMetadata,
  createVersionRecord,
  METADATA_SCHEMA_VERSION,
  MetadataStore,
  migrateMetadata,
  normalizeVersionNote,
  sortNewestFirst
} from "../chrome/content/src/metadata.mjs";
import { resolveUILocale, setUILocale } from "../chrome/content/src/localization.mjs";
import { assertSafeCommitHash, GitBackend } from "../chrome/content/src/git-backend.mjs";
import { PaperVersionMenu } from "../chrome/content/src/menu.mjs";
import { normalizeJoinParts, ZoteroPlatform } from "../chrome/content/src/platform.mjs";
import {
  classifyError,
  DiagnosticService,
  ERROR_CATEGORIES,
  LastErrorStore,
  recordLastError
} from "../chrome/content/src/diagnostics.mjs";
import { PaperVersionPane } from "../chrome/content/src/ui.mjs";
import { VersionService } from "../chrome/content/src/version-service.mjs";

let CRC_TABLE = null;

assert.equal(resolveUILocale("zh-CN"), "zh-CN");
assert.equal(resolveUILocale("zh-TW"), "zh-TW");
assert.equal(resolveUILocale("zh-HK"), "zh-TW");
assert.equal(resolveUILocale("en-US"), "en-US");
assert.equal(resolveUILocale("fr-FR"), "en-US");
setUILocale("en-US");
assert.equal(UI_TEXT.menuRoot, "Paper Versions");
assert.equal(UI_TEXT.preferences.testGit, "Test Git");
assert.equal(UI_TEXT.preferences.copyDiagnostics, "Copy Diagnostics");
assert(!/[\u4e00-\u9fff]/.test(JSON.stringify(UI_TEXT)));
setUILocale("zh-TW");
assert.equal(UI_TEXT.menuRoot, "論文版本");
assert.equal(UI_TEXT.preferences.testGit, "測試 Git");
assert.equal(UI_TEXT.preferences.copyDiagnostics, "複製診斷資訊");
setUILocale("zh-CN");
assert.equal(UI_TEXT.menuRoot, "论文版本");

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
        get: (key) => ({ path: key === "WinD" ? "C:\\Windows" : (key === "ProfD" ? "C:\\Profile" : "C:\\Users\\Tester") })
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
  const knownGit = "C:\\Program Files\\Git\\cmd\\git.exe";
  const userGit = "C:\\Users\\Tester\\AppData\\Local\\Programs\\Git\\cmd\\git.exe";
  const pathGit = "D:\\PortableGit\\cmd\\git.exe";
  const subprocessCalls = [];
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      appinfo: { OS: "WINNT" },
      dirsvc: {
        get: (key) => ({ path: key === "WinD" ? "C:\\Windows" : (key === "ProfD" ? "C:\\Profile" : "C:\\Users\\Tester") })
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
            if (command.endsWith("where.exe")) {
              return makeSubprocessProc({ exitCode: 0, stdout: `${pathGit}\n${knownGit}\n` });
            }
            return makeSubprocessProc({ exitCode: 0, stdout: `git version for ${command}\n` });
          }
        }
      })
    },
    IOUtils: {
      exists: async (target) => [knownGit, userGit, "C:\\Windows\\System32\\where.exe"].includes(target)
    },
    PathUtils: null
  });
  const candidates = await platform.listGitExecutableCandidates();
  assert.deepEqual(candidates.map((candidate) => candidate.command), [knownGit, userGit, pathGit]);
  assert(candidates.every((candidate) => candidate.available));
  assert(candidates.every((candidate) => candidate.version.startsWith("git version for ")));
  assert(subprocessCalls.some((call) => call.command.endsWith("where.exe")));
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
  const parentWindow = { name: "preferences" };
  parentWindow.top = parentWindow;
  const picker = {
    file: { path: "C:\\Exports\\summary.md" },
    init(parent, title, mode) {
      assert.equal(parent, parentWindow);
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
    PathUtils: null,
    window: parentWindow
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
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { appinfo: { OS: "WINNT" }, prompt: {} },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  const processCalls = [];
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  platform.runProcess = async (command, args) => {
    processCalls.push({ command, args });
    return { exitCode: 0, stdout: "D:\\Backups\\git4zotero-backup.zip\r\n", stderr: "" };
  };
  platform.pickOpenPathWithFilePicker = async () => {
    throw new Error("nsIFilePicker should not be used when native Windows open-file picker succeeds");
  };
  const selectedPath = await platform.pickOpenPath(UI_TEXT.archiveImportTitle);
  assert.equal(selectedPath, "D:\\Backups\\git4zotero-backup.zip");
  assert.equal(processCalls[0].command, "powershell.exe");
  assert(processCalls[0].args.includes("-STA"));
  assert(processCalls[0].args.at(-1).includes("OpenFileDialog"));
  assert(processCalls[0].args.at(-1).includes("ZIP backups"));
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { appinfo: { OS: "WINNT" }, prompt: {} },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  platform.runProcess = async () => ({ exitCode: 2, stdout: "", stderr: "" });
  platform.pickOpenPathWithFilePicker = async () => {
    throw new Error("cancelled native Windows open-file picker should not fall through to nsIFilePicker");
  };
  const selectedPath = await platform.pickOpenPath(UI_TEXT.archiveImportTitle);
  assert.equal(selectedPath, null);
}

{
  const parentWindow = { name: "main" };
  let initMode = null;
  const picker = {
    file: { path: "D:\\Backups\\fallback.zip" },
    init(_parent, _title, mode) {
      initMode = mode;
    },
    appendFilter(label, pattern) {
      assert.equal(label, "ZIP");
      assert.equal(pattern, "*.zip");
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
    Services: { appinfo: { OS: "WINNT" }, prompt: {} },
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance: () => picker
      }
    },
    Ci: {
      nsIFile: function nsIFile() {},
      nsIFilePicker: {
        modeOpen: 4,
        returnCancel: 2,
        filterAll: 99
      }
    },
    ChromeUtils: {},
    window: parentWindow
  });
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  platform.runProcess = async () => ({ exitCode: 1, stdout: "", stderr: "native unavailable" });
  const selectedPath = await platform.pickOpenPath(UI_TEXT.archiveImportTitle);
  assert.equal(initMode, 4);
  assert.equal(selectedPath, "D:\\Backups\\fallback.zip");
}

{
  const invalidParent = { name: "preferences" };
  const validParent = { name: "top" };
  const initParents = [];
  const initError = new Error("Could not convert JavaScript argument arg 0 [nsIFilePicker.init]");
  const pickers = [
    {
      init(parent) {
        initParents.push(parent);
        throw initError;
      }
    },
    {
      file: { path: "D:\\Backups\\retried-open.zip" },
      init(parent, _title, mode) {
        initParents.push(parent);
        assert.equal(mode, 4);
      },
      appendFilter() {},
      appendFilters() {},
      open(resolve) {
        resolve(0);
      }
    }
  ];
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { prompt: {} },
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance: () => pickers.shift()
      }
    },
    Ci: {
      nsIFile: function nsIFile() {},
      nsIFilePicker: {
        modeOpen: 4,
        returnCancel: 2,
        filterAll: 99
      }
    },
    ChromeUtils: {},
    window: {
      browsingContext: { topChromeWindow: invalidParent },
      top: validParent
    }
  });
  const selectedPath = await platform.pickOpenPath(UI_TEXT.archiveImportTitle);
  assert.deepEqual(initParents, [invalidParent, validParent]);
  assert.equal(selectedPath, "D:\\Backups\\retried-open.zip");
}

{
  const promptMessages = [];
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: {
      appinfo: { OS: "WINNT" },
      prompt: {
        prompt(_parent, title, message, input) {
          promptMessages.push({ title, message });
          input.value = "D:\\Manual\\typed-backup.zip";
          return true;
        }
      }
    },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  platform.runProcess = async () => ({ exitCode: 1, stdout: "", stderr: "native unavailable" });
  const selectedPath = await platform.pickOpenPath(UI_TEXT.archiveImportTitle);
  assert.equal(selectedPath, "D:\\Manual\\typed-backup.zip");
  assert.equal(promptMessages[0].title, UI_TEXT.archiveImportPathPromptTitle);
  assert(promptMessages[0].message.includes(UI_TEXT.archiveImportPathPromptMessage));
  assert(promptMessages[0].message.includes(UI_TEXT.openFileDialogUnavailable));
}

{
  const platform = Object.create(ZoteroPlatform.prototype);
  Object.assign(platform, {
    exists: async (target) => target === "D:\\BackupFolder" || target === "D:\\ExistingBackup.zip",
    isDirectory: async (target) => target === "D:\\BackupFolder",
    readFileBytes: async () => new Uint8Array([1, 2, 3]),
    pickOpenPath: async () => {
      throw new Error("direct path must not open file picker");
    }
  });
  await assert.rejects(
    () => platform.openBinaryFile({ path: "D:\\MissingBackup.zip" }),
    /导入文件不存在|匯入檔案不存在|import file does not exist/i
  );
  await assert.rejects(
    () => platform.openBinaryFile({ path: "D:\\BackupFolder" }),
    /导入路径不是文件|匯入路徑不是檔案|import path is not a file/i
  );
  const opened = await platform.openBinaryFile({ path: "\"D:\\ExistingBackup.zip\"" });
  assert.equal(opened.path, "D:\\ExistingBackup.zip");
  assert.deepEqual([...opened.bytes], [1, 2, 3]);
}

{
  const parentWindow = { name: "preferences" };
  parentWindow.top = parentWindow;
  let initParent = null;
  let initTitle = "";
  let initMode = null;
  const picker = {
    file: { path: "D:\\MigrationBackups\\.git4zotero-select-folder" },
    init(parent, title, mode) {
      initParent = parent;
      initTitle = title;
      initMode = mode;
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
    Services: { prompt: {} },
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
    window: parentWindow
  });
  const selectedDirectory = await platform.pickDirectoryViaSaveDialog("选择迁移导出目录");
  assert.equal(initParent, parentWindow);
  assert.equal(initTitle, "选择迁移导出目录");
  assert.equal(initMode, 1);
  assert.equal(picker.defaultString, ".git4zotero-select-folder");
  assert.equal(selectedDirectory, "D:\\MigrationBackups");
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { appinfo: { OS: "WINNT" }, prompt: {} },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  const processCalls = [];
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  platform.runProcess = async (command, args) => {
    processCalls.push({ command, args });
    return { exitCode: 0, stdout: "D:\\NativeChosen\r\n", stderr: "" };
  };
  platform.pickSavePath = async () => {
    throw new Error("nsIFilePicker should not be used when native Windows folder picker succeeds");
  };
  const selectedDirectory = await platform.pickDirectoryViaSaveDialog("选择迁移导出目录");
  assert.equal(selectedDirectory, "D:\\NativeChosen");
  assert.equal(processCalls[0].command, "powershell.exe");
  assert(processCalls[0].args.includes("-STA"));
  assert(processCalls[0].args.at(-1).includes("FolderBrowserDialog"));
  assert(processCalls[0].args.at(-1).includes("选择迁移导出目录"));
  assert(processCalls[0].args.at(-1).includes("System.Windows.Forms"));
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { appinfo: { OS: "WINNT" }, prompt: {} },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  platform.runProcess = async () => ({ exitCode: 2, stdout: "", stderr: "" });
  platform.pickSavePath = async () => {
    throw new Error("cancelled native Windows folder picker should not fall through to nsIFilePicker");
  };
  const selectedDirectory = await platform.pickDirectoryViaSaveDialog("选择迁移导出目录");
  assert.equal(selectedDirectory, null);
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { appinfo: { OS: "WINNT" }, prompt: {} },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  const scriptsRun = [];
  platform.runProcess = async (_command, args) => {
    scriptsRun.push(args.at(-1));
    if (scriptsRun.length === 1) {
      return { exitCode: 1, stdout: "", stderr: "forms unavailable" };
    }
    return { exitCode: 0, stdout: "D:\\ShellChosen\r\n", stderr: "" };
  };
  platform.pickSavePath = async () => {
    throw new Error("Windows folder picker should use Shell.Application fallback before nsIFilePicker");
  };
  const selectedDirectory = await platform.pickDirectoryViaSaveDialog("选择 O'Hare 目录");
  assert.equal(selectedDirectory, "D:\\ShellChosen");
  assert.equal(scriptsRun.length, 2);
  assert(scriptsRun[0].includes("FolderBrowserDialog"));
  assert(scriptsRun[1].includes("Shell.Application"));
  assert(platform.createWindowsFolderPickerScripts("选择 O'Hare 目录")[0].includes("O''Hare"));
}

{
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { appinfo: { OS: "WINNT" }, prompt: {} },
    Cc: {},
    Ci: {},
    ChromeUtils: {}
  });
  platform.getPowerShellExecutableCandidates = () => [{ command: "powershell.exe", mustExist: false }];
  platform.runProcess = async () => ({ exitCode: 1, stdout: "", stderr: "native picker unavailable" });
  platform.pickSavePath = async () => {
    throw new Error("Windows directory selection must not fall through to nsIFilePicker after native picker failure");
  };
  await assert.rejects(
    () => platform.pickDirectoryViaSaveDialog("选择迁移导出目录"),
    /Windows/
  );
}

{
  const invalidParent = { name: "preferences" };
  const validParent = { name: "top" };
  const initParents = [];
  const initTitles = [];
  const initModes = [];
  const initError = new Error("Component returned failure code: 0x80070057 (NS_ERROR_ILLEGAL_VALUE) [nsIFilePicker.init]");
  initError.result = 0x80070057;
  const pickers = [
    {
      init(parent, title, mode) {
        initParents.push(parent);
        initTitles.push(title);
        initModes.push(mode);
        throw initError;
      }
    },
    {
      file: { path: "D:\\GuideExports" },
      init(parent, title, mode) {
        initParents.push(parent);
        initTitles.push(title);
        initModes.push(mode);
      },
      open(resolve) {
        resolve(0);
      }
    }
  ];
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { prompt: {} },
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance: () => pickers.shift()
      }
    },
    Ci: {
      nsIFile: function nsIFile() {},
      nsIFilePicker: {
        modeGetFolder: 3,
        returnCancel: 2
      }
    },
    ChromeUtils: {},
    window: {
      browsingContext: { topChromeWindow: invalidParent },
      top: validParent
    }
  });
  const selectedDirectory = await platform.pickDirectory("选择迁移导出目录");
  assert.deepEqual(initParents, [invalidParent, validParent]);
  assert.deepEqual(initTitles, ["选择迁移导出目录", "选择迁移导出目录"]);
  assert.deepEqual(initModes, [3, 3]);
  assert.equal(selectedDirectory, "D:\\GuideExports");
}

{
  const invalidPreferenceWindow = { name: "preferences-wrapper" };
  const zoteroMainWindow = { name: "zotero-main" };
  const initParents = [];
  const initError = new Error("Could not convert JavaScript argument arg 0 [nsIFilePicker.init]");
  const pickers = [
    {
      init(parent) {
        initParents.push(parent);
        throw initError;
      }
    },
    {
      file: { path: "D:\\ImportedMainWindow\\.git4zotero-select-folder" },
      init(parent, _title, mode) {
        initParents.push(parent);
        assert.equal(mode, 1);
      },
      appendFilters() {},
      open(resolve) {
        resolve(0);
      }
    }
  ];
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: null,
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance: () => pickers.shift()
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
    ChromeUtils: {
      importESModule: (spec) => {
        assert.equal(spec, "resource://gre/modules/Services.sys.mjs");
        return {
          Services: {
            wm: {
              getMostRecentWindow: (windowType) => windowType === "zotero:main" ? zoteroMainWindow : null
            }
          }
        };
      }
    },
    window: {
      browsingContext: { topChromeWindow: invalidPreferenceWindow }
    }
  });
  const selectedDirectory = await platform.pickDirectoryViaSaveDialog("选择迁移导出目录");
  assert.deepEqual(initParents, [invalidPreferenceWindow, zoteroMainWindow]);
  assert.equal(selectedDirectory, "D:\\ImportedMainWindow");
}

{
  const mainWindow = { name: "main" };
  let initParent = null;
  const picker = {
    file: { path: "D:\\ShouldNotUse" },
    init(parent, _title, mode) {
      initParent = parent;
      assert.equal(mode, 3);
    },
    open(resolve) {
      resolve(2);
    }
  };
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {},
      getMainWindow: () => mainWindow
    },
    Services: { prompt: {} },
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance: () => picker
      }
    },
    Ci: {
      nsIFile: function nsIFile() {},
      nsIFilePicker: {
        modeGetFolder: 3,
        returnCancel: 2
      }
    },
    ChromeUtils: {}
  });
  const selectedDirectory = await platform.pickDirectory("选择迁移导出目录");
  assert.equal(initParent, mainWindow);
  assert.equal(selectedDirectory, null);
}

{
  const initError = new Error("Component returned failure code: 0x80070057 (NS_ERROR_ILLEGAL_VALUE) [nsIFilePicker.init]");
  initError.result = 0x80070057;
  const platform = new ZoteroPlatform({
    Zotero: {
      Prefs: { get: () => "" },
      debug() {}
    },
    Services: { prompt: {} },
    Cc: {
      "@mozilla.org/filepicker;1": {
        createInstance: () => ({
          init() {
            throw initError;
          }
        })
      }
    },
    Ci: {
      nsIFile: function nsIFile() {},
      nsIFilePicker: {
        modeGetFolder: 3,
        returnCancel: 2
      }
    },
    ChromeUtils: {},
    window: { top: { name: "invalid" } }
  });
  await assert.rejects(
    () => platform.pickDirectory("选择迁移导出目录"),
    /当前环境无法打开保存对话框。.*NS_ERROR_ILLEGAL_VALUE/
  );
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
  const writes = [];
  let saveDialogCalls = 0;
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
      exists: async (target) => target === "D:\\SummaryExports",
      makeDirectory: async () => {},
      stat: async (target) => ({ type: target === "D:\\SummaryExports" ? "directory" : "file" }),
      writeUTF8: async (target, content) => writes.push([target, content])
    },
    PathUtils: null
  });
  platform.pickSavePath = async () => {
    saveDialogCalls += 1;
    throw new Error("save dialog should not be used for configured export directory");
  };
  const savedPath = await platform.saveTextFile({
    defaultFileName: "summary.md",
    content: "# Summary\n",
    initialDirectory: "D:\\SummaryExports"
  });
  assert.equal(savedPath, "D:\\SummaryExports\\summary.md");
  assert.equal(saveDialogCalls, 0);
  assert.deepEqual(writes, [["D:\\SummaryExports\\summary.md", "# Summary\n"]]);
  await assert.rejects(
    () => platform.saveTextFile({
      defaultFileName: "summary.md",
      content: "# Summary\n",
      initialDirectory: "D:\\Missing"
    }),
    /迁移导出目录不可用|Migration export directory is unavailable/
  );
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
  pluginVersion: "0.2.2"
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
const migratedMetadata = migrateMetadata({
  schemaVersion: 1,
  versions: [oldest, {
    id: "legacy-no-hash",
    commitHash: "fedcba9876543210",
    shortHash: "fedcba98",
    createdAt: "2026-01-04T00:00:00.000Z",
    kind: "manual",
    note: "",
    fileName: "legacy.docx",
    trackedRelativePath: "tracked/document.docx"
  }],
  item: "invalid",
  attachment: null,
  trackedFile: "invalid"
}, {
  item: { itemKey: "FALLBACK" },
  attachment: { fileName: "fallback.docx" },
  trackedFile: { trackedRelativePath: "tracked/document.docx" }
});
assert.equal(migratedMetadata.schemaVersion, METADATA_SCHEMA_VERSION);
assert.equal(migratedMetadata.enabled, true);
assert.equal(migratedMetadata.item.itemKey, "FALLBACK");
assert.equal(migratedMetadata.attachment.fileName, "fallback.docx");
assert.deepEqual(migratedMetadata.versions.map((version) => version.id), ["legacy-no-hash", "oldest"]);
assert.equal(migratedMetadata.versions[0].contentHash, null);
assert.deepEqual(migratedMetadata.versions[0].zotero, {});

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

assert.equal(isSafeRepoRelativePath("library-1/item-ITEM"), true);
assert.equal(isSafeRepoRelativePath("../library-1/item-ITEM"), false);
assert.deepEqual(createEmptyRepositoryIndex().repositories, []);

{
  const files = new Map();
  const directories = new Set(["C:/Profile", "C:/Profile/git4zotero"]);
  const removedDirectories = [];
  const platform = {
    Zotero: {
      Items: {
        get: () => null
      },
      debug() {}
    },
    getPluginDataDirectory: () => "C:/Profile/git4zotero",
    join: (...parts) => parts.join("/"),
    exists: async (target) => files.has(target) || directories.has(target),
    makeDirectory: async (target) => directories.add(target),
    readText: async (target) => files.get(target),
    writeText: async (target, content) => {
      directories.add(target.replace(/\/[^/]+$/, ""));
      files.set(target, content);
    },
    listDirectory: async (target) => {
      if (target === "C:/Profile/git4zotero") {
        return ["C:/Profile/git4zotero/library-1"];
      }
      if (target === "C:/Profile/git4zotero/library-1") {
        return ["C:/Profile/git4zotero/library-1/item-ITEM"];
      }
      return [];
    },
    removeDirectory: async (target) => {
      removedDirectories.push(target);
      directories.delete(target);
      for (const key of [...files.keys()]) {
        if (key === target || key.startsWith(`${target}/`)) {
          files.delete(key);
        }
      }
    }
  };
  const metadataStore = new MetadataStore(platform);
  const indexStore = new RepositoryIndexStore(platform);
  const cleanupService = new RepositoryCleanupService({ platform, metadataStore, indexStore });
  const repoPath = "C:/Profile/git4zotero/library-1/item-ITEM";
  directories.add(repoPath);
  await metadataStore.write(repoPath, {
    ...createEmptyMetadata(),
    enabled: true,
    item: { libraryID: 1, itemID: 2, itemKey: "ITEM" },
    attachment: { attachmentID: 3, attachmentKey: "ATT", fileName: "paper.docx" },
    versions: [older]
  });
  await indexStore.upsertAttachment(managedAttachment, { enabled: true });

  await cleanupService.handleItemEvent("trash", "item", [2]);
  assert.equal(removedDirectories.length, 0);
  assert.equal(await platform.exists(repoPath), true);

  await cleanupService.handleItemEvent("delete", "item", [2]);
  assert.deepEqual(removedDirectories, [repoPath]);
  assert.equal(await platform.exists(repoPath), false);
  assert.equal((await indexStore.read()).repositories.length, 0);

  directories.add(repoPath);
  await metadataStore.write(repoPath, {
    ...createEmptyMetadata(),
    enabled: true,
    item: { libraryID: 1, itemID: 2, itemKey: "ITEM" },
    attachment: { attachmentID: 3, attachmentKey: "ATT", fileName: "paper.docx" },
    versions: [older]
  });
  await indexStore.upsertAttachment(managedAttachment, { enabled: true });
  await cleanupService.handleItemEvent("delete", "item", [3]);
  assert.equal(removedDirectories.at(-1), repoPath);

  const invalidResult = await cleanupService.cleanupCandidates(
    [{ ...managedAttachment, repoRelativePath: "../escape" }],
    new Set([2])
  );
  assert.equal(invalidResult.cleaned.length, 0);
  assert.equal(invalidResult.skipped.length, 1);

  directories.add(repoPath);
  await metadataStore.write(repoPath, {
    ...createEmptyMetadata(),
    enabled: true,
    item: { libraryID: 1, itemID: 222, itemKey: "OTHER" },
    attachment: { attachmentID: 333, attachmentKey: "OTHERATT", fileName: "paper.docx" },
    versions: []
  });
  const mismatch = await cleanupService.cleanupCandidates(
    [{
      ...managedAttachment,
      repoRelativePath: "library-1/item-ITEM"
    }],
    new Set([2])
  );
  assert.equal(mismatch.cleaned.length, 0);
  assert.equal(mismatch.skipped[0].reason.includes("元数据"), true);

  files.delete("C:/Profile/git4zotero/index.json");
  await metadataStore.write(repoPath, {
    ...createEmptyMetadata(),
    enabled: true,
    item: { libraryID: 1, itemID: 2, itemKey: "ITEM" },
    attachment: { attachmentID: 3, attachmentKey: "ATT", fileName: "paper.docx" },
    versions: [older]
  });
  const orphanScan = await cleanupService.scanOrphanRepositories();
  assert.equal(orphanScan.count, 1);
  assert.equal(orphanScan.repositories[0].repoRelativePath, "library-1/item-ITEM");
}

{
  let exportedZip = null;
  const saveRequests = [];
  const encoder = new TextEncoder();
  const sourceFiles = new Map([
    ["C:/Profile/git4zotero/index.json", encoder.encode("{\"repositories\":[]}")],
    ["C:/Profile/git4zotero/library-1/item-ITEM/.git/config", encoder.encode("[core]\n")],
    ["C:/Profile/git4zotero/library-1/item-ITEM/.git4zotero/versions.json", encoder.encode(JSON.stringify({
      ...createEmptyMetadata(),
      item: { libraryID: 1, itemID: 10, itemKey: "ITEM" },
      attachment: { attachmentID: 20, attachmentKey: "ATTACH", fileName: "paper.docx" },
      versions: [older, newer]
    }))]
  ]);
  const sourceDirectories = new Set([
    "C:/Profile/git4zotero",
    "C:/Profile/git4zotero/library-1",
    "C:/Profile/git4zotero/library-1/item-ITEM",
    "C:/Profile/git4zotero/library-1/item-ITEM/.git",
    "C:/Profile/git4zotero/library-1/item-ITEM/.git4zotero"
  ]);
  const sourcePlatform = {
    getPluginDataDirectory: () => "C:/Profile/git4zotero",
    getPluginVersion: () => "0.2.4",
    join: (...parts) => parts.join("/"),
    exists: async (target) => sourceFiles.has(target) || sourceDirectories.has(target),
    isDirectory: async (target) => sourceDirectories.has(target),
    readFileBytes: async (target) => sourceFiles.get(target),
    listDirectory: async (target) => {
      const prefix = `${target}/`;
      const children = new Set();
      for (const dir of sourceDirectories) {
        if (dir.startsWith(prefix)) {
          const rest = dir.slice(prefix.length);
          if (rest && !rest.includes("/")) {
            children.add(`${prefix}${rest}`);
          }
        }
      }
      for (const file of sourceFiles.keys()) {
        if (file.startsWith(prefix)) {
          const rest = file.slice(prefix.length);
          if (rest && !rest.includes("/")) {
            children.add(`${prefix}${rest}`);
          }
        }
      }
      return [...children];
    },
    saveBinaryFile: async (request) => {
      saveRequests.push(request);
      const { bytes } = request;
      exportedZip = bytes;
      return "C:/backup/git4zotero-backup.zip";
    }
  };
  const archiveService = new RepositoryArchiveService({
    platform: sourcePlatform,
    cleanupService: { ensureIndex: async () => {} },
    pluginVersion: "0.2.4"
  });
  const exportResult = await archiveService.exportRepositoryArchive({ initialDirectory: "C:/backup" });
  assert.equal(exportResult.repositoryCount, 1);
  assert(exportedZip instanceof Uint8Array);
  assert.equal(saveRequests.at(-1).initialDirectory, "C:/backup");
  assert(saveRequests.at(-1).defaultFileName.startsWith("git4zotero-backup-"));
  const globalExportedZip = exportedZip;

  const itemArchiveAttachment = {
    libraryID: 1,
    itemID: 10,
    itemKey: "ITEM",
    attachmentID: 20,
    attachmentKey: "ATTACH",
    fileName: "paper.docx",
    extension: ".docx"
  };
  const itemExportResult = await archiveService.exportItemRepositoryArchive({
    repoRelativePath: "library-1/item-ITEM",
    repoPath: "C:/Profile/git4zotero/library-1/item-ITEM",
    attachment: itemArchiveAttachment,
    initialDirectory: "C:/item-backup"
  });
  const itemExportedZip = exportedZip;
  assert.equal(itemExportResult.repositoryCount, 1);
  assert.equal(saveRequests.at(-1).initialDirectory, "C:/item-backup");
  assert(saveRequests.at(-1).defaultFileName.startsWith("git4zotero-ITEM-history-"));
  const itemExportEntries = archiveService.readArchiveEntries(itemExportedZip);
  const itemExportNames = itemExportEntries.map((entry) => entry.name);
  assert(itemExportNames.includes("export-manifest.json"));
  assert(!itemExportNames.includes("index.json"));
  assert(itemExportNames.includes("library-1/item-ITEM/.git/config"));
  assert(itemExportNames.every((name) => name === "export-manifest.json" || name.startsWith("library-1/item-ITEM/")));
  const itemExportManifest = JSON.parse(new TextDecoder().decode(itemExportEntries.find((entry) => entry.name === "export-manifest.json").bytes));
  assert.equal(itemExportManifest.schemaVersion, 2);
  assert.equal(itemExportManifest.scope, "item");
  assert.equal(itemExportManifest.archiveKind, "item-history");
  assert.equal(itemExportManifest.pluginVersion, "0.2.4");
  assert.equal(itemExportManifest.sourceRepository.repoRelativePath, "library-1/item-ITEM");
  assert.equal(itemExportManifest.sourceRepository.compatibleFormat.extension, ".docx");
  assert.equal(itemExportManifest.sourceRepository.compatibleFormat.supportsContentDiff, true);
  assert.equal(itemExportManifest.sourceRepository.versionCount, 2);
  assert.equal(itemExportManifest.sourceRepository.latestVersionAt, newer.createdAt);
  assert.equal(itemExportManifest.repositories[0].repoRelativePath, "library-1/item-ITEM");
  assert.equal(itemExportManifest.repositories[0].metadataSchemaVersion, METADATA_SCHEMA_VERSION);

  const globalExportEntries = archiveService.readArchiveEntries(globalExportedZip);
  const globalExportManifest = JSON.parse(new TextDecoder().decode(globalExportEntries.find((entry) => entry.name === "export-manifest.json").bytes));
  assert.equal(globalExportManifest.scope, "all");
  assert.equal(globalExportManifest.archiveKind, "internal-all-history-compat");
  assert.equal(globalExportManifest.internalCompatibilityOnly, true);

  const targetFiles = new Map();
  const targetDirectories = new Set(["D:/Profile/git4zotero"]);
  let ensureIndexCalls = 0;
  const importPlatform = {
    getPluginDataDirectory: () => "D:/Profile/git4zotero",
    join: (...parts) => parts.join("/"),
    exists: async (target) => targetFiles.has(target) || targetDirectories.has(target),
    writeBytes: async (target, bytes) => {
      let parent = target.replace(/\/[^/]+$/, "");
      while (parent && !targetDirectories.has(parent)) {
        targetDirectories.add(parent);
        parent = parent.replace(/\/[^/]+$/, "");
      }
      targetFiles.set(target, bytes);
    },
    openBinaryFile: async () => ({ path: "C:/backup/git4zotero-backup.zip", bytes: exportedZip })
  };
  const importService = new RepositoryArchiveService({
    platform: importPlatform,
    cleanupService: { ensureIndex: async () => { ensureIndexCalls += 1; } },
    pluginVersion: "0.2.4"
  });
  const importResult = await importService.importRepositoryArchive();
  assert.equal(importResult.imported.length, 1);
  assert.equal(importResult.skipped.length, 0);
  assert.equal(ensureIndexCalls, 1);
  assert(targetFiles.has("D:/Profile/git4zotero/library-1/item-ITEM/.git/config"));
  const skipResult = await importService.importRepositoryArchive();
  assert.equal(skipResult.imported.length, 0);
  assert.equal(skipResult.skipped[0].reason, UI_TEXT.archiveImportSkippedExisting);

  const directImportFiles = new Map();
  let directImportPath = "";
  const directImportService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "E:/Profile/git4zotero",
      join: (...parts) => parts.join("/"),
      exists: async (target) => directImportFiles.has(target) || target === "E:/Profile/git4zotero",
      writeBytes: async (target, bytes) => {
        directImportFiles.set(target, bytes);
      },
      openBinaryFile: async ({ path }) => {
        directImportPath = path;
        return { path, bytes: exportedZip };
      }
    },
    cleanupService: { ensureIndex: async () => {} },
    pluginVersion: "0.2.4"
  });
  const directImportResult = await directImportService.importRepositoryArchive({ path: "C:/backup/git4zotero-backup.zip" });
  assert.equal(directImportPath, "C:/backup/git4zotero-backup.zip");
  assert.equal(directImportResult.imported.length, 1);
  assert(directImportFiles.has("E:/Profile/git4zotero/library-1/item-ITEM/.git/config"));

  const invalidPluginZip = makeStoredZip([{
    name: "export-manifest.json",
    text: JSON.stringify({ schemaVersion: 1, plugin: "other-plugin" })
  }]);
  const invalidPluginService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "D:/Profile/git4zotero",
      openBinaryFile: async () => ({ path: "C:/backup/invalid-plugin.zip", bytes: invalidPluginZip })
    }
  });
  await assert.rejects(
    () => invalidPluginService.importRepositoryArchive(),
    /插件标识不匹配|plugin does not match/i
  );

  const unsupportedSchemaZip = makeStoredZip([{
    name: "export-manifest.json",
    text: JSON.stringify({ schemaVersion: 99, plugin: "git4zotero" })
  }]);
  const unsupportedSchemaService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "D:/Profile/git4zotero",
      openBinaryFile: async () => ({ path: "C:/backup/schema.zip", bytes: unsupportedSchemaZip })
    }
  });
  await assert.rejects(
    () => unsupportedSchemaService.importRepositoryArchive(),
    /schema/
  );

  const unsafeZip = makeStoredZip([{
    name: "../evil.txt",
    text: "nope"
  }]);
  const unsafeService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "D:/Profile/git4zotero",
      openBinaryFile: async () => ({ path: "C:/backup/unsafe.zip", bytes: unsafeZip })
    }
  });
  await assert.rejects(
    () => unsafeService.importRepositoryArchive(),
    /不安全|unsafe/i
  );

  const partialZip = makeStoredZip([
    {
      name: "export-manifest.json",
      text: JSON.stringify({ schemaVersion: 1, plugin: "git4zotero" })
    },
    {
      name: "library-1/item-OK/.git/config",
      text: "[core]\n"
    },
    {
      name: "library-1/item-FAIL/.git/config",
      text: "[core]\n"
    }
  ]);
  const partialWrites = [];
  const partialService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "D:/Profile/git4zotero",
      join: (...parts) => parts.join("/"),
      exists: async () => false,
      writeBytes: async (target, bytes) => {
        if (target.includes("item-FAIL")) {
          throw new Error("write failed");
        }
        partialWrites.push({ target, bytes });
      },
      openBinaryFile: async () => ({ path: "C:/backup/partial.zip", bytes: partialZip })
    },
    cleanupService: { ensureIndex: async () => {} }
  });
  const partialResult = await partialService.importRepositoryArchive();
  assert.deepEqual(partialResult.imported, ["library-1/item-OK"]);
  assert.equal(partialResult.failed.length, 1);
  assert.equal(partialResult.failed[0].repoRelativePath, "library-1/item-FAIL");
  assert(partialWrites.some((entry) => entry.target.includes("item-OK")));

  const sourceMetadata = {
    enabled: true,
    item: { libraryID: 9, itemID: 90, itemKey: "SOURCE" },
    attachment: { attachmentID: 91, attachmentKey: "SOURCEATT", fileName: "source.docx" },
    trackedFile: { trackedRelativePath: "tracked/document.docx" },
    versions: [{
      id: "v1",
      commitHash: "abc123",
      shortHash: "abc123",
      fileName: "source.docx",
      trackedRelativePath: "tracked/document.docx",
      zotero: {
        libraryID: 9,
        itemID: 90,
        itemKey: "SOURCE",
        attachmentID: 91,
        attachmentKey: "SOURCEATT"
      }
    }]
  };
  const itemImportZip = makeStoredZip([
    {
      name: "export-manifest.json",
      text: JSON.stringify({
        schemaVersion: 1,
        plugin: "git4zotero",
        scope: "item",
        repositories: [{ repoRelativePath: "library-9/item-SOURCE" }]
      })
    },
    {
      name: "library-9/item-SOURCE/.git/config",
      text: "[core]\n"
    },
    {
      name: "library-9/item-SOURCE/.git4zotero/versions.json",
      text: JSON.stringify(sourceMetadata)
    }
  ]);
  const itemImportFiles = new Map();
  let itemImportEnsureIndexCalls = 0;
  const itemImportService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "F:/Profile/git4zotero",
      join: (...parts) => parts.join("/"),
      exists: async (target) => target === "F:/Profile/git4zotero",
      writeBytes: async (target, bytes) => {
        itemImportFiles.set(target, bytes);
      },
      openBinaryFile: async () => ({ path: "C:/backup/item.zip", bytes: itemImportZip })
    },
    cleanupService: { ensureIndex: async () => { itemImportEnsureIndexCalls += 1; } }
  });
  const itemImportRequest = {
    targetRepoRelativePath: "library-2/item-TARGET",
    targetRepoPath: "F:/Profile/git4zotero/library-2/item-TARGET",
    attachment: {
      libraryID: 2,
      itemID: 200,
      itemKey: "TARGET",
      attachmentID: 201,
      attachmentKey: "TARGETATT",
      fileName: "target.docx",
      extension: ".docx"
    }
  };
  const itemImportPreview = await itemImportService.prepareItemRepositoryArchiveImport(itemImportRequest);
  assert.equal(itemImportPreview.sourceFileName, "source.docx");
  assert.equal(itemImportPreview.versionCount, 1);
  assert.equal(itemImportPreview.targetFileName, "target.docx");
  assert.equal(itemImportPreview.targetRepoRelativePath, "library-2/item-TARGET");
  assert.equal(itemImportPreview.canImport, true);
  assert.equal(itemImportPreview.willSkip, false);
  assert.equal(itemImportPreview.compatibleFormat.extension, ".docx");
  const itemImportResult = await itemImportService.importItemRepositoryArchive({
    preparedImport: itemImportPreview
  });
  assert.deepEqual(itemImportResult.imported, ["library-2/item-TARGET"]);
  assert.equal(itemImportResult.sourceRepoRelativePath, "library-9/item-SOURCE");
  assert.equal(itemImportEnsureIndexCalls, 1);
  assert(itemImportFiles.has("F:/Profile/git4zotero/library-2/item-TARGET/.git/config"));
  assert(!itemImportFiles.has("F:/Profile/git4zotero/library-9/item-SOURCE/.git/config"));
  const rewrittenMetadata = JSON.parse(new TextDecoder().decode(itemImportFiles.get("F:/Profile/git4zotero/library-2/item-TARGET/.git4zotero/versions.json")));
  assert.equal(rewrittenMetadata.enabled, true);
  assert.equal(rewrittenMetadata.item.itemKey, "TARGET");
  assert.equal(rewrittenMetadata.attachment.attachmentKey, "TARGETATT");
  assert.equal(rewrittenMetadata.versions[0].zotero.itemKey, "TARGET");
  assert.equal(rewrittenMetadata.versions[0].zotero.attachmentKey, "TARGETATT");
  assert.equal(rewrittenMetadata.versions[0].fileName, "source.docx");

  const multiSourceZip = makeStoredZip([
    {
      name: "export-manifest.json",
      text: JSON.stringify({ schemaVersion: 1, plugin: "git4zotero", scope: "all" })
    },
    {
      name: "library-1/item-A/.git/config",
      text: "[core]\n"
    },
    {
      name: "library-1/item-A/.git4zotero/versions.json",
      text: JSON.stringify({ ...sourceMetadata, item: { itemKey: "A" }, attachment: { fileName: "a.docx" } })
    },
    {
      name: "library-1/item-B/.git/config",
      text: "[core]\n"
    },
    {
      name: "library-1/item-B/.git4zotero/versions.json",
      text: JSON.stringify({ ...sourceMetadata, item: { itemKey: "B" }, attachment: { fileName: "b.docx" } })
    }
  ]);
  const multiSourceFiles = new Map();
  const sourceSelections = [];
  const multiSourceService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "G:/Profile/git4zotero",
      join: (...parts) => parts.join("/"),
      exists: async (target) => target === "G:/Profile/git4zotero",
      writeBytes: async (target, bytes) => {
        multiSourceFiles.set(target, bytes);
      },
      openBinaryFile: async () => ({ path: "C:/backup/multi.zip", bytes: multiSourceZip })
    },
    cleanupService: { ensureIndex: async () => {} }
  });
  const multiSourceResult = await multiSourceService.importItemRepositoryArchive({
    targetRepoRelativePath: "library-3/item-TARGET",
    targetRepoPath: "G:/Profile/git4zotero/library-3/item-TARGET",
    attachment: {
      libraryID: 3,
      itemID: 300,
      itemKey: "TARGET",
      attachmentID: 301,
      attachmentKey: "TARGETATT",
      fileName: "target.docx",
      extension: ".docx"
    },
    selectSourceRepository: (_title, _message, labels, repoRelativePaths) => {
      sourceSelections.push({ labels, repoRelativePaths });
      return 1;
    }
  });
  assert.equal(sourceSelections.length, 1);
  assert.equal(multiSourceResult.sourceRepoRelativePath, "library-1/item-B");
  assert(multiSourceFiles.has("G:/Profile/git4zotero/library-3/item-TARGET/.git/config"));

  const existingTargetService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "H:/Profile/git4zotero",
      join: (...parts) => parts.join("/"),
      exists: async (target) => target === "H:/Profile/git4zotero/library-2/item-TARGET",
      writeBytes: async () => {
        throw new Error("existing target must not be overwritten");
      },
      openBinaryFile: async () => ({ path: "C:/backup/item.zip", bytes: itemImportZip })
    },
    cleanupService: { ensureIndex: async () => {} }
  });
  const existingTargetRequest = {
    targetRepoRelativePath: "library-2/item-TARGET",
    targetRepoPath: "H:/Profile/git4zotero/library-2/item-TARGET",
    attachment: {
      libraryID: 2,
      itemID: 200,
      itemKey: "TARGET",
      attachmentID: 201,
      attachmentKey: "TARGETATT",
      fileName: "target.docx",
      extension: ".docx"
    }
  };
  const existingTargetPreview = await existingTargetService.prepareItemRepositoryArchiveImport(existingTargetRequest);
  assert.equal(existingTargetPreview.willSkip, true);
  assert.equal(existingTargetPreview.canImport, false);
  assert.equal(existingTargetPreview.resultMessage, UI_TEXT.archiveImportPreviewWillSkipExisting);
  const existingTargetResult = await existingTargetService.importItemRepositoryArchive({
    preparedImport: existingTargetPreview
  });
  assert.equal(existingTargetResult.imported.length, 0);
  assert.equal(existingTargetResult.skipped[0].reason, UI_TEXT.archiveImportSkippedExisting);

  const missingMetadataZip = makeStoredZip([{
    name: "library-1/item-NO-META/.git/config",
    text: "[core]\n"
  }]);
  const missingMetadataService = new RepositoryArchiveService({
    platform: {
      getPluginDataDirectory: () => "I:/Profile/git4zotero",
      openBinaryFile: async () => ({ path: "C:/backup/missing-metadata.zip", bytes: missingMetadataZip })
    }
  });
  await assert.rejects(
    () => missingMetadataService.importItemRepositoryArchive({
      targetRepoRelativePath: "library-1/item-TARGET",
      targetRepoPath: "I:/Profile/git4zotero/library-1/item-TARGET",
      attachment: { fileName: "target.docx", extension: ".docx" }
    }),
    /元数据|metadata/i
  );
}

{
  const binary = new Uint8Array([1, 2, 3]);
  let pickedInitialDirectory = "unset";
  const defaultSavePlatform = Object.create(ZoteroPlatform.prototype);
  Object.assign(defaultSavePlatform, {
    Zotero: { debug() {} },
    getPluginDataDirectory: () => "C:/Profile/git4zotero",
    join: (...parts) => parts.join("/"),
    pickSavePath: async (_title, _defaultFileName, initialDirectory) => {
      pickedInitialDirectory = initialDirectory;
      return "C:/Chosen/git4zotero-backup.zip";
    },
    writeBytes: async () => {}
  });
  assert.equal(
    await defaultSavePlatform.saveBinaryFile({ defaultFileName: "git4zotero-backup.zip", bytes: binary }),
    "C:/Chosen/git4zotero-backup.zip"
  );
  assert.equal(pickedInitialDirectory, "");

  const configuredSavePlatform = Object.create(ZoteroPlatform.prototype);
  const configuredWrites = [];
  let configuredPickCalls = 0;
  Object.assign(configuredSavePlatform, {
    Zotero: { debug() {} },
    getPluginDataDirectory: () => "C:/Profile/git4zotero",
    join: (...parts) => parts.join("/"),
    exists: async (target) => target === "C:/Backup",
    isDirectory: async (target) => target === "C:/Backup",
    pickSavePath: async () => {
      configuredPickCalls += 1;
      throw new Error(UI_TEXT.saveDialogUnavailable);
    },
    writeBytes: async (target, bytes) => {
      configuredWrites.push({ target, bytes });
    }
  });
  assert.equal(
    await configuredSavePlatform.saveBinaryFile({
      defaultFileName: "git4zotero-backup.zip",
      bytes: binary,
      initialDirectory: "C:/Backup"
    }),
    "C:/Backup/git4zotero-backup.zip"
  );
  assert.equal(configuredPickCalls, 0);
  assert.equal(configuredWrites[0].target, "C:/Backup/git4zotero-backup.zip");

  const fallbackSavePlatform = Object.create(ZoteroPlatform.prototype);
  const fallbackWrites = [];
  Object.assign(fallbackSavePlatform, {
    Zotero: { debug() {} },
    getPluginDataDirectory: () => "C:/Profile/git4zotero",
    join: (...parts) => parts.join("/"),
    pickSavePath: async () => {
      throw new Error(UI_TEXT.saveDialogUnavailable);
    },
    writeBytes: async (target, bytes) => {
      fallbackWrites.push({ target, bytes });
    }
  });
  assert.equal(
    await fallbackSavePlatform.saveBinaryFile({
      defaultFileName: "git4zotero-backup.zip",
      bytes: binary
    }),
    "C:/Profile/git4zotero/exports/git4zotero-backup.zip"
  );
  assert.equal(fallbackWrites[0].target, "C:/Profile/git4zotero/exports/git4zotero-backup.zip");

  const invalidDirectoryPlatform = Object.create(ZoteroPlatform.prototype);
  let invalidPickCalls = 0;
  let invalidWriteCalls = 0;
  Object.assign(invalidDirectoryPlatform, {
    Zotero: { debug() {} },
    getPluginDataDirectory: () => "C:/Profile/git4zotero",
    join: (...parts) => parts.join("/"),
    exists: async () => false,
    isDirectory: async () => false,
    pickSavePath: async () => {
      invalidPickCalls += 1;
      return "unused";
    },
    writeBytes: async () => {
      invalidWriteCalls += 1;
    }
  });
  await assert.rejects(
    () => invalidDirectoryPlatform.saveBinaryFile({
      defaultFileName: "git4zotero-backup.zip",
      bytes: binary,
      initialDirectory: "C:/Missing"
    }),
    /迁移导出目录不可用/
  );
  assert.equal(invalidPickCalls, 0);
  assert.equal(invalidWriteCalls, 0);
}

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
  pluginVersion: "0.2.2",
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
  pluginVersion: "0.2.2"
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
  pluginVersion: "0.2.2"
});
const historyExport = await exportService.exportVersionSummary({}, {
  scope: "history",
  format: "markdown",
  initialDirectory: "D:/SummaryExports"
});
assert(historyExport.path.includes("git4zotero-history-ITEM"));
assert.equal(exportedFiles.at(-1).initialDirectory, "D:/SummaryExports");
assert(exportedFiles.at(-1).content.includes("# git4zotero 版本历史"));
assert(exportedFiles.at(-1).content.includes("Hash：0123abcd"));
assert(exportedFiles.at(-1).content.includes("位置摘要"));
assert(exportedFiles.at(-1).content.includes("引言 · 修改 1 段"));
const diffExport = await exportService.exportVersionSummary({}, { scope: "last-check", format: "text" });
assert(diffExport.path.endsWith(".txt"));
assert(exportedFiles.at(-1).content.includes("git4zotero 最近检查差异"));
assert(exportedFiles.at(-1).content.includes("引言 · 第 1 段"));
const singleVersionMarkdown = exportService.formatSingleVersionSummaryMarkdown({
  ...older,
  note: "导师反馈后修改",
  changeSummary: {
    summary: "正文内容已修改；修改 1 段。",
    paragraphChanges: [{ type: "modified", oldText: "旧讨论", newText: "新讨论", locationLabel: "讨论 · 第 1 段" }],
    totalParagraphChanges: 1
  }
});
assert(singleVersionMarkdown.includes("# git4zotero 单次版本修改摘要"));
assert(singleVersionMarkdown.includes("导师反馈后修改"));
assert(singleVersionMarkdown.includes("Hash：0123abcd"));
assert(singleVersionMarkdown.includes("讨论 · 第 1 段"));
const singleVersionExport = await exportService.exportSingleVersionSummary({
  ...older,
  note: "导师反馈后修改",
  fileName: "paper.docx",
  changeSummary: {
    summary: "正文内容已修改；修改 1 段。",
    paragraphChanges: [{ type: "modified", oldText: "旧讨论", newText: "新讨论", locationLabel: "讨论 · 第 1 段" }],
    totalParagraphChanges: 1
  }
}, { initialDirectory: "D:/SummaryExports" });
assert(singleVersionExport.path.includes("git4zotero-version-paper-0123abcd"));
assert.equal(exportedFiles.at(-1).title, UI_TEXT.versionDetailExport);
assert.equal(exportedFiles.at(-1).initialDirectory, "D:/SummaryExports");
assert(exportedFiles.at(-1).content.includes("# git4zotero 单次版本修改摘要"));
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
assert(historyPaneText.includes(UI_TEXT.versionDetailButton));

const detailLongText = "第二十五段完整修改内容 ".repeat(18) + "DETAIL_END";
const detailChanges = Array.from({ length: 25 }, (_value, index) => {
  if (index === 24) {
    return { type: "modified", oldText: "第二十五段旧内容", newText: detailLongText, oldIndex: 24, newIndex: 24, source: "document" };
  }
  if (index % 3 === 0) {
    return { type: "modified", oldText: `第 ${index + 1} 段旧内容`, newText: `第 ${index + 1} 段新内容`, oldIndex: index, newIndex: index, source: "document" };
  }
  if (index % 3 === 1) {
    return { type: "added", newText: `第 ${index + 1} 段新增内容`, newIndex: index, source: "document" };
  }
  return { type: "deleted", oldText: `第 ${index + 1} 段删除内容`, oldIndex: index, source: "document" };
});
const copiedVersionDetails = [];
const exportedVersionDetails = [];
const detailHarness = await renderPaneHarness({
  stateProvider: () => ({
    attachment: managedAttachment,
    enabled: true,
    git: { available: true, detail: "git version 2.44.0" },
    workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
    versions: [{
      ...older,
      id: "detail-version",
      note: "详情版本",
      commitHash: "0123456789abcdef0123456789abcdef01234567",
      shortHash: "01234567",
      changeSummary: {
        summary: "正文内容已修改；共 25 处修改。",
        paragraphChanges: detailChanges,
        totalParagraphChanges: 25,
        omittedChanges: 0
      }
    }]
  }),
  serviceOverrides: {
    formatSingleVersionSummaryMarkdown: (version) => {
      const content = `# git4zotero ${UI_TEXT.exportTitleSingleVersion}\n\n${version.note}\n${version.commitHash}\n${detailLongText}\n`;
      return content;
    },
    exportSingleVersionSummary: async (version, options = {}) => {
      exportedVersionDetails.push({ version, options });
      return { path: `${options.initialDirectory}\\${version.shortHash}.md` };
    }
  },
  platformOverrides: {
    getPref: (key, fallback) => key === PREFS.archiveExportDirectory ? "D:\\PaneExports" : fallback,
    copyTextToClipboard: (text) => copiedVersionDetails.push(text)
  }
});
assert(!detailHarness.body.textContent.includes("DETAIL_END"), "timeline preview should stay short");
assert.equal(findAllByClass(detailHarness.body, "git4zotero-version-detail-button").length, 1);
await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
let detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
assert(detailPanel, "history detail panel should open inside a timeline item");
assert.equal(detailPanel.getAttribute("role"), "region");
assert.equal(detailPanel.closest(".git4zotero-timeline-item") !== null, true);
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-backdrop"), null);
assert(detailPanel.textContent.includes(UI_TEXT.versionDetailTitle));
assert(detailPanel.textContent.includes("详情版本"));
assert(detailPanel.textContent.includes("0123456789abcdef0123456789abcdef01234567"));
assert(detailPanel.textContent.includes(UI_TEXT.versionDetailAllStoredChanges));
assert(detailPanel.textContent.includes(UI_TEXT.versionDetailCopy));
assert(detailPanel.textContent.includes(UI_TEXT.versionDetailExport));
assert.equal(findAllByClass(detailPanel, "git4zotero-change").length, 20);
assert(detailPanel.textContent.includes("第 1 段旧内容"));
assert(detailPanel.textContent.includes("第 2 段新增内容"));
assert(!detailPanel.textContent.includes("DETAIL_END"), "panel should defer very long stored change text");
assert(detailPanel.textContent.includes("暂未渲染"));
await findButton(detailPanel, UI_TEXT.versionDetailShowAll).click();
assert.equal(findAllByClass(detailPanel, "git4zotero-change").length, 25);
assert(detailPanel.textContent.includes("DETAIL_END"), "expanded panel should show full stored change text");
await findButton(detailPanel, UI_TEXT.versionDetailCollapse).click();
assert(!detailPanel.textContent.includes("DETAIL_END"), "collapsed panel should hide long tail again");
await findButton(detailPanel, UI_TEXT.versionDetailCopy).click();
assert.equal(copiedVersionDetails.length, 1);
assert(copiedVersionDetails[0].includes("DETAIL_END"));
assert(detailPanel.textContent.includes(UI_TEXT.versionDetailCopySuccess));
await findButton(detailPanel, UI_TEXT.versionDetailExport).click();
assert.equal(exportedVersionDetails.length, 1);
assert.equal(exportedVersionDetails[0].options.initialDirectory, "D:\\PaneExports");
assert(detailPanel.textContent.includes("D:\\PaneExports\\01234567.md"));
let detailCloseButton = findButton(detailPanel, UI_TEXT.versionDetailClose);
assert(detailPanel.getAttribute("style").includes("var(--git4zotero-detail-surface"));
assert(detailPanel.getAttribute("style").includes("pointer-events:auto"));
assert(!detailPanel.getAttribute("style").includes("position:fixed"));
assert(!detailPanel.getAttribute("style").includes("2147483647"));
assert(detailCloseButton.getAttribute("style").includes("pointer-events:auto"));
assert.equal(detailCloseButton.getAttribute("data-git4zotero-version-detail-close"), "true");
assert(detailCloseButton.getAttribute("style").includes("min-height:32px"));
assert(detailCloseButton.getAttribute("style").includes("touch-action:manipulation"));
for (const handler of detailCloseButton.listeners.get("pointerdown") ?? []) {
  await handler({
    target: detailCloseButton,
    preventDefault() {},
    stopPropagation() {}
  });
}
assert.equal(detailPanel.getAttribute("data-git4zotero-closing"), "true");
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);
await detailCloseButton.click();
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
detailCloseButton = findButton(detailPanel, UI_TEXT.versionDetailClose);
for (const handler of detailCloseButton.listeners.get("mousedown") ?? []) {
  await handler({
    target: detailCloseButton,
    preventDefault() {},
    stopPropagation() {}
  });
}
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
detailCloseButton = findButton(detailPanel, UI_TEXT.versionDetailClose);
await detailCloseButton.click();
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
detailCloseButton = findButton(detailPanel, UI_TEXT.versionDetailClose);
for (const handler of detailCloseButton.listeners.get("command") ?? []) {
  await handler({
    target: detailCloseButton,
    preventDefault() {},
    stopPropagation() {}
  });
}
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
detailCloseButton = findButton(detailPanel, UI_TEXT.versionDetailClose);
for (const handler of detailPanel.listeners.get("pointerdown") ?? []) {
  await handler({
    target: detailCloseButton,
    preventDefault() {},
    stopPropagation() {}
  });
}
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
detailCloseButton = findButton(detailPanel, UI_TEXT.versionDetailClose);
for (const handler of detailPanel.listeners.get("mousedown") ?? []) {
  await handler({
    target: detailCloseButton,
    preventDefault() {},
    stopPropagation() {}
  });
}
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
detailCloseButton = findButton(detailPanel, UI_TEXT.versionDetailClose);
for (const handler of detailPanel.listeners.get("command") ?? []) {
  await handler({
    target: detailCloseButton,
    preventDefault() {},
    stopPropagation() {}
  });
}
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

await findButton(detailHarness.body, UI_TEXT.versionDetailButton).click();
detailPanel = findByClass(detailHarness.body, "git4zotero-version-detail-panel");
for (const handler of detailPanel.listeners.get("keydown") ?? []) {
  await handler({
    key: "Escape",
    preventDefault() {},
    stopPropagation() {}
  });
}
assert.equal(findByClass(detailHarness.body, "git4zotero-version-detail-panel"), null);

const multiDetailHarness = await renderPaneHarness({
  stateProvider: () => ({
    attachment: managedAttachment,
    enabled: true,
    git: { available: true, detail: "git version 2.44.0" },
    workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
    versions: [
      { ...older, id: "first-detail", note: "第一条详情", shortHash: "first001" },
      { ...newer, id: "second-detail", note: "第二条详情", shortHash: "second02" }
    ]
  })
});
const detailButtons = findAllByClass(multiDetailHarness.body, "git4zotero-version-detail-button");
await detailButtons[0].click();
let openPanels = findAllByClass(multiDetailHarness.body, "git4zotero-version-detail-panel");
assert.equal(openPanels.length, 1);
assert(openPanels[0].textContent.includes("第一条详情"));
assert.equal(detailButtons[0].getAttribute("aria-expanded"), "true");
await detailButtons[1].click();
openPanels = findAllByClass(multiDetailHarness.body, "git4zotero-version-detail-panel");
assert.equal(openPanels.length, 1);
assert(openPanels[0].textContent.includes("第二条详情"));
assert.equal(detailButtons[0].getAttribute("aria-expanded"), "false");
assert.equal(detailButtons[1].getAttribute("aria-expanded"), "true");

const groupedDetailHarness = await renderPaneHarness({
  stateProvider: () => ({
    attachment: managedAttachment,
    enabled: true,
    git: { available: true, detail: "git version 2.44.0" },
    workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
    versions: [{
      ...older,
      id: "grouped-detail-version",
      note: "分组详情版本",
      changeSummary: {
        summary: "正文内容已修改。",
        changeGroups: [{
          label: "正文",
          summary: "正文 · 3 处变化",
          changes: [
            { type: "modified", oldText: "分组旧一", newText: "分组新一", oldIndex: 0, newIndex: 0, source: "document" },
            { type: "modified", oldText: "分组旧二", newText: "分组新二", oldIndex: 1, newIndex: 1, source: "document" },
            { type: "added", newText: "分组新增三", newIndex: 2, source: "document" }
          ]
        }],
        totalParagraphChanges: 3,
        omittedChanges: 0
      }
    }]
  })
});
await findButton(groupedDetailHarness.body, UI_TEXT.versionDetailButton).click();
const groupedPanel = findByClass(groupedDetailHarness.body, "git4zotero-version-detail-panel");
assert(groupedPanel.textContent.includes("正文 · 3 处变化"));
assert(groupedPanel.textContent.includes("分组新二"));
assert(groupedPanel.textContent.includes("分组新增三"));

const fileOnlyDetailHarness = await renderPaneHarness({
  stateProvider: () => ({
    attachment: { ...managedAttachment, fileName: "legacy.doc", extension: ".doc" },
    enabled: true,
    git: { available: true, detail: "git version 2.44.0" },
    workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
    versions: [{
      ...older,
      fileName: "legacy.doc",
      contentSummary: { mode: "file-only", extension: ".doc", fileOnly: true },
      changeSummary: { summary: UI_TEXT.docFileOnlyTracking }
    }]
  })
});
await findButton(fileOnlyDetailHarness.body, UI_TEXT.versionDetailButton).click();
const fileOnlyPanel = findByClass(fileOnlyDetailHarness.body, "git4zotero-version-detail-panel");
assert(fileOnlyPanel.textContent.includes(UI_TEXT.versionDetailFileOnly));
assert(fileOnlyPanel.textContent.includes(UI_TEXT.docFileOnlyTracking));

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
assert(timelineText.indexOf(UI_TEXT.versionHistory) < timelineText.lastIndexOf(UI_TEXT.lastCheck));
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
  assert.equal(findAllByClass(body, "git4zotero-status-card").length, 5);
  assert(body.textContent.includes(UI_TEXT.statusCardsTitle));
  assert(body.textContent.includes(UI_TEXT.stateGitAvailable));
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
  const section = doc.createElement("item-pane-custom-section");
  const header = doc.createElement("label");
  const staleIcon = doc.createElement("span");
  const body = doc.createElement("div");
  header.setAttribute("data-l10n-id", "git4zotero-item-pane-header");
  header.textContent = "版本管理";
  staleIcon.className = "git4zotero-pane-header-icon";
  staleIcon.setAttribute("class", "git4zotero-pane-header-icon");
  section.setAttribute("data-pane", actualPaneID);
  section.append(staleIcon, header, body);
  doc.documentElement.append(section);
  const pane = new PaperVersionPane({
    service: { getPanelState: async () => ({ attachment: null, enabled: false, versions: [] }) },
    platform: makePanePlatform()
  });
  pane.renderShell({ body, item: {}, paneID: actualPaneID, setSectionSummary: () => {} });
  pane.renderShell({ body, item: {}, paneID: actualPaneID, setSectionSummary: () => {} });
  const headerIcon = findByClass(section, "git4zotero-pane-header-icon");
  assert(headerIcon, "item pane header should receive plugin icon fallback");
  assert.equal(headerIcon.getAttribute("data-git4zotero-pane-header-icon"), "true");
  assert(String(header.className).split(/\s+/).includes("git4zotero-pane-header-label"));
  assert.equal(findAllByClass(section, "git4zotero-pane-header-icon").length, 1);
  assert.equal(header.childNodes[0], headerIcon);
  assert.equal(section.childNodes.includes(staleIcon), false);
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
    pluginVersion: "0.2.2",
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
    pluginVersion: "0.2.2",
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
  const previewService = new VersionService({
    platform: {
      getRepoPath: () => "repo",
      exists: async () => true,
      join: (...parts) => parts.join("/"),
      getPref: (_key, fallback) => fallback
    },
    attachmentFinder: {
      findManageableAttachment: async () => ({ ...managedAttachment, fileName: "paper.doc", filePath: "paper.doc", extension: ".doc" })
    },
    gitBackend: {
      checkAvailability: async () => ({ available: true, detail: "git version 2.44.0" }),
      getWorkingTreeStatus: async () => ({ clean: false, entries: [" M tracked/paper.doc"], summary: " M tracked/paper.doc" })
    },
    metadataStore: {
      read: async () => ({ ...createEmptyMetadata(), enabled: true, versions: [older] })
    },
    pluginVersion: "0.2.4",
    contentAnalyzer: {
      analyze: async () => ({
        fileHash: "doc-file",
        fileSize: 30,
        contentHash: null,
        contentSummary: { mode: "file-only", extension: ".doc" },
        contentSnapshot: null,
        changeSummary: { changeType: "file", summary: UI_TEXT.genericFileLevelSummary },
        shouldCreateVersion: true
      })
    }
  });
  const preview = await previewService.buildCreateVersionPreview({});
  assert.equal(preview.trackingMode, UI_TEXT.contentModeFileOnly);
  assert.equal(preview.attachment.extension, ".doc");
  assert.equal(preview.workingTree.clean, false);
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
    pluginVersion: "0.2.2",
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
  const preflight = await restoreService.buildRestorePreflight({}, older, { stamp: "fixed-stamp" });
  assert.equal(preflight.ok, true);
  assert(preflight.backupPath.includes("fixed-stamp-current-paper.docx"));
  assert(preflight.checks.some((check) => check.id === "backup-path"));
  const result = await restoreService.restoreVersion({}, older, { preflight });
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
    pluginVersion: "0.2.2"
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
        calls.push(["export", selected, options.scope, options.format, options.initialDirectory]);
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
      getPref: (key, fallback) => key === PREFS.archiveExportDirectory ? "D:\\SummaryExports" : fallback,
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
  assert.equal(rootMenu.menus.length, 9);
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
  assert.deepEqual(menuVisibility, [true, true, true, true, true, true, true, false, true]);
  assert.deepEqual(menuEnabled, [false, true, true, true, true, false, true, false, true]);
  assert.equal(menuStateCalls, 1);
  await rootMenu.menus[0].onCommand({}, { items: [item] });
  await rootMenu.menus[1].onCommand({}, { items: [item] });
  await rootMenu.menus[2].onCommand({}, { items: [item] });
  await rootMenu.menus[3].onCommand({}, { items: [item] });
  await rootMenu.menus[4].onCommand({}, { items: [item] });
  await rootMenu.menus[8].onCommand({}, { items: [item] });
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
  assert.equal(exportCall[4], "D:\\SummaryExports");
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
  assert.equal(fallbackPopup.children.length, 8);
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
  assert.deepEqual(gitMissingVisibility, [true, true, true, true, true, true, true, true, true]);
  assert.deepEqual(gitMissingEnabled, [false, false, false, false, false, false, true, true, true]);
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
  const item = { id: 1 };
  let exportArchiveOptions = null;
  let importArchiveOptions = null;
  let committedPreparedImport = null;
  const importPreviewConfirms = [];
  const harness = makeMenuHarness({
    serviceOverrides: {
      getPanelState: async () => ({
        attachment: managedAttachment,
        repoPath: "C:\\Profile\\git4zotero\\library-1\\item-ITEM",
        enabled: true,
        git: { available: false, detail: "git missing" },
        versions: []
      })
    },
    archiveServiceOverrides: {
      exportItemRepositoryArchive: async (options = {}) => {
        exportArchiveOptions = options;
        return { path: "D:\\ArchiveDir\\git4zotero-ITEM-history.zip", fileCount: 4 };
      },
      prepareItemRepositoryArchiveImport: async (options = {}) => {
        importArchiveOptions = options;
        return {
          sourceRepoRelativePath: "library-9/item-SOURCE",
          sourceFileName: "source.docx",
          versionCount: 2,
          latestVersionAt: "2026-01-02T00:00:00.000Z",
          targetRepoRelativePath: "library-1/item-ITEM",
          targetFileName: "paper.docx",
          compatibleFormat: { extension: ".docx", supportsContentDiff: true },
          willSkip: false,
          canImport: true,
          resultMessage: UI_TEXT.archiveImportPreviewWillImport
        };
      },
      commitItemRepositoryArchiveImport: async (preparedImport = {}) => {
        committedPreparedImport = preparedImport;
        return {
          imported: ["library-1/item-ITEM"],
          skipped: [],
          failed: [],
          sourceRepoRelativePath: "library-9/item-SOURCE",
          targetRepoRelativePath: "library-1/item-ITEM"
        };
      }
    },
    platformOverrides: {
      exists: async (path) => path === "C:\\Profile\\git4zotero\\library-1\\item-ITEM",
      getPref: (key, fallback) => key === PREFS.archiveExportDirectory ? "D:\\ArchiveDir" : fallback,
      confirm: (title, message) => {
        importPreviewConfirms.push({ title, message });
        return true;
      }
    }
  });
  harness.menu.register({ id: "git4zotero@paper-version.local", rootURI: "chrome://git4zotero/content/" });
  const rootMenu = harness.registered.menus[0];
  const enabled = [];
  for (const itemMenu of rootMenu.menus) {
    await itemMenu.onShowing({}, {
      items: [item],
      setEnabled: (value) => {
        enabled.push(value);
      }
    });
  }
  assert.equal(enabled[5], true, "item archive export should not require Git availability");
  assert.equal(enabled[6], true, "item archive import should not require Git availability");
  await rootMenu.menus[5].onCommand({}, { items: [item] });
  assert.equal(exportArchiveOptions.repoRelativePath, "library-1/item-ITEM");
  assert.equal(exportArchiveOptions.initialDirectory, "D:\\ArchiveDir");
  assert(harness.alerts.at(-1)[1].includes("D:\\ArchiveDir\\git4zotero-ITEM-history.zip"));
  await rootMenu.menus[6].onCommand({}, { items: [item] });
  assert.equal(importArchiveOptions.targetRepoRelativePath, "library-1/item-ITEM");
  assert.equal(typeof importArchiveOptions.selectSourceRepository, "function");
  assert.equal(importPreviewConfirms.at(-1).title, UI_TEXT.archiveImportPreviewTitle);
  assert(importPreviewConfirms.at(-1).message.includes("source.docx"));
  assert.equal(committedPreparedImport.sourceRepoRelativePath, "library-9/item-SOURCE");
  assert(harness.alerts.at(-1)[1].includes("library-9/item-SOURCE"));
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
  assert.equal(classifyError(new Error(UI_TEXT.menuMultiSelectUnsupported)).category, ERROR_CATEGORIES.userActionable);
  assert.equal(classifyError(new Error(UI_TEXT.gitPathNotFound)).category, ERROR_CATEGORIES.git);
  assert.equal(classifyError(new Error(UI_TEXT.restorePreflightUnwritable)).category, ERROR_CATEGORIES.fileState);
  assert.equal(classifyError(new Error("Unexpected metadata shape")).category, ERROR_CATEGORIES.internal);

  const prefs = new Map();
  const diagnosticPlatform = {
    Zotero: {
      locale: "zh-CN",
      getActiveZoteroPane: () => ({ getSelectedItems: () => [] }),
      debug() {}
    },
    getPref: (key, fallback = "") => prefs.get(key) ?? fallback,
    setPref: (key, value) => prefs.set(key, value),
    redactPath: (value) => String(value ?? "").replace(/C:\\Users\\Tester/gi, "<HOME>"),
    checkGitAvailability: async () => ({
      available: true,
      command: "C:\\Users\\Tester\\Git\\cmd\\git.exe",
      version: "git version 2.44.0",
      detail: "git version 2.44.0"
    }),
    getGitExecutable: () => "C:\\Users\\Tester\\Git\\cmd\\git.exe",
    getPluginDataDirectory: () => "C:\\Users\\Tester\\Zotero\\git4zotero",
    getPluginVersion: () => "0.2.2",
    getAppVersion: () => "8.0-test",
    getSystemInfo: () => "OS=WINNT",
    getLocale: () => "zh-CN",
    makeDirectory: async () => {},
    writeTempProbeFile: async () => "C:\\Users\\Tester\\Zotero\\git4zotero\\git4zotero-diagnostic-write-test.txt",
    exists: async (target) => target === "C:\\Users\\Tester\\Zotero\\git4zotero",
    listDirectory: async () => [],
    readText: async () => "",
    join: (...parts) => parts.join("\\")
  };
  const lastErrorStore = new LastErrorStore(diagnosticPlatform);
  const stored = lastErrorStore.write(new Error(UI_TEXT.gitUnavailableDetail), { operation: "test Git" });
  assert.equal(stored.category, ERROR_CATEGORIES.git);
  assert.equal(new LastErrorStore(diagnosticPlatform).read().operation, "test Git");
  prefs.set(PREFS.lastError, "{broken");
  assert.equal(new LastErrorStore(diagnosticPlatform).read(), null);
  recordLastError(diagnosticPlatform, new Error("file is not writable"), { operation: "restore" });
  assert.equal(JSON.parse(prefs.get(PREFS.lastError)).category, ERROR_CATEGORIES.fileState);

  const diagnostics = new DiagnosticService({
    platform: diagnosticPlatform,
    cleanupService: {
      scanOrphanRepositories: async () => ({ count: 0, repositories: [], skipped: [] })
    },
    metadataStore: {
      getMetadataPath: (repoPath) => `${repoPath}\\.git4zotero\\versions.json`
    },
    pluginVersion: "0.2.2"
  });
  const report = await diagnostics.buildReport();
  assert(report.includes("Plugin version: 0.2.2"));
  assert(report.includes("<HOME>\\Git\\cmd\\git.exe"));
  assert(!report.includes("C:\\Users\\Tester"));
  const issueTemplate = await diagnostics.buildIssueTemplate();
  assert(issueTemplate.includes("## 复现步骤"));
  assert(issueTemplate.includes("```text"));
  assert(!issueTemplate.includes("C:\\Users\\Tester"));
  const health = await diagnostics.runHealthCheck();
  assert.equal(health.errorCount, 0);
  assert.equal(health.checks.find((check) => check.id === "write-permission").status, "ok");
  assert.equal(health.checks.find((check) => check.id === "repository-consistency").status, "ok");
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

  const candidatePrefs = await runPreferencesScript();
  const candidateWindow = candidatePrefs.context.window.Git4ZoteroPreferences;
  let candidateSelectionShown = false;
  candidateWindow.getPlatform = () => ({
    listGitExecutableCandidates: async () => [
      { command: "C:\\GitA\\cmd\\git.exe", version: "git version A" },
      { command: "C:\\GitB\\cmd\\git.exe", version: "git version B" }
    ],
    selectFromList: (title, message, options) => {
      candidateSelectionShown = true;
      assert.equal(title, "选择 Git 可执行文件");
      assert(message.includes("多个可用 Git"));
      assert(options[0].includes("C:\\GitA\\cmd\\git.exe"));
      assert(options[1].includes("C:\\GitB\\cmd\\git.exe"));
      return 1;
    },
    checkGitAvailability: async (value, options = {}) => {
      assert.equal(value, "C:\\GitB\\cmd\\git.exe");
      assert.equal(options.persist, true);
      candidatePrefs.prefs.set(PREFS.gitPath, value);
      return { available: true, command: value, version: "git version B", detail: "git version B" };
    }
  });
  await candidateWindow.testGit();
  assert.equal(candidateSelectionShown, true);
  assert.equal(candidatePrefs.prefs.get(PREFS.gitPath), "C:\\GitB\\cmd\\git.exe");
  assert.equal(candidatePrefs.elements["git4zotero-git-path"].value, "C:\\GitB\\cmd\\git.exe");

  const manualCandidatePrefs = await runPreferencesScript();
  const manualCandidateWindow = manualCandidatePrefs.context.window.Git4ZoteroPreferences;
  manualCandidatePrefs.elements["git4zotero-git-path"].value = "C:\\Manual\\git.exe";
  let manualCandidateLookupCalled = false;
  manualCandidateWindow.getPlatform = () => ({
    listGitExecutableCandidates: async () => {
      manualCandidateLookupCalled = true;
      return [];
    },
    checkGitAvailability: async (value) => {
      assert.equal(value, "C:\\Manual\\git.exe");
      return { available: true, command: value, version: "git version manual", detail: "git version manual" };
    }
  });
  await manualCandidateWindow.testGit();
  assert.equal(manualCandidateLookupCalled, false);

  const savedPrefs = await runPreferencesScript({
    prefValue: "C:\\Saved\\Git\\cmd\\git.exe"
  });
  assert.equal(savedPrefs.elements["git4zotero-git-path"].value, "C:\\Saved\\Git\\cmd\\git.exe");
  assert.equal(savedPrefs.elements["git4zotero-current-git"].textContent, "C:\\Saved\\Git\\cmd\\git.exe");

  const archivePathPrefs = await runPreferencesScript({
    archiveExportDirectory: "D:\\MigrationBackups"
  });
  const archivePathWindow = archivePathPrefs.context.window.Git4ZoteroPreferences;
  assert.equal(archivePathPrefs.elements["git4zotero-archive-export-directory"].value, "D:\\MigrationBackups");
  assert.equal(archivePathPrefs.elements["git4zotero-current-archive-export-directory"].textContent, "D:\\MigrationBackups");
  const chosenDirectoriesChecked = [];
  archivePathWindow.getPlatform = () => ({
    pickDirectory: async () => {
      throw new Error("modeGetFolder should not be used by preferences");
    },
    pickDirectoryViaSaveDialog: async () => "D:\\ChosenBackups",
    assertDirectoryAvailable: async (path) => {
      chosenDirectoriesChecked.push(path);
    }
  });
  await archivePathWindow.chooseArchiveExportDirectory();
  assert.equal(archivePathPrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\ChosenBackups");
  assert.equal(archivePathPrefs.elements["git4zotero-archive-export-directory"].value, "D:\\ChosenBackups");
  assert.deepEqual(chosenDirectoriesChecked, ["D:\\ChosenBackups"]);
  assert(archivePathPrefs.elements["git4zotero-archive-status"].textContent.includes("迁移导出目录已保存"));
  archivePathWindow.getPlatform = () => ({
    pickDirectory: async () => {
      throw new Error("modeGetFolder should not be used by preferences");
    },
    pickDirectoryViaSaveDialog: async () => null,
    assertDirectoryAvailable: async () => {}
  });
  await archivePathWindow.chooseArchiveExportDirectory();
  assert.equal(archivePathPrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\ChosenBackups");
  assert.equal(archivePathPrefs.elements["git4zotero-archive-export-directory"].value, "D:\\ChosenBackups");
  assert(archivePathPrefs.elements["git4zotero-archive-status"].textContent.includes("已取消操作"));
  archivePathWindow.getPlatform = () => ({
    pickDirectory: async () => {
      throw new Error("modeGetFolder should not be used by preferences");
    },
    pickDirectoryViaSaveDialog: async () => {
      throw new Error("Component returned failure code: 0x80070057 (NS_ERROR_ILLEGAL_VALUE) [nsIFilePicker.init]");
    },
    assertDirectoryAvailable: async () => {}
  });
  await archivePathWindow.chooseArchiveExportDirectory();
  assert.equal(archivePathPrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\ChosenBackups");
  assert.equal(archivePathPrefs.elements["git4zotero-archive-export-directory"].value, "D:\\ChosenBackups");
  assert(archivePathPrefs.elements["git4zotero-archive-status"].textContent.includes("选择迁移导出目录失败"));
  assert(!archivePathPrefs.elements["git4zotero-archive-status"].textContent.includes("导出版本历史失败"));
  const archiveDirectoryInput = archivePathPrefs.elements["git4zotero-archive-export-directory"];
  assert.equal(typeof archiveDirectoryInput.listeners.change, "function");
  assert.equal(typeof archiveDirectoryInput.listeners.blur, "function");
  assert.equal(typeof archiveDirectoryInput.listeners.keydown, "function");
  const manualDirectoriesChecked = [];
  archiveDirectoryInput.value = "D:\\ManualBackups";
  archivePathWindow.getPlatform = () => ({
    assertDirectoryAvailable: async (path) => {
      manualDirectoriesChecked.push(path);
    }
  });
  await archiveDirectoryInput.listeners.change({ type: "change", target: archiveDirectoryInput });
  assert.equal(archivePathPrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\ManualBackups");
  assert.equal(archiveDirectoryInput.value, "D:\\ManualBackups");
  assert.equal(archivePathPrefs.elements["git4zotero-current-archive-export-directory"].textContent, "D:\\ManualBackups");
  assert.deepEqual(manualDirectoriesChecked, ["D:\\ManualBackups"]);
  archiveDirectoryInput.value = "D:\\Missing";
  archivePathWindow.getPlatform = () => ({
    assertDirectoryAvailable: async () => {
      throw new Error("missing directory");
    }
  });
  await archiveDirectoryInput.listeners.blur({ type: "blur", target: archiveDirectoryInput });
  assert.equal(archivePathPrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\ManualBackups");
  assert.equal(archiveDirectoryInput.value, "D:\\Missing");
  assert.equal(archivePathPrefs.elements["git4zotero-current-archive-export-directory"].textContent, "D:\\ManualBackups");
  assert(archivePathPrefs.elements["git4zotero-archive-status"].textContent.includes("missing directory"));
  assert.equal(await archivePathWindow.savePendingArchiveExportDirectory(), false);
  assert(archivePathPrefs.elements["git4zotero-archive-status"].textContent.includes("missing directory"));
  let emptyInputValidated = false;
  archiveDirectoryInput.value = "";
  archivePathWindow.getPlatform = () => ({
    assertDirectoryAvailable: async () => {
      emptyInputValidated = true;
    }
  });
  let enterPrevented = false;
  let enterStopped = false;
  await archiveDirectoryInput.listeners.keydown({
    type: "keydown",
    key: "Enter",
    target: archiveDirectoryInput,
    preventDefault: () => {
      enterPrevented = true;
    },
    stopPropagation: () => {
      enterStopped = true;
    }
  });
  assert.equal(enterPrevented, true);
  assert.equal(enterStopped, true);
  assert.equal(emptyInputValidated, false);
  assert.equal(archivePathPrefs.prefs.get(PREFS.archiveExportDirectory), "");
  assert.equal(archiveDirectoryInput.value, "");
  assert(archivePathPrefs.elements["git4zotero-current-archive-export-directory"].textContent.includes("可粘贴目录路径"));
  archiveDirectoryInput.value = "D:\\ManualBackups";
  archivePathPrefs.prefs.set(PREFS.archiveExportDirectory, "D:\\ManualBackups");
  archivePathWindow.clearArchiveExportDirectory();
  assert.equal(archivePathPrefs.prefs.get(PREFS.archiveExportDirectory), "");
  assert.equal(archivePathPrefs.elements["git4zotero-archive-export-directory"].value, "");
  assert(archivePathPrefs.elements["git4zotero-current-archive-export-directory"].textContent.includes("可粘贴目录路径"));

  const delayedPreferenceWritePrefs = await runPreferencesScript({
    archiveExportDirectory: "D:\\OldDisplay"
  });
  const delayedPreferenceWriteWindow = delayedPreferenceWritePrefs.context.window.Git4ZoteroPreferences;
  const delayedPreferenceWrites = [];
  delayedPreferenceWritePrefs.context.Zotero.Prefs.set = (key, value) => {
    delayedPreferenceWrites.push([key, value]);
  };
  const delayedArchiveDirectoryInput = delayedPreferenceWritePrefs.elements["git4zotero-archive-export-directory"];
  delayedArchiveDirectoryInput.value = "D:\\ImmediateDisplay";
  delayedPreferenceWriteWindow.getPlatform = () => ({
    assertDirectoryAvailable: async () => {}
  });
  await delayedArchiveDirectoryInput.listeners.change({ type: "change", target: delayedArchiveDirectoryInput });
  assert.deepEqual(delayedPreferenceWrites, [[PREFS.archiveExportDirectory, "D:\\ImmediateDisplay"]]);
  assert.equal(delayedPreferenceWritePrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\OldDisplay");
  assert.equal(delayedArchiveDirectoryInput.value, "D:\\ImmediateDisplay");
  assert.equal(delayedPreferenceWritePrefs.elements["git4zotero-current-archive-export-directory"].textContent, "D:\\ImmediateDisplay");
  delayedArchiveDirectoryInput.value = "D:\\UnsavedAfterSave";
  assert.equal(await delayedPreferenceWriteWindow.savePendingArchiveExportDirectory(), true);
  assert.deepEqual(delayedPreferenceWrites, [
    [PREFS.archiveExportDirectory, "D:\\ImmediateDisplay"],
    [PREFS.archiveExportDirectory, "D:\\UnsavedAfterSave"]
  ]);
  assert.equal(delayedPreferenceWritePrefs.elements["git4zotero-current-archive-export-directory"].textContent, "D:\\UnsavedAfterSave");

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

  const orphanPrefs = await runPreferencesScript();
  const prefWindow = orphanPrefs.context.window.Git4ZoteroPreferences;
  let cleanupCalled = false;
  prefWindow.cleanupService = {
    scanOrphanRepositories: async () => ({
      count: 1,
      repositories: [{ repoRelativePath: "library-1/item-MISSING" }],
      skipped: []
    }),
    cleanupOrphanRepositories: async () => {
      cleanupCalled = true;
      return { cleaned: [{ path: "repo" }], skipped: [] };
    }
  };
  prefWindow.getPlatform = () => ({ confirm: () => true });
  await prefWindow.checkOrphanHistory();
  assert(orphanPrefs.elements["git4zotero-orphan-status"].textContent.includes("发现 1 个已删除条目留下的版本历史"));
  assert.equal(orphanPrefs.elements["git4zotero-check-orphans"].disabled, false);
  await prefWindow.cleanupOrphanHistory();
  assert.equal(cleanupCalled, true);
  assert(orphanPrefs.elements["git4zotero-orphan-status"].textContent.includes("已清理 1 个已删除条目的版本历史"));

  const diagnosticsPrefs = await runPreferencesScript({
    autoGitPath: "C:\\Program Files\\Git\\cmd\\git.exe",
    subprocessResult: { exitCode: 0, stdout: "git version 2.44.0\n", stderr: "" }
  });
  const diagnosticsWindow = diagnosticsPrefs.context.window.Git4ZoteroPreferences;
  await diagnosticsWindow.copyDiagnostics();
  assert(diagnosticsPrefs.elements["git4zotero-diagnostics-status"].textContent.includes("无法写入剪贴板"));
  assert(diagnosticsPrefs.elements["git4zotero-diagnostics-output"].textContent.includes("git4zotero Diagnostics"));
  await diagnosticsWindow.runHealthCheck();
  assert(diagnosticsPrefs.elements["git4zotero-health-status"].textContent.includes("健康检查完成"));
  assert(diagnosticsPrefs.elements["git4zotero-health-status"].textContent.includes("测试 Git"));
  assert(diagnosticsPrefs.elements["git4zotero-health-status"].textContent.includes("检查 Git/index/metadata 一致性"));
  assert(diagnosticsPrefs.elements["git4zotero-health-status"].textContent.includes("下一步建议"));
  assert(diagnosticsPrefs.elements["git4zotero-health-status"].textContent.includes("健康检查不会自动修复或清理历史"));
  await diagnosticsWindow.openFirstUseGuide();
  assert.equal(diagnosticsPrefs.elements["git4zotero-first-use-dialog"].hidden, false);
  assert.equal(diagnosticsPrefs.elements["git4zotero-first-use-output"].hidden, true);
  assert.equal(diagnosticsPrefs.elements["git4zotero-guide-step-title"].textContent, "Git 准备");
  assert(diagnosticsPrefs.elements["git4zotero-guide-step-detail"].textContent.includes("Git 可用"));
  await diagnosticsWindow.showFirstUseGuideStep(1);
  assert.equal(diagnosticsPrefs.elements["git4zotero-guide-step-title"].textContent, "数据目录");
  assert.equal(diagnosticsPrefs.elements["git4zotero-guide-prev"].disabled, false);
  diagnosticsWindow.closeFirstUseGuide();
  assert.equal(diagnosticsPrefs.elements["git4zotero-first-use-dialog"].hidden, true);
  await diagnosticsWindow.copyIssueTemplate();
  assert(diagnosticsPrefs.elements["git4zotero-diagnostics-output"].textContent.includes("## 复现步骤"));
  diagnosticsPrefs.prefs.set(PREFS.archiveExportDirectory, "D:\\ArchiveTarget");
  diagnosticsWindow.refreshArchiveExportDirectory();
  diagnosticsPrefs.elements["git4zotero-archive-export-directory"].value = "D:\\PendingExport";
  diagnosticsWindow.getPlatform = () => ({
    assertDirectoryAvailable: async () => {}
  });
  assert.equal(await diagnosticsWindow.savePendingArchiveExportDirectory(), true);
  assert.equal(diagnosticsPrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\PendingExport");
  assert(diagnosticsPrefs.elements["git4zotero-archive-status"].textContent.includes("迁移导出目录已保存"));
  assert.equal(diagnosticsPrefs.elements["git4zotero-copy-diagnostics"].disabled, false);
}

{
  const guidePrefs = await runPreferencesScript({
    subprocessResult: { exitCode: 0, stdout: "git version 2.44.0\n", stderr: "" }
  });
  const guideWindow = guidePrefs.context.window.Git4ZoteroPreferences;
  const platformActions = [];
  let archiveExportInitialDirectory = null;
  for (const staticButtonID of [
    "git4zotero-test-git",
    "git4zotero-check-orphans",
    "git4zotero-clean-orphans",
    "git4zotero-copy-diagnostics",
    "git4zotero-run-health-check",
    "git4zotero-first-use-guide",
    "git4zotero-open-data-dir",
    "git4zotero-copy-issue-template",
    "git4zotero-open-git-guide",
    "git4zotero-choose-archive-export-directory",
    "git4zotero-clear-archive-export-directory",
    "git4zotero-about-homepage",
    "git4zotero-about-github",
    "git4zotero-about-feedback",
    "git4zotero-about-qa"
  ]) {
    assert.equal(guidePrefs.elements[staticButtonID].listeners.click, undefined, `${staticButtonID} must rely on its inline onclick handler`);
  }
  assert.equal(typeof guidePrefs.elements["git4zotero-guide-primary-action"].listeners.click, "function");
  guideWindow.getPlatform = () => ({
    assertDirectoryAvailable: async (path) => {
      if (path === "D:\\Missing") {
        throw new Error("missing directory");
      }
    },
    checkGitAvailability: async (_value, options = {}) => {
      if (options.persist) {
        guidePrefs.prefs.set(PREFS.gitPath, "C:\\Git\\cmd\\git.exe");
      }
      return {
        available: true,
        command: "C:\\Git\\cmd\\git.exe",
        detail: "git version 2.44.0",
        version: "git version 2.44.0"
      };
    },
    copyTextToClipboard: (text) => platformActions.push(["copy", String(text).slice(0, 20)]),
    getPluginDataDirectory: () => "C:\\ZoteroProfile\\git4zotero",
    makeDirectory: async (path) => platformActions.push(["makeDirectory", path]),
    openPath: (path) => platformActions.push(["openPath", path]),
    openURL: (url) => platformActions.push(["openURL", url]),
    pickDirectory: async () => {
      throw new Error("modeGetFolder should not be used by preferences");
    },
    pickDirectoryViaSaveDialog: async () => "D:\\GuideExports",
    writeTempProbeFile: async () => "C:\\ZoteroProfile\\git4zotero\\git4zotero-diagnostic-write-test.txt"
  });
  guideWindow.diagnosticService = {
    buildIssueTemplate: async () => "## 复现步骤\n- Step",
    buildReport: async () => "git4zotero Diagnostics\nPlugin version: 0.2.5",
    runHealthCheck: async () => ({
      checks: [{ label: "测试 Git", status: "ok", detail: "git version 2.44.0" }],
      errorCount: 0,
      okCount: 1,
      skippedCount: 0,
      warningCount: 0
    })
  };
  guideWindow.openGitGuide();
  assert.equal(platformActions.filter((action) => action[0] === "openURL").length, 1);

  await guideWindow.openFirstUseGuide();
  assert.equal(guidePrefs.elements["git4zotero-first-use-dialog"].hidden, false);
  assert.equal(guidePrefs.elements["git4zotero-guide-step-title"].textContent, "Git 准备");
  assert(!guidePrefs.elements["git4zotero-guide-step-list"].textContent.includes("论文条目"));
  assert(!guidePrefs.elements["git4zotero-guide-step-list"].textContent.includes("Manuscript Item"));
  assert.equal(guideWindow.guideStepStates.item, undefined);
  const guideActionIDs = new Set();
  for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
    await guideWindow.showFirstUseGuideStep(stepIndex);
    for (const buttonID of [
      "git4zotero-guide-primary-action",
      "git4zotero-guide-secondary-action",
      "git4zotero-guide-tertiary-action"
    ]) {
      const actionID = guidePrefs.elements[buttonID].dataset.action;
      if (actionID) {
        guideActionIDs.add(actionID);
      }
    }
  }
  assert(!guideActionIDs.has("refresh-item-selection"));
  assert(!guideActionIDs.has("export-history-archive"));
  await guideWindow.showFirstUseGuideStep(0);
  assert.equal(guideWindow.guideStepStates.git.status, "ok");
  await guideWindow.runFirstUseGuideAction("test-git");
  assert(guidePrefs.elements["git4zotero-git-status"].textContent.includes("Git 可用"));
  assert.equal(guideWindow.guideStepStates.git.status, "ok");
  assert.equal(guidePrefs.prefs.get(PREFS.gitPath), "C:\\Git\\cmd\\git.exe");

  await guideWindow.runFirstUseGuideAction("open-git-guide");
  assert.equal(platformActions.filter((action) => action[0] === "openURL").length, 2);
  assert(platformActions.some((action) => action[0] === "openURL" && action[1].includes("GIT-INSTALL-zh.md")));

  const projectLinks = [
    ["homepage", "https://github.com/LiKa-shing/"],
    ["github", "https://github.com/LiKa-shing/git4zotero"],
    ["feedback", "https://github.com/LiKa-shing/git4zotero/issues"],
    ["qa", "https://github.com/LiKa-shing/git4zotero/issues"]
  ];
  for (const [linkID, expectedURL] of projectLinks) {
    guideWindow.openProjectLink(linkID);
    assert(platformActions.some((action) => action[0] === "openURL" && action[1] === expectedURL), `${linkID} must open ${expectedURL}`);
  }
  assert(guidePrefs.elements["git4zotero-about-status"].textContent.includes("已打开项目链接"));
  assert.equal(guidePrefs.elements["git4zotero-about-status"].hidden, false);
  const openURLCountAfterProjectLinks = platformActions.filter((action) => action[0] === "openURL").length;
  guideWindow.openProjectLink("missing");
  assert.equal(platformActions.filter((action) => action[0] === "openURL").length, openURLCountAfterProjectLinks);
  assert(guidePrefs.elements["git4zotero-about-status"].textContent.includes("未知的项目链接"));
  guideWindow.openProjectLink();
  assert.equal(platformActions.filter((action) => action[0] === "openURL").length, openURLCountAfterProjectLinks);
  assert(guidePrefs.elements["git4zotero-about-status"].textContent.includes("未知的项目链接"));

  await guideWindow.showFirstUseGuideStep(1);
  assert.equal(guidePrefs.elements["git4zotero-guide-step-title"].textContent, "数据目录");
  await guideWindow.runFirstUseGuideAction("open-data-directory");
  assert(platformActions.some((action) => action[0] === "openPath" && action[1] === "C:\\ZoteroProfile\\git4zotero"));
  await guideWindow.runFirstUseGuideAction("check-write-permission");
  assert(guideWindow.guideStepStates.data.detail.includes("写权限正常"));

  await guideWindow.showFirstUseGuideStep(2);
  assert.equal(guidePrefs.elements["git4zotero-guide-step-title"].textContent, "迁移备份");
  assert.equal(guideWindow.guideStepStates.archive.status, "warning");
  await guideWindow.runFirstUseGuideAction("choose-archive-directory");
  assert.equal(guidePrefs.prefs.get(PREFS.archiveExportDirectory), "D:\\GuideExports");
  assert.equal(guideWindow.guideStepStates.archive.status, "ok");
  guidePrefs.prefs.set(PREFS.archiveExportDirectory, "D:\\Missing");
  guideWindow.refreshArchiveExportDirectory();
  await guideWindow.refreshGuideArchiveState();
  assert.equal(guideWindow.guideStepStates.archive.status, "error");
  await guideWindow.runFirstUseGuideAction("clear-archive-directory");
  assert.equal(guidePrefs.prefs.get(PREFS.archiveExportDirectory), "");

  await guideWindow.showFirstUseGuideStep(3);
  assert.equal(guidePrefs.elements["git4zotero-guide-step-title"].textContent, "排错准备");
  assert.equal(guidePrefs.elements["git4zotero-guide-next"].hidden, true);
  assert.equal(guidePrefs.elements["git4zotero-guide-done"].hidden, false);
  await guideWindow.runFirstUseGuideAction("run-health-check");
  assert.equal(guideWindow.guideStepStates.troubleshooting.status, "ok");
  await guideWindow.runFirstUseGuideAction("copy-diagnostics");
  assert(guidePrefs.elements["git4zotero-diagnostics-status"].textContent.includes("诊断信息已复制"));
  await guideWindow.runFirstUseGuideAction("copy-issue-template");
  assert(guidePrefs.elements["git4zotero-diagnostics-status"].textContent.includes("issue 模板已复制"));
  guideWindow.closeFirstUseGuide();
  assert.equal(guidePrefs.elements["git4zotero-first-use-dialog"].hidden, true);
}

let enabledMetadata = null;
const indexUpdates = [];
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
  },
  indexStore: {
    upsertAttachment: async (attachment, options) => {
      indexUpdates.push([attachment.itemKey, options.enabled]);
    }
  }
});
await enablingService.enableVersionManagement({});
assert.equal(enabledMetadata.enabled, true);
await enablingService.disableVersionManagement({});
assert.equal(enabledMetadata.enabled, false);
assert.deepEqual(indexUpdates, [["ITEM", true], ["ITEM", false]]);

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

function makeStoredZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const item of files) {
    const data = item.data instanceof Uint8Array
      ? Buffer.from(item.data)
      : Buffer.from(encoder.encode(item.text ?? ""));
    const name = Buffer.from(item.name, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    writeStoredLocalHeader(localHeader, crc, data.length, name.length);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    writeStoredCentralHeader(centralHeader, crc, data.length, name.length, offset);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  writeEndHeader(end, files.length, centralSize, offset);
  return new Uint8Array(Buffer.concat([...localParts, ...centralParts, end]));
}

function writeStoredLocalHeader(buffer, crc, size, nameLength) {
  buffer.writeUInt32LE(0x04034b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(0x0800, 6);
  buffer.writeUInt16LE(0, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt32LE(crc, 14);
  buffer.writeUInt32LE(size, 18);
  buffer.writeUInt32LE(size, 22);
  buffer.writeUInt16LE(nameLength, 26);
  buffer.writeUInt16LE(0, 28);
}

function writeStoredCentralHeader(buffer, crc, size, nameLength, offset) {
  buffer.writeUInt32LE(0x02014b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(20, 6);
  buffer.writeUInt16LE(0x0800, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt16LE(0, 14);
  buffer.writeUInt32LE(crc, 16);
  buffer.writeUInt32LE(size, 20);
  buffer.writeUInt32LE(size, 24);
  buffer.writeUInt16LE(nameLength, 28);
  buffer.writeUInt16LE(0, 30);
  buffer.writeUInt16LE(0, 32);
  buffer.writeUInt16LE(0, 34);
  buffer.writeUInt16LE(0, 36);
  buffer.writeUInt32LE(0, 38);
  buffer.writeUInt32LE(offset, 42);
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
    formatSingleVersionSummaryMarkdown: (version) => `# git4zotero ${UI_TEXT.exportTitleSingleVersion}\n\n${version.note || UI_TEXT.defaultNote}\n${version.commitHash || version.id || ""}\n`,
    exportSingleVersionSummary: async (version, options = {}) => ({
      path: `${options.initialDirectory || "exports"}\\${version.shortHash || "version"}.md`,
      options
    }),
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
    copyTextToClipboard: () => {},
    promptGitPath: () => false,
    ...overrides
  };
}

function makeMenuHarness({ serviceOverrides = {}, archiveServiceOverrides = {}, platformOverrides = {} } = {}) {
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
    buildCreateVersionPreview: async () => ({
      attachment: { ...managedAttachment, extension: ".docx" },
      trackingMode: UI_TEXT.contentModeDocx,
      fileHash: "file-hash",
      workingTree: { clean: true, entries: [], summary: UI_TEXT.workingTreeClean },
      changeSummary: { summary: "正文内容已修改。" },
      shouldCreateVersion: true
    }),
    createVersion: async () => older,
    getRestoreCandidates: async () => [older],
    buildRestorePreflight: async () => ({
      attachment: managedAttachment,
      targetVersion: older,
      currentFileHash: "current-hash",
      targetFileHash: older.fileHash,
      backupPath: "repo/.git4zotero/restore-backups/current-paper.docx",
      checks: [{ id: "git", label: "Git", status: "ok", detail: "git version 2.44.0" }],
      ok: true,
      errorCount: 0,
      warningCount: 0,
      summary: UI_TEXT.restorePreflightOk
    }),
    restoreVersion: async () => ({ attachment: managedAttachment, restoredVersion: older, backupPath: "backup.docx" }),
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
    exists: async () => false,
    getRepoPath: (libraryID, itemKey) => `C:\\Profile\\git4zotero\\${buildRepoRelativePath(libraryID, itemKey).replace(/\//g, "\\")}`,
    promptGitPath() {
      promptGitCount += 1;
      return true;
    },
    refreshItemPane() {
      refreshCount += 1;
    },
    ...platformOverrides
  };
  const archiveService = {
    exportItemRepositoryArchive: async () => ({ path: "C:\\Backups\\item-history.zip", fileCount: 3 }),
    importItemRepositoryArchive: async () => ({
      imported: ["library-1/item-ABC123"],
      skipped: [],
      failed: [],
      sourceRepoRelativePath: "library-1/item-SOURCE",
      targetRepoRelativePath: "library-1/item-ABC123"
    }),
    ...archiveServiceOverrides
  };
  const menu = new PaperVersionMenu({ service, archiveService, platform });
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
    archiveService,
    platform,
    service
  };
}

function makePreferenceElement(id = "", tagName = "div") {
  return {
    attributes: new Map(),
    childNodes: [],
    className: "",
    dataset: {},
    disabled: false,
    hidden: false,
    id,
    listeners: {},
    ownerDocument: null,
    tagName,
    textContent: "",
    type: "",
    value: "",
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    append(...children) {
      this.childNodes.push(...children);
    },
    getAttribute(name) {
      if (name === "id") {
        return this.id;
      }
      if (name === "class") {
        return this.className;
      }
      return this.attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === "hidden") {
        this.hidden = false;
      }
      if (name === "class") {
        this.className = "";
      }
    },
    replaceChildren(...children) {
      this.childNodes = [...children];
      this.textContent = "";
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === "hidden") {
        this.hidden = true;
      }
      if (name === "class") {
        this.className = String(value);
      }
      if (name === "id") {
        this.id = String(value);
      }
    }
  };
}

async function runPreferencesScript({
  archiveExportDirectory = "",
  autoGitPath = "",
  missingInitially = false,
  prefValue = "",
  subprocessResult = null,
  subprocessError = null
} = {}) {
  let elementsReady = !missingInitially;
  const timeouts = [];
  const prefs = new Map([
    [PREFS.gitPath, prefValue],
    [PREFS.archiveExportDirectory, archiveExportDirectory]
  ]);
  const subprocessCalls = [];
  const files = new Map();
  const directories = new Set(["C:\\ZoteroProfile", "C:\\ZoteroProfile\\git4zotero"]);
  const elements = new Proxy({}, {
    get(target, id) {
      if (!target[id]) {
        target[id] = makePreferenceElement(id);
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
        if (spec === "chrome://git4zotero/content/src/diagnostics.mjs") {
          return { classifyError, DiagnosticService, ERROR_CATEGORIES, LastErrorStore, recordLastError };
        }
        if (spec === "chrome://git4zotero/content/src/attachments.mjs") {
          return { AttachmentFinder };
        }
        if (spec === "chrome://git4zotero/content/src/git-backend.mjs") {
          return { GitBackend };
        }
        if (spec === "chrome://git4zotero/content/src/metadata.mjs") {
          return { MetadataStore };
        }
        if (spec === "chrome://git4zotero/content/src/cleanup.mjs") {
          return { RepositoryCleanupService, RepositoryIndexStore };
        }
        if (spec === "chrome://git4zotero/content/src/archive.mjs") {
          return { RepositoryArchiveService };
        }
        if (spec === "chrome://git4zotero/content/src/version-service.mjs") {
          return { VersionService };
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
      createElement: (tagName) => makePreferenceElement("", tagName),
      createElementNS: (_namespace, tagName) => makePreferenceElement("", tagName),
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
      exists: async (target) => target === autoGitPath || files.has(target) || directories.has(target),
      getChildren: async (target) => {
        const prefix = `${target}\\`;
        const children = new Set();
        for (const dir of directories) {
          if (dir.startsWith(prefix)) {
            const rest = dir.slice(prefix.length);
            if (rest && !rest.includes("\\")) {
              children.add(`${prefix}${rest}`);
            }
          }
        }
        for (const file of files.keys()) {
          if (file.startsWith(prefix)) {
            const rest = file.slice(prefix.length);
            if (rest && !rest.includes("\\")) {
              children.add(`${prefix}${rest}`);
            }
          }
        }
        return [...children];
      },
      makeDirectory: async (target) => directories.add(target),
      readUTF8: async (target) => files.get(target) ?? "",
      remove: async (target) => files.delete(target),
      writeUTF8: async (target, content) => {
        const parent = target.replace(/\\[^\\]+$/, "");
        directories.add(parent);
        files.set(target, content);
      }
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
      locale: "zh-CN",
      debug() {},
      getActiveZoteroPane: () => ({ getSelectedItems: () => [] }),
      Items: { get: () => null },
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
