# Audit GitHub Actions used in workflow runs for an organization, Enterprise or repository

Discover which exact versions (down to the commit) of GitHub Actions were used in workflow runs.

Check the audit log for a GitHub Enterprise/organization (or just list the runs, for a repository) for workflow runs created between the start date and end date.

Lists the Actions and specific versions and commits used in them.

Optionally, filter by a particular action, possibly including a commit SHA of interest.

> [!NOTE]
> This is unofficial software, not supported by GitHub

## Usage

For all scripts, you must set a `GITHUB_TOKEN` in the environment with appropriate access to the audit log on your org or Enterprise, or the repository you are interested in.

For Enterprise Server or Data Residency users, please set `GITHUB_BASE_URL` in your environment, e.g. `https://github.acme-inc.com/api/v3`

### audit_workflow_runs.js

```text
node audit_workflow_runs.js <org or enterprise name> <ent|org|repo> <start date> <end date> [<output-file>] [<input-file>]
```

Results are printed to the console in CSV, and also appended to a file in the current directory, named `workflow_audit_results.sljson` by default.

By default all Actions are listed, but you can filter by particular Actions using a JSON formatted input file.

For example:

```bash
node audit_workflow_runs.js github org 2025-03-13 2025-03-15 github_actions_audit.json
```

#### JSON input file format

The JSON input file should an object with the keys being the name of the Action, and the value being an array of the commits you are interested in.

Use the Action name in the format `owner/repo` or `owner/repo/path`, where `path` can contain any number of slashes.

You can express some wildcards - use `*` after the first `/` in the Action to include all repositories under the owner, and use `*` in the commit array (or leave it empty) to include all commits.

An Action name given without a path will match any Action in that repository, whether or not it has a path. You can also explictly use `*` in the path to match any path.

### find_compromised_secrets.js

> [!NOTE]
> This is relevant only to secrets leaked because of the `tj-actions/changed-files` and `reviewdog` compromises in March 2025.

This script takes the structured single-line JSON output of `audit_workflow_runs.js` (not the convenience CSV output) and searches for secrets that were leaked in those workflow runs.

```text
node find_compromised_secrets.js < <path sljson file>
```

Results are printed to the console, and written to a file in the current directory, named `compromised_secrets.sljson`.

For example:

```bash
node find_compromised_secrets.js < workflow_audit_results.sljson
```

## Changelog

### 2025-05-28 15:30Z

Updated audit script to take JSON input to filter by Actions and commits.

### 2025-05-20 18:15Z

Added script to allow decoding secrets from workflows affected by a particular set of compromises in March 2025.

### 2025-05-20 15:10Z

Made searching for Actions downloads more efficient. The search now stops after any consecutive lines seen that show an Action was downloaded, and avoids searching the rest of the log file.

### 2025-05-18 18:30Z

Added searching for logs in the top level `0_` file, if the `1_Set up job.txt` is no longer available in the logs zip file
