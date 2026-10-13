# Changelog

本项目的变更记录遵循简洁人工维护格式。发布日期以实际发布为准。

## Unreleased

### 中文

### English

## 0.7.0

### 中文

#### 版本对比与逐条审阅

- 支持比较任意两个历史版本，也可将历史版本与当前附件比较，方便回顾一轮修订或多轮修改的累计变化。
- 完整对比窗口支持为每条修改标记“未审阅”“已确认”或“需处理”，添加备注和书签，并通过“下一条未审阅”继续检查；还可选择隐藏标点和格式变化，聚焦内容修改。
- 改善 DOCX 内容识别，帮助发现数字、引用、缩写、题注、公式、图表引用、批注及修订痕迹等变化，并减少重复分析未修改内容的耗时。
- 保留右侧版本管理面板、历史详情及独立对比窗口的现有操作方式。

#### AI 审阅与报告

- 新增可选的 AI 审阅摘要，支持 DeepSeek 和自定义 OpenAI 兼容服务。在完整对比窗口选中修改、查看并确认发送内容后，即可生成摘要和核验建议。AI 不会自动改写论文、创建或恢复版本。
- AI 仅接收你选中并确认的修改，不发送未选中的论文内容、文件路径或 Zotero 条目信息。
- AI 审阅结果以报告形式展示：总体摘要、分组摘要、关键变化、风险与核验建议分区呈现，重要变化和高风险事项优先显示。点击相关修改编号即可查看原始差异，便于逐项核验。
- 支持一键复制完整 AI 审阅报告、单独复制建议版本说明，以及导出 Markdown 文件，方便留存或与导师、合作者分享。报告会显示所用模型、生成时间、审阅范围及是否来自缓存。
- AI 审阅结果会在本机缓存，相同审阅条件下可复用已有结果，减少重复请求。支持清除单次对比或全部 AI 缓存；缓存不包含在导出的版本历史 ZIP 中。

#### AI 设置与使用体验

- AI 功能适用于 Zotero 9/10，可在设置页配置；Zotero 8 继续支持全部离线版本管理功能。
- 获取模型列表后，可直接从下拉列表选择模型，选择会自动保存；切换供应商或 API 地址后会提示重新获取列表。
- API 密钥输入或粘贴后自动保存，清空输入框即可删除，无需额外点击保存或清除按钮。密钥保存在本机 Zotero 设置中，采用明文存储，设置页提供了相应说明。
- 修复获取模型列表、测试连接或生成 AI 审阅摘要时出现错误、无法继续的问题，并改善请求超时和取消操作的处理。
- AI 服务出错时不会自动重复提交请求，减少意外重复计费的可能。

### English

#### Version comparison and change review

- Compare any two saved versions, or compare a saved version with the current attachment, to review a single revision round or changes accumulated across several rounds.
- Mark individual changes as Unreviewed, Confirmed, or Action Required, add notes and bookmarks, and use Next Unreviewed to continue checking. Hide punctuation and formatting changes when you want to focus on content edits.
- Improved DOCX recognition to help identify changes to numbers, citations, abbreviations, captions, equations, figure and table references, comments, and tracked revisions, while reducing time spent reanalyzing unchanged content.
- Kept the existing workflows in the right-side Version Management panel, History Details, and the standalone comparison window.

#### AI review and reports

- Added optional AI review summaries with DeepSeek and custom OpenAI-compatible services. Select changes in the full comparison window, preview and confirm what will be sent, then generate a summary and verification suggestions. AI does not automatically edit the manuscript or create or restore versions.
- AI receives only the changes you select and confirm, excluding unselected manuscript content, file paths, and Zotero item information.
- AI reviews appear as structured reports with overall and section summaries, key changes, risks, and verification suggestions. Important changes and higher-risk findings appear first, and related change references link to the original diff for verification.
- Copy a complete AI report, copy the suggested version note separately, or export a Markdown file to keep or share with advisors and collaborators. Reports show the model, generation time, review scope, and whether the result came from the cache.
- AI results are cached locally and can be reused under the same review conditions to reduce repeat requests. Clear the cache for one comparison or all AI results; cached reports are not included in exported version-history ZIP files.

#### AI settings and usability

- AI features are available in Zotero 9/10 and can be configured in settings. Zotero 8 retains all offline version-management features.
- After loading the model list, choose a model directly from a dropdown; your selection is saved automatically. Changing the provider or API address prompts you to refresh the list.
- API keys are saved automatically when typed or pasted and removed when the field is cleared, with no separate save or delete buttons. Keys are stored in plaintext in local Zotero settings, as explained on the settings page.
- Fixed errors that prevented model-list loading, connection testing, or AI review generation, and improved request timeout and cancellation handling.
- Failed AI requests are not automatically resubmitted, reducing the chance of unexpected duplicate charges.


