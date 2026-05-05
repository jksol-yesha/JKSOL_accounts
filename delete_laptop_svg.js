const fs = require('fs');
const path = require('path');

const filePath = '/Users/erasoft/Downloads/local-live copy 23/application/src/modules/dashboard/components/DashboardPieChart.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove laptopChartGeometry, laptopSliceAnchors, laptopCalloutLayout
content = content.replace(/const laptopChartGeometry = useMemo\(\(\) => \{.+?\}\], \[chartDimensions\.width, isLaptop, laptopCallouts, laptopChartGeometry, laptopSliceAnchors\]\);/gs, '');

// 2. Remove isLaptop checks from ECharts Option
content = content.replace(/show: !isLaptop,/g, 'show: true,');
content = content.replace(/alignTo: isLaptop \? 'edge' : 'none',/g, '');
content = content.replace(/edgeDistance: isLaptop \? 18 : 10,/g, '');
content = content.replace(/bleedMargin: isLaptop \? 4 : 8,/g, '');

// 3. Remove native laptop formatter override
content = content.replace(/if \(isLaptop\) \{\s*return `\{\s*amount\|\$\{params\.data\.compactAmount\}\}\\n\{\s*name\|\$\{params\.data\.shortName\}\}\`;\s*\}/g, '');

// 4. Remove the JSX overlay code
content = content.replace(/\{isLaptop \? \(.*?\) : null\}/gs, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned up laptop overlay!');
