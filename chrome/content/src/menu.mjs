import { ICON_20, PLUGIN_ID, UI_TEXT } from "./constants.mjs";
import { formatText } from "./localization.mjs";

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

export class PaperVersionMenu {
  constructor({ service, platform }) {
    this.service = service;
    this.platform = platform;
    this.menuID = null;
    this.context = null;
    this.fallbacks = new Map();
    this.menuStateCache = null;
  }

  register(context) {
    this.context = context;
    const zotero = this.platform.Zotero;
    const manager = zotero.MenuManager;
    if (!manager?.registerMenu && !manager?.register) {
      this.debug("MenuManager.registerMenu unavailable");
      return;
    }

    this.menuID = "git4zotero-paper-version-menu";
    const menu = {
      menuID: this.menuID,
      pluginID: context.id || PLUGIN_ID,
      target: "main/library/item",
      menus: [
        {
          menuID: "git4zotero-menu-root",
          menuType: "submenu",
          l10nID: "git4zotero-menu-root",
          icon: context.rootURI + ICON_20,
          onShowing: (_event, eventContext = {}) => {
            return this.updateRootVisibility(eventContext);
          },
          menus: this.actionDefinitions().map((definition) => this.menuItem(definition))
        }
      ]
    };

    if (manager.registerMenu) {
      manager.registerMenu(menu);
    }
    else {
      manager.register(menu);
    }
    this.debug("context menu registered");
  }

  unregister() {
    const manager = this.platform.Zotero.MenuManager;
    for (const win of this.fallbacks.keys()) {
      this.uninstallFallback(win);
    }
    if (!this.menuID) {
      return;
    }
    if (manager?.unregisterMenu) {
      manager.unregisterMenu(this.menuID);
    }
    else {
      manager?.unregister?.(this.menuID);
    }
    this.menuID = null;
    this.context = null;
  }

  menuItem(definition) {
    return {
      menuID: definition.id,
      menuType: "menuitem",
      l10nID: definition.l10nID,
      onShowing: (_event, eventContext = {}) => {
        return this.updateActionVisibility(definition, eventContext);
      },
      onCommand: (_event, eventContext) => {
        return this.runAction(definition.action, eventContext);
      }
    };
  }

  actionDefinitions() {
    return [
      {
        action: "enable",
        id: "git4zotero-menu-enable",
        label: UI_TEXT.enableManagement,
        l10nID: "git4zotero-menu-enable"
      },
      {
        action: "check",
        id: "git4zotero-menu-check",
        label: UI_TEXT.checkChanges,
        l10nID: "git4zotero-menu-check"
      },
      {
        action: "create",
        id: "git4zotero-menu-create",
        label: `${UI_TEXT.createVersion}...`,
        l10nID: "git4zotero-menu-create"
      },
      {
        action: "restore",
        id: "git4zotero-menu-restore",
        label: UI_TEXT.menuRestorePromptTitle + "...",
        l10nID: "git4zotero-menu-restore"
      },
      {
        action: "export",
        id: "git4zotero-menu-export",
        label: UI_TEXT.menuExportSummaryLabel,
        l10nID: "git4zotero-menu-export"
      },
      {
        action: "configureGit",
        id: "git4zotero-menu-configure-git",
        label: UI_TEXT.menuConfigureGit,
        l10nID: "git4zotero-menu-configure-git"
      },
      {
        action: "disable",
        id: "git4zotero-menu-disable",
        label: UI_TEXT.disableManagement,
        l10nID: "git4zotero-menu-disable"
      }
    ];
  }

  async runAction(action, eventContext) {
    try {
      if (action === "enable") {
        await this.enable(eventContext);
      }
      else if (action === "check") {
        await this.check(eventContext);
      }
      else if (action === "create") {
        await this.create(eventContext);
      }
      else if (action === "restore") {
        await this.restore(eventContext);
      }
      else if (action === "export") {
        await this.exportSummary(eventContext);
      }
      else if (action === "configureGit") {
        await this.configureGit();
      }
      else if (action === "disable") {
        await this.disable(eventContext);
      }
    }
    catch (error) {
      this.showError(error);
    }
  }

