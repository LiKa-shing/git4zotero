import { SECTION_ID, UI_TEXT } from "./constants.mjs";

const XHTML_NS = "http://www.w3.org/1999/xhtml";
const ROOT_INLINE_STYLE = "display:block;box-sizing:border-box;width:100%;min-width:0;min-height:72px;color:CanvasText;background:Canvas;";
const PANEL_INLINE_STYLE = "display:flex;flex-direction:column;gap:12px;box-sizing:border-box;width:100%;min-width:0;max-width:100%;min-height:72px;color:CanvasText;background:Canvas;padding:8px 4px 12px;";
const STATUS_INLINE_STYLE = "display:block;box-sizing:border-box;color:CanvasText;background:Canvas;border:1px solid ButtonBorder;border-radius:4px;line-height:1.5;overflow-wrap:anywhere;padding:8px 10px;";
const SECTION_INLINE_STYLE = "display:flex;flex-direction:column;gap:8px;min-width:0;color:CanvasText;";
const TIMELINE_INLINE_STYLE = "display:grid;overflow:visible;padding:2px 0;min-width:0;color:CanvasText;";
const TIMELINE_ITEM_INLINE_STYLE = "display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;position:relative;min-width:0;padding:0 0 12px;color:CanvasText;";
const TIMELINE_LINE_INLINE_STYLE = "display:block;position:absolute;top:0;bottom:-2px;left:8px;width:2px;background:ButtonBorder;";
const TIMELINE_NODE_INLINE_STYLE = "display:block;box-sizing:border-box;width:12px;height:12px;margin-top:4px;justify-self:center;align-self:start;border:2px solid #1565c0;border-radius:50%;background:Canvas;z-index:1;";
const TIMELINE_BODY_INLINE_STYLE = "display:grid;gap:6px;min-width:0;color:CanvasText;";
const TIMELINE_HEADER_INLINE_STYLE = "display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-width:0;color:CanvasText;";
const PRIMARY_TEXT_INLINE_STYLE = "color:CanvasText;overflow-wrap:anywhere;";
const SECONDARY_TEXT_INLINE_STYLE = "color:GrayText;overflow-wrap:anywhere;";
const BADGE_INLINE_STYLE = "display:inline-block;flex:0 0 auto;white-space:nowrap;color:GrayText;background:Canvas;border:1px solid ButtonBorder;border-radius:999px;font-size:11px;line-height:1.2;padding:2px 6px;";
const SCOPED_TIMELINE_STYLE = `
.git4zotero-panel-root {
  display: block !important;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 72px;
  color: CanvasText;
  background: Canvas;
}

.git4zotero-panel-root .git4zotero-panel {
  display: flex !important;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 72px;
  padding: 8px 4px 12px;
  color: CanvasText;
  background: Canvas;
}

.git4zotero-panel-root .git4zotero-toolbar {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.git4zotero-panel-root .git4zotero-refresh-button {
  color: CanvasText;
  background: Canvas;
  border: 1px solid ButtonBorder;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.3;
  padding: 3px 8px;
}

.git4zotero-panel-root .git4zotero-status,
.git4zotero-panel-root .git4zotero-change,
.git4zotero-panel-root .git4zotero-change-summary,
.git4zotero-panel-root .git4zotero-working-tree {
  display: block;
  box-sizing: border-box;
  color: CanvasText;
  background: Canvas;
  border: 1px solid ButtonBorder;
  border-radius: 4px;
  overflow-wrap: anywhere;
}

.git4zotero-panel-root .git4zotero-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  color: CanvasText;
}

.git4zotero-panel-root .git4zotero-section-title,
.git4zotero-panel-root .git4zotero-timeline-note,
.git4zotero-panel-root .git4zotero-change-kind {
  color: CanvasText;
}

.git4zotero-panel-root .git4zotero-file,
.git4zotero-panel-root .git4zotero-hint,
.git4zotero-panel-root .git4zotero-version-meta,
.git4zotero-panel-root .git4zotero-timeline-meta,
.git4zotero-panel-root .git4zotero-change-location,
.git4zotero-panel-root .git4zotero-version-badge {
  color: GrayText;
}

.git4zotero-panel-root .git4zotero-timeline {
  display: grid !important;
  overflow: visible;
  padding: 2px 0;
  min-width: 0;
}

.git4zotero-panel-root .git4zotero-timeline-item {
  display: grid !important;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  position: relative;
  padding: 0 0 12px;
}

.git4zotero-panel-root .git4zotero-timeline-item:last-child {
  padding-bottom: 0;
}

.git4zotero-panel-root .git4zotero-timeline-line {
  display: block;
  position: absolute;
  top: 0;
  bottom: -2px;
  left: 8px;
  width: 2px;
  background: ButtonBorder;
}

.git4zotero-panel-root .git4zotero-timeline-item:last-child .git4zotero-timeline-line {
  bottom: calc(100% - 12px);
}

.git4zotero-panel-root .git4zotero-timeline-node {
  display: block;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  justify-self: center;
  align-self: start;
  border: 2px solid #1565c0;
  border-radius: 50%;
  background: Canvas;
  z-index: 1;
}

.git4zotero-panel-root .git4zotero-timeline-node-safety {
  border-color: #b26a00;
}

.git4zotero-panel-root .git4zotero-timeline-node-git {
  border-color: #6a5acd;
}

.git4zotero-panel-root .git4zotero-timeline-body,
.git4zotero-panel-root .git4zotero-change-list,
.git4zotero-panel-root .git4zotero-workflow {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.git4zotero-panel-root .git4zotero-timeline-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
`;

export class PaperVersionPane {
  constructor({ service, platform }) {
    this.service = service;
    this.platform = platform;
    this.renderTokens = new WeakMap();
    this.asyncStates = new WeakMap();
    this.revealStates = new WeakMap();
    this.liveBodies = new Map();
    this.stateCache = new Map();
    this.refreshTimers = new Map();
    this.currentPaneItems = new Map();
    this.paneContext = {
      doc: null,
      paneID: SECTION_ID,
      refresh: null
    };
    this.actualPaneID = SECTION_ID;
  }

  setActualPaneID(paneID) {
    if (!paneID) {
      return;
    }
    this.actualPaneID = String(paneID);
    this.paneContext.paneID = this.actualPaneID;
    this.debug(`item pane actualPaneID=${this.actualPaneID}`);
  }

  init(renderContext = {}) {
    this.capturePaneContext(renderContext, "init");
  }

  bodyXHTML() {
    const loading = this.escapeXHTML(UI_TEXT.loading);
    return `<div xmlns="${XHTML_NS}" class="git4zotero-panel-root" data-git4zotero-root="true" data-git4zotero-status="bodyXHTML" data-git4zotero-version-count="0" data-git4zotero-render-phase="bodyXHTML" style="${ROOT_INLINE_STYLE}"><div class="git4zotero-panel" data-git4zotero-status="bodyXHTML" data-git4zotero-version-count="0" data-git4zotero-render-phase="bodyXHTML" style="${PANEL_INLINE_STYLE}"><div class="git4zotero-status" style="${STATUS_INLINE_STYLE}"><strong>${loading}</strong></div></div></div>`;
  }

  updateItemAvailability(renderContext = {}) {
    const { body, item, setEnabled, setSectionSummary } = renderContext;
    this.capturePaneContext(renderContext, "item-change");
    const enabled = this.isRenderableItem(item);
    const paneID = this.getActualPaneID(renderContext);
    this.rememberCurrentItem(paneID, item);
    this.markItemIdentity(body, item, paneID);
    setEnabled?.(enabled);
    setSectionSummary?.(enabled ? "" : UI_TEXT.noItem);
    return enabled;
  }

  handleItemChange(renderContext = {}) {
    const enabled = this.updateItemAvailability(renderContext);
    if (enabled && renderContext.body) {
      this.render(renderContext, { reason: "item-change" });
    }
    return enabled;
  }

  render(renderContext, options = {}) {
    const shell = this.renderShell(renderContext);
    this.scheduleAsyncRender(renderContext, shell.token, {
      reason: options.reason ?? "render",
      source: "self-scheduled"
    });
    return shell;
  }

  renderShell(renderContext) {
    const { body, item, setSectionSummary } = renderContext;
    this.capturePaneContext(renderContext, "render-shell");
    const paneID = this.getActualPaneID(renderContext);
    this.rememberCurrentItem(paneID, item);
    this.debug("item pane render shell");
    this.expandContainingSection(body);
    const token = this.nextToken(body);
    this.markBody(body);
    const root = this.ensureRoot(body);
    this.markItemIdentity(body, item, paneID);
    this.clear(root);
    this.injectScopedStyle(body);
    const panel = this.el(body.ownerDocument, "div", "git4zotero-panel");
    root.append(panel);
    this.setPanelDiagnostics(panel, { status: "loading", renderPhase: "shell" });
    panel.append(this.status(body.ownerDocument, UI_TEXT.loading));
    setSectionSummary?.(UI_TEXT.loading);
    this.debug(`item pane shell rendered root=${!!root}, styleInjected=${root.getAttribute?.("data-git4zotero-style-injected") === "true"}, children=${panel.childNodes?.length ?? panel.children?.length ?? 0}`);
    this.registerLiveBody({ body, item, paneID, panel, root, setSectionSummary, token });
    const cached = this.getCachedState({ paneID, item });
    if (cached) {
      this.renderState({ body, item, panel, state: cached.state, setSectionSummary, token, paneID });
      this.debug(`item pane cached state rendered in shell actualPaneID=${paneID}, item=${cached.itemIdentity}, ageMs=${Date.now() - cached.updatedAt}`);
    }
    else {
      this.revealPane(body, { token, phase: "shell", reason: "renderShell", paneID });
    }
    return { root, panel, token, paneID };
  }

