# Audit GitHub workflow runs for an org or Enterprise, using the audit log

Check the audit log for a GitHub Enterprise or organization for workflow runs, listing the Actions and specific versions and commits used in them.

Optionally, filter by a particular action, possibly including a commit SHA of interest.

> [!NOTE]
> Not supported by GitHub

(C) Copyright GitHub, Inc.

## Usage

Set a `GITHUB_TOKEN` in the environment with appropriate access to the audit log on your org or Enterprise.

For Enterprise Server or Data Residency users, please set `GITHUB_BASE_URL` in your environment, e.g. `https://github.acme-inc.com/api/v3`

```bash
node audit_workflow_runs.js <org or enterprise name> <"ent" or "org"> <start date> <end date> [<action>] [<commit SHA>]
```

For example:

```bash
node audit_workflow_runs.js github org 2025-03-13 2025-03-15 tj-actions/changed-files 0e58ed8671d6b60d0890c21b07f8835ace038e67
```
