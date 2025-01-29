const fs = require('fs');
const path = require('path');

// Read the combined report file
const reportPath = path.join(__dirname, 'frontend/cypress/reports/combined-report.json');
const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const stats = reportData.stats;

// Create the summary
const summary = `
End-to-end Test Results
${stats.testsRegistered} tests   ${stats.passes} ✅  ${(stats.duration / 1000).toFixed(0)}s ⏱️
${stats.suites} suites    ${stats.pending} 💤
  1 files    ${stats.failures} ❌.
`;

// Write the summary to a file (this can be used for posting as a comment)
const summaryPath = path.join(__dirname, 'frontend/cypress/reports/test-summary.txt');
fs.writeFileSync(summaryPath, summary);

console.log('Test summary generated:');
console.log(summary);
