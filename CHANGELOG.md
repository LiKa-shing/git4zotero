# Changelog

本项目的变更记录遵循简洁人工维护格式。发布日期以实际发布为准。

## Unreleased

- 暂无。

## 0.2.0

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

- Documented current plugin release metadata for Zotero 8/9 compatibility.
- Current supported manuscript formats are `.docx` and `.doc`.
- `.docx` versions support content-level paragraph comparison; `.doc` versions use file-level tracking.
