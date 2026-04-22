import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';

const PageHeader = ({ title, breadcrumbs, actionLabel, onAction, actionIcon = Plus, rightContent, mobileSticky = true, tabs, activeTab }) => {
    const navigate = useNavigate();
    const ActionIcon = actionIcon;

    return (
        <div className={cn(
            "bg-white w-full flex flex-col z-20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]",
            mobileSticky ? "sticky top-0" : "md:sticky md:top-0"
        )}>
            <div className="px-4 md:px-5 xl:px-6 py-2 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
            <div className="flex flex-col">
                <h2 className="text-[13px] font-extrabold text-slate-700 uppercase tracking-widest leading-none py-2">
                    {title}
                </h2>
                {/* Mobile Breadcrumbs (Stacked) */}
                {breadcrumbs && (
                    <div className="flex lg:hidden items-center space-x-2 text-[11px] font-semibold text-gray-500 mt-1">
                        {breadcrumbs.map((crumb, index) => {
                            const label = typeof crumb === 'object' ? crumb.label : crumb;
                            const path = typeof crumb === 'object' ? crumb.path : null;

                            return (
                                <React.Fragment key={index}>
                                    <span
                                        onClick={() => path && navigate(path)}
                                        className={cn(
                                            "hover:text-primary transition-colors",
                                            path && "cursor-pointer",
                                            index === breadcrumbs.length - 1 && "text-gray-400 pointer-events-none"
                                        )}
                                    >
                                        {label}
                                    </span>
                                    {index < breadcrumbs.length - 1 && <ChevronRight size={12} className="text-gray-400" />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between lg:justify-start gap-3 md:gap-4 flex-wrap w-full lg:w-auto">
                {/* Desktop Breadcrumbs (Right aligned) */}
                {breadcrumbs && (
                    <div className="hidden lg:flex items-center space-x-2 text-[15px] font-extrabold text-gray-500">
                        {breadcrumbs.map((crumb, index) => {
                            const label = typeof crumb === 'object' ? crumb.label : crumb;
                            const path = typeof crumb === 'object' ? crumb.path : null;

                            return (
                                <React.Fragment key={index}>
                                    <span
                                        onClick={() => path && navigate(path)}
                                        className={cn(
                                            "hover:text-primary transition-colors",
                                            path && "cursor-pointer",
                                            index === breadcrumbs.length - 1 && "text-gray-400 pointer-events-none"
                                        )}
                                    >
                                        {label}
                                    </span>
                                    {index < breadcrumbs.length - 1 && <ChevronRight size={15} className="text-gray-700" />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {/* Custom right content (e.g., connection status) */}
                {rightContent && (
                    <div className="flex items-center">
                        {rightContent}
                    </div>
                )}

                {actionLabel && (
                    <button
                        onClick={onAction}
                        className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white text-[12px] font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-slate-200 active:scale-95 w-full sm:w-auto"
                    >
                        <ActionIcon size={16} />
                        <span>{actionLabel}</span>
                    </button>
                )}
            </div>
            </div>
            
            {tabs && tabs.length > 0 && (
                <div className="px-4 md:px-5 xl:px-6 border-t border-slate-100/60 flex items-center gap-6 overflow-x-auto no-scrollbar">
                    {tabs.map((tab, idx) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (tab.path) navigate(tab.path);
                                    if (tab.onClick) tab.onClick();
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-1 py-3 text-[13px] font-bold whitespace-nowrap border-b-[3px] transition-colors relative top-[1px]",
                                    isActive 
                                        ? "border-primary text-primary" 
                                        : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                                )}
                            >
                                {tab.icon && <tab.icon size={16} />}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
