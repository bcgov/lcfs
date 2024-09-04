const fs = require('fs');
const path = require('path');

// Directory where your report files are located
const reportsDir = path.join(__dirname, 'frontend/cypress/reports');

// Initialize totals for the stats and test cases
let combinedCtrfReport = {
  results: {
    tool: {
      name: "cypress"
    },
    summary: {
      tests: 0,
      passed: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
      other: 0,
      start: null,
      stop: null
    },
    tests: [],
    environment: {
      appName: "MyApp",  // Replace with actual environment variables if available
      buildName: "MyBuild",
      buildNumber: "1"
    }
  }
};

// Read all files in the reports directory
const reportFiles = fs.readdirSync(reportsDir).filter(file => file.endsWith('.json'));

reportFiles.forEach((file, index) => {
  const reportPath = path.join(reportsDir, file);
  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  // Combine the test stats
  if (reportData.stats) {
    combinedCtrfReport.results.summary.tests += reportData.stats.tests;
    combinedCtrfReport.results.summary.passed += reportData.stats.passes;
    combinedCtrfReport.results.summary.failed += reportData.stats.failures;
    combinedCtrfReport.results.summary.pending += reportData.stats.pending;
    combinedCtrfReport.results.summary.skipped += reportData.stats.skipped;
    combinedCtrfReport.results.summary.other += reportData.stats.hasOther ? 1 : 0;

    // Set start time from the first report and stop time from the last report
    if (index === 0) {
      combinedCtrfReport.results.summary.start = new Date(reportData.stats.start).getTime();
    }
    combinedCtrfReport.results.summary.stop = new Date(reportData.stats.end).getTime();
  }

  // Process individual tests from the report
  if (reportData.results && reportData.results.length > 0) {
    reportData.results.forEach(suite => {
      suite.suites.forEach(subSuite => {
        subSuite.tests.forEach(test => {
          combinedCtrfReport.results.tests.push({
            name: test.fullTitle,
            status: test.state === 'passed' ? 'passed' : test.state === 'failed' ? 'failed' : 'pending',
            duration: test.duration
          });
        });
      });
    });
  }
});

// Write the combined CTRF report to a file
const ctrfReportPath = path.join(reportsDir, 'combined-ctrf-report.json');
fs.writeFileSync(ctrfReportPath, JSON.stringify(combinedCtrfReport, null, 2));

console.log('Combined CTRF report generated successfully.');
