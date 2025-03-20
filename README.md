# Audit GitHub workflow runs for an organization, Enterprise or repository

Check the audit log for a GitHub Enterprise/organization (or just list the runs, for a repository) for workflow runs created between the start date and end date.

Lists the Actions and specific versions and commits used in them.

Optionally, filter by a particular action, possibly including a commit SHA of interest.

> [!NOTE]
> Not supported by GitHub

(C) Copyright GitHub, Inc.

## Usage

Set a `GITHUB_TOKEN` in the environment with appropriate access to the audit log on your org or Enterprise.

For Enterprise Server or Data Residency users, please set `GITHUB_BASE_URL` in your environment, e.g. `https://github.acme-inc.com/api/v3`

```text
node audit_workflow_runs.js <org or enterprise name> <ent|org|repo> <start date> <end date> [<action>] [<commit SHA>]
```

Results are printed to the console in CSV, and also appended to a file in the current directory, named `workflow_audit_results.sljson`.

For example:

```bash
node audit_workflow_runs.js github org 2025-03-13 2025-03-15 tj-actions/changed-files 0e58ed8671d6b60d0890c21b07f8835ace038e67
```

## Changelog

### 2025-05-20 15:10Z

Made searching for Actions downloads more efficient. The search now stops after any consecutive lines seen that show an Action was downloaded, and avoids searching the rest of the log file.

### 2025-05-18 18:30Z

Added searching for logs in the top level `0_` file, if the `1_Set up job.txt` is no longer available in the logs zip file
