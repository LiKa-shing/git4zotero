export const PLUGIN_ID = "git4zotero@paper-version.local";
export const PLUGIN_NAME = "git4zotero";
export const FTL_FILE = "git4zotero.ftl";
export const STYLE_ID = "git4zotero-style";
export const SECTION_ID = "git4zotero-paper-versions";
export const ICON_16 = "chrome/content/icons/paper-version-16.png";
export const ICON_20 = "chrome/content/icons/paper-version-20.png";
export const PREFERENCES_XHTML = "chrome/content/preferences.xhtml";
export const PREFERENCES_SCRIPT = "chrome/content/preferences.mjs";
export const PREFERENCES_STYLE = "chrome/content/preferences.css";
export const SUPPORTED_EXTENSIONS = [".docx", ".doc"];

export const PREFS = Object.freeze({
  gitPath: "extensions.git4zotero.gitPath",
  defaultVersionNote: "extensions.git4zotero.defaultVersionNote",
  autoSafetyVersion: "extensions.git4zotero.autoSafetyVersion"
});

export const UI_TEXT = Object.freeze({
  menuRoot: "论文版本",
  preferencePaneLabel: "Git",
  loading: "正在读取论文版本信息…",
  noItem: "请选择一个 Zotero 条目。",
  gitUnavailable: "Git 不可用",
  gitUnavailableDetail: "未检测到可用的 Git。请安装 Git，或配置 Git 可执行文件路径。",
  gitPathNotFound: "未找到 Git 可执行文件。请在“论文版本管理”设置中填写完整 git.exe 路径，例如 C:\\Program Files\\Git\\cmd\\git.exe。",
  gitPathActionRequired: "未找到 Git 可执行文件，请填写完整 git.exe 路径",
  gitConfigured: "Git 路径已配置",
  configureGit: "配置 Git 路径",
  noDocument: "未找到可管理的论文文件",
  noDocumentDetail: "请为当前条目添加 .docx 或 .doc 附件。",
  rightClickHint: "请在条目列表中右键条目或论文附件进行版本操作。",
  notEnabled: "尚未启用版本管理",
  notEnabledDetail: "只有通过右键菜单启用的条目才会被 git4zotero 跟踪。未启用条目不会创建 Git 仓库，也不会保存或恢复版本。",
  enableManagement: "启用版本管理",
  enablingManagement: "正在启用版本管理…",
  enableSuccess: "已为当前条目启用论文版本管理。",
  disableManagement: "停用版本管理",
  disablingManagement: "正在停用版本管理…",
  disableConfirmTitle: "停用版本管理",
  disableConfirmMessage: "停用后不会删除已有版本历史，但当前条目将不再允许检查、创建或恢复版本。确定继续吗？",
  disableSuccess: "已停用当前条目的论文版本管理。",
  itemNotEnabledError: "当前条目尚未启用论文版本管理。",
  currentFile: "当前论文文件",
  createVersion: "创建版本",
  creatingVersion: "正在创建版本…",
  checkChanges: "检查修改",
  checkingChanges: "正在检查修改…",
  lastCheck: "最近检查",
  neverChecked: "尚未检查修改。",
  workingTree: "Git 工作树",
  workingTreeClean: "工作树无未提交修改。",
  workingTreeUninitialized: "尚未创建 Git 仓库。",
  versionHistory: "版本历史",
  restoreVersion: "恢复此版本",
  restoringVersion: "正在恢复版本…",
  emptyHistory: "尚未创建版本。",
  notePlaceholder: "输入本次版本说明，例如：完成引言修改",
  defaultNote: "论文版本",
  safetyNotePrefix: "恢复前自动备份",
  restoreConfirmTitle: "恢复论文版本",
  restoreConfirmMessage: "恢复会先自动备份当前文件，然后用所选版本覆盖当前论文附件。确定继续吗？",
  createSuccess: "版本已创建。",
  noChangesToSave: "未检测到修改，无需创建新版本。",
  restoreSuccess: "版本已恢复。",
  operationFailed: "操作失败",
  actionCompleted: "操作完成。",
  menuUnavailable: "论文版本操作不可用",
  menuMultiSelectUnsupported: "请只选择一个 Zotero 条目或论文附件。",
  menuCreatePromptTitle: "创建论文版本",
  menuCreatePromptMessage: "请输入本次版本说明。",
  menuRestorePromptTitle: "恢复论文版本",
  menuRestorePromptMessage: "请选择要恢复的版本。",
  menuNoVersions: "当前条目尚未创建版本。",
  menuStatusLoading: "正在读取论文版本状态...",
  menuStatusNoSelection: "请选择一个条目或论文附件。",
  menuStatusReady: "论文版本可用。",
  menuStatusNoHistory: "尚未创建版本。",
  menuDisabledReasonPrefix: "不可用",
  menuConfigureGit: "配置 Git 路径...",
  invalidCommit: "版本标识无效，已取消恢复。",
  promptGitTitle: "配置 Git 路径",
  promptGitMessage: "请输入 Git 可执行文件路径。留空表示使用系统 PATH 中的 git。",
  contentModeDocx: ".docx 正文级识别",
  contentModeFileOnly: "文件级识别",
  savedBeforeCheck: "请先在 Word/WPS/LibreOffice 中保存论文文件，再回到 Zotero 检查修改或创建版本。"
});
