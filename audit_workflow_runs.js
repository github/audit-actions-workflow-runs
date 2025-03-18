import { Octokit } from "@octokit/rest";
import fs from "fs";
import AdmZip from "adm-zip";

// Initialize Octokit with a personal access token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Set your GitHub token in an environment variable
  baseUrl: process.env.GITHUB_BASE_URL  // Set the GitHub base URL, e.g. for Enterprise Server, in an env var
});

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
    const actionRegex = /Download action repository '(.+?)' \(SHA:(.+?)\)/g;
    const actions = [];

    // Iterate through each file in the zip
    for (const entry of logEntries) {
        if (!entry.isDirectory) {
          const fileName = entry.entryName; // Get the file name
          // get the base name of the file
          const baseName = fileName.split("/").pop();
          if (baseName == "1_Set up job.txt") {
            const logContent = entry.getData().toString("utf8"); // Extract file content as a string
            let match;
            // Extract actions from the log content
            while (match = actionRegex.exec(logContent)) {
                const action = match[1];
                const sha = match[2];

                const [repo, version] = action.split("@");
                actions.push([repo, version, sha]);
            }
          }
        }
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
      try {
            const workflowRuns = await octokit.actions.listWorkflowRunsForRepo({
                owner: orgName,
                repo: repo.name,
                per_page: 100,
                created: `${startDate}..${endDate}`,
            });

            for (const run of workflowRuns.data.workflow_runs) {
                // Step 3: Get the logs for the workflow run
                const actions = await extractActionsFromLogs(run.logs_url);
        
                const action_run_results = await createActionsRunResults(
                    orgName,
                    repo.name,
                    run,
                    actions
                );
                
                for (const result of action_run_results) {
                    yield result;
                }
            }
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    console.error("Error auditing organization:", error.message);
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
        console.error("Usage: node main.js <org-or-ent-name> <org|ent> <start-date> <end-date> [<action-name>] [<action-commit-sha>]");
        return;
    }

    const [orgOrEntName, orgOrEnt, startDate, endDate] = args;

    if (!['ent', 'org'].includes(orgOrEnt)) {
        console.error("<org|ent|repo> must be 'ent', 'org'");
        return;
    }

    const action_run_results = auditEnterpriseOrOrg(orgOrEntName, orgOrEnt, startDate, endDate);

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
            "workflow_audit_results.json",
            JSON.stringify(result) + "\n"
        );
    }
}

await main();
