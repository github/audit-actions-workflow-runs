import { Octokit } from "@octokit/rest";
import fs from "fs";
import AdmZip from "adm-zip";
import { log } from "console";

// Initialize Octokit with a personal access token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Set your GitHub token in an environment variable
  baseUrl: process.env.GITHUB_BASE_URL  // Set the GitHub base URL, e.g. for Enterprise Server, in an env var
});

function searchForActionsLines(entry, actionRegex) {
    const logContent = entry.getData().toString("utf8"); // Extract file content as a string
    const logLines = logContent.split("\n");
    const actions = [];
    let foundActions = false;

    for (const line of logLines) {
        const data = line.split(" ").slice(1).join(" ");
        if (data == undefined) {
            continue;
        }
        if (data.startsWith("Download action repository '")) {
            foundActions = true;
            const match = actionRegex.exec(data);
            if (match) {
                const action = match[1];
                const sha = match[2];

                const [repo, version] = action.split("@");
                actions.push([repo, version, sha]);
            }
        // quit processing the log after the first line that is not an action, if we already found actions
        } else if (foundActions) {
            break;
        }
    }

    return actions;
}

function searchForSetUpJob(logEntries, actionRegex) {
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
                actions.push(...searchForActionsLines(entry, actionRegex));
            }
        }
    }

    return [foundSetUpJob, actions];
}

function searchForTopLevelLog(logEntries, actionRegex) {
    const actions = [];

    // Iterate through each file in the zip
    for (const entry of logEntries) {
        if (!entry.isDirectory) {
            const fileName = entry.entryName; // Get the file name
            console.log(fileName);
            if (fileName !== undefined && fileName.startsWith("0_")) {
                actions.push(...searchForActionsLines(entry, actionRegex));
            }
        }
    }

    return actions;
}

// Helper function to extract Actions used from workflow logs
async function extractActionsFromLogs(logUrl) {
  try {
    const response = await octokit.request(`GET ${logUrl}`, {
      headers: { Accept: "application/vnd.github+json" },
    });

    // get the zip file content
    const zipBuffer = Buffer.from(response.data);

    // Unzip the file
    const zip = new AdmZip(zipBuffer);
    const logEntries = zip.getEntries(); // Get all entries in the zip file

    // Download action repository 'actions/checkout@v4' (SHA:11bd71901bbe5b1630ceea73d27597364c9af683)
    const actionRegex = /Download action repository '(.+?)' \(SHA:(.+?)\)/;

    const [success, actions] = searchForSetUpJob(logEntries, actionRegex);
    
    if (!success) {
        actions.push(...searchForTopLevelLog(logEntries, actionRegex));
    }

    return actions;

  } catch (error) {
    console.error(`Failed to fetch logs from ${logUrl}:`, error.message);
    return [];
  }
}

async function createActionsRunResults(owner, repo, run, actions) {
    const action_run_results = [];

    for (const action of actions) {
        const workflow = await octokit.request(`GET ${run.workflow_url}`)

        if (workflow.status != 200) {
            console.error("Error fetching workflow:", workflow.status);
            continue;
        }

        const workflow_path = workflow.data.path;

        action_run_results.push({
            org: owner,
            repo: repo,
            workflow: workflow_path,
            run_id: run.id,
            created_at: run.created_at,
            name: action[0],
            version: action[1],
            sha: action[2],
        });
    }
    return action_run_results;
}

// Main function to query an organization and its repositories without using the audit log
async function* auditOrganizationWithoutAuditLog(orgName, startDate, endDate) {
  try {
    // Step 1: Get all repositories in the organization
    const repos = await octokit.repos.listForOrg({
      org: orgName,
      per_page: 100
    });

    if (repos.status != 200) {
        console.error("Error listing repos:", repos.status);
        return;
    }

    for (const repo of repos.data) {
      // Step 2: Get all workflow runs in the repository within the date range
      for await (const result of _auditRepo(orgName, repo.name, startDate, endDate)) {
        yield result;
      }
    }
  } catch (error) {
    console.error("Error auditing organization:", error.message);
  }
}

