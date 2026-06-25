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
- **条目级版本历史备份与迁移**：在具体条目的右键 `论文版本` 菜单中导出或导入该条目的版本历史；导入不会覆盖已有历史。
- **诊断与健康检查**：设置页可复制脱敏诊断信息、运行健康检查、复制 issue 模板，便于普通用户排错和提交高质量反馈。
- **右侧论文版本面板**：在 Zotero 条目详情区域查看状态卡片、版本数量、最近检查结果、工作树状态、版本历史摘要和单次历史详情；历史详情可复制为 Markdown，也可导出该次修改摘要。

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
- `版本历史备份与迁移`：只配置条目级导出 ZIP 的默认保存目录；实际导入/导出请在具体条目的右键 `论文版本` 菜单中执行。

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

`论文版本` 菜单和右侧面板包含：

| 操作 | 说明 |
| --- | --- |
| `启用版本管理` | 为当前条目开启版本跟踪。 |
| `检查修改` | 比较当前论文文件与上一版本的差异。 |
| `创建版本...` | 将当前论文文件保存为一个新版本；创建前会显示文件名、跟踪方式、变化摘要、文件 hash 和工作树状态。 |
| `恢复版本...` | 选择历史版本并恢复到当前附件；恢复前会显示目标版本、当前/目标 hash、备份路径和安全检查结果。 |
| `导出此条目版本历史...` | 将当前条目的 git4zotero 本地版本历史导出为 ZIP；不包含 Zotero 原始附件文件。 |
| `导入版本历史到此条目...` | 将备份 ZIP 中的一个来源历史导入到当前条目；当前条目已有历史时会跳过，不会覆盖。 |
| `配置 Git 路径...` | 当 Git 不可用时快速配置路径。 |
| `停用版本管理` | 停止当前条目的版本管理，不删除已有版本历史。 |
| `历史详情` | 在右侧 `论文版本` 面板的单条历史记录中打开，查看备注、时间、文件信息、变化摘要和修改记录；长修改会先折叠，可按需展开，并可复制详情或导出该次修改摘要。 |

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

从 `0.4.0` 开始，版本历史导入/导出面向具体 Zotero 条目执行，不再从设置页操作整个库。设置页的 `版本历史备份与迁移` 只用于配置条目级导出 ZIP 的默认保存目录。

- 导出当前条目历史：右键目标 Zotero 条目或论文附件，选择 `论文版本 -> 导出此条目版本历史...`。
- 导入历史到当前条目：右键目标 Zotero 条目或论文附件，选择 `论文版本 -> 导入版本历史到此条目...`。
- 条目级导出文件名形如 `git4zotero-<item-key>-history-<timestamp>.zip`；如果设置页已配置迁移导出目录，插件会在该目录自动生成备份 ZIP 文件名。
- 导出内容只包含 git4zotero 保存的本地版本仓库和 `export-manifest.json`，不包含 Zotero 原始附件文件。
- 导入旧设备或旧条目的备份时，可以从备份包中选择一个来源历史并映射到当前条目。
- 如果当前条目已有版本历史，导入会跳过并提示，不会覆盖已有记录。

如果你仍保留旧版本生成的全库备份 ZIP，也可以从当前目标条目的右键导入入口选择该备份包，再从列表中选择需要导入到当前条目的来源历史。

## 诊断与健康检查

设置页的 `诊断与健康检查` 面向排错和 issue 反馈：

- `复制诊断信息`：生成默认脱敏的插件版本、Zotero 版本、系统、locale、Git 命令、Git 版本、数据目录、当前条目状态和最近错误。
- `运行健康检查`：检查 Git、数据目录、写权限、已删除条目留下的版本历史、metadata schema，以及 Git/index/metadata 一致性。
- `复制 issue 模板`：生成包含脱敏诊断信息和复现步骤占位的 issue 文本。
- `打开数据目录`：打开 Zotero profile 下的 `git4zotero` 目录，便于备份或人工核对。
- `打开 Git 安装指南`：跳转到 [Git 安装指南（Windows 小白版）](docs/GIT-INSTALL-zh.md)。

健康检查只提供诊断和建议，不会自动修复仓库、自动清理历史或覆盖本地文件。检查完成后会显示“下一步建议”，帮助判断是配置 Git、检查数据目录、清理已删除条目历史，还是复制诊断信息提交 issue。发现 metadata、Git 或 index 不一致时，建议先复制诊断信息提交 issue，再根据明确的修复方案处理。

## 功能边界

- 本插件提供本地版本管理，不是云同步、备份盘或多人实时协作系统。
- 本插件不替代 Word/WPS/LibreOffice 的修订模式；它保存的是附件文件在不同时间点的版本。
- 右侧 `论文版本` 面板主要用于显示状态；启用、检查、创建、恢复等写操作请通过条目列表右键菜单完成。
- 设置页只配置 Git、默认说明、诊断工具和条目级导出的默认目录；版本历史导入/导出请通过具体条目的右键菜单执行。
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

### 历史详情在哪里

选中已经启用版本管理的条目后，打开右侧 Zotero 条目栏中的 `论文版本` 面板。在版本历史列表中点击某条记录的 `历史详情`，即可查看该次版本的备注、创建时间、文件信息、变化摘要和已保存修改记录。详情面板提供 `复制详情` 和 `导出该次修改摘要`，便于发给指导老师或提交 issue；长文档差异会默认折叠，点击 `显示全部修改` 后再展开完整记录。

### 为什么设置页没有导入/导出按钮

从 `0.4.0` 开始，导入/导出按具体条目执行，避免误操作整个库。设置页的 `版本历史备份与迁移` 只保留默认导出目录配置；实际导入/导出请右键目标条目或附件，进入 `论文版本` 菜单。

### 设置迁移导出目录后会发生什么

你可以在设置页直接粘贴目录路径，按 Enter 或离开输入框后会自动保存。之后执行 `导出此条目版本历史...` 时，插件会在该目录自动生成备份 ZIP 文件名。该目录只影响导出默认位置，不影响导入位置、Zotero 原始附件或插件数据目录。

### 如何把版本历史迁移到新电脑

1. 在旧电脑选中需要迁移的 Zotero 条目或论文附件，右键选择 `论文版本 -> 导出此条目版本历史...`，保存条目级备份 ZIP。
2. 在新电脑安装 Zotero、Git 和 git4zotero，并确认目标论文条目已经存在且有 `.docx` 或 `.doc` 附件。
3. 在新电脑右键目标条目或附件，选择 `论文版本 -> 导入版本历史到此条目...`，选择旧电脑导出的备份 ZIP。
4. 如果备份包中有多个来源历史，选择要导入到当前条目的那一项；如果当前条目已有历史，插件会跳过导入，不会覆盖。
5. 导入完成后运行 `运行健康检查`，确认 Git、数据目录、metadata 和索引状态正常。

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

感谢以下项目、社区与贡献者为 git4zotero 的开发提供基础、参考与建议：

- [zotero/zotero](https://github.com/zotero/zotero)
- [windingwind/zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
- [Git](https://git-scm.com/)
- [zotero 中文社区](https://zotero-chinese.com)
- [Zeng Jin](https://medgs.xjtu.edu.cn/info/1408/12084.htm)（指导老师）
- Meng L.、Liu G.
