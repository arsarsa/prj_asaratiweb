// src/utils/testCommonFrontend.js
// Script di test rapido per funzioni di validazione frontend

import { isValidEmail, isNonEmptyString } from '../../utils/commonFrontend.js';

function testIsValidEmail() {
  const testCases = [
    { input: "user@example.com", expected: true },
    { input: "user.name+tag@domain.co.uk", expected: true },
    { input: "invalid-email@", expected: false },
    { input: "noatsymbol.com", expected: false },
    { input: "", expected: false },
    { input: null, expected: false },
    { input: undefined, expected: false },
  ];

  console.log("Testing isValidEmail:");
  testCases.forEach(({ input, expected }) => {
    const result = isValidEmail(input);
    console.log(`  Input: "${input}" → Expected: ${expected}, Got: ${result} → ${result === expected ? "✔" : "❌"}`);
  });
}

function testIsNonEmptyString() {
  const testCases = [
    { input: "hello", expected: true },
    { input: "  world  ", expected: true },
    { input: "", expected: false },
    { input: "   ", expected: false },
    { input: null, expected: false },
    { input: 123, expected: false },
    { input: undefined, expected: false },
  ];

  console.log("Testing isNonEmptyString:");
  testCases.forEach(({ input, expected }) => {
    const result = isNonEmptyString(input);
    console.log(`  Input: ${JSON.stringify(input)} → Expected: ${expected}, Got: ${result} → ${result === expected ? "✔" : "❌"}`);
  });
}

// Esegui i test
testIsValidEmail();
testIsNonEmptyString();
