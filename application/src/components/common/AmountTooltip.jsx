import React from 'react';
import { cn } from '../../utils/cn';

export const AmountTooltip = ({
    amount,
    fullAmount,
    className,
    textClassName,
    tooltipClassName,
    position = 'top', // 'top' or 'bottom'
    align = 'left' // 'left' or 'right'
}) => {
    return (
        <div className={cn("group relative flex w-fit", className)}>
            <span className={cn("cursor-default", textClassName)}>
                {amount}
            </span>
            {fullAmount && (
                <div className={cn(
                    "pointer-events-none absolute opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-[60]",
                    position === 'top' ? 'bottom-full mb-2' : 'top-full mt-1.5',
                    align === 'left' ? 'left-0' : 'right-0',
                    tooltipClassName
                )}>
                    <div className="flex items-center whitespace-nowrap rounded-[4px] border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-md">
                        <span>{fullAmount}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
