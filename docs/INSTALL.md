# Windows + VSCode 开发环境搭建

本文档用于在新的 Windows 设备上搭建 `git4zotero` 开发环境。目标是让本机可以完成代码编辑、类型检查、测试、打包，以及在 Zotero 8/9 中安装 XPI 做手动验证。

普通用户安装插件请参考仓库根目录的 [README.md](../README.md)。贡献和发布规范请参考 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 适用范围

- 操作系统：Windows 10/11
- 编辑器：VSCode
- 终端：PowerShell
- Zotero：`8.0` 到 `9.0.*`
- Node.js：与 CI 保持一致，使用 `24.16.0`
- 支持附件格式：`.docx`、`.doc`

本项目需要在 Windows 本机与 Zotero 联调，不建议使用 Docker 作为主要 npm 开发环境。

## 1. 安装基础工具

### Git for Windows

安装 [Git for Windows](https://git-scm.com/downloads)，然后重新打开 PowerShell，确认 Git 可用。普通用户第一次安装 Git，可参考 [Git 安装指南（Windows 小白版）](GIT-INSTALL-zh.md)：

```powershell
git --version
where git
```

如果 Zotero 插件内无法自动识别 Git，后续可在插件设置页填写：

```text
C:\Program Files\Git\cmd\git.exe
```

### Node.js 与 npm

CI 使用 Node `24.16.0`。本地开发应尽量使用同一版本，避免类型检查、测试或打包行为不一致。

推荐两种安装方式：

| 方案 | 适用场景 | 建议 |
| --- | --- | --- |
| Node.js 官方 MSI | 这台电脑主要开发 `git4zotero` | 默认选择，安装简单。 |
| `nvm-windows` | 需要维护多个 Node 项目或多个 Node 主版本 | 便于锁定和切换精确版本。 |

#### 方案 A：Node.js 官方 MSI

访问 Node.js 下载页：

```text
https://nodejs.org/en/download
```

选择 Windows x64 安装包。安装完成后关闭所有终端，重新打开 PowerShell：

```powershell
node --version
npm --version
where node
where npm
```

如果官网当前 LTS 已不是 `24.16.0`，但你需要与 CI 完全一致，优先使用 `nvm-windows` 安装精确版本。

正常情况下，`where node` 和 `where npm` 应指向 `C:\Program Files\nodejs`。npm 使用 Node 自带版本，不需要全局升级。

#### 方案 B：nvm-windows

如果电脑已经安装过 Node.js MSI，先在 Windows“应用和功能”中卸载旧 Node。重新打开 PowerShell，确认旧路径不再抢先：

```powershell
where node
where npm
```

从官方 release 页面安装 `nvm-windows`：

```text
https://github.com/coreybutler/nvm-windows/releases
```

安装完成后关闭所有终端，使用管理员 PowerShell 安装并启用 Node `24.16.0`：

```powershell
nvm install 24.16.0 64
nvm use 24.16.0 64
```

确认环境：

```powershell
nvm current
node --version
npm --version
where node
where npm
```

### VSCode

安装 [VSCode](https://code.visualstudio.com/)，建议启用：

- EditorConfig for VS Code
- GitLens，可选

建议使用 VSCode 内置 JavaScript/TypeScript 支持。项目没有 Prettier 或 ESLint 配置，不建议启用全仓库保存时自动格式化，以免产生无关 diff。

### Zotero 8/9

安装 [Zotero](https://www.zotero.org/)。开发验证建议使用单独的测试 profile 或测试文献库，避免测试版本历史写入真实文献库。

## 2. 获取项目并安装依赖

示例目录为 `%USERPROFILE%\Github\git4zotero`，可按个人习惯调整。

```powershell
cd $env:USERPROFILE\Github
git clone https://github.com/LiKa-shing/git4zotero.git
cd $env:USERPROFILE\Github\git4zotero
npm install
```

如果已经从其他设备复制了仓库，只需进入项目目录后执行：

```powershell
npm install
```

如果使用 `nvm-windows`，每次进入项目或重开终端后先确认 Node 版本：

```powershell
nvm use 24.16.0 64
node --version
```

## 3. 配置 VSCode 工作区

打开项目：

```powershell
code $env:USERPROFILE\Github\git4zotero
```

建议保持以下设置和习惯：

- VSCode 终端使用 PowerShell。
- 安装或切换 Node 后，重启 VSCode 或至少重开 VSCode 终端。
- 文件编码使用 UTF-8。
- 换行使用 LF，遵守 `.editorconfig` 和 `.gitattributes`。
- 不全局安装 TypeScript、ESLint 或 Prettier；始终通过 `package.json` scripts 调用项目依赖。
- 修改源码前先阅读相关测试和相邻模块，避免破坏 Zotero 8/9 兼容路径。

主要源码位于：

```text
chrome/content/src/*.mjs
```

需要特别注意：`bootstrap.js` 不直接加载 ESM，而是加载打包时生成的 classic runtime。新增运行时模块时，必须同步维护 `scripts/runtime-builder.mjs` 中的 `runtimeModuleOrder`。

## 4. 验证开发环境

建议先分步执行，方便定位问题：

```powershell
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

验证成功后，仓库会生成：

```text
dist\git4zotero.xpi
```

`npm run verify` 会依次运行静态检查、类型检查、测试、打包和 XPI 检查。若失败，优先根据失败阶段判断是环境问题、依赖问题、源码问题还是打包结构问题。

## 5. 打包并安装到 Zotero

生成插件包：

```powershell
npm run package
```

在 Zotero 中安装：

1. 打开 `工具 -> 插件`。
2. 点击齿轮菜单，选择从文件安装插件。
3. 选择 `dist\git4zotero.xpi`。
4. 重启 Zotero。

安装后打开 Zotero 设置页中的 `Git` / `论文版本管理` 面板。Git 路径可以先留空，让插件自动查找 PATH 或常见安装路径。如果检测失败，填写：

```text
C:\Program Files\Git\cmd\git.exe
```

然后点击 `测试 Git`。

设置页中的 `版本历史备份与迁移` 只用于配置条目级导出 ZIP 的默认保存目录。`0.4.0` 起不要在设置页寻找全库导入/导出按钮；实际导入/导出请在具体条目或附件的右键 `论文版本` 菜单中执行。

## 6. Zotero 手动测试流程

建议使用测试 profile 或测试文献库执行：

1. 新建一个测试条目。
2. 添加 `.docx` 附件。
3. 右键条目或附件，选择 `论文版本 -> 启用版本管理`。
4. 选择 `论文版本 -> 创建版本...`，创建首个版本。
5. 用 Word、WPS 或 LibreOffice 修改并保存 `.docx`。
6. 回到 Zotero，选择 `论文版本 -> 检查修改`。
7. 确认差异后创建新版本。
8. 打开右侧条目栏中的 `论文版本` 面板，点击单条历史记录的 `历史详情`，确认能看到备注、创建时间、文件信息、变化摘要和完整修改记录。
9. 使用 `论文版本 -> 恢复版本...` 验证历史恢复。
10. 在设置页 `版本历史备份与迁移` 中粘贴一个测试导出目录，按 Enter 或离开输入框，确认目录会自动保存。
11. 回到测试条目，右键选择 `论文版本 -> 导出此条目版本历史...`，确认导出的 ZIP 默认写入刚保存的目录。
12. 准备一个没有版本历史的目标测试条目，右键选择 `论文版本 -> 导入版本历史到此条目...`，选择上一步导出的 ZIP，确认导入只作用于当前目标条目且不会覆盖已有历史。
13. 再用 `.doc` 附件验证文件级版本判断和恢复。
14. 分别测试 Git 路径为空和显式填写 `git.exe` 路径两种场景。

插件数据目录位于 Zotero profile 下的 `git4zotero` 文件夹。不要手动修改其中的 Git 仓库和 `.git4zotero` 元数据，除非正在进行专门排错。

## 7. 常见排错

### PowerShell 找不到 `node` 或 `npm`

- 关闭并重新打开 PowerShell。
- 重启 VSCode 或重开 VSCode 终端。
- 运行 `where node` 和 `where npm`，确认路径来自预期安装位置。
- 如果使用 `nvm-windows`，先执行 `nvm use 24.16.0 64`。

### Node 版本不对

- MSI 方案：检查是否存在旧 Node 安装目录或旧 PATH 项。
- `nvm-windows` 方案：运行 `nvm current`，确认当前版本为 `24.16.0`。
- VSCode 终端版本不对时，重启 VSCode。

### `nvm use` 权限失败

使用管理员 PowerShell 执行：

```powershell
nvm use 24.16.0 64
```

### `npm install` 失败

- 确认 Node 和 npm 可用。
- 确认当前目录是项目根目录。
- 如果是网络问题，先确认代理或网络环境，再重试。

### Zotero 插件内提示 `Git 不可用`

- 在 PowerShell 中运行 `git --version`。
- 在插件设置页点击 `测试 Git`。
- 如果 PATH 无法识别，填写完整路径：`C:\Program Files\Git\cmd\git.exe`。

### 安装 XPI 后没有看到菜单

- 确认安装的是 `dist\git4zotero.xpi`，不是旧包。
- 重启 Zotero。
- 确认只选中了一个 Zotero 条目或附件。
- 确认条目中存在 `.docx` 或 `.doc` 附件。

## 8. 后续阅读

- [README.md](../README.md)：用户安装、功能说明和常见问题。
- [CONTRIBUTING.md](../CONTRIBUTING.md)：贡献流程、代码约束、测试矩阵和发布流程。
- [CHANGELOG.md](../CHANGELOG.md)：版本变更记录。