  scheduleAsyncRender(renderContext, token, { reason = "render", source = "self-scheduled" } = {}) {
    const { body } = renderContext;
    if (!body || !token || this.isStale(body, token)) {
      return null;
    }

    const asyncState = this.getAsyncState(body);
    if (asyncState.scheduledToken === token || asyncState.runningToken === token || asyncState.completedToken === token) {
      this.debug(`item pane self async render skipped token=${token}, reason=${reason}`);
      return asyncState.promise ?? null;
    }

    asyncState.scheduledToken = token;
    this.debug(`item pane self async render scheduled token=${token}, reason=${reason}`);

    const run = () => {
      const currentState = this.getAsyncState(body);
      if (currentState.scheduledToken !== token || this.isStale(body, token)) {
        this.debug(`item pane self async render stale before start token=${token}`);
        return;
      }
      currentState.scheduledToken = null;
      void this.renderAsync(renderContext, { source, token });
    };

    const win = body.ownerDocument?.defaultView;
    const runLater = win?.setTimeout ?? globalThis.setTimeout;
    if (typeof runLater === "function") {
      runLater(run, 0);
    }
    else {
      Promise.resolve().then(run);
    }
    return null;
  }

  async renderAsync(renderContext, options = {}) {
    const { body, item, setSectionSummary } = renderContext;
    const source = options.source ?? "direct";
    this.capturePaneContext(renderContext, "async-render");
    const paneID = options.paneID ?? this.getActualPaneID(renderContext);
    if (this.isConnected(body)) {
      this.rememberCurrentItem(paneID, item);
    }
    this.debug(`item pane async render start source=${source}, actualPaneID=${paneID}`);
    this.expandContainingSection(body);
    this.markBody(body);
    const root = this.ensureRoot(body);
    this.markItemIdentity(body, item, paneID);
    this.injectScopedStyle(body);
    let token = options.token ?? this.renderTokens.get(body);
    let panel = this.getPanel(root) ?? this.getPanel(body);
    if (!token || !panel) {
      ({ panel, token } = this.renderShell(renderContext));
    }

    const asyncState = this.getAsyncState(body);
    if (asyncState.scheduledToken === token) {
      asyncState.scheduledToken = null;
    }
    if (asyncState.runningToken === token && asyncState.promise) {
      this.debug(`item pane async render reused source=${source}, token=${token}`);
      return asyncState.promise;
    }
    if (asyncState.completedToken === token) {
      this.debug(`item pane async render skipped completed source=${source}, token=${token}`);
      return null;
    }

    this.registerLiveBody({ body, item, paneID, panel, root, setSectionSummary, token });
    const promise = this.performAsyncRender({ ...renderContext, paneID, panel, token, source });
    asyncState.runningToken = token;
    asyncState.promise = promise;
    try {
      return await promise;
    }
    finally {
      const currentState = this.getAsyncState(body);
      if (currentState.runningToken === token) {
        currentState.runningToken = null;
        currentState.promise = null;
        currentState.completedToken = token;
      }
    }
  }

  async performAsyncRender({ body, item, setSectionSummary, panel, token, source, paneID }) {
    try {
      if (!this.isRenderableItem(item)) {
        if (this.isStale(body, token)) {
          return;
        }
        const target = this.resolveWritableTarget({ body, item, setSectionSummary, panel, token, paneID, source });
        if (!target) {
          return;
        }
        this.clear(target.panel);
        this.setPanelDiagnostics(target.panel, { status: "no-item", renderPhase: "state" });
        target.panel.append(this.status(target.doc, UI_TEXT.noItem));
        target.setSectionSummary?.(UI_TEXT.noItem);
        this.revealPane(target.body, { token: target.token, phase: "state", reason: "no-item", paneID: target.paneID });
        this.debug(`item pane async render complete source=${source}`);
        return;
      }

      const state = await this.service.getPanelState(item);
      this.cacheState({ paneID, item, state, source });
      if (this.isStale(body, token)) {
        this.debug("item pane async render stale");
        if (!this.requestRefresh({ body, item, paneID, reason: "stale-async-state", source })) {
          this.debug(`item pane refresh deferred for stale detached body actualPaneID=${paneID}, item=${this.itemIdentity(item)}, source=${source}`);
        }
        return;
      }
      this.debug(`state attachment=${!!state.attachment}, enabled=${!!state.enabled}, git=${state.git?.available ?? "skipped"}`);
      const target = this.resolveWritableTarget({ body, item, setSectionSummary, panel, token, paneID, source });
      if (!target) {
        this.debug(`item pane pending cached state actualPaneID=${paneID}, item=${this.itemIdentity(item)}, source=${source}`);
        if (!this.requestRefresh({ body, item, paneID, reason: "detached-async-target", source })) {
          this.debug(`item pane refresh deferred for detached body actualPaneID=${paneID}, item=${this.itemIdentity(item)}, source=${source}`);
        }
        return;
      }
      this.renderState({ body: target.body, item, panel: target.panel, state, setSectionSummary: target.setSectionSummary, token: target.token, paneID: target.paneID });
      this.debug(`item pane async render complete source=${source}`);
    }
    catch (error) {
      if (this.isStale(body, token)) {
        return;
      }
      this.debug(`item pane async render failed: ${error?.stack || error}`);
      const target = this.resolveWritableTarget({ body, item, setSectionSummary, panel, token, paneID, source });
      if (!target) {
        return;
      }
      this.renderError(target.body, error, target.setSectionSummary);
      this.revealPane(target.body, { token: target.token, phase: "error", reason: "renderError", paneID: target.paneID });
    }
  }

  renderState({ body, item, panel, state, setSectionSummary, token, paneID }) {
    const doc = panel.ownerDocument;
    this.clear(panel);
    const versionCount = state.versions?.length ?? 0;
    panel.append(this.toolbar(doc, { body, item, setSectionSummary, paneID }));

    if (!state.attachment) {
      this.setPanelDiagnostics(panel, { status: "no-attachment", versionCount, renderPhase: "state" });
      panel.append(
        this.status(doc, UI_TEXT.noDocument, "warning", UI_TEXT.noDocumentDetail),
        this.workflow(doc, state)
      );
      setSectionSummary?.(UI_TEXT.noDocument);
      this.debugRenderComplete(panel, state, "no-attachment");
      this.revealPane(body, { token, phase: "state", reason: "no-attachment", paneID });
      return;
    }

    panel.append(this.fileSummary(doc, state.attachment));

    if (!state.enabled) {
      this.setPanelDiagnostics(panel, { status: "disabled", versionCount, renderPhase: "state" });
      panel.append(
        this.status(doc, UI_TEXT.notEnabled, "", UI_TEXT.notEnabledDetail),
        this.workflow(doc, state)
      );
      setSectionSummary?.(UI_TEXT.notEnabled);
      this.debugRenderComplete(panel, state, "disabled");
      this.revealPane(body, { token, phase: "state", reason: "disabled", paneID });
      return;
    }

    if (!state.git?.available) {
      this.setPanelDiagnostics(panel, { status: "git-unavailable", versionCount, renderPhase: "state" });
      panel.append(this.history(doc, state.versions));
      this.appendOptional(panel, this.repositoryHealth(doc, state.health));
      panel.append(
        this.status(doc, UI_TEXT.gitUnavailable, "warning", state.git?.detail || UI_TEXT.gitUnavailableDetail),
        this.lastCheck(doc, state.lastCheck),
        this.workflow(doc, state)
      );
      setSectionSummary?.(UI_TEXT.gitUnavailable);
      this.debugRenderComplete(panel, state, "git-unavailable");
      this.revealPane(body, { token, phase: "state", reason: "git-unavailable", paneID });
      return;
    }

    this.setPanelDiagnostics(panel, { status: "ready", versionCount, renderPhase: "state" });
    panel.append(this.history(doc, state.versions));
    this.appendOptional(panel, this.repositoryHealth(doc, state.health));
    panel.append(
      this.status(doc, state.git.detail || UI_TEXT.actionCompleted),
      this.lastCheck(doc, state.lastCheck),
      this.workingTree(doc, state.workingTree ?? state.lastCheck?.workingTree ?? null),
      this.workflow(doc, state)
    );
    setSectionSummary?.(this.stateSummary(state));
    this.debugRenderComplete(panel, state, "ready");
    this.revealPane(body, { token, phase: "state", reason: "ready", paneID });
  }

