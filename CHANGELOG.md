# Changelog

本项目的变更记录遵循简洁人工维护格式。发布日期以实际发布为准。

## Unreleased

### 中文

- 设置页新增更轻量的“关于”区域，采用紧凑文本链接风格，提供 Homepage、GitHub、反馈和 Q&A 入口，并展示插件版本、仓库、协议、兼容范围和支持格式。
- “低风险工具”更名为“支持工具”，让设置页工具区的用途更清晰。
- 改进“迁移导出目录”设置体验：可以直接粘贴目录路径，也可以点击“选择目录...”；保存或选择成功后会立即回填输入框，并同步“当前迁移导出目录”显示。
- 修复 Windows/Zotero 9 下“选择目录...”可能无法打开的问题；系统目录选择器不可用时会提示手动粘贴路径，不再显示难懂的底层文件选择器错误。
- 已设置迁移导出目录后，“导出全部版本历史...”会直接在该目录自动生成备份 zip 文件；如果目录不存在或不是文件夹，会明确提示错误，不会静默保存到其他位置。

### English

- Added a lighter About area in the preferences pane with compact text links for Homepage, GitHub, feedback, and Q&A, plus plugin version, repository, license, compatibility, and supported formats.
- Renamed “Low-Risk Tools” to “Support Tools” so the settings tools area is easier to understand.
- Improved the migration export directory workflow: paste a folder path directly or use Choose Directory; after saving or choosing a folder, the input and current-directory display update immediately.
- Fixed cases where Choose Directory could fail on Windows/Zotero 9; when the system folder picker is unavailable, the pane now points users to the paste-and-save fallback instead of showing low-level file picker errors.
- When a migration export directory is configured, Export All Version History writes the backup zip directly there; if the directory is missing or not a folder, the pane reports a clear error instead of silently saving elsewhere.

## 0.3.1

### 中文

- 优化首次使用向导弹窗 UI：固定窗口尺寸，改为内部区域滚动，并改善深色界面下的背景、文字、按钮、步骤选中态和状态徽标对比度。
- 将插件版本提升至 0.3.1，用于本轮首次使用向导界面改进。

### English

- Improved the first-use guide dialog UI with a fixed window size, internal scrolling, and better dark-theme contrast for backgrounds, text, buttons, selected steps, and status badges.
- Bumped the plugin version to 0.3.1 for this first-use guide UI refinement.

## 0.3.0

### 中文

- 修复设置页静态按钮重复绑定导致“打开 Git 安装指南”可能打开两个浏览器标签页的问题。
- 移除首次使用向导中的“论文条目”步骤，保留 Git、数据目录、迁移备份和排错准备四个环境配置与诊断步骤。

### English

- Fixed duplicate static preference button binding that could make “Open Git Install Guide” open two browser tabs.
- Removed the “Manuscript Item” step from the first-use guide while keeping the Git, data directory, migration backup, and troubleshooting setup steps.

## 0.2.5

### 中文

- 新增迁移导出目录设置：可在设置页指定“导出全部版本历史...”的默认保存目录，迁移备份时保存对话框会优先打开该目录。
- 将首次使用向导升级为设置页内交互式弹窗：按 Git 准备、数据目录、迁移备份、论文条目和排错准备分步显示状态，并提供可执行检查与配置按钮。
- 将插件版本提升至 0.2.5，用于本轮交互式新用户引导与迁移导出目录配置改进。

### English

- Added a migration export directory setting: the preferences pane can now set the default save directory for “Export All Version History...”, so migration backups open the save dialog in that directory first.
- Upgraded the first-use guide to an interactive preferences-pane modal: it now walks through Git setup, data directory, migration backup, manuscript item, and troubleshooting steps with status checks and action buttons.
- Bumped the plugin version to 0.2.5 for this round of interactive onboarding and migration export directory improvements.

## 0.2.4

### 中文

