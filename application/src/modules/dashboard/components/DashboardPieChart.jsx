import React, { useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Loader2, RefreshCw } from 'lucide-react';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';

const COLORS = ['#2dd4bf', '#fb923c', '#3b82f6', '#fcd34d', '#818cf8', '#38bdf8', '#fb7185'];
const MAX_VISIBLE_SEGMENTS = 8;
const TOP_CATEGORY_COUNT = MAX_VISIBLE_SEGMENTS - 1;

const formatFullAmount = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Math.abs(Number(amount) || 0));
};

const DashboardPieChart = ({ dashboardFilters }) => {
    const { getBranchFilterValue, selectedBranch, loading: branchLoading } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { preferences } = usePreferences();

    const [selectedType, setSelectedType] = useState('expense');
    const [categories, setCategories] = React.useState([]);
    const [loading, setLoading] = useState(false);
    const echartsRef = useRef(null);

    const contextReady = Boolean(!branchLoading && !yearLoading && selectedYear?.id);

    React.useEffect(() => {
        const fetchCategories = async () => {
            if (!contextReady) return;
            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                const response = await apiService.dashboard.getCategoryRankings({
                    branchId: branchFilter,
                    financialYearId: selectedYear.id,
                    targetCurrency: dashboardFilters?.currency || preferences.currency,
                    ...(dashboardFilters?.dateRange?.startDate ? {
                        startDate: dashboardFilters.dateRange.startDate,
                        endDate: dashboardFilters.dateRange.endDate
                    } : {})
                });

                if (response?.success && Array.isArray(response.data)) {
                    setCategories(response.data.map((category) => ({
                        ...category,
                        type: String(category?.type ?? category?.txnType ?? '').trim().toLowerCase(),
                        amount: Number(category?.amount || 0)
                    })));
                }
            } catch (error) {
                console.error('Failed to fetch categories', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, [contextReady, selectedBranch?.id, selectedYear?.id, dashboardFilters, preferences.currency, getBranchFilterValue]);

    const chartData = useMemo(() => {
        const filtered = categories
            .filter((c) => c.type === selectedType)
            .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        
        const total = filtered.reduce((sum, c) => sum + Math.abs(c.amount), 0);
        let items = [];
        if (filtered.length > MAX_VISIBLE_SEGMENTS) {
            items = filtered.slice(0, TOP_CATEGORY_COUNT);
            const othersAmount = filtered.slice(TOP_CATEGORY_COUNT).reduce((sum, c) => sum + Math.abs(c.amount), 0);
            if (othersAmount > 0) items.push({ name: 'Others', amount: othersAmount });
        } else {
            items = [...filtered];
        }

        return items.map((item, idx) => {
            const percent = total > 0 ? (Math.abs(item.amount) / total) * 100 : 0;
            return {
                ...item,
                value: item.amount,
                percent: percent.toFixed(2),
                color: COLORS[idx % COLORS.length]
            };
        });
    }, [categories, selectedType]);

    const echartsOption = {
        animationDuration: 500,
        animationEasing: 'cubicOut',
        series: [{
            type: 'pie',
            radius: ['0%', '60%'],
            center: ['50%', '50%'],
            startAngle: 90, 
            clockwise: true,
            avoidLabelOverlap: true,
            itemStyle: {
                borderWidth: 2,
                borderColor: '#fff',
                color: (params) => chartData[params.dataIndex]?.color
            },
            label: {
                show: true,
                position: 'outside',
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                borderRadius: 6,
                padding: [10, 14],
                shadowColor: 'rgba(0, 0, 0, 0.08)',
                shadowBlur: 8,
                shadowOffsetX: 0,
                shadowOffsetY: 4,
                formatter: (params) => {
                    const amountStr = formatFullAmount(params.data.value, dashboardFilters?.currency || preferences.currency);
                    return `{amount|${amountStr}}\n{name|${params.data.name} (${params.data.percent}%)}`;
                },
                rich: {
                    amount: {
                        fontSize: 16,
                        fontWeight: 500,
                        color: '#0f172a',
                        padding: [0, 0, 6, 0]
                    },
                    name: {
                        fontSize: 12,
                        color: '#475569'
                    }
                }
            },
            labelLine: {
                show: true,
                length: 25,
                length2: 35,
                smooth: false,
                lineStyle: {
                    width: 1.5,
                    color: '#cbd5e1'
                }
            },
            emphasis: {
                scale: true,
                scaleSize: 10,
                itemStyle: {
                    shadowBlur: 20,
                    shadowColor: 'rgba(0, 0, 0, 0.15)'
                }
            },
            data: chartData
        }]
    };

    const headerTitle = `Top ${selectedType === 'income' ? 'Income' : 'Expenses'}`;

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full lg:row-span-1 lg:col-span-1 min-h-[460px]">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center shrink-0 bg-[#F9F9FB]">
                <h3 className="text-[15px] font-medium text-slate-900 tracking-tight flex items-center gap-1.5 focus:outline-none">
                    {headerTitle}
                </h3>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setSelectedType(prev => prev === 'expense' ? 'income' : 'expense')}
                        className="animate-rotate-hover group flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-0.5 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                    >
                        <RefreshCw size={13} className="text-slate-500 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-hover:text-indigo-600">
                            {selectedType === 'expense' ? 'Income' : 'Expense'}
                        </span>
                    </button>
                </div>
            </div>

            <div className="flex-1 relative bg-white flex flex-col items-center justify-center p-4">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[15px] font-medium text-slate-400">
                        No {selectedType} data found
                    </div>
                ) : (
                    <div className="w-full h-[350px] md:h-[400px]">
                        <ReactECharts
                            ref={echartsRef}
                            option={echartsOption}
                            style={{ height: '100%', width: '100%' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPieChart;
