"use strict";

var git4zoteroRuntimeURL = "chrome://git4zotero/content/runtime/git4zotero-runtime.js";
var git4zoteroChromeHandle = null;
var git4zoteroRuntime = null;

async function startup({ id, version, rootURI }, reason) {
  log(`startup ${version}, reason=${reason}`);

  try {
    const aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"]
      .getService(Ci.amIAddonManagerStartup);
    const manifestURI = Services.io.newURI(rootURI + "manifest.json");
    const contentRoot = rootURI + "chrome/content/";

    log(`registering chrome content=${contentRoot}`);
    git4zoteroChromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "git4zotero", contentRoot]
    ]);
    log("chrome registered");

    const scope = createRuntimeScope({
      id,
      version,
      rootURI,
      reason
    });
    log(`loading runtime script ${git4zoteroRuntimeURL}`);
    Services.scriptloader.loadSubScript(git4zoteroRuntimeURL, scope, "UTF-8");
    log("runtime script loaded");

    if (!scope.Git4Zotero?.startup) {
      throw new Error("git4zotero runtime did not expose Git4Zotero.startup");
    }

    git4zoteroRuntime = scope.Git4Zotero;

    await git4zoteroRuntime.startup({
      id,
      version,
      rootURI,
      Zotero,
      Services,
      Cc,
      Ci,
      ChromeUtils,
      IOUtils: typeof IOUtils !== "undefined" ? IOUtils : null,
      PathUtils: typeof PathUtils !== "undefined" ? PathUtils : null
    }, reason);
    log("startup complete");
  }
  catch (error) {
    logError("startup failed", error);
    throw error;
  }
}

async function shutdown({ id, version, rootURI }, reason) {
  log(`shutdown ${version}, reason=${reason}`);

  try {
    if (reason !== APP_SHUTDOWN && git4zoteroRuntime) {
      await git4zoteroRuntime.shutdown({ id, version, rootURI }, reason);
    }

    git4zoteroRuntime = null;

    if (git4zoteroChromeHandle) {
      git4zoteroChromeHandle.destruct();
      git4zoteroChromeHandle = null;
    }
  }
  catch (error) {
    logError("shutdown failed", error);
    throw error;
  }
}

function install(data, reason) {
  log(`install reason=${reason}`);
}

function uninstall(data, reason) {
  log(`uninstall reason=${reason}`);
}

async function onMainWindowLoad({ window }) {
  try {
    log("main window load");
    await git4zoteroRuntime?.onMainWindowLoad(window);
  }
  catch (error) {
    logError("main window load failed", error);
    throw error;
  }
}

function onMainWindowUnload({ window }) {
  try {
    log("main window unload");
    git4zoteroRuntime?.onMainWindowUnload(window);
  }
  catch (error) {
    logError("main window unload failed", error);
    throw error;
  }
}

function log(message) {
  if (typeof Zotero !== "undefined" && typeof Zotero.debug === "function") {
    Zotero.debug(`git4zotero: ${message}`);
  }
}

function logError(message, error) {
  log(`${message}: ${error?.stack || error}`);
}

function createRuntimeScope(context) {
  const scope = {
    ...context,
    Zotero,
    Services,
    Cc,
    Ci,
    ChromeUtils,
    IOUtils: typeof IOUtils !== "undefined" ? IOUtils : null,
    PathUtils: typeof PathUtils !== "undefined" ? PathUtils : null,
    TextEncoder: typeof TextEncoder !== "undefined" ? TextEncoder : null,
    TextDecoder: typeof TextDecoder !== "undefined" ? TextDecoder : null,
    DOMParser: typeof DOMParser !== "undefined" ? DOMParser : null,
    ReadableStream: typeof ReadableStream !== "undefined" ? ReadableStream : null,
    DecompressionStream: typeof DecompressionStream !== "undefined" ? DecompressionStream : null,
    crypto: typeof crypto !== "undefined" ? crypto : null
  };
  scope.globalThis = scope;
  scope.self = scope;
  return scope;
}