  installFallback(win, context = this.context) {
    if (!win?.document || this.fallbacks.has(win)) {
      return;
    }

    const popup = win.document.getElementById("zotero-itemmenu");
    if (!popup) {
      this.debug("zotero-itemmenu unavailable for fallback menu");
      return;
    }

    const onPopupShowing = () => {
      const runLater = win.setTimeout || globalThis.setTimeout;
      runLater(() => {
        void this.prepareFallbackMenu(win, context);
      }, 0);
    };
    popup.addEventListener("popupshowing", onPopupShowing);
    this.fallbacks.set(win, { onPopupShowing, popup });
    this.debug("context menu fallback installed");
  }

  uninstallFallback(win) {
    const fallback = this.fallbacks.get(win);
    if (!fallback) {
      return;
    }
    fallback.popup?.removeEventListener?.("popupshowing", fallback.onPopupShowing);
    win.document?.getElementById("git4zotero-fallback-menu")?.remove();
    this.fallbacks.delete(win);
  }

  async prepareFallbackMenu(win, context = this.context) {
    const doc = win.document;
    const itemPopup = doc.getElementById("zotero-itemmenu");
    if (!itemPopup) {
      return;
    }

    const officialRoot = this.findOfficialRoot(itemPopup);
    const fallbackRoot = doc.getElementById("git4zotero-fallback-menu");
    if (!(await this.isMenuRelevant())) {
      this.setMenuElementVisible(officialRoot, false);
      fallbackRoot?.remove();
      return;
    }

    if (officialRoot) {
      this.setMenuElementVisible(officialRoot, true);
      fallbackRoot?.remove();
      this.clearOfficialFallback(officialRoot);
      return;
    }

    let visibleFallbackRoot = fallbackRoot;
    if (!visibleFallbackRoot) {
      visibleFallbackRoot = this.createXULElement(doc, "menu");
      visibleFallbackRoot.id = "git4zotero-fallback-menu";
      visibleFallbackRoot.setAttribute("label", UI_TEXT.menuRoot);
      visibleFallbackRoot.setAttribute("class", "menu-iconic");
      if (context?.rootURI) {
        visibleFallbackRoot.setAttribute("image", context.rootURI + ICON_20);
      }
      itemPopup.append(visibleFallbackRoot);
    }
    this.setMenuElementVisible(visibleFallbackRoot, true);
    const fallbackPopup = this.ensurePopup(doc, visibleFallbackRoot);
    await this.populateFallbackPopup(fallbackPopup);
  }

  async populateFallbackPopup(popup, eventContext = {}) {
    const token = String(Date.now() + Math.random());
    popup.setAttribute("data-git4zotero-state-token", token);
    this.clearFallbackPopup(popup);

    if (!(await this.isMenuRelevant(eventContext))) {
      this.setMenuElementVisible(popup.parentNode, false);
      this.debug("context menu fallback hidden for unrelated selection");
      return null;
    }

    this.setMenuElementVisible(popup.parentNode, true);

    try {
      const state = await this.getMenuState(eventContext);
      if (popup.getAttribute("data-git4zotero-state-token") !== token) {
        return state;
      }
      this.renderFallbackPopup(popup, state);
      if (!popup.children.length) {
        this.setMenuElementVisible(popup.parentNode, false);
      }
      this.debug("context menu fallback populated");
      return state;
    }
    catch (error) {
      if (popup.getAttribute("data-git4zotero-state-token") !== token) {
        return null;
      }
      this.clearFallbackPopup(popup);
      this.setMenuElementVisible(popup.parentNode, false);
      this.debug(`context menu fallback state failed: ${error?.stack || error}`);
      return null;
    }
  }

