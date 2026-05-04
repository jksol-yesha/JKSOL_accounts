import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/cn';

const PageHeader = ({ title, breadcrumbs, actionLabel, onAction, actionIcon = Plus, rightContent, mobileSticky = true, tabs, activeTab, onBack }) => {
    const navigate = useNavigate();
    const ActionIcon = actionIcon;

    return (
        <div className={cn(
            "bg-white w-full flex flex-col z-20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]",
            mobileSticky ? "sticky top-0" : "md:sticky md:top-0"
        )}>

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
