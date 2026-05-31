import { PLUGIN_ID, PREFS, UI_TEXT } from "./constants.mjs";
import { buildRepoRelativePath, getExtension } from "./attachments.mjs";
import { formatText } from "./localization.mjs";

const GIT_COMMAND = "git";
const WINDOWS_GIT_CANDIDATES = [
  "C:\\Program Files\\Git\\cmd\\git.exe",
  "C:\\Program Files\\Git\\bin\\git.exe",
  "C:\\Program Files (x86)\\Git\\cmd\\git.exe"
];
const POSIX_GIT_CANDIDATES = [
  "/usr/bin/git",
  "/usr/local/bin/git",
  "/opt/homebrew/bin/git"
];

export class ZoteroPlatform {
  constructor({ Zotero, Services, Cc, Ci, ChromeUtils, IOUtils, PathUtils }) {
    this.Zotero = Zotero;
    this.Services = Services;
    this.Cc = Cc;
    this.Ci = Ci;
    this.ChromeUtils = ChromeUtils;
    this.IOUtils = IOUtils ?? globalThis.IOUtils;
    this.PathUtils = PathUtils ?? globalThis.PathUtils;
    this.Subprocess = null;
  }

  getPref(key, fallback = undefined) {
    const value = this.Zotero.Prefs.get(key);
    return value === undefined || value === null ? fallback : value;
  }

  setPref(key, value) {
    this.Zotero.Prefs.set(key, value);
  }

  getGitExecutable() {
    return normalizeExecutablePath(this.getPref(PREFS.gitPath, "")) || GIT_COMMAND;
  }

  async promptGitPath() {
    const input = { value: String(this.getPref(PREFS.gitPath, "") || "") };
    const accepted = this.Services.prompt.prompt(
      null,
      UI_TEXT.promptGitTitle,
      UI_TEXT.promptGitMessage,
      input,
      null,
      {}
    );
    if (!accepted) {
      return null;
    }
    return this.checkGitAvailability(input.value, { persist: true });
  }

  async resolveGitExecutable(value = undefined) {
    const fromInput = value !== undefined;
    const raw = normalizeExecutablePath(fromInput ? value : this.getPref(PREFS.gitPath, ""));
    const requestedSource = fromInput ? "input" : "saved";
    if (raw && !isGitCommandAlias(raw)) {
      return {
        command: raw,
        source: requestedSource,
        requested: raw,
        unresolved: false
      };
    }

    const discovered = await this.findGitExecutable();
    if (discovered) {
      return {
        command: discovered,
        source: "auto",
        requested: raw,
        unresolved: false
      };
    }

    return {
      command: raw || GIT_COMMAND,
      source: raw ? requestedSource : "auto",
      requested: raw,
      unresolved: true
    };
  }

  async checkGitAvailability(value = undefined, { persist = false } = {}) {
    const resolution = await this.resolveGitExecutable(value);
    try {
      const result = await this.runProcess(resolution.command, ["--version"]);
      const detail = result.stdout.trim() || result.stderr.trim();
      if (result.exitCode !== 0) {
      const error = detail || formatText("processExitCode", { code: result.exitCode });
        return {
          available: false,
          command: resolution.command,
          source: resolution.source,
          detail: error,
          error
        };
      }

      if (persist) {
        this.setPref(PREFS.gitPath, resolution.command);
      }

      return {
        available: true,
        command: resolution.command,
        source: resolution.source,
        version: detail,
        detail
      };
    }
    catch (error) {
      const friendly = this.formatGitAvailabilityError(error, resolution);
      return {
        available: false,
        command: resolution.command,
        source: resolution.source,
        detail: friendly,
        error: friendly,
        cause: error
      };
    }
  }

  async findGitExecutable() {
    for (const candidate of this.getGitExecutableCandidates()) {
      if (await this.safeExists(candidate)) {
        return candidate;
      }
    }
    return this.findGitExecutableFromPath();
  }

