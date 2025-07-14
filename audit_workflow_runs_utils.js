import fs from "fs";

export function matchActionsToAuditTargets(result, actionsToAudit) {
  const name = result.name;
  const sha = result.sha;

  const [owner, repo] = name.split("/");
  const path = name.split("/").slice(2).join("/");

  const owners = Object.keys(actionsToAudit);

  let matchedRepo = "";
  let matchedPath = "";

  if (owners.includes(owner)) {
    const repos = Object.keys(actionsToAudit[owner]);

    if (repos.includes(repo) || repos.includes("*")) {
      matchedRepo = repos.includes(repo) ? repo : "*";

      const paths = Object.keys(actionsToAudit[owner][matchedRepo]);

      if (paths.includes(path) || paths.includes("*") || paths.includes("")) {
        matchedPath = paths.includes(path)
          ? path
          : paths.includes("*")
          ? "*"
          : "";

        const hashes = actionsToAudit[owner][matchedRepo][matchedPath];

        if (
          hashes.includes(sha) ||
          hashes.includes("*") ||
          hashes.length == 0
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function parseFromInputFile(actionsToAuditFilename) {
  const actionsToAudit = {};
  if (actionsToAuditFilename) {
    const actionsToAuditFile = fs.readFileSync(actionsToAuditFilename, "utf-8");
    const actionsToAuditRaw = JSON.parse(actionsToAuditFile);
    for (const [action, hashes] of Object.entries(actionsToAuditRaw)) {
      const [org, repo] = action.split("/");
      const path = action.split("/").slice(2).join("/");
      actionsToAudit[org] ??= {};
      actionsToAudit[org][repo] ??= {};
      actionsToAudit[org][repo][path] = hashes;
    }
  }
  return actionsToAudit;
}

// Regex to spot, e.g. Download action repository 'actions/checkout@v4' (SHA:11bd71901bbe5b1630ceea73d27597364c9af683)
const mutableActionPrefix = "Download action repository '";
const mutableActionRegex = /^Download action repository '([^']+?)' \(SHA:([^)]+?)\)/;
const immutableActionPrefix = "##[group]Download immutable action package '";
const immutableActionRegex = /^##\[group\]Download immutable action package '([^'@]+?)@([^']*)'/;
const gettingDownloadInfoLine = "Getting action download info";

export function searchForActionsLines(logContent) {
  const logLines = logContent.split("\n");
  const actions = [];
  let foundActions = false;
  let inImmutableGroup = false;
  let immutableAction = {};

  for (const line of logLines) {
    // separate the timestamp from the data
    const data = line.split(" ").slice(1).join(" ");
    if (data == undefined) {
      continue;
    }
    if (data.startsWith(mutableActionPrefix)) {
      foundActions = true;
      const match = mutableActionRegex.exec(data);
      if (match) {
        const action = match[1];
        const sha = match[2];

        const [repo, version] = action.split("@");
        actions.push([repo, version, sha]);
      }
    } else if (data.startsWith(immutableActionPrefix)) {
      foundActions = true;
      inImmutableGroup = true;
      const match = immutableActionRegex.exec(data);
      if (match) {
        const action = match[1];
        const tag = match[2];

        immutableAction = {
          action: action,
          tag: tag,
          version: null,
          sha: null,
          digest: null,
        }
      }
    } else if (inImmutableGroup && data.startsWith("##[endgroup]")) {
      actions.push([immutableAction.action, immutableAction.tag, immutableAction.sha, immutableAction.version, immutableAction.digest]);
      inImmutableGroup = false;
    } else if (inImmutableGroup) {
      const versionMatch = data.match(/Version: ([a-zA-Z0-9._-]+)/);
      const shaMatch = data.match(/Source commit SHA: ([a-f0-9]{40,})/);
      const digestMatch = data.match(/Digest: sha256:([a-f0-9]{64})/);
      if (versionMatch) {
        immutableAction.version = versionMatch[1];
      }
      if (shaMatch) {
        immutableAction.sha = shaMatch[1];
      }
      if (digestMatch) {
        immutableAction.digest = digestMatch[1];
      }
    } else if (data == gettingDownloadInfoLine) {
      // continue processing the log until we find an action line
      continue;
    } else if (foundActions) {
      // quit processing the log after the first line that is not an action, if we already found actions
      break;
    }
  }

  return actions;
}

export function searchForSetUpJob(logEntries) {
  let foundSetUpJob = false;
  const actions = [];

  // Iterate through each file in the zip
  for (const entry of logEntries) {
    if (!entry.isDirectory) {
      const fileName = entry.entryName; // Get the file name
      if (fileName === undefined) {
        continue;
      }
      // get the base name of the file
      const baseName = fileName.split("/").pop();
      if (baseName == "1_Set up job.txt") {
        foundSetUpJob = true;
        const logContent = entry.getData().toString("utf8");
        actions.push(...searchForActionsLines(logContent));
      }
    }
  }

  return [foundSetUpJob, actions];
}

export function searchForTopLevelLog(logEntries) {
  const actions = [];

  // Iterate through each file in the zip
  for (const entry of logEntries) {
    if (!entry.isDirectory) {
      const fileName = entry.entryName; // Get the file name
      if (fileName !== undefined && fileName.startsWith("0_")) {
        const logContent = entry.getData().toString("utf8");
        actions.push(...searchForActionsLines(logContent));
      }
    }
  }

  return actions;
}
