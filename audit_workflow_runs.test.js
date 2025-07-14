import {
  matchActionsToAuditTargets,
  parseFromInputFile,
  searchForActionsLines,
} from "./audit_workflow_runs_utils.js";
import assert from "assert";

function runTests() {
  console.log("Running tests for matchActionsToAuditTargets...");
  testMatchActionsToAuditTargets();
  console.log("Running tests for parseFromInputFile...");
  testParseFromInputFile();
  console.log("Running tests for searchForActionsLines...");
  testSearchForActionsLines();
  console.log("All tests passed!");
}

function testMatchActionsToAuditTargets() {
  const actionsToAudit = {
    owner1: {
      repo1: {
        "path/to/action": ["sha1", "sha2"],
        "*": ["*"],
      },
    },
  };

  // Test cases
  assert.strictEqual(
    matchActionsToAuditTargets(
      { name: "owner1/repo1/path/to/action", sha: "sha1" },
      actionsToAudit
    ),
    true,
    "Should return true for a matching owner, repo, path, and sha"
  );

  assert.strictEqual(
    matchActionsToAuditTargets(
      { name: "owner1/repo1/another/path", sha: "sha1" },
      actionsToAudit
    ),
    true,
    "Should return true for a matching owner, repo, wildcard path, and sha"
  );

  assert.strictEqual(
    matchActionsToAuditTargets(
      { name: "owner2/repo1/path/to/action", sha: "sha1" },
      actionsToAudit
    ),
    false,
    "Should return false for a non-matching owner"
  );

  assert.strictEqual(
    matchActionsToAuditTargets(
      { name: "owner1/repo1/path/to/action", sha: "sha3" },
      actionsToAudit
    ),
    false,
    "Should return false for a non-matching sha"
  );
}

function testParseFromInputFile() {
  const result1 = parseFromInputFile("testFile.json");

  assert.deepStrictEqual(
    result1,
    {
      owner1: {
        repo1: {
          "path/to/action": ["sha1", "sha2"],
        },
      },
    },
    "Should parse a valid JSON file into the expected structure"
  );
}

