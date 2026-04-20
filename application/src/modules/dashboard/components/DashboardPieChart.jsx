import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Loader2, RefreshCw } from 'lucide-react';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';

const COLORS = ['#347CF0', '#59C96B', '#FF962E', '#8D59E8'];
const MAX_VISIBLE_SEGMENTS = 4;
const TOP_CATEGORY_COUNT = MAX_VISIBLE_SEGMENTS - 1;

const formatCompactAmount = (amount, currency) => {
    const numericAmount = Math.abs(Number(amount) || 0);
    const parts = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2
    }).formatToParts(numericAmount);
    
    const symbol = parts.find(p => p.type === 'currency')?.value || '';
    
    if (numericAmount >= 10000000) return `${symbol}${(numericAmount / 10000000).toFixed(1)}Cr`;
    if (numericAmount >= 100000) return `${symbol}${(numericAmount / 100000).toFixed(1)}L`;
    if (numericAmount >= 1000) return `${symbol}${(numericAmount / 1000).toFixed(1)}K`;
    return `${symbol}${numericAmount.toFixed(0)}`;
};

const DashboardPieChart = ({ dashboardFilters }) => {
    const { getBranchFilterValue, selectedBranch, loading: branchLoading } = useBranch();
    const { selectedYear, loading: yearLoading } = useYear();
    const { preferences } = usePreferences();

    const [selectedType, setSelectedType] = useState('expense');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
    
    const echartsRef = useRef(null);
    const chartFrameRef = useRef(null);
    const contextReady = Boolean(!branchLoading && !yearLoading && selectedYear?.id);

    useEffect(() => {
        const node = chartFrameRef.current;
        if (!node) return undefined;
        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setChartSize({ width, height });
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

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

        // Reorder to put the medium-sized "Green" segment between tiny Orange and Purple
        // This acts as a physical buffer to prevent card overlapping.
        // Logic: [Largest, 3rd Largest, 2nd Largest, 4th Largest]
        const reordered = [];
        if (items[0]) reordered.push(items[0]); // Blue (Largest)
        if (items[2]) reordered.push(items[2]); // Orange (3rd)
        if (items[1]) reordered.push(items[1]); // Green (Buffer - 2nd)
        if (items[3]) reordered.push(items[3]); // Purple (4th)
        
        const finalItems = reordered.length === items.length ? reordered : items;

        // Calculate rotation for RHS centering
        let currentAngle = 320; 
        return finalItems.map((item, idx) => {
            const percent = total > 0 ? (Math.abs(item.amount) / total) * 100 : 0;
            const angleSpan = (percent / 100) * 360;
            const midAngle = currentAngle - (angleSpan / 2);
            currentAngle -= angleSpan;
            return {
                ...item,
                value: item.amount,
                percent: percent.toFixed(1),
                color: COLORS[idx % COLORS.length],
                midAngle
            };
        });
    }, [categories, selectedType]);

    const getRadialPos = (angle, index) => {
        // Reduced base radius to move boxes a little bit inside
        const radius = 40 + (index === 0 ? 0 : (index % 2 === 0 ? 3 : -3)); 
        const rad = (angle * Math.PI) / 180;
        const aspect = chartSize.width / chartSize.height || 1;
        
        return {
            x: 50 + (radius * Math.cos(rad) / aspect * 1.02), 
            y: 50 - (radius * Math.sin(rad) * 1.02)
        };
    };

    const echartsOption = {
        animationDuration: 500,
        animationEasing: 'cubicOut',
        series: [{
            type: 'pie',
            radius: ['0%', '70%'],
            center: ['50%', '50%'],
            startAngle: 320, 
            clockwise: true,
            avoidLabelOverlap: true,
            itemStyle: {
                borderWidth: 0,
                borderRadius: 0,
                color: (params) => chartData[params.dataIndex]?.color
            },
            label: {
                show: true,
                position: 'outside',
                // Keep the label empty to avoid duplicate text with React cards
                // but keep it active so labelLine (the connector) shows up
                formatter: () => ' ', 
                fontSize: 0
            },
            labelLine: {
                show: true,
                length: 20,
                length2: 45,
                smooth: true,
                lineStyle: {
                    width: 1.8,
                    cap: 'round',
                    color: 'rgba(0,0,0,0.1)'
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
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col w-full h-full lg:row-span-1 lg:col-span-1 overflow-hidden min-h-[460px]">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center shrink-0 bg-[#F9F9FB]">
                <h3 className="text-[15px] font-medium text-slate-900 tracking-tight flex items-center gap-1.5 focus:outline-none">
                    {headerTitle}
                </h3>

                <button
                    type="button"
                    onClick={() => setSelectedType(prev => prev === 'expense' ? 'income' : 'expense')}
                    className="animate-rotate-hover group flex h-7 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                >
                    <RefreshCw size={13} className="text-slate-500 group-hover:text-indigo-500 transition-colors" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 group-hover:text-indigo-600">
                        {selectedType === 'expense' ? 'Income' : 'Expense'}
                    </span>
                </button>
            </div>

            <div className="flex-1 relative bg-white" ref={chartFrameRef}>
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[15px] font-medium text-slate-400">
                        No {selectedType} data found
                    </div>
                ) : (
                    <>
                        <ReactECharts
                            ref={echartsRef}
                            option={echartsOption}
                            style={{ height: '100%', width: '100%' }}
                            onEvents={{
                                'mouseover': (params) => setHoveredIndex(params.dataIndex),
                                'mouseout': () => setHoveredIndex(null)
                            }}
                        />
                        
                        {/* Radial Indicator Cards */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden sm:block">
                            {chartData.map((item, idx) => {
                                const pos = getRadialPos(item.midAngle, 38); // Base distance
                                const isHovered = hoveredIndex === idx;
                                
                                return (
                                    <div
                                        key={`card-${idx}`}
                                        className={`floating-legend-card absolute p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-1 min-w-[140px] pointer-events-auto ${isHovered ? 'scale-105 border-indigo-200 shadow-md ring-4 ring-indigo-50' : 'opacity-90'}`}
                                        style={{
                                            left: `${pos.x}%`,
                                            top: `${pos.y}%`,
                                            transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.05)' : 'scale(1)'}`,
                                            zIndex: isHovered ? 30 : 10
                                        }}
                                        onMouseEnter={() => {
                                            setHoveredIndex(idx);
                                            echartsRef.current?.getEchartsInstance().dispatchAction({
                                                type: 'highlight',
                                                seriesIndex: 0,
                                                dataIndex: idx
                                            });
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredIndex(null);
                                            echartsRef.current?.getEchartsInstance().dispatchAction({
                                                type: 'downplay',
                                                seriesIndex: 0,
                                                dataIndex: idx
                                            });
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-[12px] font-bold text-slate-800 truncate max-w-[80px]">
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-baseline mt-0.5">
                                            <span className="text-[11px] font-medium text-slate-400">{item.percent}%</span>
                                            <span className="text-[13px] font-bold text-slate-900 tracking-tight">
                                                {formatCompactAmount(item.amount, dashboardFilters?.currency || preferences.currency)}
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
