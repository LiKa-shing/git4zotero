<p align="center">
  <img src="chrome/content/icons/paper-version-96.png" alt="git4zotero icon" width="96" height="96">
</p>

<h1 align="center">git4zotero</h1>

<p align="center">为 Zotero 的 Word 论文手稿提供基于 Git 的本地版本管理。</p>

<p align="center">
  <a href="https://www.zotero.org/"><img src="https://img.shields.io/badge/Zotero-8%20%7C%209-CC2936?logo=zotero&logoColor=white" alt="Zotero"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/releases"><img src="https://img.shields.io/github/package-json/v/LiKa-shing/git4zotero" alt="version"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/releases/latest"><img src="https://img.shields.io/github/downloads/LiKa-shing/git4zotero/latest/total" alt="downloads"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/releases/latest"><img src="https://img.shields.io/github/release-date/LiKa-shing/git4zotero" alt="release date"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/LiKa-shing/git4zotero" alt="license"></a>
  <a href="https://github.com/LiKa-shing/git4zotero/actions/workflows/ci.yml"><img src="https://github.com/LiKa-shing/git4zotero/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  简体中文 | <a href="README-en.md">English</a>
</p>

`git4zotero` ，即`git for zotero`，是一款面向 Zotero 8/9 的论文附件版本管理插件。它使用本机 Git 为 Zotero 条目中的 Word 论文文件建立本地版本历史，让初稿、修改稿、投稿稿和恢复点留在同一个文献条目旁边。

- 兼容 Zotero `8.0` 到 `9.0.*`
- 推荐格式：`.docx`
- 支持格式：`.docx`、`.doc`
- 数据位置：Zotero 配置目录中的 `git4zotero` 文件夹

## 特性

- **本地 Git 版本历史**：每个启用版本管理的 Zotero 条目都有独立的本地 Git 仓库，不依赖云服务。
- **围绕 Zotero 条目操作**：通过条目列表右键菜单中的 `论文版本` 执行启用、检查、创建、恢复和停用。
- **`.docx` 正文级差异识别**：读取正文、脚注和尾注，排除删除修订和批注，显示新增、删除、修改段落及字数变化。
- **`.doc` 文件级跟踪**：支持创建版本和恢复版本，用于保存二进制文件变更历史。
- **恢复前可解释安全检查**：恢复旧版本前展示目标版本、Git hash、当前文件 hash、目标版本 hash、备份路径、可写状态和 Git 工作树状态。
- **本地版本历史备份与迁移**：可在设置页导出全部 git4zotero 版本仓库，也可导入到新设备；导入只补充缺失仓库，不覆盖已有历史。
- **诊断与健康检查**：设置页可复制脱敏诊断信息、运行健康检查、复制 issue 模板，便于普通用户排错和提交高质量反馈。
- **右侧论文版本面板**：在 Zotero 条目详情区域查看状态卡片、版本数量、最近检查结果、工作树状态和版本历史摘要。

## 适用场景

- 为论文初稿、修改稿、投稿稿、返修稿保留清晰的本地历史。
- 在导师、合作者或编辑反馈后，记录每轮改动的可恢复版本。
- 在不引入外部同步或协作系统的前提下，为 Zotero 中的论文附件增加版本留痕。
- 在 Word/WPS/LibreOffice 编辑和 Zotero 文献管理之间建立更稳妥的工作流。

## 安装

### 1. 安装 Git

