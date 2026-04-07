import React from 'react';

const AuthLayout = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-900 relative">
            <div className="-translate-y-8 bg-white w-full max-w-[400px] p-6 md:p-8 rounded-lg shadow-sm border border-slate-200 border-t-4 border-t-emerald-600 z-10">
                <div className="flex flex-col items-center mb-6 text-center">
                    {/* Logo & Brand Name */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <img 
                            src='https://cdn.jkcdns.com/logo/jksol_120x120.jpg'
                            alt="JKACCOUNTS Logo" 
                            className="w-12 h-12 object-contain mb-3"
                        />
                        <div className="flex items-center gap-2.5 opacity-90">
                            {/* Icon Combination Group */}
                            <div className="relative flex items-center justify-center">
                                {/* Organization / Enterprise Skyline Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-800">
                                    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                                    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                                    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                                    <path d="M10 6h4" />
                                    <path d="M10 10h4" />
                                    <path d="M10 14h4" />
                                    <path d="M10 18h4" />
                                </svg>
                                
                                {/* Money / Rupee Overlay Badge */}
                                <div className="absolute -bottom-1 -right-1.5 bg-white rounded-full p-[1.5px] shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-emerald-600">
                                        <path d="M6 3h12" />
                                        <path d="M6 8h12" />
                                        <path d="m6 13 8.5 8" />
                                        <path d="M6 13h3" />
                                        <path d="M9 13c6.667 0 6.667-10 0-10" />
                                    </svg>
                                </div>
                            </div>
                            <span className="text-sm font-bold tracking-[0.2em] text-slate-800 uppercase ml-0.5">JKACCOUNTS</span>
                        </div>
                    </div>
                    {title && <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">{title}</h1>}
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
                {children}
            </div>

            {/* Subtle Enterprise Footer */}
            <div className="absolute bottom-6 left-0 w-full text-center px-4">
                <div className="flex flex-col items-center">
                    <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                        © {new Date().getFullYear()} JKACCOUNTS. Secure Financial Environment.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