  toolbar(doc, { body, item, setSectionSummary, paneID }) {
    const toolbar = this.el(doc, "div", "git4zotero-toolbar");
    const button = this.el(doc, "button", "git4zotero-refresh-button");
    button.setAttribute("type", "button");
    button.setAttribute("aria-label", UI_TEXT.refreshPanel);
    button.textContent = UI_TEXT.refreshPanel;
    button.addEventListener?.("click", () => {
      this.manualRefresh({ body, item, setSectionSummary, paneID });
    });
    toolbar.append(button);
    return toolbar;
  }

  manualRefresh({ body, item, setSectionSummary, paneID }) {
    if (!body || !this.isConnected(body)) {
      this.debug(`item pane manual refresh ignored detached body actualPaneID=${paneID || this.actualPaneID}`);
      return;
    }
    this.debug(`item pane manual refresh requested actualPaneID=${paneID || this.actualPaneID}, item=${this.itemIdentity(item)}`);
    this.render({ body, item, setSectionSummary, paneID }, { reason: "manual-refresh" });
  }

  stateSummary(state) {
    const versionCount = state.versions?.length ?? 0;
    const workingTree = state.workingTree ?? state.lastCheck?.workingTree ?? null;
    const workingTreeSummary = workingTree?.clean === false
      ? "有未提交修改"
      : (workingTree?.clean ? "工作树干净" : "尚未检查工作树");
    const latestSummary = this.latestVersionSummary(state.versions?.[0]);
    return [
      "已启用",
      `${versionCount} 个版本`,
      latestSummary ? `最新 ${latestSummary}` : "",
      workingTreeSummary
    ].filter(Boolean).join(" · ");
  }

  latestVersionSummary(version) {
    if (!version) {
      return "";
    }
    return [
      version.shortHash,
      this.formatDate(version.createdAt)
    ].filter(Boolean).join(" ");
  }

  workflow(doc, state) {
    const section = this.section(doc, "工作流");
    const list = this.el(doc, "ol", "git4zotero-workflow");
    for (const step of this.workflowSteps(state)) {
      list.append(this.workflowStep(doc, step));
    }
    section.append(list);
    return section;
  }

  workflowSteps(state) {
    if (!state.attachment) {
      return [
        {
          tone: "current",
          title: "添加论文附件",
          detail: "为当前条目添加 .docx 或 .doc 文件后再进行版本管理。"
        }
      ];
    }

    if (!state.enabled) {
      return [
        {
          tone: "current",
          title: "启用版本管理",
          detail: `右键条目或附件，选择“${UI_TEXT.menuRoot} → ${UI_TEXT.enableManagement}”。`
        },
        {
          tone: "pending",
          title: "检查修改并创建首个版本",
          detail: `启用后使用“${UI_TEXT.checkChanges}”确认差异，再使用“${UI_TEXT.createVersion}”。`
        }
      ];
    }

    if (!state.git?.available) {
      return [
        {
          tone: "done",
          title: "版本管理已启用",
          detail: state.attachment.fileName
        },
        {
          tone: "current",
          title: "配置 Git",
          detail: `打开设置页填写 Git 路径，或右键选择“${UI_TEXT.menuConfigureGit}”。`
        }
      ];
    }

    const hasHistory = (state.versions?.length ?? 0) > 0;
    const workingTree = state.workingTree ?? state.lastCheck?.workingTree ?? null;
    return [
      {
        tone: "done",
        title: "版本管理已启用",
        detail: state.attachment.fileName
      },
      {
        tone: "current",
        title: hasHistory ? "检查当前修改" : "检查并创建首个版本",
        detail: `保存论文文件后，右键选择“${UI_TEXT.checkChanges}”；确认无误后选择“${UI_TEXT.createVersion}”。`
      },
      {
        tone: hasHistory ? "available" : "pending",
        title: "恢复历史版本",
        detail: hasHistory
          ? `已有 ${state.versions.length} 个版本，可右键选择“恢复版本...”。`
          : "创建首个版本后，这里会显示可恢复的历史。"
      },
      {
        tone: workingTree?.clean === false ? "warning" : "done",
        title: "工作树状态",
        detail: workingTree?.clean === false
          ? "检测到未提交修改，创建版本后会进入历史记录。"
          : (workingTree?.summary || UI_TEXT.workingTreeClean)
      }
    ];
  }

  workflowStep(doc, step) {
    const item = this.el(doc, "li", `git4zotero-workflow-step git4zotero-workflow-${step.tone}`);
    const title = this.el(doc, "strong");
    title.textContent = step.title;
    item.append(title);
    if (step.detail) {
      item.append(this.el(doc, "br"), this.text(doc, step.detail));
    }
    return item;
  }

  fileSummary(doc, attachment) {
    const wrapper = this.el(doc, "div", "git4zotero-file");
    const title = this.el(doc, "strong");
    title.textContent = `${UI_TEXT.currentFile}：${attachment.fileName}`;
    const mode = attachment.extension === ".docx"
      ? UI_TEXT.contentModeDocx
      : (attachment.extension === ".doc" ? UI_TEXT.docFileOnlyTracking : UI_TEXT.contentModeFileOnly);
    wrapper.append(
      title,
      this.el(doc, "br"),
      this.text(doc, mode)
    );
    return wrapper;
  }

  lastCheck(doc, lastCheck) {
    const section = this.section(doc, UI_TEXT.lastCheck);
    if (!lastCheck) {
      section.append(this.status(doc, UI_TEXT.neverChecked));
      return section;
    }

    section.append(this.status(
      doc,
      lastCheck.changeSummary?.summary ?? UI_TEXT.actionCompleted,
      "",
      `${this.formatDate(lastCheck.checkedAt)} · ${this.formatSize(lastCheck.fileSize)}`
    ));

    if (lastCheck.contentSummary?.mode === "docx-content") {
      section.append(this.meta(doc, `正文 ${lastCheck.contentSummary.paragraphCount} 段 · ${lastCheck.contentSummary.wordCount} 字/词`));
    }
    else if (lastCheck.contentSummary?.extension === ".doc") {
      section.append(this.meta(doc, UI_TEXT.docFileOnlyTracking));
    }
    const changes = this.changeList(doc, lastCheck.changeSummary, 5);
    if (changes) {
      section.append(changes);
    }
    return section;
  }

  workingTree(doc, workingTree) {
    const section = this.section(doc, UI_TEXT.workingTree);
    if (!workingTree) {
      section.append(this.status(doc, UI_TEXT.workingTreeUninitialized));
      return section;
    }

    if (workingTree.clean) {
      section.append(this.status(doc, workingTree.summary || UI_TEXT.workingTreeClean, "success"));
      return section;
    }

    const pre = this.el(doc, "pre", "git4zotero-working-tree");
    pre.textContent = workingTree.entries?.join("\n") || workingTree.summary;
    section.append(this.status(doc, UI_TEXT.workingTree, "warning"), pre);
    return section;
  }

  repositoryHealth(doc, health) {
    if (!health) {
      return null;
    }

    const section = this.section(doc, UI_TEXT.repositoryHealth);
    const tone = health.errorCount > 0
      ? "warning"
      : (health.warningCount > 0 ? "warning" : "success");
    section.append(this.status(doc, health.summary, tone));

    const issues = (health.checks ?? []).filter((check) => check.status !== "ok");
    for (const issue of issues.slice(0, 4)) {
      section.append(this.meta(doc, `${issue.label}：${issue.detail}`));
    }
    if (issues.length > 4) {
      section.append(this.meta(doc, `另有 ${issues.length - 4} 个问题未展开。`));
    }
    return section;
  }

  history(doc, versions) {
    const section = this.section(doc, UI_TEXT.versionHistory);
    if (!versions.length) {
      section.append(this.status(doc, UI_TEXT.emptyHistory));
      return section;
    }

    const timeline = this.el(doc, "div", "git4zotero-timeline");
    for (const version of versions) {
      timeline.append(this.versionTimelineItem(doc, version));
    }
    section.append(timeline);
    return section;
  }

  versionTimelineItem(doc, version) {
    const item = this.el(doc, "article", "git4zotero-timeline-item");
    const line = this.el(doc, "span", "git4zotero-timeline-line");
    const node = this.el(doc, "span", `git4zotero-timeline-node git4zotero-timeline-node-${this.versionTone(version)}`);
    const body = this.el(doc, "div", "git4zotero-timeline-body");
    const header = this.el(doc, "div", "git4zotero-timeline-header");
    const note = this.el(doc, "div", "git4zotero-timeline-note");
    note.textContent = version.note;
    const badge = this.el(doc, "span", `git4zotero-version-badge git4zotero-version-badge-${this.versionTone(version)}`);
    badge.textContent = this.versionKindLabel(version);
    header.append(note, badge);

    const meta = this.el(doc, "div", "git4zotero-timeline-meta");
    meta.textContent = [
      this.formatDate(version.createdAt),
      version.shortHash,
      version.author,
      version.fileName,
      Number.isFinite(version.fileSize) ? this.formatSize(version.fileSize) : ""
    ].filter(Boolean).join(" · ");

    body.append(header, meta);

    if (version.changeSummary?.summary) {
      const summary = this.el(doc, "div", "git4zotero-change-summary");
      summary.textContent = version.changeSummary.summary;
      body.append(summary);
    }
    body.append(this.versionDetails(doc, version));
    const changes = this.changeList(doc, version.changeSummary, 2);
    if (changes) {
      body.append(changes);
    }

    item.append(line, node, body);
    return item;
  }

