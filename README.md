# Audit GitHub Actions used in workflow runs for an organization, Enterprise or repository

Discover which exact versions (down to the commit) of GitHub Actions were used in workflow runs.

Check the audit log for a GitHub Enterprise/organization (or just list the runs, for a repository) for workflow runs created between the start date and end date.

Lists the Actions and specific versions and commits used in them.

Optionally, filter by particular Actions, possibly including one or more commit SHAs of interest.

> [!NOTE]
> This is unofficial software, not supported by GitHub

## Usage

For all scripts, you must set a `GITHUB_TOKEN` in the environment with appropriate access to the audit log on your org or Enterprise, or the repository you are interested in.

For Enterprise Server or Data Residency users, please set `GITHUB_BASE_URL` in your environment, e.g. `https://github.acme-inc.com/api/v3`.

### audit_workflow_runs.js

```text
node audit_workflow_runs.js <org or enterprise name> <ent|org|repo> <start date> <end date> [<output-file>] [<input-filters-file>]
```

Results are printed to the console in CSV, and also appended to a file in the current directory, named `workflow_audit_results.sljson` by default. This can be set with the optional `output-file` parameter.

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

## License

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](LICENSE) for the full terms.

## Maintainers

See [CODEOWNERS](CODEOWNERS) for the list of maintainers.

## Support

> [!NOTE]
> This is an _unofficial_ tool created by Field Security Specialists, and is not officially supported by GitHub.

See the [SUPPORT](SUPPORT.md) file.

## Background and acknowledgements

The `changes` Action relies on the [`dorny/paths-filter`](https://github.com/dorny/paths-filter/) Action.

See the [CHANGELOG](CHANGELOG.md), [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md), [SUPPORT](SUPPORT.md), [CODE OF CONDUCT](CODE_OF_CONDUCT.md) and [PRIVACY](PRIVACY.md) files for more information.
