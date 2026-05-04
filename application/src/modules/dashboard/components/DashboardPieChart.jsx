import React, { useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { RefreshCw } from 'lucide-react';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';
import { Loader } from '../../../components/common/Loader';

const COLORS = ['#2dd4bf', '#fb923c', '#3b82f6', '#fcd34d', '#818cf8', '#38bdf8', '#fb7185'];
const MAX_VISIBLE_SEGMENTS = 6;
const TOP_CATEGORY_COUNT = 5;

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
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

    React.useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth < 768;
    const isDesktop = windowWidth >= 1500;

    const contextReady = Boolean(!branchLoading && !yearLoading && selectedYear?.id);

    React.useEffect(() => {
        const controller = new AbortController();
        const fetchCategories = async () => {
            if (!contextReady) return;
            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                const rankingsResponse = await apiService.dashboard.getCategoryRankings({
                    branchId: branchFilter,
                    financialYearId: selectedYear.id,
                    targetCurrency: dashboardFilters?.currency || preferences.currency,
                    ...(dashboardFilters?.dateRange?.startDate ? { startDate: dashboardFilters.dateRange.startDate, endDate: dashboardFilters.dateRange.endDate } : {})
                }, { signal: controller.signal });

                if (!controller.signal.aborted) {
                    if (rankingsResponse.success) {
                        const normalizedRankings = (Array.isArray(rankingsResponse.data) ? rankingsResponse.data : []).map(item => ({
                            ...item, 
                            type: String(item?.type ?? item?.txnType ?? '').trim().toLowerCase(), 
                            name: String(item?.name ?? '').trim(), 
                            amount: Number(item?.amount || 0)
                        }));
                        // Filter out 'account' type if any, just like CategoryRankings does
                        setCategories(normalizedRankings.filter((item) => item.type !== 'account'));
                    } else {
                        setCategories([]);
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Failed to fetch categories', error);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };
        fetchCategories();
        return () => controller.abort();
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

        // Interleave items (Largest, Smallest, 2nd Largest, 2nd Smallest...)
        // This distributes the physical area of the slices evenly around the 360 degree circle.
        // As a result, the label anchor points are naturally distributed vertically from Top to Bottom
        // on both the left and right edges, perfectly filling the 4 corners of the UI.
        const interleaved = [];
        let left = 0;
        let right = items.length - 1;
        while (left <= right) {
            if (left === right) {
                interleaved.push(items[left]);
            } else {
                interleaved.push(items[left]);
                interleaved.push(items[right]);
            }
            left++;
            right--;
        }

        return interleaved.map((item, idx) => {
            const percent = total > 0 ? (Math.abs(item.amount) / total) * 100 : 0;
            return {
                ...item,
                value: item.amount,
                percent: percent.toFixed(2),
                itemStyle: {
                    color: item.name === 'Others' ? '#94a3b8' : COLORS[idx % COLORS.length]
                }
            };
        });
    }, [categories, selectedType]);

    const echartsOption = {
        animationDuration: 500,
        animationEasing: 'cubicOut',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            shadowColor: 'rgba(0, 0, 0, 0.08)',
            shadowBlur: 12,
            textStyle: { color: '#0f172a', fontSize: 12 },
            formatter: (params) => {
                const amountStr = formatFullAmount(params.data.value, dashboardFilters?.currency || preferences.currency);
                return `<div style="display:flex;flex-direction:column;gap:4px">
                            <div style="display:flex;align-items:center;gap:6px">
                                <span style="width:8px;height:8px;border-radius:50%;background-color:${params.color}"></span>
                                <span style="color:#64748b;font-weight:500">${params.data.name}</span>
                            </div>
                            <div style="margin-left:14px;font-weight:600;color:#0f172a;font-size:13px">${amountStr} <span style="color:#64748b;font-weight:500;margin-left:2px">(${params.data.percent}%)</span></div>
                        </div>`;
            }
        },
        series: [{
            type: 'pie',
            radius: isMobile ? ['0%', '40%'] : isDesktop ? ['0%', '55%'] : ['0%', '48%'],
            center: ['50%', '50%'],
            startAngle: 210, // Fixed start angle combined with interleaving spreads labels across all 4 quadrants
            clockwise: true,
            avoidLabelOverlap: true,
            itemStyle: {
                borderWidth: 2,
                borderColor: '#fff'
            },
            labelLayout: {
                hideOverlap: false,
                moveOverlap: 'shiftY'
            },
            label: {
                show: true,
                position: 'outside',
                distanceToLabelLine: 5,
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                borderRadius: 6,
                padding: isMobile ? [6, 8] : [8, 12],
                shadowColor: 'rgba(0, 0, 0, 0.08)',
                shadowBlur: 8,
                shadowOffsetX: 0,
                shadowOffsetY: 4,
                formatter: (params) => {
                    const amountStr = formatFullAmount(params.data.value, dashboardFilters?.currency || preferences.currency);
                    let nameStr = params.data.name;
                    if (isMobile && nameStr.length > 15) {
                        nameStr = nameStr.substring(0, 12) + '...';
                    }
                    return `{amount|${amountStr}}\n{name|${nameStr} (${params.data.percent}%)}`;
                },
                rich: {
                    amount: {
                        fontSize: isMobile ? 10 : 11,
                        fontWeight: 600,
                        color: '#0f172a',
                        padding: [0, 0, 2, 0]
                    },
                    name: {
                        fontSize: isMobile ? 9 : 10,
                        color: '#475569'
                    }
                }
            },
            labelLine: {
                show: true,
                length: isMobile ? 15 : 20,
                length2: isMobile ? 15 : 30,
                maxSurfaceAngle: 80,
                smooth: false,
                lineStyle: {
                    width: 1.5,
                    color: '#cbd5e1'
                }
            },
            data: chartData.map(item => ({
                value: item.value,
                name: item.name,
                percent: item.percent,
                itemStyle: { color: item._color }
            }))
        }]
    };

    const headerTitle = `Top ${selectedType === 'income' ? 'Income' : 'Expenses'}`;

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full lg:row-span-1 lg:col-span-1 min-h-[380px] 2xl:min-h-[460px]">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center shrink-0 bg-[#F9F9FB]">
                <h3 className="text-[13px] 2xl:text-[15px] font-medium text-slate-900 tracking-tight flex items-center gap-1.5 focus:outline-none">
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
                        <Loader className="h-6 w-6 text-[#4A8AF4]" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[15px] font-medium text-slate-400">
                        No {selectedType} data found
                    </div>
                ) : (
                    <div className="w-full h-[320px] md:h-[350px] 2xl:h-[400px]">
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