  getGitExecutableCandidates() {
    const candidates = this.isWindows() ? [...WINDOWS_GIT_CANDIDATES] : [...POSIX_GIT_CANDIDATES];
    const home = this.getHomeDirectory();
    if (home && this.isWindows()) {
      candidates.push(this.join(home, "AppData", "Local", "Programs", "Git", "cmd", "git.exe"));
    }
    return [...new Set(candidates)];
  }

  async findGitExecutableFromPath() {
    const lookupCommands = this.getPathLookupCommands();
    for (const lookup of lookupCommands) {
      if (lookup.mustExist && !(await this.safeExists(lookup.command))) {
        continue;
      }
      try {
        const result = await this.runProcess(lookup.command, lookup.args);
        if (result.exitCode !== 0 || !result.stdout.trim()) {
          continue;
        }
        const command = result.stdout
          .split(/\r?\n/)
          .map((line) => normalizeExecutablePath(line))
          .find(Boolean);
        if (command) {
          return command;
        }
      }
      catch (error) {
        this.Zotero.debug?.(`git4zotero: Git path lookup failed: ${error?.stack || error}`);
      }
    }
    return "";
  }

  getPathLookupCommands() {
    if (this.isWindows()) {
      const windowsDir = this.getWindowsDirectory();
      return [
        {
          command: this.join(windowsDir, "System32", "where.exe"),
          args: ["git"],
          mustExist: true
        },
        {
          command: this.join(windowsDir, "Sysnative", "where.exe"),
          args: ["git"],
          mustExist: true
        }
      ];
    }
    return [
      { command: "/usr/bin/which", args: ["git"], mustExist: true },
      { command: "/bin/which", args: ["git"], mustExist: true }
    ];
  }

  formatGitAvailabilityError(error, resolution = {}) {
    const raw = error?.message || String(error || "");
    const command = resolution.command || GIT_COMMAND;
    if (resolution.unresolved || isGitCommandAlias(command) || /File at path "git"/i.test(raw)) {
      return UI_TEXT.gitPathNotFound;
    }
    return raw || UI_TEXT.gitUnavailableDetail;
  }

  async safeExists(path) {
    try {
      return !!(path && await this.exists(path));
    }
    catch (_error) {
      return false;
    }
  }

  isWindows() {
    try {
      if (this.Services?.appinfo?.OS === "WINNT") {
        return true;
      }
    }
    catch (_error) {
      // Fall through to path-shape detection.
    }
    try {
      return this.Services?.dirsvc?.get?.("ProfD", this.Ci.nsIFile)?.path?.includes("\\") === true;
    }
    catch (_error) {
      return false;
    }
  }

  getHomeDirectory() {
    try {
      return this.Services?.dirsvc?.get?.("Home", this.Ci.nsIFile)?.path || "";
    }
    catch (_error) {
      return "";
    }
  }

  getWindowsDirectory() {
    try {
      return this.Services?.dirsvc?.get?.("WinD", this.Ci.nsIFile)?.path || "C:\\Windows";
    }
    catch (_error) {
      return "C:\\Windows";
    }
  }

  getAppVersion() {
    return String(this.Zotero?.version || this.Services?.appinfo?.version || "");
  }

  getPluginVersion() {
    if (this.pluginVersion) {
      return String(this.pluginVersion);
    }
    try {
      const plugin = this.Zotero?.PluginManager?.getPlugin?.(PLUGIN_ID)
        || this.Zotero?.Plugins?.get?.(PLUGIN_ID);
      return String(plugin?.version || "");
    }
    catch (_error) {
      return "";
    }
  }

  getSystemInfo() {
    const parts = [];
    try {
      if (this.Services?.appinfo?.OS) {
        parts.push(`OS=${this.Services.appinfo.OS}`);
      }
      if (this.Services?.appinfo?.XPCOMABI) {
        parts.push(`ABI=${this.Services.appinfo.XPCOMABI}`);
      }
      if (this.Services?.appinfo?.name) {
        parts.push(`App=${this.Services.appinfo.name}`);
      }
      if (this.Services?.appinfo?.version) {
        parts.push(`AppVersion=${this.Services.appinfo.version}`);
      }
    }
    catch (_error) {
      // Fall back to the minimal label below.
    }
    return parts.join(", ") || "unknown";
  }

