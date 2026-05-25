import { UI_TEXT } from "./constants.mjs";
import { formatText } from "./localization.mjs";

const COMMIT_RE = /^[0-9a-f]{7,40}$/i;
const RECORD_SEPARATOR = "\x1e";
const BODY_SEPARATOR = "\x1f";

export function assertSafeCommitHash(commitHash) {
  if (!COMMIT_RE.test(String(commitHash ?? ""))) {
    throw new Error(UI_TEXT.invalidCommit);
  }
}

export class GitBackend {
  constructor(platform) {
    this.platform = platform;
  }

  async checkAvailability() {
    if (typeof this.platform.checkGitAvailability === "function") {
      return this.platform.checkGitAvailability();
    }
    try {
      const result = await this.runGit(["--version"]);
      if (result.exitCode !== 0) {
        return { available: false, detail: result.stderr || result.stdout };
      }
      const detail = result.stdout.trim();
      return { available: true, detail, version: detail, command: this.platform.getGitExecutable() };
    }
    catch (error) {
      return { available: false, detail: error.message, error: error.message };
    }
  }

  async ensureRepo(repoPath) {
    await this.platform.makeDirectory(repoPath);
    const gitDir = this.platform.join(repoPath, ".git");
    if (!(await this.platform.exists(gitDir))) {
      await this.mustRun(["init"], { cwd: repoPath });
    }

    await this.platform.writeText(
      this.platform.join(repoPath, ".gitignore"),
      ".git4zotero/\n"
    );
    await this.platform.makeDirectory(this.platform.join(repoPath, "tracked"));
    await this.mustRun(["config", "user.name", "git4zotero"], { cwd: repoPath });
    await this.mustRun(["config", "user.email", "git4zotero@local"], { cwd: repoPath });
    await this.mustRun(["config", "core.quotePath", "false"], { cwd: repoPath });
  }

  async commitSnapshot(repoPath, snapshot) {
    await this.mustRun(["add", "--", "tracked", ".gitignore"], { cwd: repoPath });

    const subject = `git4zotero: ${snapshot.note}`;
    const body = JSON.stringify({
      sourceFileName: snapshot.sourceFileName,
      trackedRelativePath: snapshot.trackedRelativePath,
      kind: snapshot.kind,
      createdAt: snapshot.createdAt,
      changeSummary: snapshot.changeSummary?.summary ?? null
    }, null, 2);

    await this.mustRun(["commit", "--allow-empty", "-m", subject, "-m", body], {
      cwd: repoPath
    });

    const head = await this.mustRun(["rev-parse", "HEAD"], { cwd: repoPath });
    return { hash: head.stdout.trim() };
  }

  async checkoutTrackedFile(repoPath, commitHash, trackedRelativePath) {
    assertSafeCommitHash(commitHash);
    const normalizedPath = String(trackedRelativePath ?? "").replace(/\\/g, "/");
    if (!normalizedPath
      || normalizedPath.startsWith("/")
      || normalizedPath.split("/").includes("..")) {
      throw new Error(UI_TEXT.invalidTrackedPath);
    }
    await this.mustRun(["checkout", commitHash, "--", normalizedPath], {
      cwd: repoPath
    });
  }

  async listHistory(repoPath) {
    const gitDir = this.platform.join(repoPath, ".git");
    if (!(await this.platform.exists(gitDir))) {
      return [];
    }

    const result = await this.runGit([
      "log",
      "--date=iso-strict",
      "--pretty=format:%H%x09%aI%x09%an%x09%s%x1f%b%x1e"
    ], { cwd: repoPath });

    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return [];
    }

    return result.stdout
      .split(RECORD_SEPARATOR)
      .map((record) => record.replace(/^\r?\n|\r?\n$/g, ""))
      .filter(Boolean)
      .map((record) => {
        const [header, ...bodyParts] = record.split(BODY_SEPARATOR);
        const body = bodyParts.join(BODY_SEPARATOR).trim();
        const headerParts = header.split("\t");
        const [hash, loggedAt] = headerParts;
        const hasAuthor = headerParts.length >= 4;
        const author = hasAuthor ? headerParts[2] : "";
        const subject = (hasAuthor ? headerParts.slice(3) : headerParts.slice(2)).join("\t");
        const bodyMetadata = parseCommitBody(body);
        const createdAt = bodyMetadata.createdAt || loggedAt;
        return {
          hash,
          shortHash: hash.slice(0, 8),
          createdAt,
          author,
          subject,
          body,
          sourceFileName: bodyMetadata.sourceFileName ?? null,
          trackedRelativePath: bodyMetadata.trackedRelativePath ?? null,
          kind: bodyMetadata.kind ?? null,
          changeSummary: bodyMetadata.changeSummary ?? null
        };
      });
  }

  async getWorkingTreeStatus(repoPath) {
    const gitDir = this.platform.join(repoPath, ".git");
    if (!(await this.platform.exists(gitDir))) {
      return {
        clean: true,
        entries: [],
        summary: UI_TEXT.workingTreeUninitialized
      };
    }

    const result = await this.runGit([
      "status",
      "--short",
      "--",
      "tracked",
      ".gitignore"
    ], { cwd: repoPath });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || UI_TEXT.gitStatusFailed);
    }

    const entries = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);

    return {
      clean: entries.length === 0,
      entries,
      summary: entries.length === 0 ? UI_TEXT.workingTreeClean : entries.join("\n")
    };
  }

  async runGit(args, options = {}) {
    const resolution = typeof this.platform.resolveGitExecutable === "function"
      ? await this.platform.resolveGitExecutable()
      : { command: this.platform.getGitExecutable() };
    return this.platform.runProcess(resolution.command, args, options);
  }

  async mustRun(args, options = {}) {
    const result = await this.runGit(args, options);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || formatText("gitCommandFailed", { args: args.join(" ") }));
    }
    return result;
  }
}

function parseCommitBody(body) {
  const text = String(body ?? "").trim();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  }
  catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return {};
    }
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
      return {};
    }
  }
}
