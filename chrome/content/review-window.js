"use strict";

window.addEventListener("DOMContentLoaded", () => {
  const payload = window.arguments?.[0];
  if (!payload) {
    return;
  }
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
  }

  async init() {
    document.title = this.labels.title;
    this.text("review-title", this.labels.title);
    this.text("review-sections-title", this.labels.sections);
    this.text("review-search-label", this.labels.search);
    this.text("review-previous", this.labels.previous);
    this.text("review-next", this.labels.next);
    this.text("review-page-label", this.labels.page);
    this.text("review-copy-filtered", this.labels.copyFiltered);
    this.text("review-copy-all", this.labels.copyAll);
    this.text("review-export", this.labels.exportMarkdown);
    this.text("review-version-meta", [
      this.payload.version.note,
      this.payload.version.createdAt,
      this.payload.version.commitHash
    ].filter(Boolean).join(" · "));
    this.populateTypes();
    this.bindEvents();
    try {
      this.index = await this.payload.loadIndex();
      this.text("review-quality", this.index.quality === "approximate" ? this.labels.qualityApproximate : this.labels.qualityExact);
      this.renderGroups();
      await this.loadPage();
    }
    catch (error) {
      this.setStatus(error?.message || String(error));
    }
  }

  populateTypes() {
    const select = document.getElementById("review-type");
    for (const [value, label] of [
      ["", this.labels.all],
      ["modified", this.labels.modified],
      ["added", this.labels.added],
      ["deleted", this.labels.deleted],
      ["moved", this.labels.moved]
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
  }

  bindEvents() {
    let queryTimer = null;
    document.getElementById("review-query").addEventListener("input", (event) => {
      clearTimeout(queryTimer);
      queryTimer = setTimeout(() => {
        this.query = event.target.value;
        this.page = 1;
        this.loadPage();
      }, 180);
    });
    document.getElementById("review-type").addEventListener("change", (event) => {
      this.type = event.target.value;
      this.page = 1;
      this.loadPage();
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
      this.renderChanges(result.changes);
      document.getElementById("review-page").value = String(this.page);
      document.getElementById("review-page").max = String(pageCount);
      this.text("review-page-count", `/ ${pageCount}`);
      document.getElementById("review-previous").disabled = this.page <= 1;
      document.getElementById("review-next").disabled = this.page >= pageCount;
      this.setStatus(`${result.total}`);
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
      const kind = document.createElement("strong");
      kind.textContent = this.labels[change.type] || change.type;
      const location = document.createElement("span");
      location.className = "review-location";
      location.textContent = change.locationLabel || "";
      header.append(kind, location);
      article.append(header, this.renderComparison(change));
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
      groupID: this.groupID
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