  getLocale() {
    return String(
      this.Zotero?.locale
      || this.Services?.locale?.appLocaleAsBCP47
      || this.Services?.locale?.requestedLocale
      || ""
    );
  }

  confirm(title, message) {
    return this.Services.prompt.confirm(null, title, message);
  }

  alert(title, message) {
    this.Services.prompt.alert(null, title, message);
  }

  copyTextToClipboard(text) {
    const helper = this.Cc?.["@mozilla.org/widget/clipboardhelper;1"]?.getService?.(this.Ci?.nsIClipboardHelper);
    if (!helper?.copyString) {
      throw new Error("Clipboard helper is unavailable.");
    }
    helper.copyString(String(text ?? ""));
  }

  promptText(title, message, defaultValue = "") {
    const input = { value: String(defaultValue ?? "") };
    const accepted = this.Services.prompt.prompt(null, title, message, input, null, {});
    return accepted ? input.value : null;
  }

  selectFromList(title, message, options) {
    const selected = { value: 0 };
    let accepted;
    try {
      accepted = this.Services.prompt.select(null, title, message, options, selected);
    }
    catch (error) {
      this.Zotero.debug?.(`git4zotero: Zotero 9 prompt.select signature failed, retrying legacy signature: ${error?.stack || error}`);
      accepted = this.Services.prompt.select(
        null,
        title,
        message,
        options.length,
        options,
        selected
      );
    }
    return accepted ? selected.value : -1;
  }

  async saveTextFile({ title = UI_TEXT.saveFileTitle, defaultFileName = "git4zotero-export.txt", content = "" } = {}) {
    const fallbackPath = this.join(this.getPluginDataDirectory(), "exports", defaultFileName);
    try {
      const targetPath = await this.pickSavePath(title, defaultFileName);
      if (!targetPath) {
        return null;
      }
      await this.writeText(targetPath, content);
      return targetPath;
    }
    catch (error) {
      this.Zotero.debug?.(`git4zotero: save dialog unavailable, using fallback export path: ${error?.stack || error}`);
      await this.writeText(fallbackPath, content);
      return fallbackPath;
    }
  }

  async saveBinaryFile({ title = UI_TEXT.saveFileTitle, defaultFileName = "git4zotero-export.bin", bytes = new Uint8Array() } = {}) {
    const fallbackPath = this.join(this.getPluginDataDirectory(), "exports", defaultFileName);
    try {
      const targetPath = await this.pickSavePath(title, defaultFileName);
      if (!targetPath) {
        return null;
      }
      await this.writeBytes(targetPath, bytes);
      return targetPath;
    }
    catch (error) {
      this.Zotero.debug?.(`git4zotero: binary save dialog unavailable, using fallback path: ${error?.stack || error}`);
      await this.writeBytes(fallbackPath, bytes);
      return fallbackPath;
    }
  }

  async openBinaryFile({ title = UI_TEXT.archiveImportTitle } = {}) {
    const path = await this.pickOpenPath(title);
    if (!path) {
      return null;
    }
    return { path, bytes: await this.readFileBytes(path) };
  }

  async pickSavePath(title, defaultFileName) {
    const filePickerInterface = this.Ci?.nsIFilePicker;
    const picker = this.Cc?.["@mozilla.org/filepicker;1"]?.createInstance?.(filePickerInterface);
    if (!picker || !filePickerInterface) {
      throw new Error(UI_TEXT.saveDialogUnavailable);
    }
    picker.init(null, title, filePickerInterface.modeSave);
    picker.defaultString = defaultFileName;
    const extension = getExtension(defaultFileName);
    if (extension === ".md") {
      picker.appendFilter?.("Markdown", "*.md");
    }
    else if (extension === ".txt") {
      picker.appendFilter?.("Text", "*.txt");
    }
    else if (extension === ".zip") {
      picker.appendFilter?.("ZIP", "*.zip");
    }
    picker.appendFilters?.(filePickerInterface.filterAll);

    const result = await this.showFilePicker(picker);
    if (result === filePickerInterface.returnCancel) {
      return null;
    }
    const path = picker.file?.path || "";
    if (!path) {
      throw new Error(UI_TEXT.saveDialogNoPath);
    }
    return path;
  }

