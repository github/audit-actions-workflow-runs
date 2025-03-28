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
}

// Run the tests
runTests();
