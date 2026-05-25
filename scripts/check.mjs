import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildRuntimeScript,
  runtimeEntry,
  runtimeModuleOrder
} from "./runtime-builder.mjs";

const root = process.cwd();
const requiredFiles = [
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "manifest.json",
  "bootstrap.js",
  "prefs.js",
  "README.md",
  "docs/INSTALL.md",
  "tsconfig.json",
  "locale/en-US/git4zotero.ftl",
  "locale/zh-CN/git4zotero.ftl",
  "chrome/content/preferences.xhtml",
  "chrome/content/preferences.mjs",
  "chrome/content/preferences.css",
  "chrome/content/style.css",
  "chrome/content/icons/paper-version.svg",
  "chrome/content/icons/paper-version-16.png",
  "chrome/content/icons/paper-version-20.png",
  "chrome/content/icons/paper-version-48.png",
  "chrome/content/icons/paper-version-96.png",
  "chrome/content/src/content-diff.mjs",
  "chrome/content/src/docx-reader.mjs",
  "chrome/content/src/main.mjs",
  "chrome/content/src/git-backend.mjs",
  "chrome/content/src/menu.mjs",
  "chrome/content/src/version-service.mjs",
  "chrome/content/src/ui.mjs",
  "chrome/content/src/vendor/zip-reader.mjs",
  "scripts/create-update-manifest.mjs",
  "scripts/create-release-notes.mjs",
  "scripts/runtime-builder.mjs",
  "scripts/inspect-xpi.mjs"
];

const requiredChineseText = [
  "论文版本",
  "创建版本",
  "检查修改",
  "版本历史",
  "恢复此版本",
  "Git 不可用",
  "未找到可管理的论文文件",
  ".docx 正文级识别",
  "正文内容已修改",
  "工作流",
  "具体修改",
  ".doc 仅支持文件级跟踪",
  "导出版本摘要",
  "启用版本管理",
  "停用版本管理",
  "Git 可执行文件路径",
  "恢复旧版本前自动创建安全版本"
];
const legacyModulePattern = new RegExp("\\." + "jsm\\b");
const oldPromiseName = "Blue" + "bird";
const oldSpawnName = "Zotero" + ".spawn";

for (const file of requiredFiles) {
  await fs.access(path.join(root, file));
}

const manifestText = await fs.readFile(path.join(root, "manifest.json"), "utf8");
assert.notEqual(manifestText.charCodeAt(0), 0xfeff, "manifest.json must not contain a UTF-8 BOM");
const manifest = JSON.parse(manifestText);
assert.equal(manifest.manifest_version, 2);
assert.equal(manifest.author, "Li Ka-shing");
assert.equal(manifest.applications.zotero.id, "git4zotero@paper-version.local");
assert.equal(manifest.applications.zotero.update_url, "https://github.com/LiKa-shing/git4zotero/releases/latest/download/updates.json");
assert.match(manifest.applications.zotero.update_url, /^https:\/\//);
assert.equal(manifest.applications.zotero.strict_min_version, "8.0");
assert.equal(manifest.applications.zotero.strict_max_version, "9.0.*");
assert(!("browser_specific_settings" in manifest), "Zotero manifest should rely on applications.zotero metadata");

for (const iconPath of Object.values(manifest.icons)) {
  assert(iconPath.endsWith(".png"), `manifest icon must be PNG: ${iconPath}`);
  await assertPngFile(path.join(root, iconPath));
}

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.version, manifest.version);
assert.equal(packageJson.author, "Li Ka-shing");
assert.equal(packageJson.devDependencies["zotero-types"], "^4.1.2");
assert(packageJson.devDependencies.typescript);
assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
assert.equal(packageJson.scripts["create:update-manifest"], "node scripts/create-update-manifest.mjs");
assert.equal(packageJson.scripts["inspect:xpi"], "node scripts/inspect-xpi.mjs");
assert(packageJson.scripts.verify.includes("tsc --noEmit"));
assert(packageJson.scripts.verify.includes("scripts/inspect-xpi.mjs"));

const tsconfig = JSON.parse(await fs.readFile(path.join(root, "tsconfig.json"), "utf8"));
assert.equal(tsconfig.extends, "zotero-types/entries/sandbox");

