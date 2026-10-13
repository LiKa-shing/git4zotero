"use strict";

const REVIEW_TYPE_OPTIONS = Object.freeze([
  { value: "", labelKey: "all", id: "all" },
  { value: "modified", labelKey: "modified", id: "modified" },
  { value: "added", labelKey: "added", id: "added" },
  { value: "deleted", labelKey: "deleted", id: "deleted" },
  { value: "moved", labelKey: "moved", id: "moved" }
]);
const REVIEW_TYPE_VALUES = new Set(REVIEW_TYPE_OPTIONS.map(({ value }) => value));

window.addEventListener("DOMContentLoaded", () => {
  if (window.__git4zoteroReviewInitialized) {
    return;
  }
  const payload = window.arguments?.[0];
  if (!payload) {
    return;
  }
  window.__git4zoteroReviewInitialized = true;
  new Git4ZoteroReviewWindow(payload).init();
});

class Git4ZoteroReviewWindow {
  constructor(payload) {
    this.payload = payload;
    this.labels = payload.labels;
    this.index = null;
    this.groupID = "";
    this.type = "";
    this.query = "";
    this.page = 1;
    this.pageSize = 100;
    this.requestToken = 0;
    this.selectedChangeIDs = new Set();
    this.currentChanges = [];
    this.reviewStates = {};
    this.hideMinor = false;
    this.aiController = null;
    this.comparisonCandidates = [];
    this.baselineID = "";
    this.targetID = "";
    this.initialized = false;
    this.eventsBound = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    document.title = this.labels.title;
    this.text("review-title", this.labels.title);
    this.text("review-sections-title", this.labels.sections);
    this.text("review-search-label", this.labels.search);
    this.text("review-type-label", this.labels.filterLabel);
    this.text("review-previous", this.labels.previous);
    this.text("review-next", this.labels.next);
    this.text("review-page-label", this.labels.page);
    this.text("review-copy-filtered", this.labels.copyFiltered);
    this.text("review-copy-all", this.labels.copyAll);
    this.text("review-export", this.labels.exportMarkdown);
    this.text("review-select-page", this.labels.selectPage);
    this.text("review-clear-selection", this.labels.clearSelection);
    this.text("review-next-unreviewed", this.labels.nextUnreviewed);
    this.text("review-hide-minor-label", this.labels.hideMinor);
    this.text("review-baseline-label", this.labels.compareBaseline);
    this.text("review-target-label", this.labels.compareTarget);
    this.text("review-run-compare", this.labels.compareRun);
    this.text("review-ai-generate", this.labels.aiGenerate);
    this.text("review-ai-clear-cache", this.labels.aiClearCache);
    this.text("review-ai-modal-title", this.labels.aiPreviewTitle);
    this.text("review-ai-warning", this.labels.aiPrivacyWarning);
    this.text("review-ai-confirm", this.labels.aiConfirm);
    this.text("review-ai-cancel", this.labels.aiCancel);
    const aiButton = document.getElementById("review-ai-generate");
    if (aiButton) aiButton.hidden = !this.payload.aiAvailable;
    const aiClearButton = document.getElementById("review-ai-clear-cache");
    if (aiClearButton) aiClearButton.hidden = !this.payload.aiAvailable;
    this.text("review-version-meta", [
      this.payload.version.note,
      this.payload.version.createdAt,
      this.payload.version.commitHash
    ].filter(Boolean).join(" · "));
    this.populateTypeFilters();
    this.bindEvents();
    try {
      this.index = await this.payload.loadIndex();
      this.text("review-quality", this.index.quality === "approximate" ? this.labels.qualityApproximate : this.labels.qualityExact);
      this.renderGroups();
      await this.loadComparisonCandidates();
      await this.loadPage();
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  populateTypeFilters() {
    const container = document.getElementById("review-type-options");
    container.replaceChildren();
    for (const { value, labelKey, id } of REVIEW_TYPE_OPTIONS) {
      const label = document.createElement("label");
      label.className = "review-type-choice";
      label.htmlFor = `review-type-${id}`;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "review-type";
      input.id = `review-type-${id}`;
      input.value = value;
      input.checked = value === this.type;
      const text = document.createElement("span");
      text.textContent = this.labels[labelKey];
      label.append(input, text);
      container.append(label);
    }
  }

  bindEvents() {
    if (this.eventsBound) {
      return;
    }
    this.eventsBound = true;
    let queryTimer = null;
    document.getElementById("review-query").addEventListener("input", (event) => {
      clearTimeout(queryTimer);
      queryTimer = setTimeout(() => {
        this.query = event.target.value;
        this.page = 1;
        this.loadPage();
      }, 180);
    });
    document.getElementById("review-type-options").addEventListener("change", (event) => {
      const input = event.target;
      if (input?.type !== "radio" || input.name !== "review-type" || !REVIEW_TYPE_VALUES.has(input.value)) {
        return;
      }
      this.applyTypeFilter(input.value);
    });
    document.getElementById("review-previous").addEventListener("click", () => {
      this.page = Math.max(1, this.page - 1);
      this.loadPage();
    });
    document.getElementById("review-next").addEventListener("click", () => {
      this.page += 1;
      this.loadPage();
    });
    document.getElementById("review-page").addEventListener("change", (event) => {
      this.page = Math.max(1, Number(event.target.value) || 1);
      this.loadPage();
    });
    document.getElementById("review-copy-filtered").addEventListener("click", () => this.copy(false));
    document.getElementById("review-copy-all").addEventListener("click", () => this.copy(true));
    document.getElementById("review-export").addEventListener("click", () => this.exportMarkdown());
    document.getElementById("review-all-groups").addEventListener("click", () => this.selectGroup(""));
    document.getElementById("review-select-page")?.addEventListener("click", () => this.selectCurrentPage());
    document.getElementById("review-clear-selection")?.addEventListener("click", () => this.clearSelection());
    document.getElementById("review-hide-minor")?.addEventListener("change", (event) => {
      this.hideMinor = event.target.checked === true;
      this.page = 1;
      this.loadPage();
    });
    document.getElementById("review-next-unreviewed")?.addEventListener("click", () => this.focusNextUnreviewed());
    document.getElementById("review-run-compare")?.addEventListener("click", () => this.runComparison());
    this.bindVersionPicker("baseline");
    this.bindVersionPicker("target");
    document.getElementById("review-ai-generate")?.addEventListener("click", () => this.openAIPreview());
    document.getElementById("review-ai-clear-cache")?.addEventListener("click", () => this.clearAICache());
    document.getElementById("review-ai-confirm")?.addEventListener("click", () => this.generateAI());
    document.getElementById("review-ai-cancel")?.addEventListener("click", () => this.closeAIModal());
  }

  applyTypeFilter(type) {
    if (!REVIEW_TYPE_VALUES.has(type)) {
      return;
    }
    this.type = type;
    this.page = 1;
    return this.loadPage();
  }

  renderGroups() {
    const all = document.getElementById("review-all-groups");
    all.textContent = `${this.labels.all} (${this.index.totalChanges})`;
    const container = document.getElementById("review-groups");
    container.replaceChildren();
    for (const group of this.index.groups) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "review-group";
      button.dataset.groupID = group.id;
      button.textContent = `${group.label} (${group.totalChanges})`;
      button.addEventListener("click", () => this.selectGroup(group.id));
      container.append(button);
    }
  }

  selectGroup(groupID) {
    this.groupID = groupID;
    this.page = 1;
    for (const button of document.querySelectorAll(".review-group")) {
      button.classList.toggle("active", (button.id === "review-all-groups" && !groupID) || button.dataset.groupID === groupID);
    }
    this.loadPage();
  }

  async loadPage() {
    const token = ++this.requestToken;
    const cursor = (this.page - 1) * this.pageSize;
    this.setStatus("…");
    try {
      const result = await this.payload.search({
        query: this.query,
        types: this.type ? [this.type] : [],
        groupID: this.groupID,
        excludeNoise: this.hideMinor ? ["formatting", "punctuation"] : [],
        cursor,
        limit: this.pageSize
      });
      if (token !== this.requestToken) {
        return;
      }
      const pageCount = Math.max(1, Math.ceil(result.total / this.pageSize));
      if (this.page > pageCount) {
        this.page = pageCount;
        return this.loadPage();
      }
      this.currentChanges = result.changes;
      this.reviewStates = typeof this.payload.loadReviewStates === "function"
        ? await this.payload.loadReviewStates(result.changes.map((change) => change.id))
        : {};
      if (token !== this.requestToken) {
        return;
      }
      this.renderChanges(result.changes);
      document.getElementById("review-page").value = String(this.page);
      document.getElementById("review-page").max = String(pageCount);
      this.text("review-page-count", `/ ${pageCount}`);
      document.getElementById("review-previous").disabled = this.page <= 1;
      document.getElementById("review-next").disabled = this.page >= pageCount;
      this.setStatus(`${result.total}`);
      this.updateSelectionStatus();
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  renderChanges(changes) {
    const list = document.getElementById("review-list");
    list.replaceChildren();
    if (!changes.length) {
      const empty = document.createElement("div");
      empty.className = "review-empty";
      empty.textContent = this.labels.noChanges;
      list.append(empty);
      return;
    }
    for (const change of changes) {
      const article = document.createElement("article");
      article.className = "review-change";
      const header = document.createElement("header");
      header.className = "review-change-header";
      const title = document.createElement("div");
      title.className = "review-change-title";
      const selector = document.createElement("input");
      selector.type = "checkbox";
      selector.className = "review-change-select";
      selector.checked = this.selectedChangeIDs.has(change.id);
      selector.setAttribute("aria-label", `${this.labels.all}: ${change.locationLabel || change.id}`);
      selector.addEventListener("change", () => {
        if (selector.checked) this.selectedChangeIDs.add(change.id);
        else this.selectedChangeIDs.delete(change.id);
        this.updateSelectionStatus();
      });
      const kind = document.createElement("strong");
      kind.textContent = this.labels[change.type] || change.type;
      title.append(selector, kind);
      const location = document.createElement("span");
      location.className = "review-location";
      location.textContent = change.locationLabel || "";
      header.append(title, location);
      article.dataset.changeID = change.id;
      article.append(header, this.renderComparison(change), this.renderReviewTools(change));
      list.append(article);
    }
  }

  renderComparison(change) {
    const comparison = document.createElement("div");
    comparison.className = "review-comparison";
    if (change.type === "modified") {
      const diff = this.payload.tokenDiff(change.oldText, change.newText);
      comparison.append(
        this.renderTokenText(this.labels.changeBefore, diff, "old"),
        this.renderTokenText(this.labels.changeAfter, diff, "new")
      );
      if (diff.simplified) {
        comparison.title = this.labels.simplified;
      }
    }
    else if (change.type === "deleted") {
      comparison.append(this.renderPlainText(this.labels.changeBefore, change.oldText, "deleted"));
    }
    else if (change.type === "moved") {
      comparison.append(
        this.renderPlainText(this.labels.changeBefore, change.oldText, "deleted"),
        this.renderPlainText(this.labels.changeAfter, change.newText, "added")
      );
    }
    else {
      comparison.append(this.renderPlainText(this.labels.changeAfter, change.newText, "added"));
    }
    return comparison;
  }

  renderTokenText(label, diff, side) {
    const wrapper = this.renderPlainText(label, "");
    const body = document.createElement("span");
    for (const segment of diff.segments) {
      if ((side === "old" && segment.type === "added") || (side === "new" && segment.type === "deleted")) {
        continue;
      }
      const node = segment.type === "deleted" ? document.createElement("del")
        : segment.type === "added" ? document.createElement("ins")
          : document.createTextNode(segment.text);
      if (node.nodeType === 1) {
        node.textContent = segment.text;
      }
      body.append(node);
    }
    wrapper.append(body);
    return wrapper;
  }

  renderPlainText(label, value, tone = "") {
    const wrapper = document.createElement("div");
    wrapper.className = `review-text ${tone ? `review-text-${tone}` : ""}`;
    const title = document.createElement("span");
    title.className = "review-text-label";
    title.textContent = label;
    wrapper.append(title);
    if (value) {
      wrapper.append(document.createTextNode(value));
    }
    return wrapper;
  }

  renderReviewTools(change) {
    const state = this.reviewStates[change.id] || { status: "unreviewed", note: "", bookmarked: false };
    const tools = document.createElement("div");
    tools.className = "review-change-tools";
    const status = document.createElement("button");
    status.type = "button";
    status.className = "review-state-button";
    status.dataset.status = state.status;
    status.textContent = this.reviewStatusLabel(state.status);
    status.addEventListener("click", async () => {
      const order = ["unreviewed", "confirmed", "action-required"];
      const next = order[(order.indexOf(status.dataset.status) + 1) % order.length];
      status.disabled = true;
      try {
        const saved = await this.payload.saveReviewState(change.id, { status: next });
        this.reviewStates[change.id] = saved;
        status.dataset.status = saved.status;
        status.textContent = this.reviewStatusLabel(saved.status);
      }
      catch (error) {
        this.setStatus(error?.message || String(error));
      }
      finally {
        status.disabled = false;
      }
    });
    const bookmark = document.createElement("button");
    bookmark.type = "button";
    bookmark.className = "review-bookmark-button";
    bookmark.textContent = this.labels.bookmark;
    bookmark.setAttribute("aria-pressed", state.bookmarked ? "true" : "false");
    bookmark.addEventListener("click", async () => {
      try {
        const saved = await this.payload.saveReviewState(change.id, { bookmarked: bookmark.getAttribute("aria-pressed") !== "true" });
        this.reviewStates[change.id] = saved;
        bookmark.setAttribute("aria-pressed", saved.bookmarked ? "true" : "false");
      }
      catch (error) {
        this.setStatus(error?.message || String(error));
      }
    });
    const note = document.createElement("input");
    note.type = "text";
    note.className = "review-note";
    note.placeholder = this.labels.notePlaceholder;
    note.value = state.note || "";
    note.addEventListener("change", async () => {
      try {
        this.reviewStates[change.id] = await this.payload.saveReviewState(change.id, { note: note.value });
      }
      catch (error) {
        this.setStatus(error?.message || String(error));
      }
    });
    tools.append(status, bookmark, note);
    return tools;
  }

  reviewStatusLabel(status) {
    if (status === "confirmed") return this.labels.statusConfirmed;
    if (status === "action-required") return this.labels.statusActionRequired;
    return this.labels.statusUnreviewed;
  }

  selectCurrentPage() {
    for (const change of this.currentChanges) {
      this.selectedChangeIDs.add(change.id);
    }
    for (const checkbox of document.querySelectorAll(".review-change-select")) {
      checkbox.checked = true;
    }
    this.updateSelectionStatus();
  }

  clearSelection() {
    this.selectedChangeIDs.clear();
    for (const checkbox of document.querySelectorAll(".review-change-select")) {
      checkbox.checked = false;
    }
    this.updateSelectionStatus();
  }

  updateSelectionStatus() {
    this.text("review-selected-count", formatTemplate(this.labels.selectedCount, { count: this.selectedChangeIDs.size }));
  }

  async focusNextUnreviewed() {
    const target = this.currentChanges.find((change) => (this.reviewStates[change.id]?.status || "unreviewed") === "unreviewed");
    if (target) {
      const node = [...document.querySelectorAll(".review-change")].find((article) => article.dataset.changeID === target.id);
      node?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      node?.querySelector?.(".review-state-button")?.focus?.();
      return;
    }
    if (!document.getElementById("review-next").disabled) {
      this.page += 1;
      await this.loadPage();
      return this.focusNextUnreviewed();
    }
    this.setStatus(this.labels.statusConfirmed);
  }

  async loadComparisonCandidates() {
    if (typeof this.payload.loadComparisonCandidates !== "function") {
      return;
    }
    try {
      const result = await this.payload.loadComparisonCandidates();
      this.comparisonCandidates = result?.candidates ?? [];
      if (!this.comparisonCandidates.length) {
        return;
      }
      const currentID = this.payload.version.commitHash || this.payload.version.id;
      const targetIndex = Math.max(0, this.comparisonCandidates.findIndex((candidate) => candidate.id === currentID));
      this.targetID = this.comparisonCandidates[targetIndex]?.id || "current";
      this.baselineID = this.comparisonCandidates[targetIndex + 1]?.id || "empty";
      this.renderVersionPicker("baseline");
      this.renderVersionPicker("target");
      document.getElementById("review-compare-toolbar").hidden = false;
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  bindVersionPicker(kind) {
    const button = document.getElementById(`review-${kind}-button`);
    const options = document.getElementById(`review-${kind}-options`);
    if (!button || !options) {
      return;
    }
    button.addEventListener("click", () => {
      const opening = options.hidden;
      this.closeVersionPickers();
      options.hidden = !opening;
      button.setAttribute("aria-expanded", opening ? "true" : "false");
    });
  }

  closeVersionPickers() {
    for (const kind of ["baseline", "target"]) {
      document.getElementById(`review-${kind}-options`).hidden = true;
      document.getElementById(`review-${kind}-button`).setAttribute("aria-expanded", "false");
    }
  }

  renderVersionPicker(kind) {
    const selectedID = kind === "baseline" ? this.baselineID : this.targetID;
    const button = document.getElementById(`review-${kind}-button`);
    const options = document.getElementById(`review-${kind}-options`);
    const selected = this.comparisonCandidates.find((candidate) => candidate.id === selectedID);
    button.textContent = selected?.label || selectedID;
    options.replaceChildren();
    for (const candidate of this.comparisonCandidates) {
      if ((kind === "target" && candidate.id === "empty") || (kind === "baseline" && candidate.id === "current")) {
        continue;
      }
      const option = document.createElement("button");
      option.type = "button";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", candidate.id === selectedID ? "true" : "false");
      option.textContent = candidate.label;
      option.addEventListener("click", () => {
        if (kind === "baseline") this.baselineID = candidate.id;
        else this.targetID = candidate.id;
        this.renderVersionPicker(kind);
        this.closeVersionPickers();
      });
      options.append(option);
    }
  }

  async runComparison() {
    try {
      this.setStatus("…");
      const result = await this.payload.compareVersions(this.baselineID, this.targetID);
      this.index = result.index;
      this.text("review-version-meta", [result.version.note, result.version.createdAt].filter(Boolean).join(" · "));
      this.text("review-quality", this.index.quality === "approximate" ? this.labels.qualityApproximate : this.labels.qualityExact);
      this.groupID = "";
      this.page = 1;
      this.clearSelection();
      this.renderGroups();
      await this.loadPage();
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  async openAIPreview() {
    if (!this.selectedChangeIDs.size) {
      this.setStatus(this.labels.aiNoSelection);
      return;
    }
    try {
      const preview = await this.payload.previewAI([...this.selectedChangeIDs]);
      this.text("review-ai-meta", formatTemplate(this.labels.aiProviderMeta || "{provider} · {model} · {count} · {characters} · {batches}", {
        provider: preview.provider,
        model: preview.model,
        count: preview.changeCount,
        characters: preview.characterCount,
        batches: preview.batchCount
      }));
      document.getElementById("review-ai-preview").value = preview.previewText;
      document.getElementById("review-ai-modal").hidden = false;
      document.getElementById("review-ai-confirm").focus();
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  closeAIModal() {
    document.getElementById("review-ai-modal").hidden = true;
  }

  async generateAI() {
    const button = document.getElementById("review-ai-confirm");
    button.disabled = true;
    this.aiController?.abort();
    this.aiController = this.payload.createAbortController();
    this.setStatus(this.labels.aiGenerating);
    try {
      const record = await this.payload.generateAI([...this.selectedChangeIDs], this.aiController.signal);
      this.closeAIModal();
      this.renderAIResult(record);
      this.setStatus(this.labels.aiDisclaimer);
    }
    catch (error) {
      if (error?.name !== "AbortError") {
        this.setStatus(error?.message || String(error));
      }
    }
    finally {
      button.disabled = false;
      this.aiController = null;
    }
  }

  async clearAICache() {
    try {
      await this.payload.clearAI();
      this.setStatus(this.labels.aiCacheCleared);
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  renderAIResult(record) {
    const result = record?.result || {};
    const container = document.getElementById("review-ai-result");
    container.replaceChildren();
    container.hidden = false;
    container.tabIndex = -1;

    const header = document.createElement("header");
    header.className = "review-ai-header";
    const headingBlock = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = this.labels.aiReportTitle;
    const meta = document.createElement("p");
    meta.className = "review-ai-meta";
    meta.textContent = formatTemplate(this.labels.aiReportMeta, {
      provider: record?.provider || "—",
      model: record?.model || "—",
      count: Array.isArray(record?.changeIDs) ? record.changeIDs.length : 0,
      time: formatReviewDate(record?.createdAt),
      source: record?.cached ? this.labels.aiCached : this.labels.aiFresh
    });
    headingBlock.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "review-ai-actions";
    actions.append(
      this.createAIAction(this.labels.aiCopyReport, () => this.copyAIReport(record)),
      this.createAIAction(this.labels.aiExportReport, () => this.exportAIReport(record))
    );
    header.append(headingBlock, actions);
    container.append(header);

    const disclaimer = document.createElement("aside");
    disclaimer.className = "review-ai-disclaimer";
    disclaimer.setAttribute("role", "note");
    disclaimer.textContent = this.labels.aiDisclaimer;
    container.append(disclaimer);

    if (result.summary) {
      const section = this.createAISection(this.labels.aiSummary, "review-ai-summary");
      const prose = document.createElement("p");
      prose.className = "review-ai-prose";
      prose.textContent = result.summary;
      section.append(prose);
      container.append(section);
    }

    if (result.sectionSummaries?.length) {
      const section = this.createAISection(this.labels.aiSectionSummaries, "review-ai-sections", result.sectionSummaries.length);
      const grid = document.createElement("div");
      grid.className = "review-ai-card-grid";
      for (const entry of result.sectionSummaries) {
        const card = this.createAICard(entry.groupID || this.labels.aiSectionSummaries, entry.summary);
        this.appendAIReferences(card, entry.changeIDs);
        grid.append(card);
      }
      section.append(grid);
      container.append(section);
    }

    if (result.keyChanges?.length) {
      const entries = sortAIEntries(result.keyChanges, "importance");
      const section = this.createAISection(this.labels.aiKeyChanges, "review-ai-key-changes", entries.length);
      const list = document.createElement("div");
      list.className = "review-ai-card-list";
      for (const entry of entries) {
        const card = this.createAICard("", entry.description);
        card.dataset.level = entry.importance || "medium";
        card.prepend(this.createAILevelBadge(entry.importance));
        this.appendAIReferences(card, entry.changeIDs);
        list.append(card);
      }
      section.append(list);
      container.append(section);
    }

    const risks = sortAIEntries(result.risks || [], "severity");
    const riskSection = this.createAISection(this.labels.aiRisks, "review-ai-risks", risks.length);
    if (risks.length) {
      const list = document.createElement("div");
      list.className = "review-ai-card-list";
      for (const risk of risks) {
        const card = this.createAICard(risk.category || this.labels.aiRisks, risk.description);
        card.dataset.level = risk.severity || "medium";
        card.prepend(this.createAILevelBadge(risk.severity));
        if (risk.verification) {
          const verification = document.createElement("div");
          verification.className = "review-ai-verification";
          const label = document.createElement("strong");
          label.textContent = `${this.labels.aiVerification}: `;
          verification.append(label, document.createTextNode(risk.verification));
          card.append(verification);
        }
        this.appendAIReferences(card, risk.changeIDs);
        list.append(card);
      }
      riskSection.append(list);
    }
    else {
      const empty = document.createElement("p");
      empty.className = "review-ai-empty";
      empty.textContent = this.labels.aiNoRisks;
      riskSection.append(empty);
    }
    container.append(riskSection);

    if (result.suggestedVersionNote) {
      const section = this.createAISection(this.labels.aiSuggestedNote, "review-ai-version-note");
      const note = document.createElement("blockquote");
      note.textContent = result.suggestedVersionNote;
      const copy = this.createAIAction(this.labels.aiCopyNote, async () => {
        await this.payload.copyText(result.suggestedVersionNote);
        this.setStatus(this.labels.aiNoteCopied);
      });
      section.append(note, copy);
      container.append(section);
    }

    if (result.limitations?.length) {
      const details = document.createElement("details");
      details.className = "review-ai-limitations";
      const summary = document.createElement("summary");
      summary.textContent = `${this.labels.aiLimitations} (${result.limitations.length})`;
      const list = document.createElement("ul");
      for (const limitation of result.limitations) {
        const item = document.createElement("li");
        item.textContent = limitation;
        list.append(item);
      }
      details.append(summary, list);
      container.append(details);
    }

    container.focus({ preventScroll: true });
    container.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  createAISection(titleText, className, count = null) {
    const section = document.createElement("section");
    section.className = `review-ai-section ${className || ""}`.trim();
    const title = document.createElement("h3");
    title.textContent = count === null ? titleText : `${titleText} (${count})`;
    section.append(title);
    return section;
  }

  createAICard(titleText, description) {
    const card = document.createElement("article");
    card.className = "review-ai-card";
    if (titleText) {
      const title = document.createElement("h4");
      title.textContent = titleText;
      card.append(title);
    }
    const prose = document.createElement("p");
    prose.className = "review-ai-prose";
    prose.textContent = description || "";
    card.append(prose);
    return card;
  }

  createAILevelBadge(level) {
    const normalized = ["high", "medium", "low"].includes(level) ? level : "medium";
    const badge = document.createElement("span");
    badge.className = "review-ai-level";
    badge.dataset.level = normalized;
    badge.textContent = this.labels[`aiLevel${normalized[0].toUpperCase()}${normalized.slice(1)}`];
    return badge;
  }

  appendAIReferences(container, changeIDs = []) {
    const ids = [...new Set(changeIDs.map(String).filter(Boolean))];
    if (!ids.length) return;
    const references = document.createElement("div");
    references.className = "review-ai-references";
    const label = document.createElement("span");
    label.textContent = `${this.labels.aiReferences}: `;
    references.append(label);
    for (const changeID of ids) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "review-ai-change-link";
      button.textContent = changeID;
      button.addEventListener("click", () => this.navigateToAIChange(changeID));
      references.append(button);
    }
    container.append(references);
  }

  async navigateToAIChange(changeID) {
    this.query = changeID;
    document.getElementById("review-query").value = changeID;
    this.page = 1;
    await this.loadPage();
    document.querySelector(`.review-change[data-change-id="${cssEscape(changeID)}"]`)?.scrollIntoView?.({ block: "center" });
  }

  createAIAction(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await action();
      }
      catch (error) {
        this.setStatus(error?.message || String(error));
      }
      finally {
        button.disabled = false;
      }
    });
    return button;
  }

  async copyAIReport(record) {
    await this.payload.copyAIReview(record);
    this.setStatus(this.labels.aiReportCopied);
  }

  async exportAIReport(record) {
    const exported = await this.payload.exportAIReview(record);
    if (exported?.path) this.setStatus(exported.path);
  }

  async copy(all) {
    try {
      await this.payload.copyMarkdown(all ? {} : this.filters());
      this.setStatus(this.labels.copySuccess);
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  async exportMarkdown() {
    try {
      const result = await this.payload.exportMarkdown(this.filters());
      this.setStatus(result?.path || "");
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  filters() {
    return {
      query: this.query,
      types: this.type ? [this.type] : [],
      groupID: this.groupID,
      excludeNoise: this.hideMinor ? ["formatting", "punctuation"] : []
    };
  }

  text(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value || "";
    }
  }

  setStatus(value) {
    this.text("review-status", value);
  }
}

function formatTemplate(template, values = {}) {
  return String(template ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => values[key] ?? "");
}

function cssEscape(value) {
  return String(value ?? "").replace(/(["\\])/g, "\\$1");
}

function sortAIEntries(entries, field) {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...entries].sort((left, right) => (rank[left?.[field]] ?? 1) - (rank[right?.[field]] ?? 1));
}

function formatReviewDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
