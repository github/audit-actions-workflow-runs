/* Script to find compromised secrets in an Actions workflow run.

Only relevant to a particular series of incidents, where a malicious actor
pushed a commit to a repository that contained a workflow that leaked secrets
into the logs.

They were doubly-Base64 encoded, so we need to spot Base64 strings and decode them.
*/

import { Octokit } from "@octokit/rest";
import fs from "fs";
import AdmZip from "adm-zip";
import { findSecretsInLines, base64Regex } from "./find_compromised_secrets_helper.js";

// Initialize Octokit with a personal access token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Set your GitHub token in an environment variable
  baseUrl: process.env.GITHUB_BASE_URL, // Set the GitHub base URL, e.g. for Enterprise Server, in an env var
});

// Helper function to extract secrets leaked into workflow logs
async function extractSecretsFromLogs(logUrl) {
  try {
    const response = await octokit.request(`GET ${logUrl}`, {
      headers: { Accept: "application/vnd.github+json" },
    });

    // get the zip file content
    const zipBuffer = Buffer.from(response.data);

    // Unzip the file
    const zip = new AdmZip(zipBuffer);
    const logEntries = zip.getEntries();

    const secrets = [];

    // Iterate through each file in the zip
    for (const entry of logEntries) {
      if (!entry.isDirectory) {
        const fileName = entry.entryName;
        if (fileName.startsWith("0_")) {
          const logContent = entry.getData().toString("utf8");

          let lines = logContent.split("\n");

          secrets.push(...findSecretsInLines(lines));
        }
      }
    }
    return secrets;
  } catch (error) {
    console.error(`Failed to fetch logs from ${logUrl}:`, error.message);
    return [];
  }
}

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);

  if (args.length > 0) {
    console.error(
      "Usage: node find_compromised_secrets.js < <input file>"
    );
    return;
  }

  // read the actions runs from STDIN, in single-line JSON format
  const actions_run_lines = fs.readFileSync(0).toString().split("\n");
  
  const all_secrets = [];

  for (const line of actions_run_lines) {
    if (line == "" || !line.startsWith("{")) {
      continue;
    }

    try {
      const actions_run = JSON.parse(line);

      const owner = actions_run.org;
      const repo = actions_run.repo;
      const run_id = actions_run.run_id;
  
      console.log(`Processing actions run ${owner}/${repo}#${run_id}...`);

      // get the logs for the run
      const logUrl = `/repos/${owner}/${repo}/actions/runs/${run_id}/logs`;
      const secrets = await extractSecretsFromLogs(logUrl);

      console.log(`Found ${secrets.length} secrets in log for ${owner}/${repo}#${run_id}`);

      for (const secret of secrets) {
        console.log(secret);
      }

      all_secrets.push(...secrets);
    }
    catch (error) {
      console.error(`Failed to parse line: ${line}`);
      continue;
    }
  }

  for (const secret of all_secrets) {
    // write to a file
    fs.appendFileSync("compromised_secrets.sljson", JSON.stringify(secret) + "\n");
  }
}

await main();
