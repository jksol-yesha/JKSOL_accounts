import React from 'react';
import { Loader } from '../../../components/common/Loader';

const DashboardSkeleton = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[600px] bg-slate-50/90 backdrop-blur-sm rounded-xl border border-slate-100 shadow-sm mt-2 relative z-[100]">
            <Loader className="h-8 w-8 text-[#4A8AF4] mb-4" strokeWidth={2} />
            <h3 className="text-base font-semibold text-slate-800 mb-1">Loading Dashboard</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm">
                Preparing your financial overview...
            </p>
        </div>
    );
};

export default DashboardSkeleton;
