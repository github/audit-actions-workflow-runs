# Audit GitHub Actions used in workflow runs for an organization, Enterprise or repository

Discover which versions of GitHub Actions were used in workflow runs, down to the exact commit.

Checks the audit log for a GitHub Enterprise/organization (or just lists the runs, for a repository) for workflow runs created between the start date and end date.

Lists the Actions and specific versions and commits used in them.

Optionally, filters by particular Actions, possibly including one or more commit SHAs of interest.

> [!NOTE]
> This is an _unofficial_ tool created by Field Security Specialists, and is not officially supported by GitHub.

## Usage

Clone this repository locally.

For all scripts, you must set a `GITHUB_TOKEN` in the environment with appropriate access to the audit log on your org or Enterprise, or the repository you are interested in. It can be convenient to use the [`gh` CLI](https://cli.github.com/) to get a token, with [`gh auth login`](https://cli.github.com/manual/gh_auth_login) and [`gh auth token`](https://cli.github.com/manual/gh_auth_token).

For Enterprise Server or Data Residency users, please set `GITHUB_BASE_URL` in your environment, e.g. `https://github.acme-inc.example/api/v3`.

### audit_workflow_runs.js

```text
node audit_workflow_runs.js <org or enterprise name> <ent|org|repo> <start date> <end date> [<output-file>] [<input-filters-file>]
```

Results are printed to the console in CSV, for convenience, and also appended to a single-line JSON file in the current directory. This is named `workflow_audit_results.sljson` by default, and can be set with the optional `output-file` parameter.

The CSV output has the headers:

```csv
org,repo,workflow,run_id,created_at,name,version,sha
```

By default all Actions are listed, but you can filter by particular Actions using a JSON formatted input file.

For example:

```bash
node audit_workflow_runs.js github org 2025-03-13 2025-03-15 github_actions_audit.sljson
```

```bash
node audit_workflow_runs.js github org 2025-03-13 2025-03-15 github_actions_audit.sljson actions_to_find.json
```

#### JSON input file format

The JSON input file should an object with the keys being the name of the Action, and the value being an array of the commits you are interested in.

Use the Action name in the format `owner/repo` or `owner/repo/path`, where `path` can contain any number of slashes.

You can express some wildcards - use `*` after the first `/` in the Action to include all repositories under the owner, and use `*` in the commit array (or leave it empty) to include all commits.

An Action name given without a path will match any Action in that repository, whether or not it has a path. You can also explictly use `*` in the path to match any path.

```json
{
    "actions/setup-node": ["*"],
    "actions/checkout": ["*"],
    "actions/setup-python": ["0000000000000000000000000000000000000000"],
} 
```

### find_compromised_secrets.js

> [!NOTE]
> This is relevant only to secrets leaked because of the `tj-actions/changed-files` and `reviewdog` compromises in March 2025.

This script takes the structured single-line JSON output of `audit_workflow_runs.js` (not the convenience CSV output) and searches for secrets in the format that was leaked in those workflow runs (doubly base64 encoded, with predictable content).

```text
node find_compromised_secrets.js < <path sljson file>
```

Results are printed to the console, and written to a file in the current directory, named `compromised_secrets.sljson`.

For example:

```bash
node find_compromised_secrets.js < workflow_audit_results.sljson
```

## License

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](LICENSE) for the full terms.

## Maintainers

See [CODEOWNERS](CODEOWNERS) for the list of maintainers.

## Support

> [!NOTE]
> This is an _unofficial_ tool created by Field Security Specialists, and is not officially supported by GitHub.

See the [SUPPORT](SUPPORT.md) file.

## Background

See the [CHANGELOG](CHANGELOG.md), [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md), [SUPPORT](SUPPORT.md), [CODE OF CONDUCT](CODE_OF_CONDUCT.md) and [PRIVACY](PRIVACY.md) files for more information.