插件依赖本机 Git。请先安装 [Git](https://git-scm.com/downloads)，并在终端确认可用：

```powershell
git --version
```

第一次安装 Git，或不熟悉 Windows 安装器选项，可参考 [Git 安装指南（Windows 小白版）](docs/GIT-INSTALL-zh.md)。

如果 Git 没有加入系统 PATH，可以稍后在 Zotero 的插件设置页中填写完整路径，例如：

```text
C:\Program Files\Git\cmd\git.exe
```

### 2. 安装插件

1. 从 [Releases](https://github.com/LiKa-shing/git4zotero/releases) 下载最新的 [`git4zotero.xpi`](https://github.com/LiKa-shing/git4zotero/releases/latest/download/git4zotero.xpi)。
2. 打开 Zotero，进入 `工具 -> 插件`。
3. 将 `git4zotero.xpi` 拖入插件窗口，或点击齿轮菜单选择 `Install Add-on From File...`。
4. 安装完成后重启 Zotero。

### 3. 初始配置

重启后进入 Zotero 设置页：

- Windows/Linux：`编辑 -> 设置`
- macOS：`Zotero -> 设置`

在 `Git` / `论文版本管理` 设置页中可以配置：

- `Git 可执行文件路径`：留空时插件会尝试使用系统 PATH 中的 `git`。
- `测试 Git`：测试当前 Git 路径是否可用，并保存可用路径。
- `默认版本说明`：创建版本时说明为空，将使用该默认文本。
- `恢复旧版本前自动创建安全版本`：建议保持开启。
- `首次使用向导`：手动查看 Git、数据目录、右键启用流程和 `.docx` / `.doc` 能力差异说明。
- `诊断与健康检查`：复制诊断信息、运行健康检查、打开数据目录、复制 issue 模板。
- `版本历史备份与迁移`：导出或导入本机保存的 git4zotero 版本历史。

## 快速开始

1. 第一次使用时，先到设置页打开 `首次使用向导` 并点击 `测试 Git`。
2. 在 Zotero 条目中添加 `.docx` 或 `.doc` 论文附件，推荐使用 `.docx`。
3. 在条目列表中右键该 Zotero 条目，或右键对应论文附件。
4. 打开 `论文版本` 菜单，选择 `启用版本管理`。
5. 选择 `创建版本...`，确认创建前摘要并填写版本说明，例如 `初稿`。
6. 在 Word、WPS 或 LibreOffice 中编辑论文，并先在文字处理软件中保存文件。
7. 回到 Zotero，右键同一条目或附件，选择 `检查修改`。
8. 确认需要保存当前修改时，选择 `创建版本...`。
9. 需要回退时，选择 `恢复版本...`，从列表中选择目标版本，确认恢复前安全检查后再继续。

`论文版本` 菜单包含：

| 操作 | 说明 |
| --- | --- |
| `启用版本管理` | 为当前条目开启版本跟踪。 |
| `检查修改` | 比较当前论文文件与上一版本的差异。 |
| `创建版本...` | 将当前论文文件保存为一个新版本；创建前会显示文件名、跟踪方式、变化摘要、文件 hash 和工作树状态。 |
| `恢复版本...` | 选择历史版本并恢复到当前附件；恢复前会显示目标版本、当前/目标 hash、备份路径和安全检查结果。 |
| `配置 Git 路径...` | 当 Git 不可用时快速配置路径。 |
| `停用版本管理` | 停止当前条目的版本管理，不删除已有版本历史。 |

插件只支持单选操作。一次选择多个 Zotero 条目时，版本操作不可用。

## 格式支持

| 格式 | 支持级别 | 说明 |
| --- | --- | --- |
| `.docx` | 正文级识别 | 可分析正文、脚注和尾注，展示段落级改动和字数变化。 |
| `.doc` | 文件级跟踪 | 可判断文件是否变化，并创建或恢复版本；不展示具体段落差异。 |

优先使用 `.docx` 可以获得更准确的差异摘要。恢复旧版本前，请确认当前文件已经保存并尽量关闭文字处理软件，避免外部程序覆盖恢复结果。

## 数据安全与恢复

恢复版本时，插件会先做恢复预检，再执行备份和替换：

- 检查当前论文文件是否存在、可读，当前文件所在目录是否可写。
- 显示当前文件 hash、目标版本文件 hash、完整 Git hash 和即将写入的恢复前备份路径。
- 读取 Git 仓库和工作树状态；若存在阻止恢复的问题，会取消恢复。
- 若只存在警告，会提示先保存并关闭 Word/WPS/LibreOffice，避免文件占用或自动保存覆盖恢复结果。
- 恢复执行时会复用预检阶段生成的备份路径，并在写入前重新校验当前文件 hash，防止确认后文件又被外部程序修改。

自动创建的安全版本和恢复前文件备份都保存在本机插件数据目录中。请不要手动删除或改写这些目录中的 Git 文件、`index.json` 或 `.git4zotero/versions.json`。

## 导入与导出

设置页提供 `导出全部版本历史...` 和 `导入版本历史...`：

- 导出文件名形如 `git4zotero-backup-<timestamp>.zip`。
- 导出内容只包含 git4zotero 的本地版本仓库、`index.json` 和 `export-manifest.json`，不包含 Zotero 原始附件文件。
- 导入用于换电脑、备份 Zotero profile 或迁移历史；若目标设备中已有同名 `library-*/item-*` 仓库，会跳过并报告，不会覆盖现有历史。
- 导入后会刷新本地仓库索引，方便后续健康检查和条目删除清理。

## 诊断与健康检查

设置页的 `诊断与健康检查` 面向排错和 issue 反馈：

- `复制诊断信息`：生成默认脱敏的插件版本、Zotero 版本、系统、locale、Git 命令、Git 版本、数据目录、当前条目状态和最近错误。
- `运行健康检查`：检查 Git、数据目录、写权限、已删除条目留下的版本历史、metadata schema，以及 Git/index/metadata 一致性。
- `复制 issue 模板`：生成包含脱敏诊断信息和复现步骤占位的 issue 文本。
- `打开数据目录`：打开 Zotero profile 下的 `git4zotero` 目录，便于备份或人工核对。
- `打开 Git 安装指南`：跳转到 [Git 安装指南（Windows 小白版）](docs/GIT-INSTALL-zh.md)。

健康检查只提供诊断和建议，不会自动修复仓库、自动清理历史或覆盖本地文件。发现 metadata、Git 或 index 不一致时，建议先复制诊断信息提交 issue，再根据明确的修复方案处理。

## 功能边界

- 本插件提供本地版本管理，不是云同步、备份盘或多人实时协作系统。
- 本插件不替代 Word/WPS/LibreOffice 的修订模式；它保存的是附件文件在不同时间点的版本。
- 右侧 `论文版本` 面板主要用于显示状态；启用、检查、创建、恢复等写操作请通过条目列表右键菜单完成。
- 不建议手动修改 Zotero 配置目录中 `git4zotero` 文件夹内的 Git 仓库、`index.json` 和 `.git4zotero` 元数据。
- Zotero 条目移入回收站时会保留版本历史；永久删除条目或清空回收站后，插件会自动清理对应历史。

## 常见问题

### 提示 `Git 不可用`

1. 确认已安装 Git。第一次安装可参考 [Git 安装指南（Windows 小白版）](docs/GIT-INSTALL-zh.md)。
2. 在终端运行 `git --version`。
3. 在 Zotero 设置页填写完整的 Git 可执行文件路径。
4. 点击 `测试 Git`，确认插件可以调用 Git。

### 找不到 `论文版本` 菜单

1. 确认只选中了一个 Zotero 条目或一个附件。
2. 确认该条目存在 `.docx` 或 `.doc` 附件。
3. 重启 Zotero。
4. 确认安装的是最新版本的 `git4zotero.xpi`。

### 显示 `未找到可管理的论文文件`

请为当前 Zotero 条目添加 `.docx` 或 `.doc` 附件。网页快照、PDF、图片和其他附件格式不会被作为论文手稿管理。

### 恢复版本后内容看起来又变回去了

恢复前请先保存并关闭 Word/WPS/LibreOffice 中打开的同一文件。有些文字处理软件会在退出或自动保存时再次写入文件，可能覆盖插件刚恢复的版本。若恢复预检提示当前文件不可写、hash 在确认后变化，或恢复时出现文件占用/保存问题，请关闭编辑器后重新执行 `恢复版本...`。

### 如何把版本历史迁移到新电脑

1. 在旧电脑 Zotero 设置页点击 `导出全部版本历史...`，保存 `git4zotero-backup-<timestamp>.zip`。
2. 在新电脑安装 Zotero、Git 和 git4zotero，并确认 Zotero 已使用同一批文献条目。
3. 在新电脑设置页点击 `导入版本历史...`，选择备份包。
4. 导入完成后运行 `运行健康检查`，确认 Git、数据目录、metadata 和索引状态正常。

### 删除 Zotero 条目后历史目录仍存在

如果只是将条目移入 Zotero 回收站，插件会保留版本历史，方便条目恢复后继续使用。只有永久删除条目或清空回收站后，插件才会自动清理对应仓库。升级前遗留的“已删除条目留下的版本历史”可在 Zotero 设置页的 `Git` 面板中检查并清理。

## 开发与贡献

开发环境、打包和 Zotero 本地验证流程见 [docs/INSTALL.md](docs/INSTALL.md)。贡献规范见 [CONTRIBUTING.md](CONTRIBUTING.md)。

常用命令：

```powershell
npm install
npm run verify
npm run package
```

打包产物位于：

```text
dist\git4zotero.xpi
```

## 开源协议

本项目使用 [MIT License](LICENSE)。

## 致谢

感谢 [Zotero](https://www.zotero.org/) 提供开放的文献管理平台，感谢 [Git](https://git-scm.com/) 提供稳定可靠的版本管理能力，也感谢 Zotero 插件社区长期积累的开发经验与文档。特别感谢 Meng L.、Liu G. 在开发过程中提出的宝贵意见。
