import React from 'react';
import { AlignLeft, ArrowRight, Menu } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useSidebarLayout } from './SidebarLayoutContext';

const SidebarToggleButton = ({ className, iconClassName, size = 18 }) => {
    const { isMobileViewport, isSidebarCollapsed, toggleSidebar } = useSidebarLayout();
    const Icon = isMobileViewport ? Menu : isSidebarCollapsed ? ArrowRight : AlignLeft;
    const ariaLabel = isMobileViewport
        ? 'Open sidebar'
        : isSidebarCollapsed
            ? 'Expand sidebar'
            : 'Collapse sidebar';

    return (
        <button
            type="button"
            onClick={toggleSidebar}
            aria-label={ariaLabel}
            className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-transparent text-slate-500 border border-transparent transition-all hover:bg-transparent hover:border-transparent hover:shadow-none',
                className
            )}
        >
            <Icon size={size} strokeWidth={2} className={cn('text-slate-500', iconClassName)} />
        </button>
    );
};

export default SidebarToggleButton;
