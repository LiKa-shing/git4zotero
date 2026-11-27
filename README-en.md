<p align="center">
  <img src="chrome/content/icons/paper-version-96.png" alt="git4zotero icon" width="96" height="96">
</p>

<h1 align="center">git4zotero</h1>

<p align="center">Local Git-based version management for Zotero Word manuscript attachments.</p>

<p align="center">
  <a href="https://zotero-chinese.com/plugins/"><img src="https://zotero-chinese.com/badges/listed.svg" alt="Zotero 中文社区 · 已收录"></a>
  <a href="https://www.zotero.org/"><img src="https://img.shields.io/badge/Zotero-8%20%7C%209%20%7C%2010-CC2936?logo=zotero&logoColor=white" alt="Zotero"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/releases"><img src="https://img.shields.io/github/package-json/v/LiKa-shing/git4zotero" alt="version"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/releases/latest"><img src="https://img.shields.io/github/downloads/LiKa-shing/git4zotero/latest/total" alt="downloads"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/releases/latest"><img src="https://img.shields.io/github/release-date/LiKa-shing/git4zotero" alt="release date"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/LiKa-shing/git4zotero" alt="license"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/actions/workflows/ci.yml"><img src="https://github.com/LiKa-shing/git4zotero/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  English | <a href="README.md">简体中文</a>
</p>

`git4zotero`, short for `git for zotero`, is a Zotero 8/9/10 plugin for manuscript attachment version management. It uses the local Git installation on your computer to keep version history for Word manuscript files attached to Zotero items, so drafts, revisions, submission copies, and restore points stay next to the same library item.

- Compatible with Zotero `8.0` to `10.0.*`
- Recommended format: `.docx`
- Supported formats: `.docx`, `.doc`
- Data location: the `git4zotero` folder under the Zotero profile directory

## Features

- **Local Git version history**: each Zotero item with version management enabled gets its own local Git repository. No cloud service is required.
- **Zotero-centered workflow**: use the `Paper Versions` context menu in the item list to enable tracking, check changes, create versions, restore as a copy, and disable tracking.
- **Content-level `.docx` diff for large papers**: reads body text, tables, footnotes, and endnotes; reports added, removed, modified, and moved paragraphs without allocating a document-wide comparison matrix for large rewrites.
- **File-level `.doc` tracking**: supports version creation and restore for binary Word files.
- **Safe restoration as a copy**: save a historical version as a separate file while preserving the current attachment and edits saved by Word/WPS during the operation. Preflight shows version hashes, copy and backup paths, output directory write status, and Git working tree status.
- **Item-level history backup and migration**: export or import version history from the selected item's `Paper Versions` context menu. Import never overwrites existing history.
- **Diagnostics and health check**: copy redacted diagnostics, run a health check, and copy an issue template from the settings pane.
- **Paper Versions pane and full comparison window**: the item pane shows compact summaries with incremental loading; the separate review window adds section navigation, search, type filters, pagination, token highlighting, and complete Markdown copy/export.
- **Cross-version review workspace**: compare any two saved versions or a saved version with the current file, attach review states, notes, and bookmarks, and surface signals such as numbers, citations, captions, formulas, and tracked revisions.
- **Optional AI review summaries**: Zotero 9/10 users can send explicitly selected changes to DeepSeek or a custom OpenAI-compatible endpoint after reviewing an exact send preview. AI never participates in diffing, version creation, restoration, or document rewriting.

## Use Cases

- Keep a clear local history for manuscript drafts, revised copies, submission files, and response-to-review versions.
- Record a recoverable version after advisor, collaborator, or editor feedback.
- Add version traceability to Zotero manuscript attachments without introducing an external sync or collaboration system.
- Build a safer workflow between Word, WPS, LibreOffice, and Zotero reference management.

## Installation

### 1. Install Git

