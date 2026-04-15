const fs = require('fs');
const file = 'application/src/modules/accounts/Accounts.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add States
const replace1_target = `    const [chartTimeframe, setChartTimeframe] = useState('30D');
    const [chartVisible, setChartVisible] = useState(false);`;
const replace1_val = `    const [chartTimeframe, setChartTimeframe] = useState('30D');
    const [chartVisible, setChartVisible] = useState(false);
    const [summaryFilter, setSummaryFilter] = useState('All Accounts');
    const [listFilter, setListFilter] = useState('Active Accounts');`;
content = content.replace(replace1_target, replace1_val);

// 2. Add Filter Logic
const replace2_target = `    const filteredAccounts = useMemo(() => {
        let result = [...accounts];

        if (searchTerm.trim()) {`;
const replace2_val = `    const filteredAccounts = useMemo(() => {
        let result = [...accounts];

        if (listFilter === 'Active Accounts') {
            result = result.filter(a => a.isActive || a.status === 1 || a.status === 'active');
        } else if (listFilter === 'Inactive Accounts') {
            result = result.filter(a => !a.isActive && a.status !== 1 && a.status !== 'active');
        }

        if (searchTerm.trim()) {`;
content = content.replace(replace2_target, replace2_val);

// 3. Update Dependency Array
const replace3_target = `        return result;
    }, [accounts, sortConfig, oweMap, searchTerm]);`;
const replace3_val = `        return result;
    }, [accounts, sortConfig, oweMap, searchTerm, listFilter]);`;
content = content.replace(replace3_target, replace3_val);

// 4. Update JSX Layout
const replace4_target = `                <div className="px-5 pt-5 pb-5 print:hidden border-b border-gray-100 flex flex-col gap-6 bg-white">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-2 py-1 -ml-2 rounded-md transition-colors">
                            <span className="text-sm font-bold text-gray-800">All Accounts</span>
                            <ChevronDown size={14} className="text-primary" />
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <div className="flex items-center gap-1.5 cursor-pointer text-gray-600 hover:text-gray-900 transition-colors bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 shadow-sm text-xs font-semibold">
                                    <Calendar size={14} />
                                    <select 
                                        value={chartTimeframe}
                                        onChange={(e) => setChartTimeframe(e.target.value)}
                                        className="appearance-none bg-transparent outline-none cursor-pointer w-full text-gray-700"
                                        aria-label="Select timeframe"
                                    >
                                        <option value="30D">Last 30 days</option>
                                        <option value="12M">Last 12 months</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                </div>
                            </div>

                            <button
                                onClick={handleCreateAccount}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95 shadow-sm bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                title="Add New Account"
                            >
                                <Plus size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>`;
const replace4_val = `                {/* Summary Component Box */}
                <div className="p-4 print:hidden">
                    <div className="bg-white border border-gray-200 rounded-[12px] p-5 shadow-sm">
                        {/* Header Controls */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="relative">
                                <select 
                                    value={summaryFilter}
                                    onChange={(e) => setSummaryFilter(e.target.value)}
                                    className="text-[15px] font-bold text-gray-800 appearance-none bg-transparent outline-none cursor-pointer pr-5"
                                >
                                    <option value="All Accounts">All Accounts</option>
                                    <option value="Bank Account">Bank Account</option>
                                    <option value="Cash Account">Cash Account</option>
                                    <option value="Credit Card Account">Credit Card Account</option>
                                    <option value="Payment Clearing Account">Payment Clearing Account</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-primary" />
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-gray-600 bg-white border border-gray-100 rounded-lg px-3 py-1.5 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] text-xs font-semibold">
                                <Calendar size={14} />
                                <span>Last 30 days</span>
                            </div>
                        </div>`;
content = content.replace(replace4_target, replace4_val);

// 5. Add custom list header before Table
const replace5_target = `                                </ResponsiveContainer>
                            </div>
                        )}
                </div>



                {!isDesktopView && (`;
const replace5_val = `                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                {/* Custom List Header */}
                <div className="px-5 pb-3 pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between print:hidden gap-3">
                    <div className="relative">
                        <select 
                            value={listFilter}
                            onChange={(e) => setListFilter(e.target.value)}
                            className="text-base font-bold text-gray-900 appearance-none bg-transparent outline-none cursor-pointer pr-5"
                        >
                            <option value="All Accounts">All Accounts</option>
                            <option value="Active Accounts">Active Accounts</option>
                            <option value="Inactive Accounts">Inactive Accounts</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-primary" />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative group flex-1 sm:w-48">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search accounts..."
                                className="w-full pl-8 pr-3 py-1.5 bg-[#f1f3f9] border border-transparent rounded-lg text-xs font-medium placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleCreateAccount}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95 shadow-sm bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 shrink-0"
                            title="Add New Account"
                        >
                            <Plus size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {!isDesktopView && (`;
content = content.replace(replace5_target, replace5_val);

fs.writeFileSync(file, content);
console.log('Update2 Complete');
