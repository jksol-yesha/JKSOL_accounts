import React from 'react';
import { cn } from '../../../utils/cn';
import { IndianRupee } from 'lucide-react';

const StatCard = ({
    title,
    amount,
    icon: Icon,
    trend,
    trendType = 'up',
    linkText = 'View net earnings',
    iconBgColor = '#d0f4ea',
    iconColor = '#10b981'
}) => {
    return (
        <div
            className="
                bg-white
                p-2.5 lg:p-3
                rounded-xl
                border border-gray-100
                shadow-sm
                hover:shadow-md
                transition-all duration-300
                flex flex-col
                self-start
                dashboard-laptop-metric-card
            "
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-1.5 lg:mb-2 dashboard-laptop-metric-header">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide dashboard-laptop-metric-title">
                    {title}
                </span>

                {trend && (
                    <div
                        className={cn(
                            "flex items-center gap-1 text-sm font-semibold",
                            trendType === 'up'
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                        )}
                    >
                        <span className="leading-none">
                            {trendType === 'up' ? '↗' : '↘'}
                        </span>
                        {trend !== '-' && <span>{trend}</span>}
                    </div>
                )}
            </div>

            {/* Amount */}
            <div className="flex items-baseline gap-1 mt-0.5 mb-0.5 lg:mt-1 lg:mb-1 dashboard-laptop-metric-amount-wrap">
                <h3 className="text-lg lg:text-xl font-bold text-gray-700 tracking-tight dashboard-laptop-metric-amount">
                    {amount}
                </h3>
            </div>

            {/* Footer - pushed to bottom */}
            <div className="-mt-3 flex items-end justify-between dashboard-laptop-metric-footer">
                <button
                    className="
                        text-xs lg:text-sm
                        font-medium
                        text-[#445185]
                        hover:text-indigo-700
                        transition-colors
                        dashboard-laptop-metric-link
                    "
                >
                    {linkText}
                </button>

                <div
                    className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all shadow-sm dashboard-laptop-metric-icon"
                    style={{ backgroundColor: iconBgColor }}
                >
                    <Icon size={20} strokeWidth={2} style={{ color: iconColor }} />
                </div>
            </div>
        </div>
    );
};

export default StatCard;