  renderFallbackPopup(popup, state) {
    this.clearFallbackPopup(popup);
    const doc = popup.ownerDocument;
    for (const action of state.actions) {
      if (action.hidden) {
        continue;
      }
      popup.append(this.createFallbackItem(doc, action.definition, action));
    }
  }

  clearFallbackPopup(popup) {
    for (const child of Array.from(popup.children ?? [])) {
      if (child.getAttribute?.("data-git4zotero-fallback") === "true") {
        child.remove();
      }
    }
  }

  createFallbackItem(doc, definition, state = {}) {
    const item = this.createXULElement(doc, "menuitem");
    const label = state.disabled && state.reason
      ? `${definition.label} - ${state.reason}`
      : definition.label;
    item.id = `${definition.id}-fallback`;
    item.setAttribute("label", label);
    item.setAttribute("data-git4zotero-fallback", "true");
    if (state.disabled) {
      item.disabled = true;
      item.setAttribute("disabled", "true");
      return item;
    }
    item.addEventListener("command", (event) => {
      event?.stopPropagation?.();
      return this.runAction(definition.action, { event });
    });
    return item;
  }

  findOfficialRoot(itemPopup) {
    if (typeof itemPopup.querySelector === "function") {
      const found = itemPopup.querySelector("[data-l10n-id='git4zotero-menu-root']");
      if (found) {
        return found;
      }
    }
    return Array.from(itemPopup.children ?? [])
      .find((child) => child.getAttribute?.("data-l10n-id") === "git4zotero-menu-root") ?? null;
  }

  ensurePopup(doc, menu) {
    const existing = this.findPopup(menu);
    if (existing) {
      return existing;
    }
    const popup = this.createXULElement(doc, "menupopup");
    menu.append(popup);
    return popup;
  }

  findPopup(menu) {
    return Array.from(menu?.children ?? [])
      .find((child) => child.localName === "menupopup" || child.tagName === "menupopup") ?? null;
  }

  clearOfficialFallback(officialRoot) {
    const popup = this.findPopup(officialRoot);
    if (popup) {
      this.clearFallbackPopup(popup);
    }
  }

  createXULElement(doc, tagName) {
    if (typeof doc.createXULElement === "function") {
      return doc.createXULElement(tagName);
    }
    return doc.createElementNS?.(XUL_NS, tagName) ?? doc.createElement(tagName);
  }

  async updateRootVisibility(eventContext = {}) {
    this.clearMenuStateCache();
    const visible = await this.isMenuRelevant(eventContext);
    eventContext?.setVisible?.(visible);
    return visible;
  }

  async updateActionVisibility(definition, eventContext = {}) {
    let state;
    try {
      state = await this.getCachedMenuState(eventContext);
    }
    catch (error) {
      this.debug(`context menu action visibility failed: ${error?.stack || error}`);
      const fallbackState = {
        definition,
        disabled: true,
        hidden: false,
        reason: UI_TEXT.menuUnavailable
      };
      this.applyActionVisibility(eventContext, fallbackState);
      return fallbackState;
    }

    const actionState = state.actions.find((candidate) => candidate.definition.action === definition.action) ?? {
      definition,
      disabled: true,
      hidden: true,
      reason: ""
    };
    this.applyActionVisibility(eventContext, actionState);
    return actionState;
  }

  async getCachedMenuState(eventContext = {}) {
    const key = this.getSelectionCacheKey(eventContext);
    if (!this.menuStateCache || this.menuStateCache.key !== key) {
      this.menuStateCache = {
        key,
        promise: this.getMenuState(eventContext)
      };
    }
    return this.menuStateCache.promise;
  }

  getSelectionCacheKey(eventContext = {}) {
    const items = this.getSelectedItems(eventContext);
    if (!items.length) {
      return "none";
    }
    return items.map((item) => [
      item.libraryID ?? "",
      item.id ?? "",
      item.key ?? "",
      item.parentItemID ?? item.parentID ?? ""
    ].join(":")).join("|");
  }