function testSearchForActionsLines() {
  // Test case: Extract actions and their details from log content
  const logContent1 = `2025-03-28T12:00:00Z Download action repository 'actions/checkout@v4' (SHA:11bd71901bbe5b1630ceea73d27597364c9af683)
2025-03-28T12:00:01Z Download action repository 'actions/setup-node@v3' (SHA:22cd71901bbe5b1630ceea73d27597364c9af684)
2025-03-28T12:00:02Z Some other log line
  `;
  const expected1 = [
    ["actions/checkout", "v4", "11bd71901bbe5b1630ceea73d27597364c9af683"],
    ["actions/setup-node", "v3", "22cd71901bbe5b1630ceea73d27597364c9af684"],
  ];
  assert.deepStrictEqual(
    searchForActionsLines(logContent1),
    expected1,
    "Should extract actions and their details from log content"
  );

  // Test case: No actions found
  const logContent2 = `2025-03-28T12:00:00Z Some random log line
2025-03-28T12:00:01Z Another random log line
  `;
  const expected2 = [];
  assert.deepStrictEqual(
    searchForActionsLines(logContent2),
    expected2,
    "Should return an empty array if no actions are found"
  );

  // Test case: Stop processing after the first non-action line if actions were found
  const logContent3 = `2025-03-28T12:00:00Z Download action repository 'actions/checkout@v4' (SHA:11bd71901bbe5b1630ceea73d27597364c9af683)
2025-03-28T12:00:01Z Some other log line
2025-03-28T12:00:02Z Download action repository 'actions/setup-node@v3' (SHA:22cd71901bbe5b1630ceea73d27597364c9af684)
  `;
  const expected3 = [
    ["actions/checkout", "v4", "11bd71901bbe5b1630ceea73d27597364c9af683"],
  ];
  assert.deepStrictEqual(
    searchForActionsLines(logContent3),
    expected3,
    "Should stop processing after the first non-action line if actions were found"
  );

  // Test case: Empty log content
  const logContent4 = "";
  const expected4 = [];
  assert.deepStrictEqual(
    searchForActionsLines(logContent4),
    expected4,
    "Should handle empty log content gracefully"
  );

  // Test case: Malformed log lines - we don't care that the SHA is invalid
  const logContent5 = `2025-03-28T12:00:00Z Download action repository 'actions/checkout@v4' (SHA:invalid_sha)
2025-03-28T12:00:01Z Malformed log line
  `;
  const expected5 = [["actions/checkout", "v4", "invalid_sha"]];
  assert.deepStrictEqual(
    searchForActionsLines(logContent5),
    expected5,
    "Should handle malformed log lines gracefully"
  );

  // Test case: Immutable action groups, plus mutable actions
  const logContent6 = `2025-07-14T13:16:54.1997507Z Current runner version: '2.326.0'
2025-07-14T13:16:54.2032898Z ##[group]Runner Image Provisioner
2025-07-14T13:16:54.2034192Z Hosted Compute Agent
2025-07-14T13:16:54.2035482Z Version: 20250711.363
2025-07-14T13:16:54.2036437Z Commit: 6785254374ce925a23743850c1cb91912ce5c14c
2025-07-14T13:16:54.2037793Z Build Date: 2025-07-11T20:04:25Z
2025-07-14T13:16:54.2038731Z ##[endgroup]
2025-07-14T13:16:54.2039633Z ##[group]Operating System
2025-07-14T13:16:54.2040684Z Ubuntu
2025-07-14T13:16:54.2041493Z 24.04.2
2025-07-14T13:16:54.2042229Z LTS
2025-07-14T13:16:54.2043203Z ##[endgroup]
2025-07-14T13:16:54.2044107Z ##[group]Runner Image
2025-07-14T13:16:54.2045360Z Image: ubuntu-24.04
2025-07-14T13:16:54.2046348Z Version: 20250710.1.0
2025-07-14T13:16:54.2048046Z Included Software: https://github.com/actions/runner-images/blob/ubuntu24/20250710.1/images/ubuntu/Ubuntu2404-Readme.md
2025-07-14T13:16:54.2050926Z Image Release: https://github.com/actions/runner-images/releases/tag/ubuntu24%2F20250710.1
2025-07-14T13:16:54.2052697Z ##[endgroup]
2025-07-14T13:16:54.2054600Z ##[group]GITHUB_TOKEN Permissions
2025-07-14T13:16:54.2057484Z Contents: read
2025-07-14T13:16:54.2058290Z Metadata: read
2025-07-14T13:16:54.2059196Z Packages: read
2025-07-14T13:16:54.2060021Z ##[endgroup]
2025-07-14T13:16:54.2062876Z Secret source: Actions
2025-07-14T13:16:54.2064129Z Prepare workflow directory
2025-07-14T13:16:54.2740053Z Prepare all required actions
2025-07-14T13:16:54.2798345Z Getting action download info
2025-07-14T13:16:54.8182595Z ##[group]Download immutable action package 'actions/checkout@v4'
2025-07-14T13:16:54.8183770Z Version: 4.2.2
2025-07-14T13:16:54.8185077Z Digest: sha256:ccb2698953eaebd21c7bf6268a94f9c26518a7e38e27e0b83c1fe1ad049819b1
2025-07-14T13:16:54.8186424Z Source commit SHA: 11bd71901bbe5b1630ceea73d27597364c9af683
2025-07-14T13:16:54.8187251Z ##[endgroup]
2025-07-14T13:16:54.9067829Z ##[group]Download immutable action package 'actions/setup-java@v4'
2025-07-14T13:16:54.9068748Z Version: 4.7.1
2025-07-14T13:16:54.9069568Z Digest: sha256:23223d64943473efb4336f60463c0429cd4f422cd5fc6c48a5cf0d5907c1aeac
2025-07-14T13:16:54.9070517Z Source commit SHA: c5195efecf7bdfc987ee8bae7a71cb8b11521c00
2025-07-14T13:16:54.9071298Z ##[endgroup]
2025-07-14T13:16:55.2797700Z Download action repository 'sbt/setup-sbt@v1' (SHA:234370af1319038bf8dc432f8a7e4b83078a1781)
2025-07-14T13:16:55.7318730Z Getting action download info
2025-07-14T13:16:56.0547136Z ##[group]Download immutable action package 'actions/cache@v4'
2025-07-14T13:16:56.0547618Z Version: 4.2.3
2025-07-14T13:16:56.0548031Z Digest: sha256:c8a3bb963e1f1826d8fcc8d1354f0dd29d8ac1db1d4f6f20247055ae11b81ed9
2025-07-14T13:16:56.0548578Z Source commit SHA: 5a3ec84eff668545956fd18022155c47e93e2684
2025-07-14T13:16:56.0548968Z ##[endgroup]
2025-07-14T13:16:56.1885796Z Complete job name: hello
2025-07-14T13:16:56.2569979Z ##[group]Run actions/checkout@v4
2025-07-14T13:16:56.2570683Z with:
2025-07-14T13:16:56.2571032Z   repository: github/invented-repo-for-test
2025-07-14T13:16:56.2571669Z   token: ***
2025-07-14T13:16:56.2571947Z   ssh-strict: true
2025-07-14T13:16:56.2572231Z   ssh-user: git
2025-07-14T13:16:56.2572519Z   persist-credentials: true
2025-07-14T13:16:56.2572857Z   clean: true
2025-07-14T13:16:56.2573169Z   sparse-checkout-cone-mode: true
2025-07-14T13:16:56.2573505Z   fetch-depth: 1
2025-07-14T13:16:56.2573786Z   fetch-tags: false
2025-07-14T13:16:56.2574068Z   show-progress: true
2025-07-14T13:16:56.2574357Z   lfs: false
2025-07-14T13:16:56.2574617Z   submodules: false
2025-07-14T13:16:56.2575090Z   set-safe-directory: true
2025-07-14T13:16:56.2575645Z ##[endgroup]
2025-07-14T13:16:56.4670673Z Syncing repository: github/invented-repo-for-test`

  const expected6 = [
    ["actions/checkout", "v4", "11bd71901bbe5b1630ceea73d27597364c9af683", "4.2.2", "ccb2698953eaebd21c7bf6268a94f9c26518a7e38e27e0b83c1fe1ad049819b1"],
    ["actions/setup-java", "v4", "c5195efecf7bdfc987ee8bae7a71cb8b11521c00", "4.7.1", "23223d64943473efb4336f60463c0429cd4f422cd5fc6c48a5cf0d5907c1aeac"],
    ["sbt/setup-sbt", "v1", "234370af1319038bf8dc432f8a7e4b83078a1781"],
    ["actions/cache", "v4", "5a3ec84eff668545956fd18022155c47e93e2684", "4.2.3", "c8a3bb963e1f1826d8fcc8d1354f0dd29d8ac1db1d4f6f20247055ae11b81ed9"],
  ];
  assert.deepStrictEqual(
    searchForActionsLines(logContent6),
    expected6,
    "Should extract actions from an immutable action group"
  );
}

// Run the tests
runTests();
