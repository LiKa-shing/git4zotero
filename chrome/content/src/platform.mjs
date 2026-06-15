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
  constructor({ Zotero, Services, Cc, Ci, ChromeUtils, IOUtils, PathUtils, window = null }) {
    this.Zotero = Zotero;
    this.ChromeUtils = ChromeUtils;
    this.Services = Services || this.importServices();
    this.Cc = Cc;
    this.Ci = Ci;
    this.IOUtils = IOUtils ?? globalThis.IOUtils;
    this.PathUtils = PathUtils ?? globalThis.PathUtils;
    this.window = window;
    this.Subprocess = null;
  }

  importServices() {
    try {
      return this.ChromeUtils?.importESModule?.("resource://gre/modules/Services.sys.mjs")?.Services || null;
    }
    catch (_error) {
      return null;
    }
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

  getPowerShellExecutableCandidates() {
    const windowsDir = this.getWindowsDirectory();
    return [
      {
        command: this.join(windowsDir, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
        mustExist: true
      },
      {
        command: this.join(windowsDir, "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe"),
        mustExist: true
      },
      {
        command: "powershell.exe",
        mustExist: false
      }
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
      const targetPath = await this.pickSavePath(title, defaultFileName, "");
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

  async saveBinaryFile({
    title = UI_TEXT.saveFileTitle,
    defaultFileName = "git4zotero-export.bin",
    bytes = new Uint8Array(),
    initialDirectory = ""
  } = {}) {
    const exportDirectory = normalizeExecutablePath(initialDirectory);
    if (exportDirectory) {
      await this.assertDirectoryAvailable(exportDirectory);
      const targetPath = this.join(exportDirectory, defaultFileName);
      await this.writeBytes(targetPath, bytes);
      return targetPath;
    }
    const fallbackPath = this.join(this.getPluginDataDirectory(), "exports", defaultFileName);
    try {
      const targetPath = await this.pickSavePath(title, defaultFileName, "");
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

  async openBinaryFile({ title = UI_TEXT.archiveImportTitle, path = "" } = {}) {
    path = normalizeExecutablePath(path) || await this.pickOpenPath(title);
    if (!path) {
      return null;
    }
    await this.assertFileAvailable(path);
    return { path, bytes: await this.readFileBytes(path) };
  }

  async pickSavePath(title, defaultFileName, initialDirectory = "") {
    const { filePickerInterface, picker } = this.createInitializedFilePicker(title, this.Ci?.nsIFilePicker?.modeSave);
    picker.defaultString = defaultFileName;
    if (initialDirectory) {
      picker.displayDirectory = this.createLocalFile(initialDirectory);
    }
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
    const nativePath = await this.tryPickOpenFileWithNativeDialog(title);
    if (nativePath !== undefined) {
      return nativePath;
    }
    try {
      return await this.pickOpenPathWithFilePicker(title);
    }
    catch (error) {
      this.Zotero.debug?.(`git4zotero: open file picker unavailable, using manual path prompt: ${error?.stack || error}`);
      return this.promptOpenFilePath(title, error);
    }
  }

  async pickOpenPathWithFilePicker(title) {
    const { filePickerInterface, picker } = this.createInitializedFilePicker(title, this.Ci?.nsIFilePicker?.modeOpen, {
      unavailableMessage: UI_TEXT.openFileDialogUnavailable
    });
    picker.appendFilter?.("ZIP", "*.zip");
    picker.appendFilters?.(filePickerInterface.filterAll);
    const result = await this.showFilePicker(picker);
    if (result === filePickerInterface.returnCancel) {
      return null;
    }
    const path = picker.file?.path || "";
    if (!path) {
      throw new Error(UI_TEXT.openFileDialogNoPath);
    }
    return path;
  }

  async tryPickOpenFileWithNativeDialog(title) {
    if (!this.isWindows()) {
      return undefined;
    }

    const scripts = this.createWindowsOpenFilePickerScripts(title);
    let lastError = null;
    for (const script of scripts) {
      for (const candidate of this.getPowerShellExecutableCandidates()) {
        try {
          if (candidate.mustExist && !(await this.safeExists(candidate.command))) {
            continue;
          }

          const result = await this.runProcess(candidate.command, [
            "-NoProfile",
            "-STA",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script
          ]);
          if (result.exitCode === 2) {
            return null;
          }
          if (result.exitCode === 0) {
            const selected = normalizeExecutablePath(result.stdout.split(/\r?\n/).find((line) => line.trim()) || "");
            if (selected) {
              return selected;
            }
          }
          lastError = new Error((result.stderr || result.stdout || UI_TEXT.openFileDialogNoPath).trim());
        }
        catch (error) {
          lastError = error;
          this.Zotero.debug?.(`git4zotero: native Windows open file picker failed: ${error?.stack || error}`);
        }
      }
    }

    if (lastError) {
      this.Zotero.debug?.(`git4zotero: native Windows open file picker unavailable, trying nsIFilePicker: ${lastError?.stack || lastError}`);
    }
    return undefined;
  }

  createWindowsOpenFilePickerScripts(title) {
    const description = escapePowerShellSingleQuotedString(title || UI_TEXT.archiveImportTitle);
    return [
      this.createWindowsFormsOpenFilePickerScript(description),
      this.createWindowsWpfOpenFilePickerScript(description)
    ];
  }

  createWindowsFormsOpenFilePickerScript(description) {
    return [
      "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
      `$dialog.Title = '${description}'`,
      "$dialog.Filter = 'ZIP backups (*.zip)|*.zip|All files (*.*)|*.*'",
      "$dialog.CheckFileExists = $true",
      "$dialog.Multiselect = $false",
      "try {",
      "  $result = $dialog.ShowDialog()",
      "  if ($result -eq [System.Windows.Forms.DialogResult]::OK -and -not [string]::IsNullOrWhiteSpace($dialog.FileName)) {",
      "    Write-Output $dialog.FileName",
      "    exit 0",
      "  }",
      "  exit 2",
      "}",
      "finally {",
      "  if ($dialog) { $dialog.Dispose() }",
      "}"
    ].join("\n");
  }

  createWindowsWpfOpenFilePickerScript(description) {
    return [
      "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false",
      "Add-Type -AssemblyName PresentationFramework",
      "$dialog = New-Object Microsoft.Win32.OpenFileDialog",
      `$dialog.Title = '${description}'`,
      "$dialog.Filter = 'ZIP backups (*.zip)|*.zip|All files (*.*)|*.*'",
      "$dialog.CheckFileExists = $true",
      "$dialog.Multiselect = $false",
      "$result = $dialog.ShowDialog()",
      "if ($result -eq $true -and -not [string]::IsNullOrWhiteSpace($dialog.FileName)) {",
      "  Write-Output $dialog.FileName",
      "  exit 0",
      "}",
      "exit 2"
    ].join("\n");
  }

  promptOpenFilePath(title, error = null) {
    if (!this.Services?.prompt?.prompt) {
      const detail = error?.message || String(error || "");
      throw new Error(detail ? `${UI_TEXT.openFileDialogUnavailable} ${detail}` : UI_TEXT.openFileDialogUnavailable);
    }
    const detail = error?.message || String(error || "");
    const message = detail
      ? `${UI_TEXT.archiveImportPathPromptMessage}\n\n${detail}`
      : UI_TEXT.archiveImportPathPromptMessage;
    const value = this.promptText(UI_TEXT.archiveImportPathPromptTitle || title, message, "");
    return normalizeExecutablePath(value);
  }

  async pickDirectoryViaSaveDialog(title, defaultFileName = ".git4zotero-select-folder") {
    const nativeDirectory = await this.tryPickDirectoryWithNativeDialog(title);
    if (nativeDirectory !== undefined) {
      return nativeDirectory;
    }

    const pickedPath = await this.pickSavePath(title, defaultFileName);
    return pickedPath ? this.dirname(pickedPath) : null;
  }

  async tryPickDirectoryWithNativeDialog(title) {
    if (!this.isWindows()) {
      return undefined;
    }

    const scripts = this.createWindowsFolderPickerScripts(title);
    let lastError = null;
    for (const script of scripts) {
      for (const candidate of this.getPowerShellExecutableCandidates()) {
        try {
          if (candidate.mustExist && !(await this.safeExists(candidate.command))) {
            continue;
          }

          const result = await this.runProcess(candidate.command, [
            "-NoProfile",
            "-STA",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script
          ]);
          if (result.exitCode === 2) {
            return null;
          }
          if (result.exitCode === 0) {
            const selected = normalizeExecutablePath(result.stdout.split(/\r?\n/).find((line) => line.trim()) || "");
            if (selected) {
              return selected;
            }
          }
          lastError = new Error((result.stderr || result.stdout || UI_TEXT.saveDialogNoPath).trim());
        }
        catch (error) {
          lastError = error;
          this.Zotero.debug?.(`git4zotero: native Windows folder picker failed: ${error?.stack || error}`);
        }
      }
    }

    const detail = lastError?.message || String(lastError || "");
    throw new Error(detail ? `${UI_TEXT.windowsFolderPickerUnavailable} ${detail}` : UI_TEXT.windowsFolderPickerUnavailable);
  }

  createWindowsFolderPickerScripts(title) {
    const description = escapePowerShellSingleQuotedString(title || UI_TEXT.saveFileTitle);
    return [
      this.createWindowsFormsFolderPickerScript(description),
      this.createWindowsShellFolderPickerScript(description)
    ];
  }

  createWindowsFormsFolderPickerScript(description) {
    return [
      "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      `$dialog.Description = '${description}'`,
      "$dialog.ShowNewFolderButton = $true",
      "try {",
      "  $result = $dialog.ShowDialog()",
      "  if ($result -eq [System.Windows.Forms.DialogResult]::OK -and -not [string]::IsNullOrWhiteSpace($dialog.SelectedPath)) {",
      "    Write-Output $dialog.SelectedPath",
      "    exit 0",
      "  }",
      "  exit 2",
      "}",
      "finally {",
      "  if ($dialog) { $dialog.Dispose() }",
      "}"
    ].join("\n");
  }

  createWindowsShellFolderPickerScript(description) {
    return [
      "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false",
      "$shell = New-Object -ComObject Shell.Application",
      `$folder = $shell.BrowseForFolder(0, '${description}', 0)`,
      "if ($folder -and $folder.Self -and -not [string]::IsNullOrWhiteSpace($folder.Self.Path)) {",
      "  Write-Output $folder.Self.Path",
      "  exit 0",
      "}",
      "exit 2"
    ].join("\n");
  }

  async pickDirectory(title) {
    const { filePickerInterface, picker } = this.createInitializedFilePicker(title, this.Ci?.nsIFilePicker?.modeGetFolder);
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

  createInitializedFilePicker(title, mode, { unavailableMessage = UI_TEXT.saveDialogUnavailable } = {}) {
    const filePickerInterface = this.Ci?.nsIFilePicker;
    if (!filePickerInterface || mode === undefined || mode === null) {
      throw new Error(unavailableMessage);
    }

    const errors = [];
    for (const parent of this.getFilePickerParentCandidates()) {
      const picker = this.Cc?.["@mozilla.org/filepicker;1"]?.createInstance?.(filePickerInterface);
      if (!picker?.init) {
        throw new Error(unavailableMessage);
      }

      try {
        picker.init(parent, title, mode);
        return { filePickerInterface, parent, picker };
      }
      catch (error) {
        if (!this.isFilePickerInitError(error)) {
          throw error;
        }
        errors.push(error);
        this.Zotero.debug?.(`git4zotero: file picker init failed, trying another parent: ${error?.stack || error}`);
      }
    }

    const detail = errors
      .map((error) => error?.message || String(error || ""))
      .filter(Boolean)
      .join("; ");
    throw new Error(detail ? `${unavailableMessage} ${detail}` : unavailableMessage);
  }

  getFilePickerParentCandidates() {
    const candidates = [];
    const addCandidate = (candidate) => {
      if (candidate === undefined) {
        return;
      }
      candidate = this.resolveFilePickerParentCandidate(candidate);
      if (candidate && typeof candidate === "object" && candidate.closed === true) {
        return;
      }
      if (!candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    };
    const addCandidateFrom = (getter) => {
      try {
        addCandidate(getter());
      }
      catch (_error) {
        // Ignore unavailable parent sources.
      }
    };

    addCandidateFrom(() => this.window?.browsingContext?.topChromeWindow);
    addCandidateFrom(() => this.window?.ownerGlobal);
    addCandidateFrom(() => this.window?.document?.defaultView);
    addCandidateFrom(() => this.window?.top);
    addCandidateFrom(() => this.Zotero?.getMainWindow?.());

    addCandidateFrom(() => {
      const mainWindows = this.Zotero?.getMainWindows?.();
      if (typeof mainWindows?.[Symbol.iterator] === "function") {
        return [...mainWindows][0];
      }
      return mainWindows?.[0];
    });

    addCandidateFrom(() => this.Services?.ww?.activeWindow);
    addCandidateFrom(() => this.Services?.focus?.activeWindow);

    for (const windowType of ["zotero:main", "navigator:browser", "zotero:preferences", null]) {
      addCandidateFrom(() => this.Services?.wm?.getMostRecentWindow?.(windowType));
    }

    addCandidateFrom(() => {
      const enumerator = this.Services?.wm?.getEnumerator?.(null);
      if (!enumerator?.hasMoreElements) {
        return undefined;
      }
      while (enumerator.hasMoreElements()) {
        const candidate = enumerator.getNext?.();
        if (candidate) {
          return candidate;
        }
      }
      return undefined;
    });
    addCandidate(null);

    return candidates;
  }

  resolveFilePickerParentCandidate(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return candidate;
    }
    for (const getter of [
      () => candidate.ownerGlobal,
      () => candidate.document?.defaultView,
      () => candidate.contentWindow,
      () => candidate.ownerDocument?.defaultView,
      () => candidate.window
    ]) {
      try {
        const resolved = getter();
        if (resolved && resolved !== candidate) {
          return resolved;
        }
      }
      catch (_error) {
        // Ignore cross-compartment or detached window wrappers.
      }
    }
    return candidate;
  }

  isFilePickerInitError(error) {
    const message = String(error?.message || error || "");
    const name = String(error?.name || "");
    const result = error?.result ?? error?.code;
    return result === 0x80070057
      || /NS_ERROR_ILLEGAL_VALUE/i.test(name)
      || /NS_ERROR_ILLEGAL_VALUE|0x80070057|nsIFilePicker\.init/i.test(message);
  }

  openPath(path) {
    const file = this.createLocalFile(path);
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

  async assertDirectoryAvailable(path) {
    if (!(await this.exists(path))) {
      throw new Error(formatText("archiveExportDirectoryUnavailable", { path }));
    }
    if (!(await this.isDirectory(path))) {
      throw new Error(formatText("archiveExportDirectoryNotFolder", { path }));
    }
  }

  async assertFileAvailable(path) {
    if (!(await this.exists(path))) {
      throw new Error(formatText("archiveImportFileUnavailable", { path }));
    }
    if (await this.isDirectory(path)) {
      throw new Error(formatText("archiveImportPathNotFile", { path }));
    }
  }

  isSaveDialogFallbackError(error) {
    const message = String(error?.message || error || "");
    return [
      UI_TEXT.saveDialogUnavailable,
      UI_TEXT.saveDialogNoPath,
      UI_TEXT.saveDialogUnsupported
    ].some((value) => message.includes(value));
  }

  createLocalFile(path) {
    const file = this.Cc?.["@mozilla.org/file/local;1"]?.createInstance?.(this.Ci?.nsIFile);
    if (!file?.initWithPath) {
      throw new Error(UI_TEXT.openPathUnavailable);
    }
    file.initWithPath(path);
    return file;
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

function escapePowerShellSingleQuotedString(value) {
  return String(value ?? "").replace(/'/g, "''");
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
