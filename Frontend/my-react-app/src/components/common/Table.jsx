import React from 'react';
import { cn } from '../../utils/cn';

const Table = ({
    headers,
    data,
    renderRow,
    className,
    tableClassName,
    style,
    stickyHeader = false
}) => {
    return (
        <div className={cn("overflow-x-auto w-full", className)}>
            <table className={cn("w-full text-sm text-left", tableClassName)} style={style}>
                <thead className={cn(
                    "text-xs text-gray-600 font-extrabold uppercase bg-gray-50 border-b border-gray-100",
                    stickyHeader && "sticky top-0 z-10"
                )}>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index} className="px-4 py-2 font-bold whitespace-nowrap">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                            {renderRow(item)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