  showFilePicker(picker) {
    if (typeof picker.open === "function") {
      return new Promise((resolve) => {
        picker.open(resolve);
      });
    }
    if (typeof picker.show === "function") {
      return picker.show();
    }
    throw new Error(UI_TEXT.saveDialogUnsupported);
  }

  async pickOpenPath(title) {
    const filePickerInterface = this.Ci?.nsIFilePicker;
    const picker = this.Cc?.["@mozilla.org/filepicker;1"]?.createInstance?.(filePickerInterface);
    if (!picker || !filePickerInterface) {
      throw new Error(UI_TEXT.saveDialogUnavailable);
    }
    picker.init(null, title, filePickerInterface.modeOpen);
    picker.appendFilter?.("ZIP", "*.zip");
    picker.appendFilters?.(filePickerInterface.filterAll);
    const result = await this.showFilePicker(picker);
    if (result === filePickerInterface.returnCancel) {
      return null;
    }
    const path = picker.file?.path || "";
    if (!path) {
      throw new Error(UI_TEXT.saveDialogNoPath);
    }
    return path;
  }

  openPath(path) {
    const file = this.Cc?.["@mozilla.org/file/local;1"]?.createInstance?.(this.Ci?.nsIFile);
    if (!file?.initWithPath) {
      throw new Error(UI_TEXT.openPathUnavailable);
    }
    file.initWithPath(path);
    if (typeof file.reveal === "function") {
      file.reveal();
      return;
    }
    file.launch?.();
  }

  openURL(url) {
    if (this.Zotero?.launchURL) {
      this.Zotero.launchURL(url);
      return;
    }
    throw new Error(UI_TEXT.openPathUnavailable);
  }

  refreshItemPane() {
    try {
      this.Zotero.Notifier?.trigger?.("refresh", "itempane", [], {});
    }
    catch (error) {
      this.Zotero.debug?.(`git4zotero: item pane refresh failed: ${error?.stack || error}`);
    }
  }

  getPluginDataDirectory() {
    const profileDir = this.Services.dirsvc.get("ProfD", this.Ci.nsIFile).path;
    return this.join(profileDir, "git4zotero");
  }

  redactPath(value) {
    let output = String(value ?? "");
    const home = this.getHomeDirectory();
    if (home) {
      output = replacePathPrefix(output, home, "<HOME>");
    }
    return output;
  }

  getRepoPath(libraryID, itemKey) {
    const repoPath = this.join(this.getPluginDataDirectory(), buildRepoRelativePath(libraryID, itemKey));
    this.Zotero.debug?.(`git4zotero: resolved repo path for library=${libraryID}, item=${itemKey}`);
    return repoPath;
  }

  join(...parts) {
    const normalizedParts = normalizeJoinParts(parts);
    if (this.PathUtils?.join) {
      return this.PathUtils.join(...normalizedParts);
    }
    const separator = normalizedParts[0]?.includes("\\") ? "\\" : "/";
    return normalizedParts
      .map((part, index) => index === 0 ? part.replace(/[\\/]+$/g, "") : part)
      .join(separator);
  }

  dirname(filePath) {
    return String(filePath).replace(/[\\/][^\\/]*$/, "");
  }

  async exists(path) {
    return this.requireIOUtils().exists(path);
  }

  async makeDirectory(path) {
    await this.requireIOUtils().makeDirectory(path, {
      createAncestors: true,
      ignoreExisting: true
    });
  }

  async readText(path) {
    return this.requireIOUtils().readUTF8(path);
  }