const packageScript = await fs.readFile(path.join(root, "scripts/package.mjs"), "utf8");
const updateManifestScript = await fs.readFile(path.join(root, "scripts/create-update-manifest.mjs"), "utf8");
const releaseNotesScript = await fs.readFile(path.join(root, "scripts/create-release-notes.mjs"), "utf8");
const inspectXpiScript = await fs.readFile(path.join(root, "scripts/inspect-xpi.mjs"), "utf8");
const ciWorkflow = await fs.readFile(path.join(root, ".github/workflows/ci.yml"), "utf8");
const releaseWorkflow = await fs.readFile(path.join(root, ".github/workflows/release.yml"), "utf8");
assert(!packageScript.includes("Compress-Archive"), "package script must not use Windows Compress-Archive packaging");
assert(packageScript.includes("distDir, \".package\""), "package script must stage package contents under dist/.package");
assert(packageScript.includes("const packageName = \"git4zotero.xpi\";"), "package script must emit the fixed XPI filename");
assert(!/git4zotero-\$\{manifest\.version\}\.xpi/.test(packageScript), "package script must not emit versioned XPI filenames");
assert(packageScript.includes("zipPath = path.join(packageRootDir"), "temporary ZIP must be created under dist/.package");
assert(packageScript.includes("writeZipFromDirectory"), "package script must write the XPI with the Node ZIP writer");
assert(packageScript.includes("writeLocalHeader"), "package script must write ZIP local headers in-process");
assert(packageScript.includes("writeCentralHeader"), "package script must write ZIP central directory headers in-process");
assert(packageScript.includes("toPosix(path.relative(sourceDir, file))"), "package script must use POSIX ZIP entry paths");
assert(packageScript.includes("entryName.includes(\"\\\\\")"), "package script must reject backslash ZIP entry paths");
assert(!packageScript.includes("normalizeZipName"), "package script must not normalize ZIP entry names during validation");
assert(packageScript.includes("buildRuntimeScript"), "package script must generate the classic runtime");
assert(packageScript.includes("writeRuntimeToStaging"), "package script must write the generated runtime into staging");
assert(packageScript.includes("new Function(runtimeText)"), "package script must syntax-check the generated runtime");
assert(packageScript.includes("manifest.json version must match package.json version"), "package script must validate manifest/package version consistency");
assert(packageScript.includes("update_url"), "package script must validate applications.zotero.update_url");
assert(packageScript.includes("chrome/content/preferences.xhtml"), "package script must include the preferences pane");
assert(packageScript.includes("runtimeEntry"), "package script must validate the runtime entry");
assert(packageScript.includes("assertPngEntry"), "package script must validate manifest PNG icons");
assert(packageScript.includes("assertZip32"), "package script must guard classic ZIP size limits");
assert(updateManifestScript.includes("const xpiName = \"git4zotero.xpi\";"), "update manifest must use the fixed release asset filename");
assert(updateManifestScript.includes("releases/download/${tagName}/${xpiName}"), "update manifest must link to the tag-scoped release asset");
assert(!/git4zotero-\$\{version\}\.xpi/.test(updateManifestScript), "update manifest must not link to a versioned XPI filename");
assert(releaseNotesScript.includes("CHANGELOG.md"), "release notes script must read CHANGELOG.md");
assert(releaseNotesScript.includes("manifest.json"), "release notes script must read manifest.json");
assert(releaseNotesScript.includes("dist\", \"release-notes.md"), "release notes script must default to dist/release-notes.md");
assert(releaseNotesScript.includes("\"### 中文\""), "release notes script must require the Chinese changelog subsection");
assert(releaseNotesScript.includes("\"### English\""), "release notes script must require the English changelog subsection");
assert(inspectXpiScript.includes("path.join(root, \"dist\", \"git4zotero.xpi\")"), "inspect script must default to the fixed XPI filename");
assert(inspectXpiScript.includes("Install dist/git4zotero.xpi"), "inspect diagnostics must point to the fixed XPI filename");
assert(ciWorkflow.includes("uses: actions/checkout@v6"), "CI workflow must use actions/checkout@v6");
assert(ciWorkflow.includes("uses: actions/setup-node@v6"), "CI workflow must use actions/setup-node@v6");
assert(ciWorkflow.includes("uses: actions/upload-artifact@v6"), "CI workflow must use actions/upload-artifact@v6");
assert(ciWorkflow.includes("path: dist/git4zotero.xpi"), "CI artifact upload must use the fixed XPI filename");
assert(!/dist\/git4zotero-\*\.xpi/.test(ciWorkflow), "CI artifact upload must not use versioned XPI globs");
assert(releaseWorkflow.includes("uses: actions/checkout@v6"), "release workflow must use actions/checkout@v6");
assert(releaseWorkflow.includes("uses: actions/setup-node@v6"), "release workflow must use actions/setup-node@v6");
assert(releaseWorkflow.includes("XPI=\"dist/git4zotero.xpi\""), "release workflow must upload the fixed XPI filename");
assert(!/git4zotero-\$VERSION\.xpi/.test(releaseWorkflow), "release workflow must not expect a versioned XPI filename");
assert(releaseWorkflow.includes("node scripts/create-release-notes.mjs dist/release-notes.md"), "release workflow must generate release notes from CHANGELOG.md");
assert(releaseWorkflow.includes("--notes-file \"dist/release-notes.md\""), "release workflow must publish CHANGELOG-based release notes");
assert(!releaseWorkflow.includes("--generate-notes"), "release workflow must not rely on generic generated notes");

