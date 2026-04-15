const fs = require('fs');
const file = 'application/src/modules/accounts/Accounts.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add lucide icons
content = content.replace(
    'Loader2\n} from \'lucide-react\';',
    'Loader2,\n    Building2,\n    CreditCard,\n    Wallet,\n    ChevronUp,\n    Calendar,\n    TrendingUp\n} from \'lucide-react\';'
);

// 2. Add Recharts and Mocks
const replace1_target = "import BankingOverview from './components/BankingOverview';";
const replace1_val = `import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const MOCK_30_DAYS = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bank: 45000 + Math.random() * 20000 - 5000,
        card: 5000 + Math.random() * 3000 - 1000,
        cash: 1000 + Math.random() * 800 - 200
    };
});

const MOCK_12_MONTHS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return {
        date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        bank: 40000 + (i * 2000) + Math.random() * 10000,
        card: 8000 + (i * 100) + Math.random() * 2000,
        cash: 1200 + (i * 50) + Math.random() * 500
    };
});

const SummaryItem = ({ title, amount, icon: Icon, colorClass, bgClass, currency, formatCurrency }) => (
    <div className="flex items-start gap-2.5">
        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", bgClass)}>
            <Icon size={16} className={colorClass} strokeWidth={2.5} />
        </div>
        <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-0.5">{title}</p>
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                {formatCurrency(amount, currency)}
            </h3>
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label, currency, formatCurrency }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-100 rounded-lg p-2.5 shadow-md z-50 min-w-[140px]">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                                {formatCurrency(entry.value, currency)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};`;
content = content.replace(replace1_target, replace1_val);

// 3. Add Component State
const replace2_target = `    const { bankBalance, cardBalance, cashBalance } = computedBalances;

    const getAccountOweValue = (account) => {`;
const replace2_val = `    const { bankBalance, cardBalance, cashBalance } = computedBalances;

    const [chartTimeframe, setChartTimeframe] = useState('30D');
    const [chartVisible, setChartVisible] = useState(false);
    const chartData = useMemo(() => {
        return chartTimeframe === '30D' ? MOCK_30_DAYS : MOCK_12_MONTHS;
    }, [chartTimeframe]);

    const getAccountOweValue = (account) => {`;
content = content.replace(replace2_target, replace2_val);

// 4. Update JSX Structure
const replace3_target = `                    <PageHeader
                        title="Banking Overview"
                        breadcrumbs={['Accounts', 'Overview']}
                    />
                )}
            >
                <div className="print:hidden">
                    <BankingOverview 
                        bankBalance={bankBalance} 
                        cardBalance={cardBalance} 
                        cashBalance={cashBalance} 
                    />
                </div>

                {/* Toolbar */}
                <div className="p-4 flex flex-row items-center justify-between gap-4 border-b border-gray-50 relative print:hidden min-h-[74px]">
                    <div className="relative hidden xl:block w-64">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search accounts..."
                            className="w-full pl-10 pr-4 py-2 bg-[#f1f3f9] border border-gray-100 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-3 flex-1 xl:hidden">
                        <div className="relative group w-full max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search accounts..."
                                className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f9] border border-transparent rounded-xl text-xs font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end">
                        {/* Create Button */}`;

const replace3_val = `                    <PageHeader
                        title="Account Overview"
                        breadcrumbs={['Accounts', 'Overview']}
                    />
                )}
            >
                <div className="px-5 pt-5 pb-1 print:hidden border-b border-gray-50">
                    <div className="bg-white border border-gray-200 rounded-[12px] p-5 shadow-sm">
                        
                        {/* Header Controls */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-2 py-1 -ml-2 rounded-md transition-colors">
                                <span className="text-sm font-bold text-gray-800">All Accounts</span>
                                <ChevronDown size={14} className="text-primary" />
                            </div>
                            
                            <div className="relative group">
                                <div className="flex items-center gap-1.5 cursor-pointer text-gray-600 hover:text-gray-900 transition-colors">
                                    <Calendar size={14} />
                                    <select 
                                        value={chartTimeframe}
                                        onChange={(e) => setChartTimeframe(e.target.value)}
                                        className="appearance-none bg-transparent text-xs font-semibold py-1 pr-4 outline-none cursor-pointer"
                                        aria-label="Select timeframe"
                                    >
                                        <option value="30D">Last 30 days</option>
                                        <option value="12M">Last 12 months</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Metrics Row */}
                        <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
                            <SummaryItem 
                                title="Bank Balance" 
                                amount={bankBalance} 
                                icon={Building2} 
                                colorClass="text-emerald-600" 
                                bgClass="bg-emerald-50" 
                                currency={preferences.currency}
                                formatCurrency={formatCurrency}
                            />
                            <SummaryItem 
                                title="Card Balance" 
                                amount={cardBalance} 
                                icon={CreditCard} 
                                colorClass="text-purple-600" 
                                bgClass="bg-purple-50"
                                currency={preferences.currency}
                                formatCurrency={formatCurrency}
                            />
                            <SummaryItem 
                                title="Cash in Hand" 
                                amount={cashBalance} 
                                icon={Wallet} 
                                colorClass="text-gray-600" 
                                bgClass="bg-gray-100"
                                currency={preferences.currency}
                                formatCurrency={formatCurrency}
                            />
                        </div>

                        {/* Chart Toggle */}
                        <div className="mt-5 pt-4 border-t border-gray-50 flex justify-start">
                            <button 
                                onClick={() => setChartVisible(!chartVisible)}
                                className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors"
                            >
                                <TrendingUp size={14} />
                                {chartVisible ? 'Hide Chart' : 'Show Chart'}
                                {chartVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </div>

                        {/* Chart Section */}
                        {chartVisible && (
                            <div className="h-[220px] w-full mt-6 transition-all">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={{ stroke: '#f3f4f6' }} 
                                            tickLine={false} 
                                            tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 500 }}
                                            dy={8}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 500 }}
                                            tickFormatter={(val) => {
                                                if (val >= 1000000) return \`\${(val / 1000000).toFixed(1)}M\`;
                                                if (val >= 1000) return \`\${(val / 1000).toFixed(0)}k\`;
                                                return val;
                                            }}
                                        />
                                        <Tooltip content={<CustomTooltip currency={preferences.currency} formatCurrency={formatCurrency} />} />
                                        <Line type="monotone" name="Bank Balance" dataKey="bank" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} />
                                        <Line type="monotone" name="Card Balance" dataKey="card" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#8b5cf6' }} />
                                        <Line type="monotone" name="Cash in Hand" dataKey="cash" stroke="#6b7280" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#6b7280' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 flex flex-row items-center justify-end gap-4 border-b border-gray-50 relative print:hidden">
                    <div className="flex items-center gap-3 justify-end">
                        {/* Create Button */}`;

content = content.replace(replace3_target, replace3_val);

fs.writeFileSync(file, content);
console.log('Update Complete');