// audit a single repository
async function* auditRepo(repoName, startDate, endDate) {
    const [org, repo] = repoName.split("/");

    for await (const result of _auditRepo(org, repo, startDate, endDate)) {
        yield result;
    }
}

// audit a single repository, using the orgname and repo name
async function* _auditRepo(org, repo, startDate, endDate) {
    try {
        const workflowRuns = await octokit.actions.listWorkflowRunsForRepo({
            owner: org,
            repo: repo,
            per_page: 100,
            created: `${startDate}..${endDate}`,
        });

        for (const run of workflowRuns.data.workflow_runs) {
            const actions = await extractActionsFromLogs(run.logs_url);

            const action_run_results = await createActionsRunResults(
                org,
                repo,
                run,
                actions
            );
            
            for (const result of action_run_results) {
                yield result;
            }
        }
    } catch (error) {
    console.error("Error auditing repo:", error.message);
    }
}

// use the Enterprise/Organization audit log to list all workflow runs in that period
// for each workflow run, extract the actions used
// 1. get the audit log, searching for `worklows` category, workflows.prepared_workflow_job
async function* auditEnterpriseOrOrg(entOrOrgName, entOrOrg, startDate, endDate) {
    try {
        const phrase = `actions:workflows.prepared_workflow_job+created:${startDate}..${endDate}`;
        const workflow_jobs = await octokit.paginate(`GET /${entOrOrg.startsWith('ent') ? 'enterprises' : 'orgs'}/${entOrOrgName}/audit-log`, {
            phrase,
            per_page: 100
        });

        for (const job of workflow_jobs) {
            if (job.action == "workflows.created_workflow_run") {
                const run_id = job.workflow_run_id;
                const [owner, repo] = job.repo.split("/");

                try {
                    // get the workflow run log with the REST API
                    const run = await octokit.actions.getWorkflowRun({
                        owner: owner,
                        repo: repo,
                        run_id,
                    });

                    const actions = await extractActionsFromLogs(run.data.logs_url);

                    const action_run_results = await createActionsRunResults(
                        owner,
                        repo,
                        run.data,
                        actions
                    );
                    
                    for (const result of action_run_results) {
                        yield result;
                    }
                } catch (error) {
                    console.error("Error fetching workflow run:", error.message);
                    continue;
                }
            }
        }
    } catch (error) {
        console.error(`Error auditing ${entOrOrg.startsWith('ent') ? 'enterprise' : 'org'}:`, error.message);
    }
}

async function main() {
    // Parse CLI arguments
    const args = process.argv.slice(2);

    if (args.length < 4) {
        console.error("Usage: node main.js <org-or-ent-name> <org|ent|repo> <start-date> <end-date> [<action-name>] [<action-commit-sha>]");
        return;
    }

    const [orgOrEntName, orgOrEnt, startDate, endDate] = args;

    if (!['ent', 'org', 'repo'].includes(orgOrEnt)) {
        console.error("<org|ent|repo> must be 'ent', 'org', 'repo'");
        return;
    }

    const action_run_results = orgOrEnt != 'repo' ? auditEnterpriseOrOrg(orgOrEntName, orgOrEnt, startDate, endDate) : auditRepo(orgOrEntName, startDate, endDate);

    console.log("org,repo,workflow,run_id,created_at,name,version,sha");

    for await (const result of action_run_results) {
        if (args.length >= 5) {
            const [actionName, actionSha] = args.slice(4);
            if (result.name != actionName) {
                continue;
            }
            if (actionSha && result.sha != actionSha) {
                continue;
            }
        }

        console.log(Object.values(result).join(","));
        fs.appendFileSync(
            "workflow_audit_results.sljson",
            JSON.stringify(result) + "\n"
        );
    }
}

await main();
