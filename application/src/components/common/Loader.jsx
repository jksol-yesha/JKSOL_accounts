import React from 'react';

export const Loader = ({ className = "h-5 w-5 text-emerald-400" }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" className={className}>
        <rect x="3" y="14" width="4" height="8" fill="currentColor" rx="1">
            <animate attributeName="height" values="8; 16; 8" dur="1s" repeatCount="indefinite" begin="0s" />
            <animate attributeName="y" values="14; 6; 14" dur="1s" repeatCount="indefinite" begin="0s" />
        </rect>
        <rect x="10" y="14" width="4" height="8" fill="currentColor" rx="1">
            <animate attributeName="height" values="8; 16; 8" dur="1s" repeatCount="indefinite" begin="0.15s" />
            <animate attributeName="y" values="14; 6; 14" dur="1s" repeatCount="indefinite" begin="0.15s" />
        </rect>
        <rect x="17" y="14" width="4" height="8" fill="currentColor" rx="1">
            <animate attributeName="height" values="8; 16; 8" dur="1s" repeatCount="indefinite" begin="0.3s" />
            <animate attributeName="y" values="14; 6; 14" dur="1s" repeatCount="indefinite" begin="0.3s" />
        </rect>
    </svg>
);

export const OverlayLoader = ({ 
    text = "Processing...", 
    containerClassName = "absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-[2px]" 
}) => (
    <div className={containerClassName}>
        <div className="flex flex-col items-center gap-3 bg-white px-8 py-6 rounded-xl shadow-lg border border-slate-100">
            <Loader className="h-8 w-8 text-emerald-600" />
            {text && <span className="text-xs font-bold tracking-widest text-slate-800 uppercase">{text}</span>}
        </div>
    </div>
);