  clearMenuStateCache() {
    this.menuStateCache = null;
  }

  applyActionVisibility(eventContext = {}, actionState = {}) {
    const visible = !actionState.hidden;
    const enabled = visible && !actionState.disabled;
    eventContext?.setVisible?.(visible);
    eventContext?.setEnabled?.(enabled);
    eventContext?.setDisabled?.(!enabled);

    const element = eventContext.menuItem ?? eventContext.target ?? eventContext.event?.target ?? null;
    if (!element) {
      return;
    }
    this.setMenuElementVisible(element, visible);
    element.disabled = !enabled;
    if (enabled) {
      element.removeAttribute?.("disabled");
    }
    else {
      element.setAttribute?.("disabled", "true");
    }
  }

  async isMenuRelevant(eventContext = {}) {
    const items = this.getSelectedItems(eventContext);
    if (items.length !== 1) {
      return false;
    }
    return !!(await this.findManageableAttachment(items[0]));
  }

  async findManageableAttachment(item) {
    try {
      if (typeof this.service.attachmentFinder?.findManageableAttachment === "function") {
        return await this.service.attachmentFinder.findManageableAttachment(item);
      }
      const state = await this.service.getPanelState?.(item);
      return state?.attachment ?? null;
    }
    catch (error) {
      this.debug(`context menu relevance check failed: ${error?.stack || error}`);
      return null;
    }
  }

  setMenuElementVisible(element, visible) {
    if (!element) {
      return;
    }
    element.hidden = !visible;
    element.collapsed = !visible;
    if (visible) {
      element.removeAttribute?.("hidden");
      element.removeAttribute?.("collapsed");
    }
    else {
      element.setAttribute?.("hidden", "true");
      element.setAttribute?.("collapsed", "true");
    }
  }

  async getMenuState(eventContext = {}) {
    const items = this.getSelectedItems(eventContext);
    if (items.length !== 1) {
      return {
        status: UI_TEXT.menuStatusNoSelection,
        detail: UI_TEXT.menuMultiSelectUnsupported,
        actions: this.buildActionStates({ selectable: false, reason: UI_TEXT.menuMultiSelectUnsupported })
      };
    }

    const item = items[0];
    const state = await this.service.getPanelState(item);
    if (!state.attachment) {
      return {
        status: UI_TEXT.noDocument,
        detail: UI_TEXT.noDocumentDetail,
        actions: this.buildActionStates({ selectable: true, attachment: false, reason: UI_TEXT.noDocument })
      };
    }

    if (!state.enabled) {
      return {
        status: UI_TEXT.notEnabled,
        detail: state.attachment.fileName,
        actions: this.buildActionStates({
          selectable: true,
          attachment: true,
          enabled: false,
          reason: UI_TEXT.notEnabled
        })
      };
    }

    if (!state.git?.available) {
      const gitDetail = state.git?.error || state.git?.detail || UI_TEXT.gitUnavailableDetail;
      return {
        status: UI_TEXT.gitUnavailable,
        detail: gitDetail,
        actions: this.buildActionStates({
          selectable: true,
          attachment: true,
          enabled: true,
          gitAvailable: false,
          gitUnavailable: true,
          reason: UI_TEXT.gitPathActionRequired
        })
      };
    }

    const versionCount = state.versions.length;
    const workingTreeSummary = state.workingTree?.clean === false
      ? state.workingTree.summary
      : UI_TEXT.workingTreeClean;
    return {
      status: versionCount ? UI_TEXT.menuStatusReady : UI_TEXT.menuStatusNoHistory,
      detail: `${state.attachment.fileName} · ${workingTreeSummary}`,
      actions: this.buildActionStates({
        selectable: true,
        attachment: true,
        enabled: true,
        gitAvailable: true,
        hasHistory: versionCount > 0
      })
    };
  }