const runtimeText = await buildRuntimeScript(root);
new Function(runtimeText);
assert(runtimeText.includes("__git4zoteroRuntimeGlobal.Git4Zotero = Git4Zotero"));
assert(!/^\s*import\s/m.test(runtimeText), "generated runtime must not contain import statements");
assert(!/^\s*export\s/m.test(runtimeText), "generated runtime must not contain export statements");
for (const runtimeModule of runtimeModuleOrder) {
  assert(runtimeText.includes(`// ${runtimeModule}`), `generated runtime must include ${runtimeModule}`);
}

const allSourceFiles = await listFiles(root);
const checkedFiles = allSourceFiles.filter((file) => {
  const rel = toPosix(path.relative(root, file));
  return !rel.startsWith("dist/")
    && !rel.startsWith(".git/")
    && !rel.includes("/node_modules/")
    && /\.(js|mjs|json|ftl|css|svg|md)$/.test(rel);
});

for (const file of checkedFiles) {
  const rel = toPosix(path.relative(root, file));
  const text = await fs.readFile(file, "utf8");
  assert(!legacyModulePattern.test(text), `${rel} must not use legacy JSM imports`);
  assert(!text.includes(oldPromiseName), `${rel} must not use ${oldPromiseName}`);
  assert(!text.includes(oldSpawnName), `${rel} must not use ${oldSpawnName}`);
}

const bootstrap = await fs.readFile(path.join(root, "bootstrap.js"), "utf8");
new Function(bootstrap);
assert(!bootstrap.includes("ChromeUtils.importESModule"), "bootstrap must not import the plugin main entry as ESM");
assert(!bootstrap.includes("resource://git4zotero/src/main.mjs"));
assert(bootstrap.includes("Services.scriptloader.loadSubScript"));
assert(bootstrap.includes("chrome://git4zotero/content/runtime/git4zotero-runtime.js"));
assert(!bootstrap.includes("rootURI + git4zoteroRuntimeURL"), "bootstrap must not load the runtime via a jar:file rootURI URL");
assert(!bootstrap.includes("rootURI + \"chrome/content/runtime/"), "bootstrap must not load the runtime via a direct rootURI path");
assert(bootstrap.includes("loading runtime script"));
assert(bootstrap.includes("runtime script loaded"));
assert(bootstrap.includes("startup complete"));
assert(bootstrap.includes("createRuntimeScope"));
assert(!bootstrap.includes("chrome://git4zotero/content/src/main.mjs"), "bootstrap must not use chrome://git4zotero/content/src/main.mjs as the ESM entry");
assert(bootstrap.includes("Zotero.debug"));
assert(bootstrap.includes("IOUtils: typeof IOUtils !== \"undefined\" ? IOUtils : null"));
assert(bootstrap.includes("PathUtils: typeof PathUtils !== \"undefined\" ? PathUtils : null"));

