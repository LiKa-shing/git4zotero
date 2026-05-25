# Changelog

本项目的变更记录遵循简洁人工维护格式。发布日期以实际发布为准。

## Unreleased

### 中文

- 暂无。

### English

- Nothing yet.

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
