const fs = require('fs');
let content = fs.readFileSync('src/modules/dashboard/components/CategoryRankings.jsx', 'utf8');

// Update imports
content = content.replace(/const \{ formatCompactCurrency: formatCurrency \} = usePreferences\(\);/g, 'const { formatCompactCurrency: formatCurrency, formatCurrency: formatCurrencyExact } = usePreferences();');

// Update Account Balance total badge
content = content.replace(
    /(\<span)(\s+className=\{cn\([\s\S]*?isTotalPositive \? "text-slate-800" : "text-rose-600"[\s\S]*?\)\}\>[\s\S]*?\{formatCurrency\(totalAvailableBalance\)\}[\s\S]*?\<\/span\>)/g,
    '$1 title={formatCurrencyExact(totalAvailableBalance)}$2'
);

// Update Account list items
content = content.replace(
    /(\<span)(\s+className="w-32 text-right text-\[14px\] font-medium text-slate-800"\>[\s\S]*?\{formatCurrency\(cat\.amount\)\}[\s\S]*?\<\/span\>)/g,
    '$1 title={formatCurrencyExact(cat.amount)}$2'
);

// Update Income Total
content = content.replace(
    /(\<div)(\s+className="text-\[14px\] font-semibold text-slate-800 tracking-tight whitespace-nowrap truncate"\>[\s\S]*?\{formatCurrency\(totalIncomeApp\)\}[\s\S]*?\<\/div\>)/g,
    '$1 title={formatCurrencyExact(totalIncomeApp)}$2'
);

// Update Expense Total
content = content.replace(
    /(\<div)(\s+className="text-\[14px\] font-semibold text-slate-800 tracking-tight whitespace-nowrap truncate"\>[\s\S]*?\{formatCurrency\(totalExpenseApp\)\}[\s\S]*?\<\/div\>)/g,
    '$1 title={formatCurrencyExact(totalExpenseApp)}$2'
);

// Update Investment total badge
content = content.replace(
    /(\<span)(\s+className=\{cn\([\s\S]*?isTotalPositive \? "text-slate-800" : "text-rose-600"[\s\S]*?\)\}\>[\s\S]*?\{formatCurrency\(totalAvailableInvestment\)\}[\s\S]*?\<\/span\>)/g,
    '$1 title={formatCurrencyExact(totalAvailableInvestment)}$2'
);

// Update Investment list items
content = content.replace(
    /(\<span)(\s+className="text-\[14px\] font-medium text-slate-800 mt-0\.5 shrink-0"\>[\s\S]*?\{formatCurrency\(cat\.amount\)\}[\s\S]*?\<\/span\>)/g,
    '$1 title={formatCurrencyExact(cat.amount)}$2'
);

fs.writeFileSync('src/modules/dashboard/components/CategoryRankings.jsx', content);
console.log('done');
