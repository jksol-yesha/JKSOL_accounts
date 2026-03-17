import React from 'react';



const AuthLayout = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="-translate-y-12 md:-translate-y-14 bg-white w-full max-w-[430px] p-4 md:px-8 md:pt-5 md:pb-8 rounded-xl md:rounded-2xl shadow-sm">
                <div className="flex flex-col items-center mb-4 md:mb-6 text-center">
                    {/* Logo Placeholder */}
                    
                    <div className="h-28 flex items-center justify-center">
                        <img 
                            src='https://cdn.jkcdns.com/logo/jksol_120x120.jpg'
                            alt="Company Logo" 
                            className="w-24 h-24 object-contain"
                        />
                    </div>
                    {title && <h1 className="text-xl md:text-2xl font-bold text-black mb-1 md:mb-2">{title}</h1>}
                    {subtitle && <p className="text-xs md:text-base text-gray-500 text-center">{subtitle}</p>}
                </div>
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;