const mainModule = await fs.readFile(path.join(root, "chrome/content/src/main.mjs"), "utf8");
assert(mainModule.includes("zotero.PreferencePanes.register"));
assert(mainModule.includes("PREFERENCES_XHTML"));
assert(mainModule.includes("src: context.rootURI + PREFERENCES_XHTML"));
assert(mainModule.includes("scripts: [context.rootURI + PREFERENCES_SCRIPT]"));
assert(mainModule.includes("stylesheets: [context.rootURI + PREFERENCES_STYLE]"));
assert(mainModule.includes("label: UI_TEXT.preferencePaneLabel"));
assert(!mainModule.includes("rawLabel"), "PreferencePanes.register should use label, not rawLabel");
assert(mainModule.includes("registerItemPane"));
assert(mainModule.includes("registerContextMenu"));
assert(mainModule.includes("bodyXHTML: this.pane.bodyXHTML()"), "Item pane should provide a stable bodyXHTML root");
assert(mainModule.includes("git4zotero-item-pane-sidenav"));
assert(mainModule.includes("orderable: false"));
assert(mainModule.includes("onInit: (renderContext)"));
assert(mainModule.includes("this.pane.init(this.withPaneID(renderContext))"));
assert(mainModule.includes("onItemChange: (renderContext)"));
assert(mainModule.includes("this.pane.handleItemChange(this.withPaneID(renderContext))"));
assert(mainModule.includes("withPaneID(renderContext)"));
assert(mainModule.includes("this.pane.setActualPaneID"));
assert(mainModule.includes("onRender: (renderContext)"));
assert(mainModule.includes("this.pane.render(this.withPaneID(renderContext))"));
assert(mainModule.includes("onAsyncRender: async (renderContext)"));
assert(mainModule.includes("await this.pane.renderAsync(this.withPaneID(renderContext), { source: \"zotero-onAsyncRender\" })"));
assert(mainModule.includes("onToggle: (renderContext)"));
assert(!mainModule.includes("this.pane.renderShell(renderContext)"), "Item pane onRender must schedule complete rendering, not stop at the shell");
assert(mainModule.includes("preference pane registration failed"));
assert(mainModule.includes("new PaperVersionMenu"));

const uiModule = await fs.readFile(path.join(root, "chrome/content/src/ui.mjs"), "utf8");
assert(uiModule.includes("createElementNS(XHTML_NS"));
assert(uiModule.includes("git4zotero-panel"));
assert(uiModule.includes("renderTokens"));
assert(uiModule.includes("asyncStates"));
assert(uiModule.includes("liveBodies"));
assert(uiModule.includes("stateCache"));
assert(uiModule.includes("item pane state cached"));
assert(uiModule.includes("item pane pending cached state"));
assert(uiModule.includes("item pane refresh requested"));
assert(uiModule.includes("item pane cached state rendered in shell"));
assert(uiModule.includes("item pane fallback section target created"));
assert(uiModule.includes("setActualPaneID"));
assert(uiModule.includes("capturePaneContext"));
assert(uiModule.includes("handleItemChange"));
assert(uiModule.includes("manualRefresh"));
assert(uiModule.includes("git4zotero-refresh-button"));
assert(uiModule.includes("requestRefresh"));
assert(uiModule.includes("resolveWritableTarget"));
assert(uiModule.includes("item pane live body rebound"));
assert(uiModule.includes("item pane detached async target"));
assert(uiModule.includes("actualPaneID="));
assert(uiModule.includes("updateItemAvailability"));
assert(uiModule.includes("bodyXHTML()"));
assert(uiModule.includes("git4zotero-panel-root"));
assert(uiModule.includes("scheduleAsyncRender"));
assert(uiModule.includes("item pane self async render scheduled"));
assert(uiModule.includes("source: \"self-scheduled\""));
assert(uiModule.includes("item pane render shell"));
assert(uiModule.includes("item pane async render start source="));
assert(uiModule.includes("item pane async render reused"));
assert(uiModule.includes("item pane async render skipped completed"));
assert(uiModule.includes("item pane async render stale"));
assert(uiModule.includes("state attachment="));
assert(uiModule.includes("item pane async render complete"));
assert(uiModule.includes("lastCheck(doc, lastCheck)"));
assert(uiModule.includes("workingTree(doc, workingTree)"));
assert(uiModule.includes("workflow(doc, state)"));
assert(uiModule.includes("工作流"));
assert(uiModule.includes("versionTimelineItem"));
assert(uiModule.includes("SCOPED_TIMELINE_STYLE"));
assert(uiModule.includes("data-git4zotero-scoped-style"));
assert(uiModule.includes("expandContainingSection"));
assert(uiModule.includes("resolvePaneHost"));
assert(uiModule.includes("revealPane"));
assert(uiModule.includes("itemDetails.scrollToPane"));
assert(uiModule.includes("item pane reveal attempted"));
assert(uiModule.includes("item pane visibility warning"));
assert(uiModule.includes("data-git4zotero-visible-probe"));
assert(uiModule.includes("applyVisibilityStyles"));
assert(uiModule.includes("CanvasText"));
assert(uiModule.includes("ButtonBorder"));
assert(uiModule.includes(".git4zotero-timeline-item"));
assert(uiModule.includes("setPanelDiagnostics"));
assert(uiModule.includes("data-git4zotero-version-count"));
assert(uiModule.includes("data-git4zotero-style-injected"));
assert(uiModule.includes("item pane state rendered status="));
assert(!uiModule.includes("versions.slice(0, 5)"), "history pane must not cap visible versions at five");
assert(uiModule.includes("changeList(doc, changeSummary"));
assert(uiModule.includes("paragraphChanges"));
assert(!uiModule.includes("this.service.createVersion"), "item pane must not create versions; write actions live in the context menu");
assert(!uiModule.includes("this.service.restoreVersion"), "item pane must not restore versions; write actions live in the context menu");
assert(!uiModule.includes("this.service.disableVersionManagement"), "item pane must not disable version management; write actions live in the context menu");

