import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import fs from "fs";
import AdmZip from "adm-zip";
import {
  parseFromInputFile,
  matchActionsToAuditTargets,
  searchForSetUpJob,
  searchForTopLevelLog,
} from "./audit_workflow_runs_utils.js";

const OctokitWithThrottling = Octokit.plugin(throttling);

// Initialize Octokit with a personal access token
const octokit = new OctokitWithThrottling({
  auth: process.env.GITHUB_TOKEN,
  baseUrl: process.env.GITHUB_BASE_URL,
  throttle: {
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );

      if (retryCount < 1) {
        // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      // does not retry, only logs a warning
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`
      );
    },
  },
});

octokit.log.warn = () => {};
octokit.log.error = () => {};

// Helper function to extract Actions used from workflow logs
async function extractActionsFromLogs(logUrl) {
  let retries = 3;

  while (retries > 0) {
    try {
      const response = await octokit.request(`GET ${logUrl}`, {
        headers: { Accept: "application/vnd.github+json" },
      });

      // get the zip file content
      const zipBuffer = Buffer.from(response.data);

      // Unzip the file
      const zip = new AdmZip(zipBuffer);
      const logEntries = zip.getEntries(); // Get all entries in the zip file

      const [success, actions] = searchForSetUpJob(logEntries);

      if (!success) {
        actions.push(...searchForTopLevelLog(logEntries));
      }

      return actions;
    } catch (error) {
      if (error.status == 404) {
        console.error(
          `Failed to fetch logs from ${logUrl}: 404. This may be due to the logs being too old, or the workflow having not run due to an error.`
        );
        return [];
      } else if (error.message.startsWith("Connect Timeout Error ") || error.message === "read ECONNRESET" || error.message === "read ETIMEDOUT") {
        console.error(
          `Connection timeout/reset. Retrying, attempt ${4 - retries}/3. Waiting 30 seconds...`
        );
        retries--;
        // sleep 30 seconds
        await new Promise((resolve) => setTimeout(resolve, 30000));
        continue;
      }
      console.error(`Failed to fetch logs from ${logUrl}:`, error.message);
      return [];
    }
  }
}

async function createActionsRunResults(owner, repo, run, actions) {
  const action_run_results = [];

  for (const action of actions) {
    const workflow = await octokit.request(`GET ${run.workflow_url}`);

    if (workflow.status != 200) {
      console.error(
        `Error fetching workflow ${run.workflow_url}: `,
        workflow.status
      );
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
      per_page: 100,
    });

    if (repos.status != 200) {
      console.error(`Error listing repos for org ${orgName}: `, repos.status);
      return;
    }

    for (const repo of repos.data) {
      // Step 2: Get all workflow runs in the repository within the date range
      for await (const result of _auditRepo(
        orgName,
        repo.name,
        startDate,
        endDate
      )) {
        yield result;
      }
    }
  } catch (error) {
    console.error(`Error auditing organization ${orgName}: `, error.message);
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
    console.error(`Error auditing repo ${org}/${repo}: `, error.message);
  }
}

// use the Enterprise/Organization audit log to list all workflow runs in that period
// for each workflow run, extract the actions used
// get the audit log, searching for `worklows` category, workflows.prepared_workflow_job being created
async function* auditEnterpriseOrOrg(
  entOrOrgName,
  entOrOrg,
  startDate,
  endDate
) {
  try {
    const phrase = `actions:workflows.prepared_workflow_job+created:${startDate}..${endDate}`;
    const workflow_jobs = await octokit.paginate(
      `GET /${
        entOrOrg.startsWith("ent") ? "enterprises" : "orgs"
      }/${entOrOrgName}/audit-log`,
      {
        phrase,
        per_page: 100,
      }
    );

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
          console.error(
            `Error fetching workflow run ${owner}/${repo}#${run_id}:`,
            error.status
          );
          continue;
        }
      }
    }
  } catch (error) {
    console.error(
      `Error auditing ${entOrOrg.startsWith("ent") ? "enterprise" : "org"}:`,
      error.message
    );
  }
}

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);

  if (args.length < 4) {
    const script_name = process.argv[1].split("/").pop();
    console.error(
      `Usage: node ${script_name} <org-or-ent-name> <org|ent|repo> <start-date> <end-date> [<actions-to-audit-file>] [<output-filename>]`
    );
    return;
  }

  const [
    orgOrEntName,
    orgOrEnt,
    startDate,
    endDate,
    argsOutputFilename,
    actionsToAuditFilename,
  ] = args;

  if (!["ent", "org", "repo"].includes(orgOrEnt)) {
    console.error("<org|ent|repo> must be 'ent', 'org', 'repo'");
    return;
  }

  const actionsToAudit = parseFromInputFile(actionsToAuditFilename);

  const outputFilename = argsOutputFilename || "workflow_audit_results.sljson";

  const action_run_results =
    orgOrEnt != "repo"
      ? auditEnterpriseOrOrg(orgOrEntName, orgOrEnt, startDate, endDate)
      : auditRepo(orgOrEntName, startDate, endDate);

  console.log("org,repo,workflow,run_id,created_at,name,version,sha");

  const checkActions = Object.keys(actionsToAudit).length > 0;

  for await (const result of action_run_results) {
    if (checkActions) {
      if (!matchActionsToAuditTargets(result, actionsToAudit)) {
        continue;
      }
    }

    console.log(Object.values(result).join(","));
    fs.appendFileSync(outputFilename, JSON.stringify(result) + "\n");
  }
}

await main();