- 增加恢复前可解释安全检查：恢复前显示目标版本、完整 Git hash、当前文件 hash、目标版本 hash、备份路径、文件可读/可写状态和 Git 工作树状态。
- 增强恢复执行保护：恢复时复用预检生成的备份路径，并在写入前重新校验当前文件 hash，避免确认后文件又被外部程序修改。
- 扩展健康检查建议，针对 Git、数据目录、写权限、已删除条目历史、metadata schema 以及 Git/index/metadata 一致性给出诊断和建议，不自动修复。
- 新增设置页“导出全部版本历史...”与“导入版本历史...”，用于备份、换电脑和迁移本地 git4zotero 版本仓库；导入只补充缺失仓库，不覆盖已有历史。
- 新增设置页“首次使用向导”“打开数据目录”“复制 issue 模板”“打开 Git 安装指南”等低风险入口。
- 右侧 `论文版本` 面板新增状态卡片，展示是否启用、Git 是否可用、最近版本、最近检查和未提交修改状态。
- 创建版本前新增确认摘要，尤其对 `.doc` 明确提示仅做文件级跟踪，不解析正文差异。
- README 增加首次使用、数据安全与恢复、导入/导出、诊断与健康检查和常见文件占用问题说明。

### English

- Added explainable restore preflight checks that show target version, full Git hash, current file hash, target file hash, backup path, file read/write status, and Git working tree status before restore.
- Hardened restore execution by reusing the preflight backup path and re-checking the current file hash before writing, preventing accidental overwrite if the file changes after confirmation.
- Expanded health-check suggestions for Git, data directory, write permission, deleted-item history, metadata schema, and Git/index/metadata consistency without automatic repair.
- Added preference-pane “Export All Version History...” and “Import Version History...” actions for backup, computer migration, and local git4zotero repository migration; import only fills missing repositories and never overwrites existing history.
- Added low-risk preference-pane actions: first-use guide, open data directory, copy issue template, and open Git install guide.
- Added status cards to the right-side Paper Versions pane for enabled state, Git availability, latest version, latest check, and uncommitted-change state.
- Added a clearer confirmation summary before creating a version, including explicit `.doc` file-level tracking guidance.
- Expanded README coverage for first use, data safety and restore, import/export, diagnostics and health checks, and common file-lock issues.

## 0.2.3

### 中文

- 在设置页增加“复制诊断信息”，用于生成默认脱敏的插件版本、Zotero 版本、系统、locale、Git、数据目录、当前条目状态和最近错误报告。
- 在设置页增加“运行健康检查”，覆盖 Git、数据目录、写权限、已删除条目历史和 metadata schema 检查。
- 增加最近错误持久化记录，Zotero 重启后仍可复制最近一次错误信息。
- 增加错误分级提示，区分用户可处理问题、Git 问题、文件状态问题和插件内部错误，并给出对应处理建议。

### English

- Added “Copy Diagnostics” in the preferences pane to generate a redacted report with plugin version, Zotero version, system, locale, Git, data directory, current item status, and the most recent error.
- Added “Run Health Check” in the preferences pane for Git, data directory, write permission, deleted-item history, and metadata schema checks.
- Added persistent recent-error recording so the latest error remains available after Zotero restarts.
- Added categorized error guidance for user-actionable issues, Git issues, file-state issues, and internal plugin errors.

## 0.2.2

### 中文

- 增加 Zotero 条目永久删除监听：移入回收站时保留版本历史，永久删除或清空回收站后自动清理对应插件仓库。
- 增加 `git4zotero/index.json` 仓库索引，用于匹配 Zotero 条目、附件和本地版本仓库。
- 增加设置页“已删除条目留下的版本历史”检查与清理入口，用于处理升级前遗留的无对应条目的版本历史。
- 增加安全校验，清理前确认路径位于插件数据目录且版本元数据与删除事件匹配。

### English

- Added Zotero item deletion handling: repository history is retained when items move to trash and cleaned only after permanent deletion or trash emptying.
- Added a `git4zotero/index.json` repository index to map Zotero items, attachments, and local version repositories.
- Added preference-pane orphan history checks and cleanup for legacy unmanaged repository directories.
- Added safety checks so cleanup only removes plugin repositories whose paths and metadata match the deleted Zotero item.

## 0.2.1

### 中文

- 优化 `.docx` 差异摘要，按标题、表格、脚注和尾注上下文组织变化。
- 在 Zotero 右侧 `论文版本` 面板增加可展开的版本详情，包括完整 Git hash、文件元数据、版本类型和安全备份状态。
- 新增右键菜单 `导出版本摘要...`，支持导出完整版本历史或最近差异摘要为 Markdown 或纯文本。
- 在界面、摘要和导出内容中明确 `.doc` 为文件级跟踪。

### English