  versionDetails(doc, version) {
    const details = this.el(doc, "details", "git4zotero-version-details");
    const summary = this.el(doc, "summary", "git4zotero-version-details-summary");
    summary.textContent = UI_TEXT.versionDetails;
    const list = this.el(doc, "dl", "git4zotero-version-details-list");
    const rows = [
      ["版本说明", version.note || UI_TEXT.defaultNote],
      ["创建时间", this.formatDate(version.createdAt)],
      ["Git hash", version.commitHash || version.id || "unknown"],
      ["文件名", version.fileName || "unknown"],
      ["文件大小", this.formatSize(version.fileSize)],
      ["版本类型", this.versionKindLabel(version)],
      ["安全备份", version.kind === "safety" ? "是，恢复前自动备份" : "否"],
      ["变化摘要", version.changeSummary?.summary || UI_TEXT.actionCompleted]
    ];
    if (version.contentSummary?.extension === ".doc") {
      rows.push(["跟踪方式", UI_TEXT.docFileOnlyTracking]);
    }
    for (const [label, value] of rows) {
      const term = this.el(doc, "dt");
      term.textContent = label;
      const description = this.el(doc, "dd");
      description.textContent = value;
      list.append(term, description);
    }
    details.append(summary, list);
    return details;
  }

  appendOptional(parent, child) {
    if (child) {
      parent.append(child);
    }
  }

  versionTone(version) {
    if (version.kind === "safety") {
      return "safety";
    }
    if (version.source === "git") {
      return "git";
    }
    return "manual";
  }

  versionKindLabel(version) {
    if (version.kind === "safety") {
      return "自动备份";
    }
    if (version.source === "git") {
      return "Git 历史";
    }
    return "手动";
  }

  changeList(doc, changeSummary, limit = 5) {
    if (changeSummary?.changeGroups?.length) {
      return this.changeGroupList(doc, changeSummary, limit);
    }
    const changes = changeSummary?.paragraphChanges?.length
      ? changeSummary.paragraphChanges
      : (changeSummary?.displayChanges ?? []);
    if (!changes.length) {
      return null;
    }

    const wrapper = this.el(doc, "div", "git4zotero-change-list");
    const shownChanges = changes.slice(0, limit);
    for (const change of shownChanges) {
      wrapper.append(this.changeItem(doc, change));
    }

    const totalChanges = Number.isFinite(changeSummary?.totalParagraphChanges)
      ? changeSummary.totalParagraphChanges
      : changes.length + Math.max(0, changeSummary?.omittedChanges ?? 0);
    const omitted = Math.max(0, totalChanges - shownChanges.length);
    if (omitted > 0) {
      wrapper.append(this.meta(doc, `另有 ${omitted} 处段落变化未展开。`));
    }

    return wrapper;
  }

  changeGroupList(doc, changeSummary, limit = 5) {
    const wrapper = this.el(doc, "div", "git4zotero-change-list");
    const groups = changeSummary.changeGroups.slice(0, limit);
    let shownChanges = 0;
    for (const group of groups) {
      const groupNode = this.el(doc, "div", "git4zotero-change-group");
      const title = this.el(doc, "strong", "git4zotero-change-group-title");
      title.textContent = group.summary || group.label;
      groupNode.append(title);
      for (const change of (group.changes ?? []).slice(0, Math.max(1, Math.min(2, limit)))) {
        groupNode.append(this.changeItem(doc, change));
        shownChanges += 1;
      }
      wrapper.append(groupNode);
    }

    const totalChanges = Number.isFinite(changeSummary?.totalParagraphChanges)
      ? changeSummary.totalParagraphChanges
      : shownChanges + Math.max(0, changeSummary?.omittedChanges ?? 0);
    const omitted = Math.max(0, totalChanges - shownChanges);
    if (omitted > 0) {
      wrapper.append(this.meta(doc, `另有 ${omitted} 处段落变化未展开。`));
    }
    return wrapper;
  }

  changeItem(doc, change) {
    const wrapper = this.el(doc, "div", "git4zotero-change");
    const kind = this.el(doc, "strong", "git4zotero-change-kind");
    kind.textContent = this.changeKind(change);
    wrapper.append(kind);

    const location = this.changeLocation(change);
    if (location) {
      const meta = this.el(doc, "span", "git4zotero-change-location");
      meta.textContent = location;
      wrapper.append(this.text(doc, " "), meta);
    }

    if (change.type === "modified") {
      wrapper.append(
        this.changeText(doc, "修改前", change.oldText),
        this.changeText(doc, "修改后", change.newText)
      );
      return wrapper;
    }

    if (change.type === "deleted") {
      wrapper.append(this.changeText(doc, "删除", change.oldText));
      return wrapper;
    }

    wrapper.append(this.changeText(doc, "新增", change.newText));
    return wrapper;
  }

  changeText(doc, label, value) {
    const line = this.el(doc, "div", "git4zotero-change-text");
    line.textContent = `${label}：${this.formatChangeText(value)}`;
    return line;
  }

  changeKind(change) {
    if (change.type === "added") {
      return "新增段落";
    }
    if (change.type === "deleted") {
      return "删除段落";
    }
    if (change.type === "modified") {
      return "修改段落";
    }
    return "段落变化";
  }

  changeLocation(change) {
    if (change.locationLabel) {
      return change.locationLabel;
    }
    const index = change.newIndex ?? change.oldIndex;
    const source = change.source && change.source !== "document" ? ` · ${change.source}` : "";
    return Number.isInteger(index) ? `第 ${index + 1} 段${source}` : source.trim();
  }

