import React from 'react';
import { Loader } from './Loader';

const LoadingOverlay = ({ label = 'Loading...', className = '' }) => {
    const classes = ['absolute inset-0 z-10 bg-white/35 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes} role="status" aria-live="polite" aria-label={label}>
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#4A8AF4]/30 bg-white/90 px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                <Loader className="h-8 w-8 text-[#4A8AF4]" />
            </div>
        </div>
    );
};

export default LoadingOverlay;
