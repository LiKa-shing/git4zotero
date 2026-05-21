import { AttachmentFinder } from "./attachments.mjs";
import {
  FTL_FILE,
  ICON_16,
  ICON_20,
  PLUGIN_ID,
  PREFERENCES_SCRIPT,
  PREFERENCES_STYLE,
  PREFERENCES_XHTML,
  SECTION_ID,
  STYLE_ID,
  UI_TEXT
} from "./constants.mjs";
import { GitBackend } from "./git-backend.mjs";
import { MetadataStore } from "./metadata.mjs";
import { PaperVersionMenu } from "./menu.mjs";
import { ZoteroPlatform } from "./platform.mjs";
import { PaperVersionPane } from "./ui.mjs";
import { VersionService } from "./version-service.mjs";

export const Git4Zotero = {
  context: null,
  platform: null,
  preferencePaneID: null,
  sectionID: null,
  pane: null,
  menu: null,

  async startup(context) {
    this.context = context;
    const zotero = context.Zotero;
    this.platform = new ZoteroPlatform({
      Zotero: zotero,
      Services: context.Services,
      Cc: context.Cc,
      Ci: context.Ci,
      ChromeUtils: context.ChromeUtils,
      IOUtils: context.IOUtils,
      PathUtils: context.PathUtils
    });

    const attachmentFinder = new AttachmentFinder({ Zotero: zotero });
    const gitBackend = new GitBackend(this.platform);
    const metadataStore = new MetadataStore(this.platform);
    const service = new VersionService({
      platform: this.platform,
      attachmentFinder,
      gitBackend,
      metadataStore,
      pluginVersion: context.version
    });

    this.pane = new PaperVersionPane({ service, platform: this.platform });
    this.menu = new PaperVersionMenu({ service, platform: this.platform });
    await this.registerPreferencePane(context);

    for (const win of zotero.getMainWindows()) {
      await this.onMainWindowLoad(win);
    }

    this.registerItemPane(context);
    this.registerContextMenu(context);
  },

  async shutdown() {
    const zotero = this.platform?.Zotero ?? this.context?.Zotero;

    if (this.sectionID) {
      zotero?.ItemPaneManager?.unregisterSection(this.sectionID);
      this.sectionID = null;
    }

    if (this.preferencePaneID && zotero?.PreferencePanes?.unregister) {
      zotero.PreferencePanes.unregister(this.preferencePaneID);
      this.preferencePaneID = null;
    }

    this.menu?.unregister();

    for (const win of zotero?.getMainWindows?.() ?? []) {
      this.onMainWindowUnload(win);
    }

    this.pane = null;
    this.menu = null;
    this.platform = null;
    this.context = null;
  },

  async registerPreferencePane(context) {
    const zotero = this.platform.Zotero;
    if (!zotero.PreferencePanes?.register) {
      this.debug("PreferencePanes.register unavailable");
      return;
    }

    try {
      this.debug("registering preference pane");
      this.preferencePaneID = await zotero.PreferencePanes.register({
        id: "git4zotero-preferences",
        label: UI_TEXT.preferencePaneLabel,
        pluginID: context.id || PLUGIN_ID,
        src: context.rootURI + PREFERENCES_XHTML,
        scripts: [context.rootURI + PREFERENCES_SCRIPT],
        stylesheets: [context.rootURI + PREFERENCES_STYLE],
        image: context.rootURI + ICON_20
      });
      this.debug("preference pane registered");
    }
    catch (error) {
      this.debug(`preference pane registration failed: ${error?.stack || error}`);
    }
  },

  registerItemPane(context) {
    const zotero = this.platform.Zotero;
    if (!zotero.ItemPaneManager?.registerSection) {
      this.debug("ItemPaneManager.registerSection unavailable");
      return;
    }

    try {
      this.debug("registering item pane section");
      this.sectionID = zotero.ItemPaneManager.registerSection({
        paneID: SECTION_ID,
        pluginID: context.id || PLUGIN_ID,
        header: {
          l10nID: "git4zotero-item-pane-header",
          icon: context.rootURI + ICON_16
        },
        sidenav: {
          l10nID: "git4zotero-item-pane-sidenav",
          icon: context.rootURI + ICON_20,
          orderable: false
        },
        bodyXHTML: this.pane.bodyXHTML(),
        onInit: (renderContext) => {
          this.pane.init(this.withPaneID(renderContext));
        },
        onItemChange: (renderContext) => {
          return this.pane.updateItemAvailability(this.withPaneID(renderContext));
        },
        onRender: (renderContext) => {
          this.pane.render(this.withPaneID(renderContext));
        },
        onAsyncRender: async (renderContext) => {
          await this.pane.renderAsync(this.withPaneID(renderContext), { source: "zotero-onAsyncRender" });
        },
        onToggle: (renderContext) => {
          this.pane.render(this.withPaneID(renderContext), { reason: "toggle" });
        }
      });
      this.pane.setActualPaneID?.(this.sectionID);
      this.debug(`item pane section registered paneID=${this.sectionID}`);
    }
    catch (error) {
      this.debug(`item pane section registration failed: ${error?.stack || error}`);
    }
  },

  withPaneID(renderContext) {
    if (!renderContext || renderContext.paneID || !this.sectionID) {
      return renderContext;
    }
    return {
      ...renderContext,
      paneID: this.sectionID
    };
  },

  registerContextMenu(context) {
    try {
      this.debug("registering context menu");
      this.menu.register(context);
    }
    catch (error) {
      this.debug(`context menu registration failed: ${error?.stack || error}`);
    }
  },

  async onMainWindowLoad(win) {
    if (!win?.document || !this.context) {
      return;
    }

    win.MozXULElement?.insertFTLIfNeeded?.(FTL_FILE);
    const doc = win.document;
    if (!doc.getElementById(STYLE_ID)) {
      const link = doc.createElement("link");
      link.id = STYLE_ID;
      link.rel = "stylesheet";
      link.href = this.context.rootURI + "chrome/content/style.css";
      doc.documentElement.append(link);
    }
    this.menu?.installFallback(win, this.context);
  },

  onMainWindowUnload(win) {
    if (!win?.document) {
      return;
    }

    win.document.getElementById(STYLE_ID)?.remove();
    win.document.querySelector(`link[href="${FTL_FILE}"]`)?.remove();
    this.menu?.uninstallFallback(win);
  },

  debug(message) {
    this.platform?.Zotero?.debug?.(`git4zotero: ${message}`);
  }
};