  buildActionStates({
    selectable = true,
    attachment = true,
    enabled = false,
    gitAvailable = false,
    gitUnavailable = false,
    hasHistory = false,
    reason = ""
  } = {}) {
    return this.actionDefinitions().map((definition) => {
      let disabled = false;
      let disabledReason = "";
      let hidden = false;

      if (!selectable || !attachment) {
        disabled = true;
        disabledReason = reason;
      }
      else if (definition.action === "enable") {
        disabled = enabled;
        disabledReason = enabled ? UI_TEXT.actionCompleted : "";
      }
      else if (definition.action === "check" || definition.action === "create") {
        disabled = !enabled || !gitAvailable;
        disabledReason = !enabled ? UI_TEXT.notEnabled : (!gitAvailable ? reason || UI_TEXT.gitUnavailable : "");
      }
      else if (definition.action === "restore") {
        disabled = !enabled || !gitAvailable || !hasHistory;
        disabledReason = !enabled
          ? UI_TEXT.notEnabled
          : (!gitAvailable ? reason || UI_TEXT.gitUnavailable : (!hasHistory ? UI_TEXT.menuNoVersions : ""));
      }
      else if (definition.action === "export") {
        disabled = !enabled || !gitAvailable;
        disabledReason = !enabled ? UI_TEXT.notEnabled : (!gitAvailable ? reason || UI_TEXT.gitUnavailable : "");
      }
      else if (definition.action === "configureGit") {
        hidden = !gitUnavailable;
      }
      else if (definition.action === "disable") {
        disabled = !enabled;
        disabledReason = !enabled ? UI_TEXT.notEnabled : "";
      }

      return {
        definition,
        disabled,
        hidden,
        reason: disabled ? disabledReason : ""
      };
    });
  }

  async enable(eventContext) {
    const item = this.requireSingleItem(eventContext);
    const result = await this.service.enableVersionManagement(item);
    this.platform.alert(UI_TEXT.enableManagement, `${UI_TEXT.enableSuccess}\n${result.attachment.fileName}`);
    this.refresh();
  }

  async disable(eventContext) {
    const item = this.requireSingleItem(eventContext);
    if (!this.platform.confirm(UI_TEXT.disableConfirmTitle, UI_TEXT.disableConfirmMessage)) {
      return;
    }
    await this.service.disableVersionManagement(item);
    this.platform.alert(UI_TEXT.disableConfirmTitle, UI_TEXT.disableSuccess);
    this.refresh();
  }

  async check(eventContext) {
    const item = this.requireSingleItem(eventContext);
    const result = await this.service.checkCurrentChange(item);
    this.platform.alert(
      UI_TEXT.checkChanges,
      `${result.attachment.fileName}\n${result.changeSummary?.summary ?? UI_TEXT.actionCompleted}${this.formatChangeDetails(result.changeSummary)}`
    );
    this.refresh();
  }

  async create(eventContext) {
    const item = this.requireSingleItem(eventContext);
    const note = this.platform.promptText(
      UI_TEXT.menuCreatePromptTitle,
      UI_TEXT.menuCreatePromptMessage,
      this.platform.getPref("extensions.git4zotero.defaultVersionNote", UI_TEXT.defaultNote)
    );
    if (note === null) {
      return;
    }
    const version = await this.service.createVersion(item, note);
    this.platform.alert(
      UI_TEXT.createVersion,
      `${UI_TEXT.createSuccess}\n${version.shortHash}\n${version.changeSummary?.summary ?? ""}${this.formatChangeDetails(version.changeSummary)}`
    );
    this.refresh();
  }

