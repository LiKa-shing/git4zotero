# Git 安装指南（Windows 小白版）

这份指南面向第一次安装 Git 的 `git4zotero` 用户。你不需要会写代码，也不需要学习 Git 命令；本插件只是借助 Git 在本机保存论文附件的版本历史。

安装完成后，只要 Zotero 插件能检测到 Git，就可以继续使用 `论文版本` 菜单中的启用、检查、创建和恢复功能。

## 1. 下载 Git for Windows

1. 打开 [Git 官网下载页](https://git-scm.com/downloads)。
2. 选择 `Windows`。
3. 下载 64 位安装包。文件名通常类似 `Git-*-64-bit.exe`。
4. 下载完成后双击安装包。

如果你不确定电脑是 32 位还是 64 位，Windows 10/11 的普通电脑几乎都可以选择 64 位安装包。

## 2. 安装时如何选择

大多数页面保持默认选项即可。遇到下面这些页面时，按这里选择：

| 安装器页面 | 建议选择 |
| --- | --- |
| `Select Components` | 保持默认。 |
| `Choosing the default editor used by Git` | 保持默认即可。 |
| `Adjusting the name of the initial branch in new repositories` | 保持默认即可。 |
| `Adjusting your PATH environment` | 选择 `Git from the command line and also from 3rd-party software`。 |
| `Choosing HTTPS transport backend` | 保持默认。 |
| `Configuring the line ending conversions` | 保持默认。 |
| `Configuring the terminal emulator to use with Git Bash` | 保持默认。 |
| `Choose the default behavior of git pull` | 保持默认。 |
| `Choose a credential helper` | 保持默认。 |
| `Configuring extra options` | 保持默认。 |

最重要的是 PATH 选项。选择 `Git from the command line and also from 3rd-party software` 后，Zotero 插件更容易自动找到 Git。

## 3. 检查 Git 是否安装成功

安装完成后，关闭已经打开的 PowerShell、Windows Terminal 或命令提示符，然后重新打开一个新的 PowerShell。

在 PowerShell 中输入：

```powershell
git --version
```

如果看到类似下面的输出，说明 Git 已安装成功：

```text
git version 2.50.0.windows.1
```

版本号不需要完全一样，只要能显示 `git version` 即可。

你也可以继续输入：

```powershell
where git
```

常见输出路径是：

```text
C:\Program Files\Git\cmd\git.exe
```

## 4. 在 Zotero 插件中配置 Git

安装 `git4zotero` 后，打开 Zotero 设置页：

- Windows/Linux：`编辑 -> 设置`
- macOS：`Zotero -> 设置`

进入 `Git` / `论文版本管理` 面板：

1. `Git 可执行文件路径` 可以先留空。
2. 点击 `测试 Git`。
3. 如果提示 Git 可用，就不需要再改。
4. 如果仍提示 `Git 不可用`，填写完整路径：

```text
C:\Program Files\Git\cmd\git.exe
```

然后再次点击 `测试 Git`。

## 5. 常见问题

### PowerShell 提示 `git` 不是命令

通常是 Git 没有加入 PATH，或安装后没有重新打开终端。

处理步骤：

1. 关闭所有 PowerShell、Windows Terminal、命令提示符窗口。
2. 重新打开 PowerShell。
3. 再运行 `git --version`。
4. 如果仍失败，重新安装 Git，并确认 PATH 页面选择了 `Git from the command line and also from 3rd-party software`。

### Zotero 仍提示 `Git 不可用`

先在 PowerShell 中确认：

```powershell
git --version
where git
```

如果 `where git` 显示了路径，把其中的 `git.exe` 完整路径复制到 Zotero 插件设置页，例如：

```text
C:\Program Files\Git\cmd\git.exe
```

然后点击 `测试 Git`。

### 我的 Git 不在 `C:\Program Files\Git`

这很常见。以 `where git` 显示的路径为准。

如果输出是：

```text
C:\Users\YourName\AppData\Local\Programs\Git\cmd\git.exe
```

就在 Zotero 设置页填写这条路径。

### 工位的电脑不允许安装 Git

如果你没有安装权限，请联系电脑管理员安装 Git for Windows。插件必须能调用本机 Git，才能创建和恢复论文版本。

## 6. macOS / Linux 简要说明

macOS 用户通常可以先在终端运行：

```bash
git --version
```

如果系统提示安装 Command Line Tools，按提示安装即可。也可以使用 Homebrew 安装：

```bash
brew install git
```

Linux 用户可使用发行版包管理器安装，例如：

```bash
sudo apt install git
```

安装完成后同样运行：

```bash
git --version
```

确认 Git 可用后，再回到 Zotero 插件设置页点击 `测试 Git`。
