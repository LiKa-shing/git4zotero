// The main window uses a classic runtime while preferences load ES modules.
// Both receive the same host object; keep their queues on that shared object.
// A module-local fallback supports standalone services without a host.
const repositoryOperationTails = new Map();
const REPOSITORY_OPERATION_STATE_KEY = "__git4zoteroRepositoryOperationTails_v1";

// Non-reentrant: nested steps must use their caller's already-held lock.
export const withRepositoryLock = async (repoPath, operation, host = null) => {
  const key = repositoryOperationKey(repoPath);
  const tails = getRepositoryOperationTails(host);
  const previous = tails.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  tails.set(key, current);

  await previous;
  try {
    return await operation();
  }
  finally {
    // Queue tails only resolve, so a failed operation cannot poison its queue.
    release();
    if (tails.get(key) === current) {
      tails.delete(key);
    }
  }
};

function getRepositoryOperationTails(host) {
  if (!host) {
    return repositoryOperationTails;
  }
  if (!host[REPOSITORY_OPERATION_STATE_KEY]) {
    Object.defineProperty(host, REPOSITORY_OPERATION_STATE_KEY, { value: new Map() });
  }
  return host[REPOSITORY_OPERATION_STATE_KEY];
}

function repositoryOperationKey(repoPath) {
  const path = String(repoPath ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (!path) {
    throw new Error("A repository path is required for an operation lock.");
  }
  // Repository paths come from the platform's canonical data directory. Treat
  // Windows drive/UNC spelling aliases as the same key, preserving POSIX case.
  return /^[A-Za-z]:\//.test(path) || path.startsWith("//") ? path.toLowerCase() : path;
}
