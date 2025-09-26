/**
 * Test script to verify firstname extraction from calendar names
 */

/**
 * Extract firstname from calendar display name
 * Converts "Travel (firstname lastname)" to "firstname"
 * @param {string} displayName - The original calendar display name
 * @returns {string} - The extracted firstname or original name if pattern doesn't match
 */
function extractFirstname(displayName) {
  if (!displayName) return displayName;
  
  // Match pattern: "Calendar Name (firstname lastname)"
  const match = displayName.match(/^.*\(([^)\s]+)\s+[^)]+\)$/);
  if (match) {
    return match[1]; // Return just the firstname
  }
  
  // If pattern doesn't match, return original name
  return displayName;
}

// Test cases
const testCases = [
  "Travel (John Doe)",
  "Support (Jane Smith)", 
  "Meeting (Bob Johnson)",
  "Calendar (Alice Brown)",
  "Work (Mike Wilson)",
  "Personal Calendar", // Should return as-is
  "Calendar (SingleName)", // Should return as-is (no lastname)
  "", // Should return as-is
  null, // Should return as-is
  "Travel (Mary Jane Watson)", // Should extract "Mary"
];

console.log("Testing firstname extraction:");
console.log("=============================");

testCases.forEach(testCase => {
  const result = extractFirstname(testCase);
  console.log(`Input:  "${testCase}"`);
  console.log(`Output: "${result}"`);
  console.log("---");
});

// Verify specific expected results
const expectedResults = [
  { input: "Travel (John Doe)", expected: "John" },
  { input: "Support (Jane Smith)", expected: "Jane" },
  { input: "Personal Calendar", expected: "Personal Calendar" },
  { input: "Travel (Mary Jane Watson)", expected: "Mary" }
];

console.log("\nVerification:");
console.log("=============");

let allPassed = true;
expectedResults.forEach(({ input, expected }) => {
  const actual = extractFirstname(input);
  const passed = actual === expected;
  allPassed = allPassed && passed;
  
  console.log(`✓ ${passed ? 'PASS' : 'FAIL'}: "${input}" -> "${actual}" ${passed ? '' : `(expected "${expected}")`}`);
});

console.log(`\nOverall result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