  async writeText(path, content) {
    await this.makeDirectory(this.dirname(path));
    await this.requireIOUtils().writeUTF8(path, content);
  }

  async writeBytes(path, bytes) {
    await this.makeDirectory(this.dirname(path));
    await this.requireIOUtils().write(path, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  async readFileBytes(path) {
    const bytes = await this.requireIOUtils().read(path);
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }

  async copyFile(sourcePath, targetPath) {
    await this.makeDirectory(this.dirname(targetPath));
    if (await this.exists(targetPath)) {
      await this.requireIOUtils().remove(targetPath);
    }
    await this.requireIOUtils().copy(sourcePath, targetPath);
  }

  async removeFile(path) {
    if (await this.exists(path)) {
      await this.requireIOUtils().remove(path);
    }
  }

  async writeTempProbeFile() {
    const dataDir = this.getPluginDataDirectory();
    const probePath = this.join(dataDir, "git4zotero-diagnostic-write-test.txt");
    await this.writeText(probePath, `git4zotero write probe ${new Date().toISOString()}\n`);
    await this.removeFile(probePath);
    return probePath;
  }

  async removeDirectory(path) {
    if (await this.exists(path)) {
      await this.requireIOUtils().remove(path, { recursive: true });
    }
  }

  async listDirectory(path) {
    if (!(await this.exists(path))) {
      return [];
    }
    const io = this.requireIOUtils();
    if (typeof io.getChildren !== "function") {
      throw new Error(UI_TEXT.missingIOUtilsGetChildren);
    }
    return io.getChildren(path);
  }

  async stat(path) {
    return this.requireIOUtils().stat(path);
  }

  async isDirectory(path) {
    const stat = await this.stat(path);
    return stat?.type === "directory" || stat?.isDir === true || stat?.isDirectory === true;
  }

  async hashFile(path) {
    return this.hashBytes(await this.readFileBytes(path));
  }

  async hashString(value) {
    return this.hashBytes(new TextEncoder().encode(String(value ?? "")));
  }

  async hashBytes(bytes) {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
    return `size-${bytes.byteLength}`;
  }

  requireIOUtils() {
    if (!this.IOUtils) {
      throw new Error(UI_TEXT.missingIOUtils);
    }
    return this.IOUtils;
  }

  async runProcess(command, args, options = {}) {
    const subprocess = this.getSubprocess();
    const proc = await subprocess.call({
      command,
      arguments: args,
      workdir: options.cwd,
      stdout: "pipe",
      stderr: "pipe"
    });

    const stdout = proc.stdout ? await proc.stdout.readString() : "";
    const stderr = proc.stderr ? await proc.stderr.readString() : "";
    const waitResult = await proc.wait();
    const exitCode = typeof waitResult === "number" ? waitResult : waitResult.exitCode;

    return { exitCode, stdout, stderr };
  }

  getSubprocess() {
    if (this.Subprocess) {
      return this.Subprocess;
    }

    const module = this.ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
    this.Subprocess = module.Subprocess;
    return this.Subprocess;
  }
}

export function normalizeExecutablePath(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

export function isGitCommandAlias(value) {
  return /^(?:git|git\.exe)$/i.test(normalizeExecutablePath(value));
}

function replacePathPrefix(value, prefix, replacement) {
  const normalizedPrefix = String(prefix ?? "").replace(/[\\/]+$/g, "");
  if (!normalizedPrefix) {
    return value;
  }
  const escaped = normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(value).replace(new RegExp(escaped, "gi"), replacement);
}

export function normalizeJoinParts(parts) {
  const normalized = [];
  for (let index = 0; index < parts.length; index += 1) {
    const value = String(parts[index] ?? "");
    if (index === 0) {
      if (value) {
        normalized.push(value);
      }
      continue;
    }

    for (const segment of value.split(/[\\/]+/)) {
      if (!segment || segment === ".") {
        continue;
      }
      if (segment === "..") {
        throw new Error(UI_TEXT.pathSegmentParent);
      }
      normalized.push(segment);
    }
  }
  return normalized;
}