## 0.5.2

### 中文

- 新增 Zotero 10 正式版支持，将插件兼容范围扩展为 Zotero `8.0` 到 `10.0.*`。

### English

- Added support for the Zotero 10 stable release and extended the compatibility range from Zotero `8.0` through `10.0.*`.

## 0.5.1

### 中文

- 修复论文修改内容较多或单段过长时“检查修改”和“创建版本”原生弹窗超过屏幕高度的问题；弹窗现在显示有长度上限的紧凑预览，完整差异仍可在右侧版本管理和完整对比窗口中查看。
- 修复独立“完整修改对比”窗口中类型筛选下拉重复显示且无法选择的问题，改用兼容 Zotero chrome/XHTML 窗口的分段单选控件。

### English

- Fixed Check Changes and Create Version dialogs growing beyond the screen for large or very long manuscript edits. Native dialogs now show a bounded compact preview while the complete diff remains available in Version Management and Full Comparison.
- Fixed duplicated, unresponsive change-type options in the standalone Full Change Comparison window by replacing the native popup selector with a Zotero chrome/XHTML-compatible segmented radio control.

## 0.5.0

### 中文

- 新增面向大规模论文改写的可扩展 `.docx` 差异引擎，使用唯一锚点、受限精确匹配和结构感知近似匹配，避免为大型文档构建完整二维 LCS 矩阵。
- 完整段落差异现在按章节和来源分页保存在仓库 sidecar 中，metadata schema 升级至 5，并兼容旧版本摘要和懒重建。
- 新增独立的完整修改对比窗口，支持章节导航、搜索、变化类型筛选、分页、移动段落识别和中英文词元高亮。
- 右侧历史详情改为紧凑摘要和按需增量加载，复制及 Markdown 导出可读取完整差异，不再受 20 条记录上限影响。
- 检查和创建版本共用同一次附件字节读取，并增加短期分析缓存、取消机制、路径安全校验和完整差异健康检查。
- 修复右侧“版本管理”标题图标与文字分离的问题。
- 设置页 About 区块中的 Homepage 现在指向开发者 GitHub 主页。

### English

- Added a scalable `.docx` diff engine for large manuscript rewrites using unique anchors, bounded exact matching, and structure-aware approximate matching without allocating a full document-wide LCS matrix.
- Complete paragraph diffs are now stored as section/source-based sidecar pages. Metadata schema 5 preserves compatibility with legacy summaries and supports lazy reconstruction.
- Added a full comparison window with section navigation, search, change-type filters, pagination, moved-paragraph detection, and token-level highlighting for Chinese and Latin text.
- History Details now use compact summaries and incremental loading. Copy and Markdown export read the complete diff instead of being limited to 20 stored records.
- Change checks and version creation share one attachment byte read and add short-lived analysis caching, cancellation, path validation, and diff-storage health reporting.
- Fixed an issue where the right-pane "Version Management" icon could be separated from the title text.
- The Homepage link in the preferences About section now opens the developer's GitHub profile.

## 0.4.2

### 中文

- 导出版本摘要现在会使用设置页保存的迁移导出目录；已配置目录时会直接在该目录自动生成摘要文件，未配置时保持原有保存对话框行为。
- 设置页 About 区块不再默认显示“尚未打开项目链接”，仅在打开项目链接成功或失败时显示状态反馈。
- 右侧栏历史详情新增“复制详情”和“导出该次修改摘要”，可生成适合发给指导老师或提交 issue 的 Markdown 内容。
- 长文档的历史详情现在默认折叠较长修改记录，可按需展开完整修改，减少右侧栏滚动卡顿。
- 健康检查结果新增独立“下一步建议”小节；Git 路径测试在检测到多个可用 Git 时可让用户选择保存的路径。
- 更新插件图标为更统一的 Git 分支与命令行风格，在设置页、右键菜单和 README 中保持一致展示。
- 右侧条目栏标题优化为“版本管理”，并在标题左侧加入插件图标，使其与 Zotero 界面风格更协调。

### English

