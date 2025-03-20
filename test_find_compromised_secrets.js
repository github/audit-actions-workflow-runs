import assert from "assert";
import { findSecretsInLines, base64Regex1 } from "./find_compromised_secrets_helper.js";

function testFindSecretsInLines() {
  console.log("Running test for findSecretsInLines...");

  // Simulate reading lines from a file
  const lines = [
    "2025-03-20T12:01:00Z SW1kcGRHaDFZbDkwYjJ0bGJpSTZleUoyWVd4MVpTSTZJbWRvYzE4d01EQXdNREF3TURBd01EQXdNREF3TURBd01EQXdNREF3TURBd01EQXdNREFpTENBaWFYTlRaV055WlhRaU9pQjBjblZsZlFvPQo=",
    "2025-03-20T12:00:00Z SWpBaU9uc2lkbUZzZFdVaU9pSmhJaXdnSW1selUyVmpjbVYwSWpwMGNuVmxmUW89Cg==",
    "2025-03-20T12:00:00Z Some log message",
    "2025-03-20T12:02:00Z Another log message",
    "",
  ];

  const data = "SWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  const match = base64Regex1.exec(data);
  
  assert(match, "Failed to match base64 data");

  // Expected secrets after decoding
  const expectedSecrets = [
    {
        github_token: {
            isSecret: true,
            value: 'ghs_000000000000000000000000000000000'
        }
    },
    {
        "0": {
            isSecret: true,
            value: 'a'
        }
    }
  ];

  // Call the function
  const secrets = findSecretsInLines(lines);

  // Assert the results
  assert.deepStrictEqual(
    secrets,
    expectedSecrets,
    "The secrets extracted from the lines do not match the expected output."
  );

  console.log("Test passed!");
}

// Run the test
function main() {
    console.log("Running tests...");
    testFindSecretsInLines();
}

main();
