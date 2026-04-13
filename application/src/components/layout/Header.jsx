import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, User, AlignLeft, ArrowRight, LogOut, X, Edit2, Check, AlertCircle, Calendar, ChevronRight, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

import { useYear } from '../../context/YearContext';
import { useOrganization } from '../../context/OrganizationContext';
import { usePreferences } from '../../context/PreferenceContext';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';

const dateFormats = [
    { value: 'DD MMM, YYYY (d M, Y)', label: '08 Jan, 2026' },
    { value: 'MM/DD/YYYY', label: '01/08/2026' },
    { value: 'YYYY-MM-DD', label: '2026-01-08' },
    { value: 'DD/MM/YYYY', label: '08/01/2026' },
];

const numberFormats = [
    { value: 'en-US', label: '1,234.56 (US)' },
    { value: 'de-DE', label: '1.234,56 (EU)' },
    { value: 'fr-CH', label: '1 234.56 (SI)' },
    { value: 'en-IN', label: '1,23,456.78 (IN)' },
];

const timeZones = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney' },
    { value: 'UTC', label: 'UTC' },
];

const Header = ({ onMenuClick, isCollapsed, toggleSidebar }) => {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showYearMenu, setShowYearMenu] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );

    const { selectedYear, setSelectedYear, financialYears } = useYear();
    const { logout, user, updateUser } = useAuth();
    
    const { selectedOrg } = useOrganization();
    const { preferences, updatePreferences } = usePreferences();
    const { currencyOptions } = useCurrencyOptions();
    const displayName = user?.name || user?.fullName || (user?.email ? String(user.email).split('@')[0] : 'User');
    const firstName = String(displayName || 'User').split(' ')[0];

    const navigate = useNavigate();
    const menuRef = useRef(null);
    const yearRef = useRef(null);

    const [activeEditField, setActiveEditField] = useState(null);
    const [tempDisplayName, setTempDisplayName] = useState(displayName);
    const [tempEmail, setTempEmail] = useState(user?.email || '');
    const [draftPreferences, setDraftPreferences] = useState(preferences || {});
    const [isSaving, setIsSaving] = useState(false);
    const [isPreferencesExpanded, setIsPreferencesExpanded] = useState(false);
    const [openPrefDropdown, setOpenPrefDropdown] = useState(null);
    const [tempProfilePhoto, setTempProfilePhoto] = useState(user?.profilePhoto || null);
    const [verifyLogout, setVerifyLogout] = useState(false);
    
    const fileInputRef = useRef(null);
    const logoutRef = useRef(null);
    
    const hasPreferenceChanges = JSON.stringify(draftPreferences) !== JSON.stringify(preferences || {});
    const hasChanges = tempDisplayName !== displayName || tempEmail !== (user?.email || '') || hasPreferenceChanges || tempProfilePhoto !== (user?.profilePhoto || null);

    useEffect(() => {
        if (!showProfileMenu) {
            setTempDisplayName(displayName);
            setTempEmail(user?.email || '');
            setTempProfilePhoto(user?.profilePhoto || null);
            setDraftPreferences(preferences || {});
            setActiveEditField(null);
            setIsPreferencesExpanded(false);
            setOpenPrefDropdown(null);
        }
    }, [showProfileMenu, displayName, user?.email, user?.profilePhoto, preferences]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) return;
            const reader = new FileReader();
            reader.onloadend = () => {
                setTempProfilePhoto(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePreferenceChange = (e) => {
        const { name, value } = e.target;
        setDraftPreferences(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async () => {
        if (!hasChanges) return;
        setIsSaving(true);
        try {
            if (tempDisplayName !== displayName || tempEmail !== (user?.email || '') || tempProfilePhoto !== (user?.profilePhoto || null)) {
                await updateUser({
                    name: tempDisplayName !== displayName ? tempDisplayName : undefined,
                    email: tempEmail !== (user?.email || '') ? tempEmail : undefined,
                    profilePhoto: tempProfilePhoto !== (user?.profilePhoto || null) ? tempProfilePhoto : undefined
                });
            }
            if (hasPreferenceChanges) {
               const changedPrefs = Object.entries(draftPreferences || {}).reduce((acc, [key, value]) => {
                   if (preferences?.[key] !== value) acc[key] = value;
                   return acc;
               }, {});
               if (Object.keys(changedPrefs).length > 0) {
                   await updatePreferences(changedPrefs);
               }
            }
            setActiveEditField(null);
            setIsPreferencesExpanded(false);
            setOpenPrefDropdown(null);
            setShowProfileMenu(false);
        } catch (error) {
            console.error('Failed to save profile changes', error);
        } finally {
            setIsSaving(false);
        }
    };

    const renderPrefSelect = (name, label, options, currentValue) => {
        const isOpen = openPrefDropdown === name;
        return (
            <div className="relative flex items-center justify-between py-1.5 group/pref hover:bg-slate-50/80 rounded px-2 -mx-2 transition-colors cursor-pointer" onClick={() => setOpenPrefDropdown(isOpen ? null : name)}>
                <label className="text-[11px] font-semibold text-slate-500 shrink-0 mr-4 cursor-pointer mb-0">{label}</label>
                <div className="flex items-center justify-end flex-1 min-w-0">
                    <span className="text-[12px] font-bold text-slate-800 truncate pr-1.5 text-right">{options.find(o => o.value === currentValue)?.label || currentValue}</span>
                    <ChevronDown size={14} strokeWidth={2.5} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[55]" onClick={(e) => { e.stopPropagation(); setOpenPrefDropdown(null); }} />
                        <div className="absolute top-[110%] right-0 min-w-[160px] max-w-[220px] bg-white border border-slate-200 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] py-1.5 z-[60] max-h-48 overflow-y-auto no-scrollbar animate-in zoom-in-95 fade-in duration-150">
                            {options.map(opt => {
                                const isSelected = currentValue === opt.value;
                                return (
                                    <div 
                                        key={opt.value}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handlePreferenceChange({ target: { name, value: opt.value } });
                                            setOpenPrefDropdown(null);
                                        }}
                                        className={`px-3 py-1.5 text-[11px] font-bold flex items-center justify-between hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}
                                    >
                                        <span className="truncate pr-2">{opt.label}</span>
                                        {isSelected && <Check size={14} strokeWidth={3} className="shrink-0 text-emerald-600" />}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        );
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
            if (yearRef.current && !yearRef.current.contains(event.target)) {
                setShowYearMenu(false);
            }
            if (logoutRef.current && !logoutRef.current.contains(event.target)) {
                setVerifyLogout(false);
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

    const confirmLogout = async () => {
        await logout();
    };

    const handleYearSelect = (year) => {
        setSelectedYear(year);
        setShowYearMenu(false);
    };


    return (
        <header className={cn(
            "bg-[#f1f4f8] h-[72px] flex items-center justify-between px-3 md:px-4 xl:px-6 sticky top-0 z-50 flex-none transition-colors print:hidden no-print"
        )}>
            <div className="flex items-center gap-2 md:gap-3 xl:gap-4 flex-1 min-w-0">
                <button
                    onClick={isMobileViewport ? onMenuClick : toggleSidebar}
                    className="flex p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-lg"
                >
                    {isMobileViewport ? <Menu size={20} /> : isCollapsed ? <ArrowRight size={20} /> : <AlignLeft size={20} />}
                </button>




                {/* Year Selector removed locally, relying on dashboard tools for date bounds */}



            </div>


            {/* Desktop: Branch Selector */}
            {/* Year Selector & Profile Group */}
            <div className="flex items-center ml-auto shrink-0">

                {/* Vertical Divider */}
                <div className="h-8 w-px bg-slate-200 hidden md:block mr-2 md:mr-3"></div>

                {/* Profile Container */}
                <div className="relative flex items-center justify-end gap-1.5" ref={menuRef}>
                    <button
                        className="flex items-center gap-2 cursor-pointer group transition-all rounded-full hover:bg-slate-50 focus:ring-2 focus:ring-emerald-500/20 pr-1 py-1"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                    >
                        <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-white ring-1 ring-slate-200 shadow-sm group-hover:ring-emerald-400 group-hover:shadow transition-all">
                            {user?.profilePhoto ? (
                                <img
                                    src={user.profilePhoto}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-[13px] font-bold text-slate-600 group-hover:text-emerald-700 transition-colors">{(tempDisplayName || firstName).charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <ChevronDown size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors hidden sm:block mr-1" />
                    </button>

                    {/* Standalone Logout Button */}
                    <div className="relative" ref={logoutRef}>
                        <button 
                             onClick={() => setVerifyLogout(!verifyLogout)}
                             className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                             title="Sign Out"
                        >
                             <LogOut size={16} strokeWidth={2}/>
                        </button>
                        {verifyLogout && (
                            <div className="absolute top-full right-0 mt-3 min-w-[240px] bg-white border border-slate-200 rounded-sm shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-3 z-[60] animate-in fade-in slide-in-from-top-2 duration-150">
                                <p className="text-[12px] font-semibold text-slate-800 mb-3 leading-tight">Are you sure?</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setVerifyLogout(false)} className="flex-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-bold py-1.5 rounded-sm transition-colors outline-none cursor-pointer">No, Cancel</button>
                                    <button onClick={confirmLogout} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold py-1.5 rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer">Yes, Sign Out</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Inline Profile Editor Popup */}
                    {showProfileMenu && (
                        <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 py-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                            
                            {/* Top Corner Utilities */}
                            <div className="absolute top-3 left-4 flex gap-2 z-10">
                                {hasChanges && (
                                    <button 
                                        onClick={handleSaveProfile} 
                                        disabled={isSaving} 
                                        className="flex items-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-colors disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : <><Check size={10} strokeWidth={3} /> Save</>}
                                    </button>
                                )}
                            </div>

                            <button 
                                onClick={() => setShowProfileMenu(false)}
                                className="absolute top-3 right-4 text-slate-300 hover:text-slate-500 transition-colors z-10 p-1 rounded-sm hover:bg-slate-50"
                            >
                                <X size={16} />
                            </button>

                            {/* Header Image Area */}
                            <div className="flex flex-col items-center justify-center mb-5 pt-2">
                                <div 
                                    className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden text-slate-400 border border-slate-200 shadow-sm relative group cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {tempProfilePhoto ? (
                                        <img src={tempProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={32} strokeWidth={1.5} />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera size={18} className="text-white drop-shadow-md" />
                                    </div>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                            </div>
                            
                            {/* Form Fields */}
                            <div className="px-6 space-y-4">
                                {/* Name Field */}
                                <div className="group/field relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                                    <div className="flex items-center justify-between">
                                        {activeEditField === 'name' ? (
                                            <input 
                                                value={tempDisplayName}
                                                onChange={(e) => setTempDisplayName(e.target.value)}
                                                autoFocus
                                                className="w-full text-[14px] font-semibold text-slate-900 border-b border-emerald-500 bg-emerald-50/50 px-1 py-0.5 focus:outline-none"
                                            />
                                        ) : (
                                            <>
                                                <span className="text-[14px] font-bold text-slate-900 truncate px-1">{tempDisplayName}</span>
                                                <button onClick={() => setActiveEditField('name')} className="text-slate-300 hover:text-emerald-600 opacity-0 group-hover/field:opacity-100 transition-all p-1 rounded hover:bg-slate-50">
                                                    <Edit2 size={12} strokeWidth={2.5}/>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Email Field */}
                                <div className="group/field relative">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Email Address</label>
                                    <div className="flex items-center justify-between">
                                        {activeEditField === 'email' ? (
                                            <input 
                                                value={tempEmail}
                                                onChange={(e) => setTempEmail(e.target.value)}
                                                autoFocus
                                                className="w-full text-[13px] text-slate-800 border-b border-emerald-500 bg-emerald-50/50 px-1 py-0.5 focus:outline-none"
                                            />
                                        ) : (
                                            <>
                                                <span className="text-[13px] text-slate-600 truncate px-1">{tempEmail}</span>
                                                <button onClick={() => setActiveEditField('email')} className="text-slate-300 hover:text-emerald-600 opacity-0 group-hover/field:opacity-100 transition-all p-1 rounded hover:bg-slate-50">
                                                    <Edit2 size={12} strokeWidth={2.5}/>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Preferences Menu (Minimal Inline) */}
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <div 
                                        className="flex items-center justify-between mb-1.5 cursor-pointer group/acc"
                                        onClick={() => setIsPreferencesExpanded(!isPreferencesExpanded)}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <ChevronDown size={14} strokeWidth={2.5} className={`text-slate-400 transition-transform ${isPreferencesExpanded ? '' : '-rotate-90'} group-hover/acc:text-slate-600`} />
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover/acc:text-slate-700 transition-colors">Preferences</p>
                                        </div>
                                        {hasPreferenceChanges && (
                                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-wider">Edited</span>
                                        )}
                                    </div>
                                    
                                    {isPreferencesExpanded && (
                                        <div className="space-y-0.5 mt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                           {renderPrefSelect('currency', 'Currency', currencyOptions.map(c => ({ value: c.code, label: c.label })), draftPreferences.currency || 'INR')}
                                           {renderPrefSelect('dateFormat', 'Date Format', dateFormats, draftPreferences.dateFormat)}
                                           {renderPrefSelect('numberFormat', 'Number Format', numberFormats, draftPreferences.numberFormat)}
                                           {renderPrefSelect('timeZone', 'Time Zone', timeZones, draftPreferences.timeZone)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>




        </header >
    );
};

export default Header;