- Version summary exports now use the migration export directory saved in preferences. When configured, summary files are generated directly in that folder; otherwise the existing save-dialog behavior is preserved.
- The About section no longer shows the initial "Project link has not been opened yet" placeholder and only displays status feedback after opening a project link succeeds or fails.
- History Details in the right pane now include Copy Details and Export This Change Summary actions that generate Markdown suitable for advisor review or issue reports.
- Long document diffs in History Details are collapsed by default and can be expanded on demand, reducing right-pane scrolling friction.
- Health check results now include a separate Next Steps section, and Git path testing lets users choose which detected Git executable to save when multiple candidates are available.
- Updated the plugin icon to a unified Git-branch and command-line style across preferences, context menus, and the README.
- The right-side item pane title is now "Version Management" with the plugin icon shown beside it for a more native Zotero feel.

## 0.4.1

### 中文

#### 更新

- 本次更新强化了条目级版本历史备份的迁移契约：新导出的备份会记录更清晰的来源仓库、兼容格式、导出插件版本、版本数量和最近版本时间，方便后续迁移与问题诊断。
- 导入版本历史前会先展示预览，包括来源文件、来源仓库、版本数量、最近版本、目标条目以及是否会因为已有历史而跳过，减少误导入和误覆盖风险。

#### 兼容性与迁移

- 旧版本备份仍可读取；全局导入/导出能力保留为内部兼容路径，但用户入口继续以具体 Zotero 条目的右键菜单为准。
- 版本历史 metadata 增加集中迁移层，旧的 `versions.json` 会在读取时规范到当前结构，后续字段演进会更稳定。
- 修复 Zotero 窗口最大化/还原后右侧论文版本面板可能无法正确刷新的问题。
- CI 工作流现在支持从 GitHub Actions 页面手动触发，用于无发布副作用地运行验证并上传 XPI artifact。

### English

#### Update

- This release strengthens the item-level backup contract. Newly exported archives now describe the source repository, compatible format, exporting plugin version, version count, and latest version time more clearly for future migration and troubleshooting.
- Version-history import now shows a preview before writing, including the source file, source repository, version count, latest version, target item, and whether the import will be skipped because history already exists.

#### Compatibility and Migration

- Older backups remain readable. Whole-library import/export is kept only as an internal compatibility path, while user-facing migration continues through the selected Zotero item's context menu.
- Version metadata now has a centralized migration layer so older `versions.json` files are normalized consistently when read, making future schema changes safer.
- Fixed an issue where the right-side Paper Versions pane could fail to refresh correctly after maximizing or restoring the Zotero window.
- CI workflow can now be manually triggered from GitHub Actions to run verification and upload the XPI artifact without publishing a release.

## 0.4.0

### 中文

#### 重要更新

- 本次为重要更新：版本历史导入/导出已改为针对单个 Zotero 条目操作。现在请在条目右键菜单的“论文版本”中导出或导入当前条目的历史，避免误操作整个库。
- 右侧“论文版本”栏新增“历史详情”，可查看单次版本的说明、创建时间、文件信息、变化摘要和全部已保存修改记录。

#### 历史详情

- 历史详情现在以右侧栏内嵌详情面板展示。

#### 条目级导入导出

- 导入备份到当前条目时，可从备份包中选择一个来源历史并映射到当前条目；如果当前条目已有版本历史，插件会跳过导入，不会覆盖已有记录。
- 导出当前条目版本历史时，只打包 git4zotero 保存的本地历史，不包含 Zotero 原始附件文件。

#### 设置与兼容性

- 迁移导出目录支持直接粘贴路径并自动保存；导出时会在该目录自动生成备份 ZIP 文件名。
- 优化 Windows/Zotero 下目录选择和 ZIP 导入的兜底提示，文件选择器不可用时可通过粘贴路径继续完成操作。

### English

#### Highlights

- Important update: version-history import/export now works on one Zotero item at a time. Use Paper Versions from the item context menu to export or import the selected item's history, reducing the risk of whole-library operations.
- The right-side Paper Versions pane now includes History Details for each saved version, showing the note, creation time, file information, change summary, and all saved change records.

#### History Details

- History Details now open as an inline panel in the right pane.

#### Item-Level Import and Export

- When importing into the current item, you can choose one source history from a backup and map it to the selected item; if that item already has history, import is skipped without overwriting.
- Exporting an item's version history packages only git4zotero's local history, not Zotero's original attachment files.

#### Preferences and Compatibility

- The migration export folder can be pasted and auto-saved; exports automatically create the backup ZIP filename in that folder.
- Improved fallback guidance for folder selection and backup ZIP import on Windows/Zotero, including pasted-path recovery when the file picker is unavailable.

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
