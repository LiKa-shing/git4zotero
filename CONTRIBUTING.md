# 贡献指南

感谢你参与 `git4zotero`。本项目是面向 Zotero 8/9 的本地 Git 论文版本管理插件，主要能力包括为 `.docx` 和 `.doc` 论文附件创建版本、检查修改、查看历史并恢复旧版本。

本文档面向两类读者：

- **贡献者**：提交 bug 修复、功能改进、文档更新或测试补充。
- **维护者**：合并变更、验证打包结果并发布 GitHub Release。

开发环境搭建见 [docs/INSTALL.md](docs/INSTALL.md)。普通用户安装和使用说明见 [README.md](README.md)。

## 贡献流程

1. 从最新代码创建独立分支，保持改动范围集中。
2. 先阅读相关模块和现有测试，再修改代码或文档。
3. 避免无关格式化、批量重排和与目标无关的重构。
4. 修改后运行与改动范围匹配的验证命令。
5. 提交前检查 diff，确认没有包含临时文件、打包产物或测试数据。
6. 在 PR 中说明改动目的、验证结果和仍需注意的风险。

推荐本地验证顺序：

```powershell
npm install
npm run check
npm run typecheck
npm run test
npm run package
npm run inspect:xpi
```

完整验证命令：

```powershell
npm run verify
```

## 项目结构

| 路径 | 说明 |
| --- | --- |
| `bootstrap.js` | Zotero bootstrap 入口，注册 chrome content 并加载打包生成的 classic runtime。 |
| `chrome/content/src/*.mjs` | 插件主体源码，包括附件识别、Git 后端、正文 diff、元数据和 UI。 |
| `chrome/content/preferences.*` | Zotero 设置页，用于配置 Git 路径、默认版本说明和恢复前安全版本。 |
| `locale/*/git4zotero.ftl` | Zotero UI 本地化文案。 |
| `scripts/runtime-builder.mjs` | 将运行时 ESM 模块按固定顺序转换为 classic runtime。 |
| `scripts/package.mjs` | 打包并校验 `dist/git4zotero.xpi`。 |
| `scripts/test.mjs` | Node 环境下的核心逻辑测试。 |
| `.github/workflows/*.yml` | CI 与手动发布流程。 |

新增运行时模块时，必须同步维护 `scripts/runtime-builder.mjs` 中的 `runtimeModuleOrder`，否则打包后的 Zotero runtime 不会包含该模块。

## 代码约束

- 保持 Zotero `8.0` 到 `9.0.*` 兼容，不使用会破坏该范围的 API 或模块加载方式。
- 不引入不必要的运行时依赖。现有运行时应优先使用 Zotero API、浏览器 API 和项目内 helper。
- `chrome/content/src/constants.mjs` 是支持格式的事实来源；当前只支持 `.docx` 和 `.doc`。
- `.docx` 走正文级差异识别；`.doc` 只做文件级版本跟踪。不要在 UI 或文档中承诺未实现的格式。
- 右侧 item pane 只负责展示状态、最近检查和历史摘要；启用、检查、创建、恢复和停用等写操作继续由右键菜单触发。
- 修改 `.docx` 解析、diff、Git 后端、恢复流程或元数据结构时，应补充或更新 `scripts/test.mjs` 中的测试。
- 保持生成包结构稳定：`manifest.json`、`bootstrap.js`、`prefs.js`、`chrome/` 和 `locale/` 必须位于 XPI 根目录。

## 验证矩阵

| 命令 | 何时运行 | 验证内容 |
| --- | --- | --- |
| `npm run check` | 所有 PR | manifest、图标、文案、模块语法、打包脚本约束和必需文件。 |
| `npm run typecheck` | 修改源码或类型相关配置 | TypeScript / Zotero 类型检查。 |
| `npm run test` | 修改业务逻辑 | 附件识别、diff、Git、元数据和恢复相关逻辑。 |
| `npm run package` | 修改运行时代码、manifest、资源或打包脚本 | 生成 `dist/git4zotero.xpi` 并校验包结构。 |
| `npm run inspect:xpi` | 打包后 | 检查 XPI 根目录、manifest、图标、runtime 和诊断信息。 |
| `npm run verify` | 合并前或发布前 | 顺序运行完整验证链路。 |

CI 会在 push 到 `main` 或针对 `main` 的 pull request 中运行同等验证，并上传 `git4zotero.xpi` artifact。CI 固定使用 Node `24.16.0`。

## Zotero 手动测试

涉及 UI、Git 调用、附件文件、恢复流程或打包结构的改动，都应安装 `dist\git4zotero.xpi` 到 Zotero 测试环境中验证。

建议使用独立测试 profile 或测试文献库，避免把实验版本历史写入真实库。基础流程：

1. 新建测试条目并添加 `.docx` 附件。
2. 右键条目或附件，选择 `论文版本 -> 启用版本管理`。
3. 创建首个版本。
4. 用 Word、WPS 或 LibreOffice 修改并保存附件。
5. 回到 Zotero，选择 `论文版本 -> 检查修改`。
6. 确认差异后创建新版本。
7. 选择 `论文版本 -> 恢复版本...`，验证历史恢复。
8. 分别测试 Git 路径为空和显式填写 `git.exe` 路径两种场景。

测试数据会写入 Zotero profile 下的 `git4zotero` 目录。不要在真实文献库中验证破坏性恢复流程。

## PR 检查清单

提交或合并前确认：

- 改动范围与 PR 目标一致，没有混入无关格式化。
- 文档、UI 文案和源码能力一致。
- 版本支持声明仍为 Zotero `8.0` 到 `9.0.*`。
- 没有提交 `dist/`、临时 profile、测试文档或本地 IDE 缓存。
- 已在 PR 描述中写明运行过的命令和手动测试结果。
- 如果修改发布、打包或更新相关逻辑，已同时检查 CI 和 release workflow。

## 发布流程

发布由维护者通过 GitHub Actions 手动执行。

1. 同步提升 `package.json` 和 `manifest.json` 中的版本号。
2. 更新 `CHANGELOG.md`。
3. 本地运行：

   ```powershell
   npm run verify
   ```

4. 合并到 `main` 后，打开 GitHub Actions 中的 `Release plugin` workflow。
5. 选择发布类型：
   - `prerelease = true`：创建 GitHub pre-release，并使用 `--latest=false`，避免影响 Zotero 自动更新入口。
   - `prerelease = false`：创建正式 release，并上传 `git4zotero.xpi` 和 `updates.json`。
6. 发布后确认 release asset 包含：
   - `git4zotero.xpi`
   - `updates.json`

Release tag 固定为 `v<version>`。如果 tag 或 release 已存在，workflow 会失败；此时应提升版本号后重新发布。
