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
                        <div className="flex items-center justify-center opacity-90">
                            <span className="text-sm font-bold tracking-[0.2em] text-slate-800 uppercase">JKACCOUNTS</span>
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
                        © {new Date().getFullYear()} JKACCOUNTS
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