  async restore(eventContext) {
    const item = this.requireSingleItem(eventContext);
    let versions = [];
    if (typeof this.service.getRestoreCandidates === "function") {
      versions = await this.service.getRestoreCandidates(item);
    }
    else {
      const state = await this.service.getPanelState(item);
      if (!state.enabled) {
        throw new Error(UI_TEXT.itemNotEnabledError);
      }
      if (!state.git?.available) {
        throw new Error(`${UI_TEXT.gitUnavailable}${UI_TEXT.colon}${state.git?.error || state.git?.detail || UI_TEXT.gitUnavailableDetail}`);
      }
      versions = state.versions;
    }
    if (!versions.length) {
      throw new Error(UI_TEXT.menuNoVersions);
    }

    const labels = versions.map((version) => this.formatRestoreLabel(version));
    const index = this.platform.selectFromList(
      UI_TEXT.menuRestorePromptTitle,
      UI_TEXT.menuRestorePromptMessage,
      labels
    );
    if (index < 0) {
      return;
    }
    const targetVersion = versions[index];
    if (!targetVersion) {
      return;
    }

    if (!this.platform.confirm(UI_TEXT.restoreConfirmTitle, UI_TEXT.restoreConfirmMessage)) {
      return;
    }

    const result = await this.service.restoreVersion(item, targetVersion);
    const safetyStatus = result?.safetyVersion
      ? formatText("restoreSafetyCreated", { hash: result.safetyVersion.shortHash })
      : UI_TEXT.restoreSafetySkipped;
    const fileBackupStatus = result?.backupPath
      ? `\n${UI_TEXT.restoreSafetyBackup}${UI_TEXT.colon}${result.backupPath}`
      : "";
    this.platform.alert(
      UI_TEXT.restoreConfirmTitle,
      `${UI_TEXT.restoreSuccess}\n${UI_TEXT.restoreTargetVersion}${UI_TEXT.colon}${targetVersion.shortHash}\n${UI_TEXT.restoreFile}${UI_TEXT.colon}${result?.attachment?.fileName ?? targetVersion.fileName}\n${safetyStatus}${fileBackupStatus}`
    );
    this.refresh();
  }

  async exportSummary(eventContext) {
    const item = this.requireSingleItem(eventContext);
    const scopeOptions = [UI_TEXT.exportScopeHistory, UI_TEXT.exportScopeLastCheck];
    const scopeIndex = this.platform.selectFromList(
      UI_TEXT.menuExportSummary,
      UI_TEXT.menuExportScopeMessage,
      scopeOptions
    );
    if (scopeIndex < 0) {
      return;
    }
    const formatOptions = [UI_TEXT.exportFormatMarkdown, UI_TEXT.exportFormatText];
    const formatIndex = this.platform.selectFromList(
      UI_TEXT.menuExportSummary,
      UI_TEXT.menuExportFormatMessage,
      formatOptions
    );
    if (formatIndex < 0) {
      return;
    }
    const result = await this.service.exportVersionSummary(item, {
      scope: scopeIndex === 1 ? "last-check" : "history",
      format: formatIndex === 1 ? "text" : "markdown"
    });
    if (!result) {
      return;
    }
    this.platform.alert(UI_TEXT.menuExportSummary, `${UI_TEXT.exportSuccess}\n${result.path}`);
  }

  async configureGit() {
    const result = await this.platform.promptGitPath();
    if (!result) {
      return;
    }
    if (result === true) {
      this.refresh();
      return;
    }
    if (!result.available) {
      throw new Error(result.error || result.detail || UI_TEXT.gitUnavailableDetail);
    }
    this.platform.alert(
      UI_TEXT.gitConfigured,
      `${result.version || result.detail || UI_TEXT.actionCompleted}\n${result.command}`
    );
    this.refresh();
  }

  requireSingleItem(eventContext) {
    const items = this.getSelectedItems(eventContext);
    if (items.length !== 1) {
      throw new Error(UI_TEXT.menuMultiSelectUnsupported);
    }
    return items[0];
  }

