/**
 * RAIV Wire — save project library + device catalog to a GitHub repo
 * via the Contents API (browser). Requires a personal access token with
 * "Contents: Read and write" on the target repository.
 */

const SETTINGS_KEY = "raiv-wire-github-settings-v1";

const DEFAULT_SETTINGS = {
  token: "",
  owner: "cotycoots-tech",
  repo: "raiv-wire",
  branch: "main",
  autoSync: true,
  /** Pull projects/catalog from GitHub when the app loads */
  autoPull: true,
  pathProjects: "data/projects-library.json",
  pathCatalog: "data/device-catalog.json",
  pathActive: "data/active-project.json",
};

export function loadGitHubSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGitHubSettings(settings) {
  const next = { ...DEFAULT_SETTINGS, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function isGitHubConfigured(settings = loadGitHubSettings()) {
  return Boolean(
    settings.token &&
      settings.owner &&
      settings.repo &&
      settings.branch
  );
}

/** Owner/repo/branch set — enough to pull public data (or with token for private). */
export function canPullFromGitHub(settings = loadGitHubSettings()) {
  return Boolean(settings.owner && settings.repo && settings.branch);
}

function apiBase(owner, repo) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

async function ghFetch(path, { token, method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg = data?.message || res.statusText || "GitHub API error";
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function contentsUrl(settings, path) {
  return `${apiBase(settings.owner, settings.repo)}/contents/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?ref=${encodeURIComponent(settings.branch)}`;
}

/** Get file SHA if it exists (needed to update). */
export async function getFileMeta(settings, path) {
  const url = contentsUrl(settings, path);
  try {
    const data = await ghFetch(url, { token: settings.token });
    return { sha: data.sha, path: data.path };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function toBase64(str) {
  // UTF-8 safe base64
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/**
 * Download a text file from the repo (authenticated API).
 * Falls back to public raw.githubusercontent.com if no token and file is public.
 * @returns {{ path, sha, content, json? } | null} null if 404
 */
export async function getRepoFileContent(settings, path) {
  const hasToken = Boolean(settings.token);

  if (hasToken) {
    try {
      const data = await ghFetch(contentsUrl(settings, path), {
        token: settings.token,
      });
      if (data.encoding === "base64" && data.content) {
        const text = fromBase64(data.content);
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* not json */
        }
        return { path: data.path || path, sha: data.sha, content: text, json };
      }
      return null;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  // Public raw fallback (no token)
  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(
    settings.owner
  )}/${encodeURIComponent(settings.repo)}/${encodeURIComponent(
    settings.branch
  )}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?t=${Date.now()}`;
  const res = await fetch(rawUrl, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { path, sha: null, content: text, json };
}

/**
 * Pull projects library + catalog (+ optional active) from GitHub.
 */
export async function pullFromGitHub(settings = loadGitHubSettings()) {
  if (!settings.owner || !settings.repo || !settings.branch) {
    throw new Error("Set owner, repo, and branch in GitHub settings.");
  }
  // Pull can work with public raw URLs without a token
  const projectsPath = settings.pathProjects || DEFAULT_SETTINGS.pathProjects;
  const catalogPath = settings.pathCatalog || DEFAULT_SETTINGS.pathCatalog;
  const activePath = settings.pathActive || DEFAULT_SETTINGS.pathActive;

  const [projectsFile, catalogFile, activeFile] = await Promise.all([
    getRepoFileContent(settings, projectsPath),
    getRepoFileContent(settings, catalogPath),
    getRepoFileContent(settings, activePath),
  ]);

  if (!projectsFile && !catalogFile && !activeFile) {
    throw new Error(
      "No data files found on GitHub yet. Click Save once to create data/projects-library.json."
    );
  }

  return {
    pulledAt: new Date().toISOString(),
    projects: projectsFile?.json || null,
    catalog: catalogFile?.json || null,
    active: activeFile?.json || null,
    files: {
      projects: projectsFile?.path || null,
      catalog: catalogFile?.path || null,
      active: activeFile?.path || null,
    },
  };
}

/**
 * Merge remote project library into local.
 * Newer project.updatedAt wins per id; keeps local-only projects.
 */
export function mergeProjectLibraries(localLib, remoteLib) {
  const localProjects = localLib?.projects || {};
  const remoteProjects = remoteLib?.projects || {};
  const merged = { ...localProjects };

  for (const [id, rp] of Object.entries(remoteProjects)) {
    if (!rp || typeof rp !== "object") continue;
    const pid = rp.id || id;
    const lp = merged[pid];
    if (!lp) {
      merged[pid] = { ...rp, id: pid };
      continue;
    }
    const lt = lp.updatedAt || lp.createdAt || "";
    const rt = rp.updatedAt || rp.createdAt || "";
    if (rt >= lt) {
      merged[pid] = { ...rp, id: pid };
    }
  }

  const remoteSaved = remoteLib?.savedAt || "";
  const localSaved = localLib?.savedAt || "";
  let activeId = localLib?.activeId || "";
  if (remoteLib?.activeId && remoteProjects[remoteLib.activeId]) {
    if (!activeId || !merged[activeId] || remoteSaved >= localSaved) {
      activeId = remoteLib.activeId;
    }
  }
  if (!activeId || !merged[activeId]) {
    activeId = Object.keys(merged)[0] || "";
  }

  return {
    version: 1,
    activeId,
    projects: merged,
    savedAt: remoteSaved > localSaved ? remoteSaved : localSaved,
  };
}

/**
 * Create or update a single text file on the branch.
 * @returns {{ path, commitSha, htmlUrl }}
 */
export async function putRepoFile(settings, path, content, message) {
  const existing = await getFileMeta(settings, path);
  const url = `${apiBase(settings.owner, settings.repo)}/contents/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const body = {
    message,
    content: toBase64(content),
    branch: settings.branch,
  };
  if (existing?.sha) body.sha = existing.sha;

  const data = await ghFetch(url, {
    token: settings.token,
    method: "PUT",
    body,
  });

  return {
    path: data.content?.path || path,
    commitSha: data.commit?.sha || "",
    htmlUrl: data.content?.html_url || data.commit?.html_url || "",
    commitUrl: data.commit?.html_url || "",
  };
}

/**
 * Verify token can access the repo.
 */
export async function testGitHubConnection(settings = loadGitHubSettings()) {
  if (!isGitHubConfigured(settings)) {
    throw new Error("Enter owner, repo, branch, and a personal access token.");
  }
  const url = apiBase(settings.owner, settings.repo);
  const repo = await ghFetch(url, { token: settings.token });
  return {
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
  };
}

/**
 * Push project library + device catalog (+ active project snapshot) to GitHub.
 * @param {{ library: object, catalogJson: string, activeProject: object }} payload
 */
export async function syncToGitHub(settings, payload) {
  if (!isGitHubConfigured(settings)) {
    throw new Error(
      "GitHub is not connected. Open GitHub settings and add a personal access token."
    );
  }

  const stamp = new Date().toISOString();
  const results = [];

  const projectsBody = JSON.stringify(
    {
      type: "raiv-wire-projects-library",
      version: 1,
      savedAt: stamp,
      activeId: payload.library?.activeId || "",
      projects: payload.library?.projects || {},
    },
    null,
    2
  );

  results.push(
    await putRepoFile(
      settings,
      settings.pathProjects || DEFAULT_SETTINGS.pathProjects,
      projectsBody,
      `chore(data): save projects library (${stamp})`
    )
  );

  if (payload.catalogJson) {
    results.push(
      await putRepoFile(
        settings,
        settings.pathCatalog || DEFAULT_SETTINGS.pathCatalog,
        payload.catalogJson,
        `chore(data): save device catalog (${stamp})`
      )
    );
  }

  if (payload.activeProject) {
    results.push(
      await putRepoFile(
        settings,
        settings.pathActive || DEFAULT_SETTINGS.pathActive,
        JSON.stringify(
          {
            type: "raiv-wire-active-project",
            version: 1,
            savedAt: stamp,
            project: payload.activeProject,
          },
          null,
          2
        ),
        `chore(data): save active project ${payload.activeProject.name || ""} (${stamp})`
      )
    );
  }

  return {
    savedAt: stamp,
    files: results,
    repoUrl: `https://github.com/${settings.owner}/${settings.repo}`,
    branch: settings.branch,
  };
}