The plugin requires Git on your computer. Install [Git](https://git-scm.com/downloads), then confirm that it is available from a terminal:

```powershell
git --version
```

If you are installing Git on Windows for the first time, see the Chinese beginner guide: [Git 安装指南（Windows 小白版）](docs/GIT-INSTALL-zh.md).

If Git is not available in system PATH, you can later enter the full executable path in the Zotero plugin settings, for example:

```text
C:\Program Files\Git\cmd\git.exe
```

### 2. Install the Plugin

1. Download the latest [`git4zotero.xpi`](https://github.com/LiKa-shing/git4zotero/releases/latest/download/git4zotero.xpi) from [Releases](https://github.com/LiKa-shing/git4zotero/releases).
2. Open Zotero and go to `Tools -> Plugins`.
3. Drag `git4zotero.xpi` into the Plugins window, or use the gear menu and choose `Install Add-on From File...`.
4. Restart Zotero after installation.

### 3. Initial Setup

After restarting Zotero, open the Zotero settings pane:

- Windows/Linux: `Edit -> Settings`
- macOS: `Zotero -> Settings`

In the `Git` / `Paper Version Management` settings pane, you can configure:

- `Git executable path`: leave it blank to let the plugin try `git` from system PATH.
- `Test Git`: test whether the current Git path is available and save a working path.
- `Default version note`: used when you create a version without entering a note.
- `Create a safety version before restoring an old version`: save the current attachment content read at that time as a safety version before creating the historical copy. Later editor saves remain in the original attachment.
- `First-use guide`: manually review Git detection, data directory, context-menu workflow, and `.docx` / `.doc` capability differences.
- `Diagnostics and health check`: copy diagnostics, run health checks, open the data directory, and copy an issue template.
- `Version history backup and migration`: configure only the default folder for item-level backup ZIP exports. Run import/export from the selected item's `Paper Versions` context menu.
- `AI review summary` (Zotero 9/10 only): load the provider's model list and select a model directly from the dropdown. The API key is saved automatically while typing and deleted automatically when the field is cleared. It is disabled by default and does not affect offline version management.

## Quick Start

1. For first use, open `First-use guide` in settings and click `Test Git`.
2. Attach a `.docx` or `.doc` manuscript file to a Zotero item. `.docx` is recommended.
3. Right-click the Zotero item or the manuscript attachment in the item list.
4. Open the `Paper Versions` menu and choose `Enable Version Management`.
5. Choose `Create Version...`, review the pre-creation summary, and enter a version note such as `First draft`.
6. Edit the manuscript in Word, WPS, or LibreOffice, then save the file in the word processor.
7. Return to Zotero, right-click the same item or attachment, and choose `Check Changes`.
8. When you want to save the current changes, choose `Create Version...`.
9. To review or use an earlier draft, choose `Restore as Copy...`, select the target version, and confirm the safety check. Open the file at the copy path shown in the success message. The current attachment is not replaced.

The `Paper Versions` menu and right-side pane contain:

| Action | Description |
| --- | --- |
| `Enable Version Management` | Enable version tracking for the current item. |
| `Check Changes` | Compare the current manuscript file with the latest saved version. |
| `Create Version...` | Save the current manuscript file as a new version. The confirmation shows file name, tracking mode, change summary, file hash, and working tree status. |
| `Restore as Copy...` | Save a historical version as a separate copy while preserving the current attachment. Preflight shows the target version, current/target hashes, copy and backup paths, and safety results. |
| `Export This Item Version History...` | Export git4zotero's local version history for the current item as a ZIP. Original Zotero attachment files are not included. |
| `Import Version History to This Item...` | Import one source history from a backup ZIP into the current item. If the current item already has history, import is skipped without overwriting. |
| `Configure Git Path...` | Quickly configure Git when it is unavailable. |
| `Disable Version Management` | Stop version management for the current item without deleting existing history. |
| `Details` | View a compact summary and incrementally load changes in the right-side pane. Use `Open Full Comparison` for section navigation, search, type filters, pagination, complete copy, and Markdown export. |

The full comparison window can also compare arbitrary versions, record per-change review states, notes, and bookmarks, and suppress whitespace/punctuation/format-only changes. AI summaries process only changes that you select and confirm in the send preview.

The plugin supports single selection only. Version actions are unavailable when multiple Zotero items are selected.

Each item's version repository is bound to one Word attachment. If an item contains several `.docx` / `.doc` attachments, actions on the parent item use the bound attachment. Before the first binding, select the intended manuscript attachment before enabling version management. Other attachments cannot join that history, and disabling and re-enabling tracking does not change its binding. Use a separate item to track another manuscript independently.

Existing histories with a single attachment continue to use their original repository. Legacy histories containing several attachments, or whose ownership cannot be established, remain available for viewing and export. They are not automatically split, rebound, or extended with new versions. If a protection message appears, export the history and preserve the original data for investigation.

## Format Support

| Format | Support level | Description |
| --- | --- | --- |
| `.docx` | Content-level diff | Analyzes body text, footnotes, and endnotes, and reports paragraph-level changes and word-count changes. |
| `.doc` | File-level tracking | Detects file changes and supports version creation and restore, but does not show paragraph-level differences. |

Use `.docx` when you need more accurate change summaries. Word, WPS, and LibreOffice can continue saving the current attachment while the plugin creates a separate historical copy.

## Data Safety and Restore

`Restore as Copy...` runs a safety preflight before saving snapshots of the current content and creating a separate historical copy:

- Checks whether the current manuscript file exists and is readable, and whether the copy output directory is writable. The original attachment and its parent directory may be read-only.
- Shows the current file hash, target version file hash, full Git hash, copy path, and pre-restore backup path.
- Reads Git repository and working tree status. Blocking problems cancel restore.
- Creates a new file under `.git4zotero/restored-copies` in the current version repository without overwriting existing copies, then checks that it matches the historical content. The success message shows the full path.
- Never writes to, deletes, or renames the original attachment, including on failure. No backup is written back to it, so new content saved by Word/WPS during the operation remains in the original attachment.

Automatically created safety versions and pre-restore backups are stored in the local plugin data directory. Each reflects the content read for that snapshot and does not represent later editor saves. Do not manually delete or rewrite Git files, `index.json`, or `.git4zotero/versions.json` inside that directory.

Open the historical copy at the path shown in the success message and review it first. To continue writing from that draft, handle any unsaved edits in your editor, then use Save As or replace the original attachment yourself. The plugin does not automatically make the copy the current attachment.

Before saving version records or the repository index, the plugin validates both the new data and the existing record. It writes to an exclusively created temporary file in the same directory, flushes and reads it back, then replaces the primary file. `versions.json.bak` and `index.json.bak` retain the previous valid record; a backup is also created on the first save. If safe writing is unavailable, the operation stops without deleting the primary file to attempt a copy.

If a primary record is damaged, or is missing while its backup remains, the plugin stops the affected operation and reports the file paths. It does not automatically restore an older record or treat a damaged index as empty. A valid backup does not prove that it matches the latest Git commit, and there is currently no automatic recovery action. Preserve the files and copy diagnostics when reporting the problem; do not delete or replace the records yourself.

## Import and Export

Starting with `0.4.0`, version-history import/export works on one Zotero item at a time. The settings pane only configures the default folder for item-level backup ZIP exports.

- To export the current item's history, right-click the target Zotero item or manuscript attachment and choose `Paper Versions -> Export This Item Version History...`.
- To import history into the current item, right-click the target Zotero item or manuscript attachment and choose `Paper Versions -> Import Version History to This Item...`.
- Item-level exports are named like `git4zotero-<item-key>-history-<timestamp>.zip`. If a migration export folder is configured in settings, the plugin automatically creates the backup ZIP filename in that folder.
- The archive contains only git4zotero's local version history and `export-manifest.json`. It does not contain original Zotero attachment files.
- When importing a backup from another device or another item, you can choose one source history from the backup and map it to the current item.
- If the current item already has version history, import is skipped and reported without overwriting existing records.
- Importing mixed or unidentified legacy history preserves its original version ownership and protection status. Re-exporting and importing it again cannot turn it into an apparently complete single-attachment history. Protection markers are also retained when some older ownership information is missing.

Older all-history backups named like `git4zotero-backup-<timestamp>.zip` can still be selected from the current item's import action. If the backup contains multiple histories, choose the one you want to map to the current item.

## Diagnostics and Health Check

The `Diagnostics and Health Check` area in settings is designed for troubleshooting and issue reports:

- `Copy Diagnostics`: generates a redacted report containing plugin version, Zotero version, system, locale, Git command, Git version, data directory, current item status, and latest error.
- `Run Health Check`: checks Git, data directory, write permission, version history left by deleted Zotero items, metadata schema, and Git/index/metadata consistency.
- `Copy Issue Template`: generates issue text with redacted diagnostics and placeholders for reproduction steps.
- `Open Data Directory`: opens the Zotero profile `git4zotero` directory for backup or manual inspection.
- `Open Git Installation Guide`: opens [Git 安装指南（Windows 小白版）](docs/GIT-INSTALL-zh.md).

Health checks only diagnose and suggest actions. They do not automatically repair repositories, clean history, or overwrite local files. After a check completes, the `Next Steps` section helps decide whether to configure Git, inspect the data directory, clean history for deleted items, or copy diagnostics for an issue. If metadata, Git history, or index consistency problems are reported, copy diagnostics and open an issue before making manual changes.

## Boundaries

- This plugin provides local version management. It is not cloud sync, a backup drive, or a real-time collaboration system.
- This plugin does not replace Track Changes in Word, WPS, or LibreOffice. It stores attachment file versions at different points in time.
- The right-side `Paper Versions` pane is mainly for status display. Use the item-list context menu for write operations such as enable, check, create, and restore.
- The settings pane configures Git, default notes, diagnostics, the default item-level export folder, and optional AI. Run version-history import/export from the selected item's context menu.
- Do not manually modify the Git repositories, `index.json`, or `.git4zotero` metadata under the Zotero profile `git4zotero` folder.
- Moving a Zotero item to Trash preserves its history. Cleanup after permanent deletion rechecks repository ownership, so deleting one attachment does not remove history belonging to another. Mixed, unidentified, or otherwise unverified histories are retained.

### AI and privacy

- AI is disabled by default and appears only in Zotero 9/10. Zotero 8 retains the complete offline version-management workflow.
- A cloud request occurs only after you select changes, choose Generate, and confirm the exact send preview. Requests exclude file paths, Git hashes, Zotero IDs, attachment metadata, unchanged paragraphs, and the full manuscript.
- DeepSeek requests send the selected manuscript text to its service. A custom OpenAI-compatible endpoint follows that provider's data-handling policy. Confirm institutional and provider privacy requirements before sending sensitive or unpublished work.

## FAQ

### `Git is unavailable`

1. Confirm that Git is installed. Windows beginners can use [Git 安装指南（Windows 小白版）](docs/GIT-INSTALL-zh.md).
2. Run `git --version` in a terminal.
3. Enter the full Git executable path in the Zotero settings pane.
4. Click `Test Git` and confirm that the plugin can call Git.

### I cannot find the `Paper Versions` menu

1. Make sure exactly one Zotero item or one attachment is selected.
2. Make sure the item has a `.docx` or `.doc` attachment.
3. Restart Zotero.
4. Confirm that the latest `git4zotero.xpi` is installed.

### `No manageable manuscript file found`

Add a `.docx` or `.doc` attachment to the current Zotero item. Web snapshots, PDFs, images, and other attachment formats are not managed as manuscripts.

### Why is the current attachment unchanged after restore?

`Restore as Copy...` preserves the current attachment and writes the historical content under `.git4zotero/restored-copies` in the current repository. Open the copy using the full path in the success message. The original attachment still contains the current draft, and subsequent editor saves still apply to it. To continue writing from the historical draft, handle any unsaved edits first, then use Save As or replace the original attachment yourself. If preflight reports that the copy directory is not writable, check access permissions for the plugin data directory.

### Where are History Details?

Select an item with version management enabled, then open the right-side `Paper Versions` pane in Zotero item details. Click `Details` to view the note, creation time, file information, and compact change summary. The pane can incrementally load changes; `Open Full Comparison` adds section navigation, search, type filters, and pagination. `Copy Details` and `Export This Change Summary` read the complete saved diff for advisor review or issue reports.

### Why are there no import/export buttons in settings?

Starting with `0.4.0`, import/export is item-level to avoid accidental whole-library operations. The settings pane keeps only the default export-folder configuration. To import or export version history, right-click the target item or attachment and use the `Paper Versions` menu.

### What happens after I set the migration export folder?

You can paste a folder path in settings, then press Enter or leave the input to auto-save it. Later, `Export This Item Version History...` writes the generated backup ZIP filename to that folder by default. This folder affects only the default export location; it does not affect imports, original Zotero attachments, or the plugin data directory.

### How do I move version history to a new computer?

1. On the old computer, right-click the Zotero item or manuscript attachment you want to migrate and choose `Paper Versions -> Export This Item Version History...`.
2. On the new computer, install Zotero, Git, and git4zotero, and make sure the target manuscript item exists with a `.docx` or `.doc` attachment.
3. Right-click the target item or attachment and choose `Paper Versions -> Import Version History to This Item...`, then select the backup ZIP from the old computer.
4. If the backup contains multiple source histories, choose the one to import into the current item. If the current item already has history, import is skipped without overwriting.
5. After import, run `Run Health Check` and confirm that Git, data directory, metadata, and index status are normal.

### History remains after deleting a Zotero item

If the item was only moved to Zotero Trash, the plugin keeps version history so it can continue working after you restore the item. After permanent deletion or emptying Trash, cleanup also checks history ownership and related item state. Mixed or unidentified history, and history whose owners cannot be checked, is not automatically deleted. Older orphaned histories can be inspected from the `Git` settings pane; manual cleanup follows the same ownership protection.

## Development and Contribution

See [docs/INSTALL.md](docs/INSTALL.md) for development setup, packaging, and local Zotero validation. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

Common commands:

```powershell
npm install
npm run verify
npm run package
```

The packaged XPI is written to:

```text
dist\git4zotero.xpi
```

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgements

Thanks to the following projects, communities, and contributors for the foundations, references, and suggestions behind git4zotero:

- [zotero/zotero](https://github.com/zotero/zotero)
- [windingwind/zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
- [Git](https://git-scm.com/)
- [Zotero Chinese Community](https://zotero-chinese.com)
- [Zeng Jin](https://medgs.xjtu.edu.cn/info/1408/12084.htm) (advisor)
- Meng L. , Liu G. and Zhang J.
