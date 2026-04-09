import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../../utils/cn';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';

// Custom vibrant colors matching the reference requested
const COLORS = ['#2dd4bf', '#fb923c', '#3b82f6', '#fbbf24', '#8b5cf6', '#38bdf8', '#f472b6', '#a3e635'];

const DashboardPieChart = ({ dashboardFilters }) => {
    const { getBranchFilterValue, selectedBranch, loading: branchLoading } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { preferences } = usePreferences();
    
    const [selectedType, setSelectedType] = useState('expense'); // 'expense' or 'income'
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    const contextReady = Boolean(!branchLoading && !yearLoading && selectedYear?.id);

    useEffect(() => {
        const fetchCategories = async () => {
            if (!contextReady) return;
            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                const response = await apiService.dashboard.getCategoryRankings({
                    branchId: branchFilter,
                    financialYearId: selectedYear.id,
                    targetCurrency: dashboardFilters?.currency || preferences.currency,
                    ...(dashboardFilters?.dateRange?.startDate ? { startDate: dashboardFilters.dateRange.startDate, endDate: dashboardFilters.dateRange.endDate } : {})
                });
                
                if (response?.success && Array.isArray(response.data)) {
                    setCategories(response.data.map(c => ({
                        ...c,
                        type: String(c?.type ?? c?.txnType ?? '').trim().toLowerCase(),
                        amount: Number(c?.amount || 0)
                    })));
                } else {
                    setCategories([]);
                }
            } catch (error) {
                console.error("Failed to fetch pie chart categories", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [contextReady, selectedBranch?.id, selectedYear?.id, dashboardFilters, preferences.currency]); // deliberately naive fetch to avoid overcomplicating caching here

    // Process data for the selected type
    const sourceData = categories
        .filter(c => c.type === selectedType)
        .sort((a, b) => b.amount - a.amount);
        
    const totalAmount = sourceData.reduce((sum, c) => sum + Math.abs(c.amount), 0);
    
    // Group into Top 5 + Others
    let pieData = [];
    if (sourceData.length > 5) {
        pieData = sourceData.slice(0, 5);
        const othersAmount = sourceData.slice(5).reduce((sum, c) => sum + Math.abs(c.amount), 0);
        if (othersAmount > 0) {
            pieData.push({ name: 'Others', amount: othersAmount });
        }
    } else {
        pieData = [...sourceData];
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full lg:row-span-1 lg:col-span-1 overflow-hidden min-h-[360px]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
                <div 
                    onClick={() => setSelectedType(prev => prev === 'expense' ? 'income' : 'expense')}
                    className="flex items-center gap-1.5 cursor-pointer select-none group"
                    title={`Click to switch to Top ${selectedType === 'expense' ? 'Income' : 'Expenses'}`}
                >
                    <h3 className="text-[15px] leading-none font-medium text-slate-900 group-hover:text-slate-700 tracking-tight transition-colors focus:outline-none flex items-center">
                        Top {selectedType === 'income' ? 'Income' : 'Expenses'}
                    </h3>
                    <div className="text-slate-400 group-hover:text-slate-600 transition-colors p-1 rounded-md group-hover:bg-slate-50 flex items-center justify-center mt-[1px]">
                        <RefreshCw className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col md:flex-row relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    </div>
                ) : pieData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-400">
                        No {selectedType} data found
                    </div>
                ) : (
                    <>
                        {/* the Pie Chart Area */}
                        <div className="flex-1 min-h-[220px] flex items-center justify-center p-4">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={85}
                                        paddingAngle={0}
                                        dataKey="amount"
                                        stroke="none"
                                        isAnimationActive={true}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        
                        {/* the Legend Area */}
                        <div className="md:w-[280px] lg:w-[260px] xl:w-[320px] flex flex-col justify-center px-6 pb-6 md:pb-0 gap-3 shrink-0 auto-y-auto">
                            {pieData.map((entry, index) => {
                                const percent = totalAmount > 0 ? (Math.abs(entry.amount) / totalAmount) * 100 : 0;
                                return (
                                    <div key={index} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <span 
                                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                                            />
                                            <span className="text-[13px] font-medium text-slate-700 truncate" title={entry.name}>
                                                {entry.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-end gap-3 shrink-0">
                                            <span className="text-[13px] font-medium text-slate-800 w-[100px] text-right whitespace-nowrap tracking-tight">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: dashboardFilters?.currency || preferences?.currency || 'INR' }).format(Math.abs(entry.amount))}
                                            </span>
                                            <span className="text-[13px] font-medium text-slate-500 w-[36px] text-right">
                                                {Math.round(percent)}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DashboardPieChart;