const zipReaderModule = await fs.readFile(path.join(root, "chrome/content/src/vendor/zip-reader.mjs"), "utf8");
assert(zipReaderModule.includes("export function inflateRaw"));
assert(zipReaderModule.includes("readDynamicTrees"));
assert(zipReaderModule.includes("getFixedTrees"));
assert(!zipReaderModule.includes("throw new Error(\"当前环境不支持 DecompressionStream"));

const docxReaderModule = await fs.readFile(path.join(root, "chrome/content/src/docx-reader.mjs"), "utf8");
assert(docxReaderModule.includes("word/document.xml"));
assert(docxReaderModule.includes("footnotes"));
assert(docxReaderModule.includes("endnotes"));
assert(docxReaderModule.includes("paragraphDetails"));
assert(docxReaderModule.includes("moveFrom"));
assert(!docxReaderModule.includes("word/comments.xml"), "comments must not participate in docx content diff");

const menuModule = await fs.readFile(path.join(root, "chrome/content/src/menu.mjs"), "utf8");
assert(menuModule.includes("MenuManager"));
assert(menuModule.includes("registerMenu"));
assert(menuModule.includes("target: \"main/library/item\""));
assert(menuModule.includes("menuType: \"submenu\""));
assert(menuModule.includes("installFallback"));
assert(menuModule.includes("zotero-itemmenu"));
assert(menuModule.includes("createXULElement"));
assert(menuModule.includes("data-git4zotero-fallback"));
assert(menuModule.includes("enableVersionManagement"));
assert(menuModule.includes("checkCurrentChange"));
assert(menuModule.includes("createVersion"));
assert(menuModule.includes("restoreVersion"));
assert(menuModule.includes("configureGit"));
assert(menuModule.includes("updateRootVisibility"));
assert(menuModule.includes("updateActionVisibility"));
assert(menuModule.includes("getCachedMenuState"));
assert(menuModule.includes("clearOfficialFallback"));
assert(menuModule.includes("isMenuRelevant"));
assert(menuModule.includes("setMenuElementVisible"));
assert(menuModule.includes("getMenuState"));
assert(menuModule.includes("getRestoreCandidates"));
assert(menuModule.includes("buildActionStates"));
assert(menuModule.includes("formatRestoreLabel"));
assert(menuModule.includes("formatVersionKind"));
assert(menuModule.includes("formatChangeDetails"));
assert(!menuModule.includes("ensurePopupFallback"), "official MenuManager submenu must not receive fallback action injection");
assert(!menuModule.includes("createStatusItem"), "context menus should not include status summary rows");
assert(!menuModule.includes("data-git4zotero-status"), "context menus should not render status rows");

const platformModule = await fs.readFile(path.join(root, "chrome/content/src/platform.mjs"), "utf8");
assert(platformModule.includes("stdout: \"pipe\""));
assert(platformModule.includes("normalizeExecutablePath"));
assert(platformModule.includes("checkGitAvailability"));
assert(platformModule.includes("findGitExecutable"));
assert(platformModule.includes("normalizeJoinParts"));
assert(platformModule.includes("value.split(/[\\\\/]+/)"));
assert(platformModule.includes("promptText"));
assert(platformModule.includes("selectFromList"));
assert(platformModule.includes("options.length"));
assert(platformModule.includes("refreshItemPane"));

