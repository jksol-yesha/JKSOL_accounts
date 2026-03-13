import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingOverlay = ({ label = 'Loading...', className = '' }) => {
    const classes = ['absolute inset-0 z-10 bg-white/35 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes} role="status" aria-live="polite" aria-label={label}>
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-gray-500">{label}</span>
        </div>
    );
};

export default LoadingOverlay;
