import React from 'react';
import { Loader } from './Loader';

const LoadingOverlay = ({ label = 'Loading...', className = '' }) => {
    const classes = ['absolute inset-0 z-10 bg-white/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes} role="status" aria-live="polite" aria-label={label}>
            <Loader className="h-5 w-5 text-[#4A8AF4]" />
        </div>
    );
};

export default LoadingOverlay;
