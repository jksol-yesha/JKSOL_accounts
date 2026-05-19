import React from 'react';
import { cn } from '../../utils/cn';

const PageContentShell = ({
    header,
    children,
    className,
    contentClassName,
    cardClassName,
    hideHeaderOnPrint = true
}) => {
    return (
        <div className={cn("flex flex-col h-full min-h-0 overflow-y-auto lg:overflow-hidden", className)}>
            {header && (
                <div className={cn(hideHeaderOnPrint && "print:hidden")}>
                    {header}
                </div>
            )}

            <div
                className={cn(
                    "flex-1 min-h-0 p-4 lg:p-8 animate-in fade-in duration-500 overflow-visible lg:overflow-hidden flex items-start",
                    contentClassName
                )}
            >
                <div
                    className={cn(
                        "bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-visible lg:overflow-hidden w-full max-h-none lg:max-h-full min-h-0 flex flex-col",
                        cardClassName
                    )}
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

export default PageContentShell;
