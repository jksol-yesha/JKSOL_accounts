import React from 'react';

const SkeletonPulse = () => (
    <div className="animate-pulse bg-slate-200 rounded"></div>
);

const DashboardSkeleton = () => {
    return (
        <div className="flex flex-col gap-3 md:gap-4 xl:gap-3 p-0 animate-in fade-in duration-300">
            {/* Action Row Skeleton */}
            <div className="flex items-center justify-between mb-1 w-full gap-3">
                <div className="h-9 w-32 bg-slate-200 rounded animate-pulse"></div>
                <div className="flex gap-3">
                    <div className="h-9 w-48 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-9 w-32 bg-slate-200 rounded animate-pulse"></div>
                </div>
            </div>

            {/* Stat Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-start gap-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-white px-5 py-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-3 min-h-[110px]">
                        <div className="flex justify-between items-center mb-1">
                            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
                            <div className="h-4 w-8 bg-slate-100 rounded animate-pulse"></div>
                        </div>
                        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-3 w-16 bg-slate-100 rounded animate-pulse mt-auto"></div>
                    </div>
                ))}
            </div>

            {/* Section Skeleton (Rankings) */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm min-h-[340px] p-6 flex flex-col gap-6">
                <div className="h-5 w-48 bg-slate-200 rounded animate-pulse"></div>
                <div className="flex flex-col gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="flex gap-3 items-center">
                                <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse"></div>
                                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse"></div>
                            </div>
                            <div className="h-4 w-20 bg-slate-100 rounded animate-pulse"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Charts Row Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 xl:gap-4">
                <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm min-h-[380px] p-6 flex flex-col gap-6">
                    <div className="h-5 w-40 bg-slate-200 rounded animate-pulse"></div>
                    <div className="flex-1 bg-slate-50/50 rounded-lg flex items-center justify-center">
                         <div className="w-full h-full p-8 flex items-end gap-2">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="flex-1 bg-slate-200 rounded-t animate-pulse" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                            ))}
                         </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm min-h-[380px] p-6 flex flex-col gap-6">
                    <div className="h-5 w-40 bg-slate-200 rounded animate-pulse"></div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-48 h-48 rounded-full border-[12px] border-slate-100 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