  getSelectedItems(eventContext = {}) {
    const context = eventContext.context ?? eventContext;
    const singleCandidates = [
      context.item ? [context.item] : null,
      context.selectedItem ? [context.selectedItem] : null,
      eventContext.item ? [eventContext.item] : null,
      eventContext.selectedItem ? [eventContext.selectedItem] : null
    ];
    const listCandidates = [
      context.items,
      context.selectedItems,
      eventContext.items,
      eventContext.selectedItems
    ];

    for (const candidate of singleCandidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(Boolean);
      }
    }

    for (const candidate of listCandidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(Boolean);
      }
    }

    const pane = this.platform.Zotero.getActiveZoteroPane?.();
    const paneItems = pane?.getSelectedItems?.();
    return Array.isArray(paneItems) ? paneItems.filter(Boolean) : [];
  }

  showError(error) {
    this.debug(`context menu action failed: ${error?.stack || error}`);
    this.platform.alert(UI_TEXT.menuUnavailable, error.message || String(error));
  }

  refresh() {
    this.clearMenuStateCache();
    this.platform.refreshItemPane();
  }

  formatDate(value) {
    try {
      return new Intl.DateTimeFormat(UI_TEXT.dateLocale || "zh-CN", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    }
    catch {
      return String(value);
    }
  }

  formatRestoreLabel(version) {
    const summary = version.changeSummary?.summary && version.changeSummary.summary !== version.note
      ? version.changeSummary.summary
      : "";
    const note = [version.note, summary].filter(Boolean).join(" · ");
    return [
      this.formatDate(version.createdAt),
      version.shortHash,
      this.formatVersionKind(version),
      note,
      version.fileName
    ].filter(Boolean).join(" · ");
  }

  formatVersionKind(version) {
    if (version.kind === "safety") {
      return UI_TEXT.versionKindSafety;
    }
    if (version.source === "git") {
      return UI_TEXT.versionKindGit;
    }
    return UI_TEXT.versionKindManual;
  }

  formatChangeDetails(changeSummary, limit = 3) {
    if (changeSummary?.changeGroups?.length) {
      const lines = [];
      for (const group of changeSummary.changeGroups.slice(0, limit)) {
        lines.push(`- ${group.summary || group.label}`);
        for (const change of (group.changes ?? []).slice(0, 2)) {
          lines.push(`  - ${this.formatParagraphChange(change)}`);
        }
      }
      const omitted = changeSummary.omittedChanges > 0
        ? `\n- ${formatText("omittedParagraphChangesDialog", { count: changeSummary.omittedChanges })}`
        : "";
      return `\n\n${UI_TEXT.concreteChanges}${UI_TEXT.colon}\n${lines.join("\n")}${omitted}`;
    }
    const changes = changeSummary?.displayChanges ?? changeSummary?.paragraphChanges ?? [];
    if (!changes.length) {
      return "";
    }
    const lines = changes.slice(0, limit).map((change) => `- ${this.formatParagraphChange(change)}`);
    const omitted = changeSummary.omittedChanges > 0
      ? `\n- ${formatText("omittedParagraphChangesDialog", { count: changeSummary.omittedChanges })}`
      : "";
    return `\n\n${UI_TEXT.concreteChanges}${UI_TEXT.colon}\n${lines.join("\n")}${omitted}`;
  }

  formatParagraphChange(change) {
    const location = change.locationLabel ? `${change.locationLabel}${UI_TEXT.colon}` : "";
    if (change.type === "added") {
      return `${location}${UI_TEXT.changeAdded}${UI_TEXT.colon}${change.newText}`;
    }
    if (change.type === "deleted") {
      return `${location}${UI_TEXT.changeDeleted}${UI_TEXT.colon}${change.oldText}`;
    }
    if (change.type === "modified") {
      return `${location}${UI_TEXT.changeKindModified}${UI_TEXT.colon}${change.oldText} → ${change.newText}`;
    }
    return `${location}${change.newText || change.oldText || UI_TEXT.actionCompleted}`;
  }

  debug(message) {
    this.platform?.Zotero?.debug?.(`git4zotero: ${message}`);
  }
}