  formatChangeText(value) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) {
      return "（空段落）";
    }
    return text.length > 180 ? `${text.slice(0, 179)}…` : text;
  }

  section(doc, title) {
    const section = this.el(doc, "section", "git4zotero-section");
    const heading = this.el(doc, "strong", "git4zotero-section-title");
    heading.textContent = title;
    section.append(heading);
    return section;
  }

  status(doc, title, tone = "", detail = "") {
    const classes = ["git4zotero-status"];
    if (tone) {
      classes.push(`git4zotero-status-${tone}`);
    }
    const wrapper = this.el(doc, "div", classes.join(" "));
    const strong = this.el(doc, "strong");
    strong.textContent = title;
    wrapper.append(strong);
    if (detail) {
      wrapper.append(this.el(doc, "br"), this.text(doc, detail));
    }
    return wrapper;
  }

  hint(doc, value) {
    const hint = this.el(doc, "div", "git4zotero-hint");
    hint.textContent = value;
    return hint;
  }

  meta(doc, value) {
    const meta = this.el(doc, "div", "git4zotero-version-meta");
    meta.textContent = value;
    return meta;
  }

  renderError(body, error, setSectionSummary) {
    const panel = this.ensurePanel(body);
    this.clear(panel);
    this.setPanelDiagnostics(panel, { status: "error", renderPhase: "error" });
    panel.append(this.status(body.ownerDocument, UI_TEXT.operationFailed, "warning", error.message || String(error)));
    setSectionSummary?.(UI_TEXT.operationFailed);
  }

  ensurePanel(body) {
    this.markBody(body);
    const root = this.ensureRoot(body);
    this.injectScopedStyle(body);
    const panel = this.getPanel(root) ?? this.getPanel(body);
    if (panel) {
      return panel;
    }
    const created = this.el(body.ownerDocument, "div", "git4zotero-panel");
    this.setPanelDiagnostics(created, { status: "created", renderPhase: "ensure" });
    root.append(created);
    return created;
  }

  ensureRoot(body) {
    const existing = this.getRoot(body);
    if (existing) {
      existing.setAttribute?.("data-git4zotero-root", "true");
      this.applyVisibilityStyles(existing, "git4zotero-panel-root");
      return existing;
    }

    const root = this.el(body.ownerDocument, "div", "git4zotero-panel-root");
    root.setAttribute?.("data-git4zotero-root", "true");
    this.setRootDiagnostics(root, { status: "created", renderPhase: "ensure" });
    body.append(root);
    return root;
  }

  getRoot(body) {
    if (this.hasClass(body, "git4zotero-panel-root")) {
      return body;
    }
    if (typeof body.querySelector === "function") {
      const found = body.querySelector(".git4zotero-panel-root");
      if (found) {
        return found;
      }
    }
    return [...(body.childNodes ?? body.children ?? [])]
      .find((child) => this.hasClass(child, "git4zotero-panel-root")) ?? null;
  }

  injectScopedStyle(body) {
    if (!body) {
      return false;
    }
    const existing = typeof body.querySelector === "function"
      ? body.querySelector("[data-git4zotero-scoped-style='true']")
      : null;
    if (!existing) {
      const style = this.el(body.ownerDocument, "style");
      style.setAttribute?.("data-git4zotero-scoped-style", "true");
      style.textContent = SCOPED_TIMELINE_STYLE;
      body.append(style);
    }

    body.setAttribute?.("data-git4zotero-style-injected", "true");
    const root = this.getRoot(body);
    root?.setAttribute?.("data-git4zotero-style-injected", "true");
    const panel = root ? this.getPanel(root) : this.getPanel(body);
    panel?.setAttribute?.("data-git4zotero-style-injected", "true");
    return true;
  }

  expandContainingSection(body) {
    try {
      const section = this.findContainingSection(body);
      if (!section) {
        this.debug("item pane section expand attempted found=false");
        return;
      }

      section.hidden = false;
      section.collapsed = false;
      section.open = true;
      section.expanded = true;
      section.removeAttribute?.("hidden");
      section.removeAttribute?.("collapsed");
      section.setAttribute?.("open", "true");
      section.setAttribute?.("expanded", "true");

      if (section.classList?.remove) {
        section.classList.remove("hidden");
        section.classList.remove("collapsed");
      }
      else if (typeof section.className === "string") {
        section.className = section.className
          .split(/\s+/)
          .filter((className) => className && className !== "hidden" && className !== "collapsed")
          .join(" ");
      }

      let calledMethod = "";
      for (const method of ["expand", "show", "openSection"]) {
        if (typeof section[method] === "function") {
          section[method]();
          calledMethod = method;
          break;
        }
      }
      this.debug(`item pane section expand attempted found=true, tag=${section.localName || section.tagName || "unknown"}, method=${calledMethod || "none"}`);
    }
    catch (error) {
      this.debug(`item pane section expand skipped: ${error?.stack || error}`);
    }
  }

  findContainingSection(body) {
    let closestError = null;
    try {
      const closest = body?.closest?.("collapsible-section");
      if (closest) {
        return closest;
      }
    }
    catch (error) {
      closestError = error;
    }

    for (let node = body?.parentNode; node; node = node.parentNode) {
      const tagName = String(node.localName || node.tagName || "").toLowerCase();
      if (tagName === "collapsible-section" || tagName.includes("collapsible")) {
        return node;
      }
      if (node.getAttribute?.("collapsed") !== null || node.getAttribute?.("hidden") !== null) {
        return node;
      }
      if (this.hasClass(node, "collapsed") || this.hasClass(node, "hidden")) {
        return node;
      }
      if (Object.prototype.hasOwnProperty.call(node, "open") || Object.prototype.hasOwnProperty.call(node, "expanded")) {
        return node;
      }
    }

    if (closestError) {
      throw closestError;
    }
    return null;
  }

  capturePaneContext(renderContext = {}, source = "context") {
    const paneID = this.getActualPaneID(renderContext);
    const doc = renderContext?.doc ?? renderContext?.body?.ownerDocument ?? null;
    const refresh = typeof renderContext?.refresh === "function"
      ? renderContext.refresh
      : null;

    if (doc) {
      this.paneContext.doc = doc;
    }
    if (refresh) {
      this.paneContext.refresh = refresh;
    }
    this.paneContext.paneID = paneID;

    if (source === "init" || refresh) {
      this.debug(`item pane context captured source=${source}, actualPaneID=${paneID}, hasDoc=${!!this.paneContext.doc}, hasRefresh=${typeof this.paneContext.refresh === "function"}`);
    }
    return this.paneContext;
  }

  getActualPaneID(renderContext = {}) {
    const paneID = renderContext?.paneID || this.actualPaneID || SECTION_ID;
    if (paneID && paneID !== this.actualPaneID) {
      this.setActualPaneID(paneID);
    }
    return paneID || SECTION_ID;
  }

  paneIDCandidates(paneID = this.actualPaneID) {
    return [...new Set([paneID, this.actualPaneID, SECTION_ID].filter(Boolean).map(String))];
  }

  paneIDMatches(value, paneID = this.actualPaneID) {
    if (!value) {
      return false;
    }
    const actual = String(value);
    return this.paneIDCandidates(paneID).some((candidate) => actual === candidate)
      || actual.endsWith(SECTION_ID);
  }

  itemIdentity(item) {
    if (!item) {
      return "no-item";
    }
    const libraryID = item.libraryID ?? item.library?.libraryID ?? "";
    const key = item.key ?? "";
    const itemID = item.id ?? item.itemID ?? "";
    const attachmentKey = item.attachmentKey ?? "";
    const parts = [libraryID, key, itemID, attachmentKey].filter((part) => part !== "");
    return parts.length ? parts.map((part) => String(part)).join("/") : "anonymous-item";
  }

  liveBodyKey(paneID, itemIdentity) {
    return `${paneID || SECTION_ID}\n${itemIdentity || "no-item"}`;
  }

  rememberCurrentItem(paneID, item) {
    const identity = this.itemIdentity(item);
    for (const candidateID of this.paneIDCandidates(paneID)) {
      this.currentPaneItems.set(candidateID, identity);
    }
    return identity;
  }

  currentItemIdentity(paneID) {
    for (const candidateID of this.paneIDCandidates(paneID)) {
      const identity = this.currentPaneItems.get(candidateID);
      if (identity) {
        return identity;
      }
    }
    return "";
  }

  cacheState({ paneID, item, state, source = "async" }) {
    const actualPaneID = paneID || this.actualPaneID || SECTION_ID;
    const itemIdentity = this.itemIdentity(item);
    const entry = {
      itemIdentity,
      paneID: actualPaneID,
      source,
      state,
      updatedAt: Date.now()
    };
    this.stateCache.set(this.liveBodyKey(actualPaneID, itemIdentity), entry);
    this.debug(`item pane state cached actualPaneID=${actualPaneID}, item=${itemIdentity}, versions=${state?.versions?.length ?? 0}, source=${source}`);
    return entry;
  }

  getCachedState({ paneID, item }) {
    const itemIdentity = this.itemIdentity(item);
    for (const candidateID of this.paneIDCandidates(paneID)) {
      const entry = this.stateCache.get(this.liveBodyKey(candidateID, itemIdentity));
      if (entry?.itemIdentity === itemIdentity) {
        return entry;
      }
    }
    return null;
  }

  requestRefresh({ body = null, item = null, paneID = this.actualPaneID, reason = "state-cache", source = "async" } = {}) {
    const actualPaneID = paneID || this.actualPaneID || SECTION_ID;
    const itemIdentity = this.itemIdentity(item);
    const refresh = this.paneContext.refresh;
    if (typeof refresh !== "function") {
      this.debug(`item pane refresh unavailable actualPaneID=${actualPaneID}, item=${itemIdentity}, reason=${reason}, source=${source}`);
      return false;
    }

    const key = this.liveBodyKey(actualPaneID, itemIdentity);
    if (this.refreshTimers.has(key)) {
      this.debug(`item pane refresh skipped duplicate actualPaneID=${actualPaneID}, item=${itemIdentity}, reason=${reason}, source=${source}`);
      return true;
    }

    this.debug(`item pane refresh requested actualPaneID=${actualPaneID}, item=${itemIdentity}, reason=${reason}, source=${source}`);
    const run = () => {
      this.refreshTimers.delete(key);
      try {
        refresh();
      }
      catch (error) {
        this.debug(`item pane refresh failed actualPaneID=${actualPaneID}, item=${itemIdentity}: ${error?.stack || error}`);
      }
    };

    this.refreshTimers.set(key, true);
    const win = body?.ownerDocument?.defaultView ?? this.paneContext.doc?.defaultView;
    const runLater = win?.setTimeout ?? globalThis.setTimeout;
    if (typeof runLater === "function") {
      runLater(run, 0);
    }
    else {
      Promise.resolve().then(run);
    }
    return true;
  }

  markItemIdentity(body, item, paneID) {
    if (!body?.setAttribute) {
      return;
    }
    const actualPaneID = paneID || this.actualPaneID || SECTION_ID;
    const identity = this.itemIdentity(item);
    body.setAttribute("data-git4zotero-pane-id", actualPaneID);
    body.setAttribute("data-git4zotero-item-identity", identity);
    const root = this.getRoot(body);
    root?.setAttribute?.("data-git4zotero-pane-id", actualPaneID);
    root?.setAttribute?.("data-git4zotero-item-identity", identity);
    const section = this.findPaneSection(body, actualPaneID);
    section?.setAttribute?.("data-git4zotero-pane-id", actualPaneID);
    section?.setAttribute?.("data-git4zotero-item-identity", identity);
  }

  registerLiveBody({ body, item, paneID, panel = null, root = null, setSectionSummary = null, token = null }) {
    if (!body || !this.isConnected(body)) {
      return null;
    }
    const actualPaneID = paneID || this.actualPaneID || SECTION_ID;
    const identity = this.itemIdentity(item);
    this.pruneLiveBodies(actualPaneID, { body, itemIdentity: identity });
    const liveRoot = root ?? this.getRoot(body);
    const livePanel = panel ?? (liveRoot ? this.getPanel(liveRoot) : this.getPanel(body));
    const entry = {
      body,
      itemIdentity: identity,
      paneID: actualPaneID,
      panel: livePanel,
      root: liveRoot,
      setSectionSummary,
      token,
      updatedAt: Date.now()
    };
    this.liveBodies.set(this.liveBodyKey(actualPaneID, identity), entry);
    body.setAttribute?.("data-git4zotero-live-body", "true");
    liveRoot?.setAttribute?.("data-git4zotero-live-body", "true");
    livePanel?.setAttribute?.("data-git4zotero-live-body", "true");
    this.debug(`item pane live body registered actualPaneID=${actualPaneID}, item=${identity}, token=${token ?? "none"}`);
    return entry;
  }

  pruneLiveBodies(paneID, { body = null, itemIdentity = "" } = {}) {
    for (const [key, entry] of this.liveBodies) {
      if (!this.paneIDMatches(entry?.paneID ?? key.split("\n")[0], paneID)) {
        continue;
      }
      if (!entry?.body || !this.isConnected(entry.body) || (body && entry.body === body && entry.itemIdentity !== itemIdentity)) {
        this.liveBodies.delete(key);
      }
    }
  }

  resolveWritableTarget({ body, item, setSectionSummary, panel, token, paneID, source }) {
    const actualPaneID = paneID || this.actualPaneID || SECTION_ID;
    const identity = this.itemIdentity(item);
    if (this.isConnected(body)) {
      const root = this.getRoot(body);
      const currentPanel = panel && this.isConnected(panel)
        ? panel
        : (root ? this.getPanel(root) : this.getPanel(body)) ?? this.ensurePanel(body);
      this.registerLiveBody({ body, item, paneID: actualPaneID, panel: currentPanel, root, setSectionSummary, token });
      return {
        body,
        doc: body.ownerDocument,
        itemIdentity: identity,
        paneID: actualPaneID,
        panel: currentPanel,
        setSectionSummary,
        token
      };
    }

    this.debug(`item pane detached async target source=${source}, token=${token ?? "none"}, actualPaneID=${actualPaneID}, item=${identity}`);
    const docs = this.candidateDocuments(body?.ownerDocument);
    const rebound = this.findLiveBodyForItem({ docs, itemIdentity: identity, paneID: actualPaneID });
    if (!rebound) {
      const fallback = this.resolveFallbackSectionTarget({
        docs,
        item,
        itemIdentity: identity,
        paneID: actualPaneID,
        setSectionSummary,
        source,
        token
      });
      if (fallback) {
        return fallback;
      }
      this.debug(`item pane detached async target unresolved actualPaneID=${actualPaneID}, item=${identity}`);
      return null;
    }

    const reboundRoot = this.getRoot(rebound.body) ?? this.ensureRoot(rebound.body);
    this.injectScopedStyle(rebound.body);
    const reboundPanel = this.getPanel(reboundRoot) ?? this.getPanel(rebound.body) ?? this.ensurePanel(rebound.body);
    const reboundToken = this.renderTokens.get(rebound.body) ?? token;
    if (!this.renderTokens.get(rebound.body) && reboundToken) {
      this.renderTokens.set(rebound.body, reboundToken);
    }
    this.markItemIdentity(rebound.body, item, actualPaneID);
    this.registerLiveBody({
      body: rebound.body,
      item,
      paneID: actualPaneID,
      panel: reboundPanel,
      root: reboundRoot,
      setSectionSummary: rebound.setSectionSummary ?? setSectionSummary,
      token: reboundToken
    });
    this.debug(`item pane live body rebound source=${source}, token=${token ?? "none"}, actualPaneID=${actualPaneID}, item=${identity}, body=${this.nodeLabel(rebound.body)}`);
    return {
      body: rebound.body,
      doc: rebound.body.ownerDocument,
      itemIdentity: identity,
      paneID: actualPaneID,
      panel: reboundPanel,
      setSectionSummary: rebound.setSectionSummary ?? setSectionSummary,
      token: reboundToken
    };
  }

  findLiveBodyForItem({ doc = null, docs = null, itemIdentity, paneID }) {
    for (const candidateID of this.paneIDCandidates(paneID)) {
      const entry = this.liveBodies.get(this.liveBodyKey(candidateID, itemIdentity));
      if (entry?.body && this.isConnected(entry.body)) {
        return entry;
      }
    }

    for (const candidateDoc of docs ?? this.candidateDocuments(doc)) {
      const body = this.findLiveBodyInDocument(candidateDoc, paneID, itemIdentity);
      if (body) {
        return { body, itemIdentity, paneID, setSectionSummary: null };
      }
    }
    return null;
  }

  findLiveBodyInDocument(doc, paneID, itemIdentity) {
    const root = doc?.documentElement;
    const section = this.findPaneSectionInDocument(doc, paneID);
    if (!section) {
      return null;
    }

    const markedBody = this.findDescendant(section, (node) => node?.getAttribute?.("data-git4zotero-body") === "true");
    const candidate = markedBody ?? this.findBodyFromSection(section);
    if (!candidate || !this.isConnected(candidate)) {
      return null;
    }

    const existingIdentity = this.nodeItemIdentity(candidate);
    if (existingIdentity && existingIdentity !== itemIdentity) {
      if (!this.canRebindPaneIdentity(existingIdentity, itemIdentity, paneID)) {
        this.debug(`item pane live body candidate rejected item=${existingIdentity}, expected=${itemIdentity}`);
        return null;
      }
      this.debug(`item pane live body candidate rebinding item=${existingIdentity}, expected=${itemIdentity}`);
    }
    return candidate;
  }

  resolveFallbackSectionTarget({ docs, item, itemIdentity, paneID, setSectionSummary, token, source }) {
    const currentIdentity = this.currentItemIdentity(paneID);
    if (currentIdentity && currentIdentity !== itemIdentity) {
      this.debug(`item pane fallback section target rejected current item=${currentIdentity}, expected=${itemIdentity}, actualPaneID=${paneID}`);
      return null;
    }

    for (const doc of docs ?? []) {
      const section = this.findPaneSectionInDocument(doc, paneID);
      if (!section || !this.isConnected(section)) {
        continue;
      }

      const existingIdentity = this.nodeItemIdentity(section);
      if (existingIdentity && existingIdentity !== itemIdentity) {
        if (!this.canRebindPaneIdentity(existingIdentity, itemIdentity, paneID)) {
          this.debug(`item pane fallback section target rejected item=${existingIdentity}, expected=${itemIdentity}, actualPaneID=${paneID}`);
          continue;
        }
        this.debug(`item pane fallback section target rebinding item=${existingIdentity}, expected=${itemIdentity}, actualPaneID=${paneID}`);
      }

      const body = this.ensureFallbackBody(section, item, paneID);
      if (!body || !this.isConnected(body)) {
        continue;
      }

      const root = this.ensureRoot(body);
      this.markItemIdentity(body, item, paneID);
      this.injectScopedStyle(body);
      const fallbackPanel = this.getPanel(root) ?? this.getPanel(body) ?? this.ensurePanel(body);
      let fallbackToken = this.renderTokens.get(body);
      if (!fallbackToken && token) {
        fallbackToken = token;
        this.renderTokens.set(body, fallbackToken);
      }
      if (!fallbackToken) {
        fallbackToken = this.nextToken(body);
      }

      this.registerLiveBody({
        body,
        item,
        paneID,
        panel: fallbackPanel,
        root,
        setSectionSummary,
        token: fallbackToken
      });
      this.debug(`item pane fallback section target ready source=${source}, token=${token ?? "none"}, actualPaneID=${paneID}, item=${itemIdentity}, body=${this.nodeLabel(body)}`);
      return {
        body,
        doc: body.ownerDocument,
        itemIdentity,
        paneID,
        panel: fallbackPanel,
        setSectionSummary,
        token: fallbackToken
      };
    }
    return null;
  }

  ensureFallbackBody(section, item, paneID) {
    let body = this.findDescendant(section, (node) => node?.getAttribute?.("data-git4zotero-fallback-body") === "true");
    if (body) {
      return body;
    }

    const doc = section.ownerDocument;
    body = this.el(doc, "div");
    body.setAttribute?.("data-git4zotero-fallback-body", "true");
    this.markBody(body);
    this.markItemIdentity(body, item, paneID);
    section.append(body);
    this.debug(`item pane fallback section target created actualPaneID=${paneID}, item=${this.itemIdentity(item)}, section=${this.nodeLabel(section)}`);
    return body;
  }

  canRebindPaneIdentity(existingIdentity, itemIdentity, paneID) {
    return !existingIdentity
      || existingIdentity === itemIdentity
      || this.currentItemIdentity(paneID) === itemIdentity;
  }

  findPaneSectionInDocument(doc, paneID = this.actualPaneID) {
    return this.findDescendant(doc?.documentElement, (node) => this.isPaneSection(node, paneID));
  }

  candidateDocuments(preferredDoc = null) {
    const docs = [];
    const add = (doc) => {
      if (doc && !docs.includes(doc)) {
        docs.push(doc);
      }
    };

    add(preferredDoc);
    add(this.paneContext.doc);
    try {
      for (const win of this.platform?.Zotero?.getMainWindows?.() ?? []) {
        add(win?.document);
      }
    }
    catch (error) {
      this.debug(`item pane main window lookup failed: ${error?.stack || error}`);
    }
    return docs;
  }

  findBodyFromSection(section) {
    const root = this.findDescendant(section, (node) => this.hasClass(node, "git4zotero-panel-root"));
    if (root?.parentNode) {
      return root.parentNode;
    }
    return null;
  }

  nodeItemIdentity(node) {
    const direct = node?.getAttribute?.("data-git4zotero-item-identity");
    if (direct) {
      return direct;
    }
    const root = this.getRoot(node);
    return root?.getAttribute?.("data-git4zotero-item-identity") ?? "";
  }

  resolvePaneHost(body, paneID = this.actualPaneID) {
    let fallbackSection = null;
    try {
      fallbackSection = this.findContainingSection(body);
    }
    catch (error) {
      this.debug(`item pane host fallback section lookup failed: ${error?.stack || error}`);
    }

    const root = this.getRoot(body);
    const panel = root ? this.getPanel(root) : this.getPanel(body);
    const section = this.findPaneSection(body, paneID) ?? fallbackSection;
    const itemDetails = this.findItemDetails(body) ?? this.findItemDetails(section);
    const documentRoot = body?.ownerDocument?.documentElement ?? null;
    const sidenavButton = this.findSidenavButton(itemDetails ?? documentRoot, paneID);
    const scrollParent = this.findScrollParent(section ?? root ?? body);
    return { body, root, panel, section, itemDetails, paneID, sidenavButton, scrollParent };
  }

  revealPane(body, { token = null, phase = "render", reason = "", paneID = this.actualPaneID } = {}) {
    if (!body) {
      return null;
    }
    if (token && this.isStale(body, token)) {
      this.debug(`item pane reveal skipped stale token=${token}, phase=${phase}, reason=${reason}`);
      return null;
    }

    const revealState = this.getRevealState(body);
    const revealKey = `${token ?? "no-token"}:${phase}`;
    if (revealState.keys.has(revealKey)) {
      this.debug(`item pane reveal skipped duplicate token=${token ?? "none"}, phase=${phase}, reason=${reason}`);
      return revealState.lastHost;
    }
    revealState.keys.add(revealKey);

    const actualPaneID = paneID || this.actualPaneID || SECTION_ID;
    const host = this.resolvePaneHost(body, actualPaneID);
    this.markVisibilityProbe(host);
    const openedCount = this.openVisibilityChain(host);
    let method = "none";
    let scrollError = null;

    try {
      if (typeof host.itemDetails?.scrollToPane === "function") {
        host.itemDetails.scrollToPane(actualPaneID, "instant");
        method = "itemDetails.scrollToPane";
      }
      else {
        const scrollTarget = host.section ?? host.root ?? body;
        if (typeof scrollTarget?.scrollIntoView === "function") {
          scrollTarget.scrollIntoView({ block: "nearest" });
          method = `${this.nodeLabel(scrollTarget)}.scrollIntoView`;
        }
      }
    }
    catch (error) {
      scrollError = error;
      method = `${method}:failed`;
    }

    const diagnostics = this.visibilityDiagnostics(host);
    this.debug(`item pane reveal attempted token=${token ?? "none"}, phase=${phase}, reason=${reason || "none"}, actualPaneID=${actualPaneID}, method=${method}, opened=${openedCount}, ${diagnostics}${scrollError ? `, error=${scrollError?.message || scrollError}` : ""}`);
    const warning = this.visibilityWarning(host);
    if (warning) {
      this.debug(`item pane visibility warning ${warning}`);
    }
    revealState.lastHost = host;
    return host;
  }

  findPaneSection(body, paneID = this.actualPaneID) {
    for (let node = body; node; node = node.parentNode) {
      if (this.isPaneSection(node, paneID)) {
        return node;
      }
    }
    return null;
  }

  isPaneSection(node, paneID = this.actualPaneID) {
    if (!node) {
      return false;
    }
    const tagName = String(node.localName || node.tagName || "").toLowerCase();
    const dataPane = node.getAttribute?.("data-pane");
    const pane = node.getAttribute?.("pane");
    const paneIDAttr = node.getAttribute?.("paneid") ?? node.getAttribute?.("paneID");
    const hasPaneIdentifier = dataPane || pane || paneIDAttr || node.id;
    return this.paneIDMatches(dataPane, paneID)
      || this.paneIDMatches(pane, paneID)
      || this.paneIDMatches(paneIDAttr, paneID)
      || this.paneIDMatches(node.id, paneID)
      || (tagName === "item-pane-custom-section" && !hasPaneIdentifier);
  }

  findItemDetails(node) {
    for (let current = node; current; current = current.parentNode) {
      const tagName = String(current.localName || current.tagName || "").toLowerCase();
      if (tagName === "item-details" || this.hasClass(current, "item-details")) {
        return current;
      }
    }
    return null;
  }

  findSidenavButton(root, paneID = this.actualPaneID) {
    return this.findDescendant(root, (node) => {
      if (!node?.getAttribute) {
        return false;
      }
      const tagName = String(node.localName || node.tagName || "").toLowerCase();
      const dataPane = node.getAttribute("data-pane");
      return this.paneIDMatches(dataPane, paneID) && (tagName === "button" || tagName === "toolbarbutton" || this.hasClass(node, "btn"));
    });
  }

  findScrollParent(node) {
    for (let current = node?.parentNode; current; current = current.parentNode) {
      const tagName = String(current.localName || current.tagName || "").toLowerCase();
      if (tagName.includes("scroll") || typeof current.scrollTop === "number" || this.hasClass(current, "scroll-container")) {
        return current;
      }
    }
    return null;
  }

  findDescendant(root, predicate) {
    if (!root) {
      return null;
    }
    if (predicate(root)) {
      return root;
    }
    for (const child of root.childNodes ?? root.children ?? []) {
      const found = this.findDescendant(child, predicate);
      if (found) {
        return found;
      }
    }
    return null;
  }

  openVisibilityChain({ body, section, itemDetails }) {
    const opened = new Set();
    const documentElement = body?.ownerDocument?.documentElement ?? null;
    const open = (node) => {
      if (!node || opened.has(node)) {
        return 0;
      }
      opened.add(node);
      return this.openVisibilityNode(node) ? 1 : 0;
    };

    let count = open(body) + open(section);
    for (let node = body?.parentNode; node; node = node.parentNode) {
      count += open(node);
      if (node === itemDetails || node === documentElement) {
        break;
      }
    }
    return count;
  }

  openVisibilityNode(node) {
    if (!node) {
      return false;
    }

    const before = this.hiddenState(node);
    node.hidden = false;
    node.collapsed = false;
    node.open = true;
    node.expanded = true;
    node.removeAttribute?.("hidden");
    node.removeAttribute?.("collapsed");
    node.setAttribute?.("open", "true");
    node.setAttribute?.("expanded", "true");

    if (node.classList?.remove) {
      node.classList.remove("hidden");
      node.classList.remove("collapsed");
    }
    else if (typeof node.className === "string") {
      node.className = node.className
        .split(/\s+/)
        .filter((className) => className && className !== "hidden" && className !== "collapsed")
        .join(" ");
    }

    return before !== this.hiddenState(node);
  }

  markVisibilityProbe({ body, root, panel, section }) {
    for (const node of [body, root, panel, section]) {
      node?.setAttribute?.("data-git4zotero-visible-probe", "true");
    }
  }

  visibilityDiagnostics({ body, root, panel, section, itemDetails, sidenavButton, scrollParent }) {
    return [
      `actualPaneID=${this.actualPaneID}`,
      `bodyConnected=${this.isConnected(body)}`,
      `body=${this.boxSummary(body)}`,
      `root=${this.boxSummary(root)}`,
      `panel=${this.boxSummary(panel)}`,
      `section=${this.nodeLabel(section)}`,
      `sectionHidden=${section ? this.hiddenState(section) : "none"}`,
      `pane=${section?.getAttribute?.("data-pane") ?? section?.getAttribute?.("pane") ?? "none"}`,
      `itemDetails=${this.nodeLabel(itemDetails)}`,
      `sidenav=${!!sidenavButton}`,
      `scrollParent=${this.nodeLabel(scrollParent)}`
    ].join(", ");
  }

  visibilityWarning({ body, root, panel, section }) {
    if (!this.isConnected(body)) {
      return "body disconnected from document";
    }
    if (section && this.isHiddenNode(section)) {
      return `section hidden state=${this.hiddenState(section)}`;
    }

    const measured = this.measureElement(root ?? panel ?? body);
    if (measured.hasLayout && measured.width === 0 && measured.height === 0 && measured.offsetHeight === 0 && measured.scrollHeight === 0) {
      return `rendered host has zero size ${this.boxSummary(root ?? panel ?? body)}`;
    }
    return "";
  }

  hiddenState(node) {
    if (!node) {
      return "none";
    }
    return [
      node.hidden === true ? "hidden-prop" : "",
      node.collapsed === true ? "collapsed-prop" : "",
      node.getAttribute?.("hidden") !== null ? "hidden-attr" : "",
      node.getAttribute?.("collapsed") !== null ? "collapsed-attr" : "",
      this.hasClass(node, "hidden") ? "hidden-class" : "",
      this.hasClass(node, "collapsed") ? "collapsed-class" : ""
    ].filter(Boolean).join("|") || "visible";
  }

  isHiddenNode(node) {
    return this.hiddenState(node) !== "visible";
  }

  boxSummary(node) {
    if (!node) {
      return "none";
    }
    const measured = this.measureElement(node);
    return [
      this.nodeLabel(node),
      `connected=${this.isConnected(node)}`,
      `rect=${measured.hasRect ? `${measured.width}x${measured.height}` : "na"}`,
      `offset=${measured.offsetWidth ?? "na"}x${measured.offsetHeight ?? "na"}`,
      `scroll=${measured.scrollWidth ?? "na"}x${measured.scrollHeight ?? "na"}`
    ].join("/");
  }

  measureElement(node) {
    const measured = {
      hasLayout: false,
      hasRect: false,
      height: null,
      offsetHeight: node?.offsetHeight ?? null,
      offsetWidth: node?.offsetWidth ?? null,
      scrollHeight: node?.scrollHeight ?? null,
      scrollWidth: node?.scrollWidth ?? null,
      width: null
    };

    if (typeof node?.getBoundingClientRect === "function") {
      const rect = node.getBoundingClientRect();
      measured.hasLayout = true;
      measured.hasRect = true;
      measured.height = Number(rect?.height ?? 0);
      measured.width = Number(rect?.width ?? 0);
    }
    if (Number.isFinite(measured.offsetHeight) || Number.isFinite(measured.scrollHeight)) {
      measured.hasLayout = true;
    }
    measured.offsetHeight = Number.isFinite(measured.offsetHeight) ? measured.offsetHeight : null;
    measured.offsetWidth = Number.isFinite(measured.offsetWidth) ? measured.offsetWidth : null;
    measured.scrollHeight = Number.isFinite(measured.scrollHeight) ? measured.scrollHeight : null;
    measured.scrollWidth = Number.isFinite(measured.scrollWidth) ? measured.scrollWidth : null;
    return measured;
  }

  nodeLabel(node) {
    if (!node) {
      return "none";
    }
    const tagName = String(node.localName || node.tagName || "node").toLowerCase();
    const pane = node.getAttribute?.("data-pane") ?? node.getAttribute?.("pane") ?? "";
    const id = node.id ? `#${node.id}` : "";
    return `${tagName}${id}${pane ? `[data-pane=${pane}]` : ""}`;
  }

  isConnected(node) {
    if (!node) {
      return false;
    }
    if (typeof node.isConnected === "boolean") {
      return node.isConnected;
    }
    const documentElement = node.ownerDocument?.documentElement;
    for (let current = node; current; current = current.parentNode) {
      if (current === documentElement) {
        return true;
      }
    }
    return false;
  }

  markBody(body) {
    body?.setAttribute?.("data-git4zotero-body", "true");
  }

  setPanelDiagnostics(panel, { status, versionCount = 0, renderPhase }) {
    panel?.setAttribute?.("data-git4zotero-status", status);
    panel?.setAttribute?.("data-git4zotero-version-count", String(versionCount));
    panel?.setAttribute?.("data-git4zotero-render-phase", renderPhase);
    panel?.setAttribute?.("data-git4zotero-style-injected", "true");
    this.applyVisibilityStyles(panel, "git4zotero-panel");
    const root = panel?.parentNode && this.hasClass(panel.parentNode, "git4zotero-panel-root")
      ? panel.parentNode
      : null;
    if (root) {
      this.setRootDiagnostics(root, { status, versionCount, renderPhase });
    }
  }

  setRootDiagnostics(root, { status, versionCount = 0, renderPhase }) {
    root?.setAttribute?.("data-git4zotero-root", "true");
    root?.setAttribute?.("data-git4zotero-status", status);
    root?.setAttribute?.("data-git4zotero-version-count", String(versionCount));
    root?.setAttribute?.("data-git4zotero-render-phase", renderPhase);
    root?.setAttribute?.("data-git4zotero-style-injected", "true");
    this.applyVisibilityStyles(root, "git4zotero-panel-root");
  }

  debugRenderComplete(panel, state, status) {
    const versionCount = state.versions?.length ?? 0;
    const childCount = panel?.childNodes?.length ?? panel?.children?.length ?? 0;
    const root = panel?.parentNode && this.hasClass(panel.parentNode, "git4zotero-panel-root")
      ? panel.parentNode
      : null;
    this.debug(`item pane state rendered status=${status}, versions=${versionCount}, children=${childCount}, textLength=${panel?.textContent?.length ?? 0}, root=${!!root}, connected=${this.isConnected(panel)}, box=${this.boxSummary(panel)}, styleInjected=${root?.getAttribute?.("data-git4zotero-style-injected") === "true"}`);
  }

  getPanel(body) {
    if (this.hasClass(body, "git4zotero-panel")) {
      return body;
    }
    if (typeof body.querySelector === "function") {
      const found = body.querySelector(".git4zotero-panel");
      if (found) {
        return found;
      }
    }
    return [...(body.childNodes ?? body.children ?? [])]
      .find((child) => this.hasClass(child, "git4zotero-panel")) ?? null;
  }

  hasClass(node, className) {
    if (!node) {
      return false;
    }
    if (node.classList?.contains?.(className)) {
      return true;
    }
    return String(node.className ?? "").split(/\s+/).includes(className);
  }

  nextToken(body) {
    const token = (this.renderTokens.get(body) ?? 0) + 1;
    this.renderTokens.set(body, token);
    const revealState = this.revealStates.get(body);
    if (revealState) {
      revealState.keys.clear();
      revealState.lastHost = null;
    }
    return token;
  }

  getAsyncState(body) {
    let asyncState = this.asyncStates.get(body);
    if (!asyncState) {
      asyncState = {
        completedToken: null,
        promise: null,
        runningToken: null,
        scheduledToken: null
      };
      this.asyncStates.set(body, asyncState);
    }
    return asyncState;
  }

  getRevealState(body) {
    let revealState = this.revealStates.get(body);
    if (!revealState) {
      revealState = {
        keys: new Set(),
        lastHost: null
      };
      this.revealStates.set(body, revealState);
    }
    return revealState;
  }

  isStale(body, token) {
    return this.renderTokens.get(body) !== token;
  }

  isRenderableItem(item) {
    if (!item) {
      return false;
    }
    if (typeof item.isRegularItem === "function" || typeof item.isAttachment === "function") {
      return item.isRegularItem?.() === true || item.isAttachment?.() === true;
    }
    return true;
  }

  debug(message) {
    this.platform?.Zotero?.debug?.(`git4zotero: ${message}`);
  }

  clear(node) {
    node.replaceChildren();
  }

  el(doc, tagName, className = "") {
    const element = typeof doc.createElementNS === "function"
      ? doc.createElementNS(XHTML_NS, tagName)
      : doc.createElement(tagName);
    if (className) {
      element.className = className;
      element.setAttribute?.("class", className);
    }
    this.applyVisibilityStyles(element, className || tagName);
    return element;
  }

  text(doc, value) {
    return doc.createTextNode(value);
  }

  applyVisibilityStyles(element, className = "") {
    if (!element?.setAttribute) {
      return;
    }
    const classes = String(className || element.className || "");
    const classTokens = new Set(classes.split(/\s+/).filter(Boolean));
    const has = (token) => classTokens.has(token);
    const styles = [];

    if (has("git4zotero-panel-root")) {
      styles.push(ROOT_INLINE_STYLE);
    }
    if (has("git4zotero-panel")) {
      styles.push(PANEL_INLINE_STYLE);
    }
    if (has("git4zotero-status")) {
      styles.push(STATUS_INLINE_STYLE);
    }
    if (has("git4zotero-section")) {
      styles.push(SECTION_INLINE_STYLE);
    }
    if (has("git4zotero-section-title")
      || has("git4zotero-timeline-note")
      || has("git4zotero-change-kind")) {
      styles.push(PRIMARY_TEXT_INLINE_STYLE);
    }
    if (has("git4zotero-file")
      || has("git4zotero-timeline-meta")
      || has("git4zotero-version-meta")
      || has("git4zotero-hint")
      || has("git4zotero-change-location")) {
      styles.push(SECONDARY_TEXT_INLINE_STYLE);
    }
    if (has("git4zotero-timeline")) {
      styles.push(TIMELINE_INLINE_STYLE);
    }
    if (has("git4zotero-timeline-item")) {
      styles.push(TIMELINE_ITEM_INLINE_STYLE);
    }
    if (has("git4zotero-timeline-line")) {
      styles.push(TIMELINE_LINE_INLINE_STYLE);
    }
    if (has("git4zotero-timeline-node")) {
      styles.push(TIMELINE_NODE_INLINE_STYLE);
    }
    if (has("git4zotero-timeline-body")) {
      styles.push(TIMELINE_BODY_INLINE_STYLE);
    }
    if (has("git4zotero-timeline-header")) {
      styles.push(TIMELINE_HEADER_INLINE_STYLE);
    }
    if (has("git4zotero-version-badge")) {
      styles.push(BADGE_INLINE_STYLE);
    }

    if (!styles.length) {
      return;
    }

    const existing = element.getAttribute?.("style") ?? "";
    const next = [existing, ...styles]
      .map((style) => String(style).trim())
      .filter(Boolean)
      .join(";");
    element.setAttribute("style", next);
  }

  escapeXHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  formatDate(value) {
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    }
    catch {
      return String(value);
    }
  }

  formatSize(size) {
    if (!Number.isFinite(size)) {
      return "大小未知";
    }
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
}
