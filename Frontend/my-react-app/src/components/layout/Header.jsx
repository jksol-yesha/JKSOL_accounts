import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, ChevronDown, Moon, User, AlignLeft, ArrowRight, LogOut, Lock, Building2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

import { useYear } from '../../context/YearContext';


import OrganizationSelector from './OrganizationSelector';
import { useOrganization } from '../../context/OrganizationContext';

const Header = ({ onMenuClick, isCollapsed, toggleSidebar }) => {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showYearMenu, setShowYearMenu] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );

    const [showLogoutDialog, setShowLogoutDialog] = useState(false);

    const { selectedYear, setSelectedYear, financialYears } = useYear();
    const { logout, user } = useAuth(); // Removed useBranch usage here as it's in BranchSelector
    const { selectedOrg } = useOrganization();
    const displayName = user?.name || user?.fullName || (user?.email ? String(user.email).split('@')[0] : 'User');
    const firstName = String(displayName || 'User').split(' ')[0];

    const navigate = useNavigate();
    const location = useLocation();
    const menuRef = useRef(null);
    const yearRef = useRef(null);
    const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
            if (yearRef.current && !yearRef.current.contains(event.target)) {
                setShowYearMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleResize = () => {
            setIsMobileViewport(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = () => {
        setShowLogoutDialog(true);
        setShowProfileMenu(false);
    };

    const confirmLogout = async () => {
        setShowLogoutDialog(false);
        await logout();
    };

    const handleYearSelect = (year) => {
        setSelectedYear(year);
        setShowYearMenu(false);
    };


    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-3 md:px-4 xl:px-6 sticky top-0 z-50 flex-none transition-colors">
            <div className="flex items-center gap-2 md:gap-3 xl:gap-4 flex-1 min-w-0">
                <button
                    onClick={isMobileViewport ? onMenuClick : toggleSidebar}
                    className="flex p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-lg"
                >
                    {isMobileViewport ? <Menu size={20} /> : isCollapsed ? <ArrowRight size={20} /> : <AlignLeft size={20} />}
                </button>




                {/* Year Selector */}
                <div className="relative ml-1 md:ml-2 shrink-0" ref={yearRef}>
                    <button
                        onClick={() => setShowYearMenu(!showYearMenu)}
                        className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 xl:px-3 bg-[#f1f3f9] rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                        <span className="text-sm font-medium text-gray-600">{selectedYear?.name || 'Select FY'}</span>
                        <ChevronDown size={14} className="text-gray-400" />
                    </button>

                    {/* Year Dropdown */}
                    {showYearMenu && (
                        <div className="absolute top-full left-0 mt-2 w-32 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                            <div className="px-1 space-y-1 max-h-60 overflow-y-auto">
                                {(financialYears || []).map((year) => (
                                    <button
                                        key={year.id}
                                        onClick={() => handleYearSelect(year)}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${selectedYear?.id === year.id
                                            ? 'text-primary bg-primary/5'
                                            : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        {year.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>



            </div>


            {/* Desktop: Branch Selector */}
            {/* Year Selector & Profile Group */}
            <div className="flex items-center gap-2 md:gap-3 xl:gap-4 ml-auto shrink-0">






                {/* Profile */}
                <div className="relative pl-2 md:pl-3" ref={menuRef}>
                    <button
                        className="flex items-center gap-2 xl:gap-3 px-2 py-1.5 xl:px-3 bg-[#f1f3f9] rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                    >
                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                            {user?.profilePhoto ? (
                                <img
                                    src={user.profilePhoto}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User size={18} className="text-gray-400" />
                            )}
                        </div>
                        <div className="hidden sm:block text-left">
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[14px] font-bold text-slate-700 mb-1">{displayName}</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[12px] font-medium text-slate-500 capitalize">{selectedOrg?.role || user?.role || 'Member'}</span>
                                    <ChevronDown size={12} className="text-slate-400" />
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Profile Dropdown */}
                    {showProfileMenu && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-2 py-2 space-y-1">
                                <div className="px-3 py-2 text-sm font-medium text-gray-500">
                                    Welcome {firstName}!
                                </div>
                                <div className="h-px bg-gray-100 my-1 mx-2"></div>

                                <button
                                    onClick={() => {
                                        navigate('/profile');
                                        setShowProfileMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors group"
                                >
                                    <User size={18} className="text-gray-400 group-hover:text-gray-600" />
                                    <span>Profile</span>
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors group"
                                >
                                    <LogOut size={18} className="text-gray-400 group-hover:text-rose-500" />
                                    <span>Log Out</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>



            {/* Logout Confirmation Dialog */}
            {showLogoutDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                    <LogOut size={24} className="text-gray-700" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Log Out</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">Are you sure you want to log out?</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowLogoutDialog(false)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmLogout}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    Yes, Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header >
    );
};

export default Header;
