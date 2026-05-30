# git for zotero

[![Zotero](https://img.shields.io/badge/Zotero-8%20%7C%209-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org/)
[![version](https://img.shields.io/github/package-json/v/LiKa-shing/git4zotero)](https://github.com/LiKa-shing/git4zotero/releases)
[![downloads](https://img.shields.io/github/downloads/LiKa-shing/git4zotero/latest/total)](https://github.com/LiKa-shing/git4zotero/releases/latest)
[![license](https://img.shields.io/github/license/LiKa-shing/git4zotero)](LICENSE)
[![CI](https://github.com/LiKa-shing/git4zotero/actions/workflows/ci.yml/badge.svg)](https://github.com/LiKa-shing/git4zotero/actions/workflows/ci.yml)

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
- **恢复前安全版本**：恢复旧版本前可自动创建当前文件的安全版本，降低误覆盖风险。
- **右侧论文版本面板**：在 Zotero 条目详情区域查看当前状态、版本数量、最近检查结果和版本历史摘要。

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

## 快速开始

1. 在 Zotero 条目中添加 `.docx` 或 `.doc` 论文附件，推荐使用 `.docx`。
2. 在条目列表中右键该 Zotero 条目，或右键对应论文附件。
3. 打开 `论文版本` 菜单，选择 `启用版本管理`。
4. 选择 `创建版本...`，填写版本说明，例如 `初稿`。
5. 在 Word、WPS 或 LibreOffice 中编辑论文，并先在文字处理软件中保存文件。
6. 回到 Zotero，右键同一条目或附件，选择 `检查修改`。
7. 确认需要保存当前修改时，选择 `创建版本...`。
8. 需要回退时，选择 `恢复版本...`，从列表中选择目标版本并确认恢复。

`论文版本` 菜单包含：

| 操作 | 说明 |
| --- | --- |
| `启用版本管理` | 为当前条目开启版本跟踪。 |
| `检查修改` | 比较当前论文文件与上一版本的差异。 |
| `创建版本...` | 将当前论文文件保存为一个新版本。 |
| `恢复版本...` | 选择历史版本并恢复到当前附件。 |
| `配置 Git 路径...` | 当 Git 不可用时快速配置路径。 |
| `停用版本管理` | 停止当前条目的版本管理，不删除已有版本历史。 |

插件只支持单选操作。一次选择多个 Zotero 条目时，版本操作不可用。

## 格式支持

| 格式 | 支持级别 | 说明 |
| --- | --- | --- |
| `.docx` | 正文级识别 | 可分析正文、脚注和尾注，展示段落级改动和字数变化。 |
| `.doc` | 文件级跟踪 | 可判断文件是否变化，并创建或恢复版本；不展示具体段落差异。 |

优先使用 `.docx` 可以获得更准确的差异摘要。恢复旧版本前，请确认当前文件已经保存并尽量关闭文字处理软件，避免外部程序覆盖恢复结果。

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

恢复前请先保存并关闭 Word/WPS/LibreOffice 中打开的同一文件。有些文字处理软件会在退出或自动保存时再次写入文件，可能覆盖插件刚恢复的版本。

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