const contentDiffModule = await fs.readFile(path.join(root, "chrome/content/src/content-diff.mjs"), "utf8");
assert(contentDiffModule.includes("paragraphChanges"));
assert(contentDiffModule.includes("displayChanges"));
assert(contentDiffModule.includes("totalParagraphChanges"));

const styleModule = await fs.readFile(path.join(root, "chrome/content/style.css"), "utf8");
assert(styleModule.includes("item-pane-sidenav .btn[data-pane$=\"git4zotero-paper-versions\"]"));
assert(!styleModule.includes("font-size: 0"), "sidenav button text/icon should not be hidden by zero font sizing");
assert(styleModule.includes("git4zotero-panel-root"));
assert(styleModule.includes("[data-git4zotero-body=\"true\"]"));
assert(styleModule.includes("git4zotero-timeline"));
assert(styleModule.includes("CanvasText"));
assert(styleModule.includes("GrayText"));
assert(styleModule.includes("ButtonBorder"));
assert(styleModule.includes("Canvas"));
assert(!styleModule.includes("max-height: 360px"), "timeline must not use its own fixed scroll area");

const preferencesXhtml = await fs.readFile(path.join(root, "chrome/content/preferences.xhtml"), "utf8");
assert(preferencesXhtml.includes("onload=\"Git4ZoteroPreferences.init(event)\""));
assert(preferencesXhtml.includes("onclick=\"Git4ZoteroPreferences.testGit(event)\""));
assert(preferencesXhtml.includes("尚未测试 Git。"));
assert(preferencesXhtml.includes("论文版本管理") || mainModule.includes("preferencePaneLabel"));
assert(preferencesXhtml.includes("状态与排错"));
assert(preferencesXhtml.includes(manifest.version));
assert(!preferencesXhtml.includes("preference=\"extensions.git4zotero.gitPath\""));
const preferencesScript = await fs.readFile(path.join(root, "chrome/content/preferences.mjs"), "utf8");
assert(preferencesScript.includes("window.Git4ZoteroPreferences"));
assert(preferencesScript.includes("window.addEventListener(\"load\""));
assert(preferencesScript.includes("DOMContentLoaded"));
assert(preferencesScript.includes("document.readyState === \"loading\""));
assert(preferencesScript.includes("requiredElementsReady"));
assert(preferencesScript.includes("scheduleInit"));
assert(preferencesScript.includes("checkGitAvailability"));
assert(preferencesScript.includes("gitInput.value = this.getSavedGitPath()"));
assert(preferencesScript.includes("已测试路径"));
assert(preferencesScript.includes("已保存路径"));

const zhFtl = await fs.readFile(path.join(root, "locale/zh-CN/git4zotero.ftl"), "utf8");
for (const id of [
  "git4zotero-menu-root",
  "git4zotero-menu-enable",
  "git4zotero-menu-check",
  "git4zotero-menu-create",
  "git4zotero-menu-restore",
  "git4zotero-menu-export",
  "git4zotero-menu-configure-git",
  "git4zotero-menu-disable"
]) {
  const index = zhFtl.indexOf(`${id} =`);
  assert(index >= 0, `missing FTL id ${id}`);
  assert(zhFtl.slice(index, index + 120).includes(".label ="), `${id} must define .label`);
}

for (const file of allSourceFiles.filter((file) => {
  const rel = toPosix(path.relative(root, file));
  return rel.startsWith("chrome/content/src/") && rel.endsWith(".mjs");
})) {
  await import(pathToFileURL(file));
}

const combinedText = await Promise.all(
  checkedFiles.map((file) => fs.readFile(file, "utf8"))
).then((parts) => parts.join("\n"));

for (const phrase of requiredChineseText) {
  assert(combinedText.includes(phrase), `missing Chinese UI phrase: ${phrase}`);
}

console.log("静态检查通过：manifest、Zotero 8/9 兼容声明、PNG 图标、中文文案和模块语法均已验证。");

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["dist", ".git", "node_modules"].includes(entry.name)) {
        continue;
      }
      files.push(...await listFiles(fullPath));
    }
    else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function assertPngFile(file) {
  const data = await fs.readFile(file);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    assert.equal(data[index], signature[index], `${file} must be a PNG file`);
  }
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
