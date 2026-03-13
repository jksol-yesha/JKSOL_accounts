import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';
import Button from '../common/Button';

const PageHeader = ({ title, breadcrumbs, actionLabel, onAction, actionIcon: Icon = Plus, rightContent, mobileSticky = true }) => {
    const navigate = useNavigate();

    return (
        <div className={cn(
            "bg-white border-b border-gray-100 px-4 md:px-5 xl:px-6 py-2 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 z-20 shadow-sm",
            mobileSticky ? "sticky top-0" : "md:sticky md:top-0"
        )}>
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
                        <Icon size={16} />
                        <span>{actionLabel}</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default PageHeader;
