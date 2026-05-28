const fs = require('fs');
const files = [
  'application/src/modules/reports/components/ReportTableScreen.jsx',
  'application/src/modules/reports/components/ReportTablePrint.jsx'
];
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  ['expandedProfitRows', 'formatTallyNum', 'expenses\\.'].forEach(term => {
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (new RegExp(term).test(line)) {
        console.log(`${file}:${i+1} contains ${term}`);
      }
    });
  });
});
