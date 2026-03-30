import React from 'react';
import { cn } from '../../utils/cn';

const Card = ({
    children,
    className,
    title,
    headerAction,
    noPadding = false,
    noHeaderBorder = false,
    style,
    headerClassName
}) => {
    return (
        <div className={cn(
            "bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden flex flex-col",
            className
        )} style={style}>
            {(title || headerAction) && (
                <div className={cn(
                    "px-6 py-4 flex items-center justify-between flex-none",
                    !noHeaderBorder && "border-b border-gray-50",
                    headerClassName
                )}>
                    {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
                    {headerAction}
                </div>
            )}
            <div className={cn(
                !noPadding && "p-6",
                "flex-1 min-h-0"
            )}>
                {children}
            </div>
        </div>
    );
};

export default Card;