- Added grouped `.docx` change summaries with heading, table, footnote, and endnote context.
- Added expandable version details in the Zotero item pane, including full Git hash, file metadata, version kind, and safety-backup status.
- Added context-menu export for full version history or the latest diff summary in Markdown or plain text.
- Clarified `.doc` behavior as file-level tracking in UI, summaries, and exports.

## 0.2.0

### 中文

- 增加更安全的恢复流程，包括恢复前检查、分阶段文件替换、hash 校验，以及失败时从本地备份回滚。
- 增加仓库健康检查，覆盖 Git 可用性、metadata 记录、tracked 文件、Git 仓库状态和工作区状态。
- 在 Zotero 右侧面板显示仓库健康状态，并在恢复成功提示中包含本地备份路径。
- 修正设置页格式列表，不再展示未支持的 `.odt` 跟踪能力。
- 增加恢复回滚、仓库健康报告和右侧面板健康状态显示的专项测试。
- 将 `README.md` 重写为中文主 README，包含徽章、安装、快速开始、功能边界、排错和贡献入口。
- 重写 `CONTRIBUTING.md` 和 `docs/INSTALL.md`，覆盖公开贡献、维护、Windows + VSCode 开发环境和本地验证流程。
- 扩展 `.gitignore`，忽略本地缓存、环境变量文件、Zotero profile、SQLite 数据库和私人论文文件。
- 增加 GitHub Actions CI 和手动 release workflow，用于包验证、XPI 产物、预发布选择和 GitHub Release 发布。
- 增加 Zotero `updates.json` 生成能力，包含 release 下载地址和 SHA-256 更新 hash。
- 统一打包和发布的 XPI 文件名为 `git4zotero.xpi`；版本号由 manifest metadata、release tag 和 update manifest 表达。
- 调整 package/check 版本校验，要求 `package.json` 与 `manifest.json` 一致，不再硬编码单一发布版本。
- 增加 Windows + VSCode 开发环境搭建文档。
- 记录单项目 Windows 开发推荐使用官方 Node.js MSI 的流程。
- 增加 nvm-windows 指南，覆盖固定 Node.js LTS、本地 npm 依赖安装、VSCode 终端验证和常见 PATH 排错。
- 增加贡献者工作流文档，覆盖本地验证、Zotero 手动测试、运行时代码打包和 Windows 文件安全规则。

### English

- Added safer restore flow with preflight checks, staged file replacement, hash verification, and rollback from a local backup on failure.
- Added repository health checks for Git availability, metadata records, tracked files, Git repository state, and working tree status.
- Added repository health display in the Zotero item pane and restore success messages that include the local backup path.
- Fixed the settings page format list so it no longer advertises unsupported `.odt` tracking.
- Added focused tests for restore rollback, repository health reporting, and item-pane health display.
- Rewrote `README.md` as the primary Chinese project README with badges, installation, quick start, feature boundaries, troubleshooting, and contribution links.
- Rewrote `CONTRIBUTING.md` and `docs/INSTALL.md` for public contribution, maintenance, Windows + VSCode development setup, and local verification workflows.
- Expanded `.gitignore` for local caches, environment files, Zotero profiles, SQLite databases, and private manuscript files.
- Added GitHub Actions CI and manual release workflows for package verification, XPI artifacts, pre-release selection, and GitHub Release publishing.
- Added Zotero `updates.json` generation with release download URL and SHA-256 update hash.
- Standardized packaged and released XPI asset naming to `git4zotero.xpi`; versions now live in manifest metadata, release tags, and update manifests.
- Reworked package/check version validation to require `package.json` and `manifest.json` consistency instead of hardcoding one release number.
- Added Windows + VSCode development environment setup documentation.
- Documented the preferred official Node.js MSI workflow for single-project Windows development.
- Added nvm-windows guidance for fixed Node.js LTS usage, local npm dependency installation, VSCode terminal verification, and common PATH troubleshooting.
- Added contributor workflow documentation for local validation, Zotero manual testing, runtime packaging, and Windows file-safety rules.

## 0.1.30

### 中文

- 记录当前插件 release metadata，声明 Zotero 8/9 兼容范围。
- 当前支持的论文格式为 `.docx` 和 `.doc`。
- `.docx` 版本支持正文段落级比较；`.doc` 版本使用文件级跟踪。

### English

- Documented current plugin release metadata for Zotero 8/9 compatibility.
- Current supported manuscript formats are `.docx` and `.doc`.
- `.docx` versions support content-level paragraph comparison; `.doc` versions use file-level tracking.
