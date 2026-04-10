import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    X,
    LogOut,
    ChevronDown,
    User as UserIcon,
    Edit2,
    Check,
    Camera
} from 'lucide-react';
import {
    Home,
    Landmark,
    ShoppingBag,
    Users,
    ArrowRightLeft,
    BarChart2,
    History
} from 'lucide-react';
import { cn } from '../../utils/cn';
import OrganizationSelector from './OrganizationSelector';
import { useOrganization } from '../../context/OrganizationContext';
import { usePreferences } from '../../context/PreferenceContext';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';

import { useAuth } from '../../context/AuthContext'; // Import useAuth

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

const Sidebar = ({ isCollapsed, isOpen, onClose, className }) => {
    const [isTabletViewport, setIsTabletViewport] = React.useState(false);
    const [isMobileViewport, setIsMobileViewport] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    const [hoveredItem, setHoveredItem] = React.useState(null);
    const [showProfileMenu, setShowProfileMenu] = React.useState(false);
    const [activeEditField, setActiveEditField] = React.useState(null);
    const [tempDisplayName, setTempDisplayName] = React.useState('');
    const [tempEmail, setTempEmail] = React.useState('');
    const [draftPreferences, setDraftPreferences] = React.useState({});
    const [isSaving, setIsSaving] = React.useState(false);
    const [isPreferencesExpanded, setIsPreferencesExpanded] = React.useState(false);
    const [openPrefDropdown, setOpenPrefDropdown] = React.useState(null);
    const [prefDropdownRect, setPrefDropdownRect] = React.useState(null);
    const [tempProfilePhoto, setTempProfilePhoto] = React.useState(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const sidebarRef = React.useRef(null);
    const profileMenuRef = React.useRef(null);
    const logoutConfirmRef = React.useRef(null);
    const fileInputRef = React.useRef(null);
    const prefSelectRefs = React.useRef({});
    const location = useLocation();
    const { selectedOrg } = useOrganization();
    const { user, logout, updateUser } = useAuth();
    const { preferences, updatePreferences } = usePreferences();
    const { currencyOptions } = useCurrencyOptions();
    const effectiveCollapsed = isMobileViewport ? false : isCollapsed;
    const showHoverExpandPanel = effectiveCollapsed && !isMobileViewport;
    const getFormattedName = (name) => {
        if (!name) return '';
        const parts = String(name).trim().split(/\s+/);
        if (parts.length < 2) return parts[0];
        const firstName = parts[0];
        const lastNameFirstChar = parts[1].charAt(0).toUpperCase();
        return `${firstName} ${lastNameFirstChar}.`;
    };

    const rawName = user?.name || user?.fullName || (user?.email ? String(user.email).split('@')[0] : 'User');
    const displayName = getFormattedName(rawName);
    const hasPreferenceChanges = JSON.stringify(draftPreferences) !== JSON.stringify(preferences || {});
    const hasChanges =
        tempDisplayName !== displayName ||
        tempEmail !== (user?.email || '') ||
        hasPreferenceChanges ||
        tempProfilePhoto !== (user?.profilePhoto || null);

    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 768px) and (max-width: 1024px)');
        const updateTabletState = (event) => {
            setIsTabletViewport(event.matches);
        };

        updateTabletState(mediaQuery);
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updateTabletState);
            return () => mediaQuery.removeEventListener('change', updateTabletState);
        }

        mediaQuery.addListener(updateTabletState);
        return () => mediaQuery.removeListener(updateTabletState);
    }, []);

    React.useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleResize = () => {
            setIsMobileViewport(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    React.useEffect(() => {
        if (!showHoverExpandPanel) {
            setHoveredItem(null);
        }
    }, [showHoverExpandPanel]);

    React.useEffect(() => {
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

    React.useEffect(() => {
        if (isMobileViewport && !isOpen) {
            setShowProfileMenu(false);
        }
    }, [isMobileViewport, isOpen]);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
                setOpenPrefDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



    const handleItemHover = (event, item, isActive = false) => {
        if (!showHoverExpandPanel || !sidebarRef.current) return;

        const itemRect = event.currentTarget.getBoundingClientRect();
        const sidebarRect = sidebarRef.current.getBoundingClientRect();

        setHoveredItem({
            label: item.label,
            icon: item.icon,
            isActive,
            left: itemRect.left - sidebarRect.left,
            top: itemRect.top - sidebarRect.top + (itemRect.height / 2),
            width: itemRect.width,
            height: itemRect.height
        });
    };

    const clearHoveredItem = () => {
        if (showHoverExpandPanel) {
            setHoveredItem(null);
        }
    };

    const handleLogout = () => {
        setHoveredItem(null);
        setShowLogoutConfirm(true);
        setShowProfileMenu(false);
    };

    const cancelLogout = () => {
        setShowLogoutConfirm(false);
    };

    const handleActualLogout = async () => {
        setIsSaving(true);
        try {
            onClose?.();
            await logout();
        } finally {
            setIsSaving(false);
        }
    };

    const handleProfileClick = () => {
        setHoveredItem(null);
        setShowLogoutConfirm(false);
        setShowProfileMenu((current) => !current);
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setTempProfilePhoto(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handlePreferenceChange = (event) => {
        const { name, value } = event.target;
        setDraftPreferences((previous) => ({ ...previous, [name]: value }));
    };

    const handleSaveProfile = async () => {
        if (!hasChanges) return;

        setIsSaving(true);
        try {
            if (
                tempDisplayName !== displayName ||
                tempEmail !== (user?.email || '') ||
                tempProfilePhoto !== (user?.profilePhoto || null)
            ) {
                await updateUser({
                    name: tempDisplayName !== displayName ? tempDisplayName : undefined,
                    email: tempEmail !== (user?.email || '') ? tempEmail : undefined,
                    profilePhoto: tempProfilePhoto !== (user?.profilePhoto || null) ? tempProfilePhoto : undefined,
                });
            }

            if (hasPreferenceChanges) {
                const changedPreferences = Object.entries(draftPreferences || {}).reduce((accumulator, [key, value]) => {
                    if (preferences?.[key] !== value) {
                        accumulator[key] = value;
                    }
                    return accumulator;
                }, {});

                if (Object.keys(changedPreferences).length > 0) {
                    await updatePreferences(changedPreferences);
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
        const selectedLabel = options.find((option) => option.value === currentValue)?.label || currentValue;

        const handleTriggerClick = (event) => {
            if (isOpen) {
                setOpenPrefDropdown(null);
                setPrefDropdownRect(null);
            } else {
                const rect = event.currentTarget.getBoundingClientRect();
                const availableHeight = window.innerHeight - rect.bottom - 8;
                const maxHeight = Math.min(180, Math.max(80, availableHeight));
                setPrefDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight });
                setOpenPrefDropdown(name);
            }
        };

        return (
            <div className="w-full">
                <div
                    className="group/pref px-6 py-1.5 transition-colors cursor-pointer hover:bg-slate-50/90"
                    onClick={handleTriggerClick}
                >
                    <div className="flex items-center justify-between gap-x-3">
                        <span className="min-w-0 text-[12px] font-bold text-[#1e293b] leading-5 whitespace-nowrap overflow-hidden text-ellipsis">
                            {selectedLabel}
                        </span>
                        <ChevronDown
                            size={14}
                            strokeWidth={2.5}
                            className={cn('shrink-0 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')}
                        />
                    </div>
                </div>

                {isOpen && prefDropdownRect && (
                    <>
                        <div
                            className="fixed inset-0 z-[195]"
                            onClick={(event) => {
                                event.stopPropagation();
                                setOpenPrefDropdown(null);
                                setPrefDropdownRect(null);
                            }}
                        />
                        <div
                            className="fixed bg-white z-[200] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-slate-100 py-1"
                            style={{
                                top: prefDropdownRect.top,
                                left: prefDropdownRect.left,
                                width: prefDropdownRect.width,
                                maxHeight: prefDropdownRect.maxHeight,
                            }}
                        >
                            {options.map((option) => {
                                const isSelected = currentValue === option.value;
                                return (
                                    <div
                                        key={option.value}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handlePreferenceChange({ target: { name, value: option.value } });
                                            setOpenPrefDropdown(null);
                                            setPrefDropdownRect(null);
                                        }}
                                        className={cn(
                                            'px-6 py-1.5 text-[12px] font-bold flex items-center justify-between gap-3 cursor-pointer transition-colors',
                                            isSelected ? 'bg-[#f0fdf4] text-[#0f172a]' : 'text-[#1e293b] hover:bg-[#f0fdf4]'
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 whitespace-normal break-words pr-2 leading-5">{option.label}</span>
                                        {isSelected && <Check size={14} strokeWidth={2.5} className="shrink-0 text-[#10b981]" />}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        );
    };

    const menuItems = [
        { icon: Home, label: 'Home', path: '/dashboard', permission: 'DASHBOARD_VIEW' },
        { icon: Landmark, label: 'Accounts', path: '/accounts' },
        { icon: ArrowRightLeft, label: 'Transactions', path: '/transactions', permission: 'TXN_VIEW' },
        { icon: Users, label: 'Parties', path: '/parties' },
        { icon: ShoppingBag, label: 'Items', path: '/category', permission: 'CATEGORY_MANAGE' },
        { icon: BarChart2, label: 'Reports', path: '/reports', permission: 'REPORT_VIEW' },
        { icon: History, label: 'Activity', path: '/audit-logs' },
    ];

    const filteredMenuItems = menuItems.filter(item => {
        // specific role check for Audit Log
        if (item.label === 'Audit Logs') {
            const orgRole = selectedOrg?.role?.toLowerCase();
            const globalRole = user?.globalRole?.toLowerCase();
            return ['owner', 'admin'].includes(orgRole) || ['owner', 'admin'].includes(globalRole);
        }

        // Optional: If we want to enforce other permissions later, this is where that gate would live.
        // Leaving this out for now to ensure I don't break existing navigation that might rely on loose permissions.

        return true;
    });

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-[60] md:hidden backdrop-blur-md transition-opacity"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-[70] w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 h-full overflow-visible",
                isTabletViewport ? (effectiveCollapsed ? "md:w-[78px]" : "md:w-64") : (isCollapsed && "lg:w-20"),
                !isOpen && "-translate-x-full md:translate-x-0",
                className
            )} ref={sidebarRef}>
                <div className={cn(
                    "flex flex-col pt-4 mb-2 flex-none",
                    effectiveCollapsed ? "items-center px-2" : "px-3"
                )}>
                    <OrganizationSelector isCollapsed={effectiveCollapsed} />
                </div>

                {/* Mobile Close Button */}
                <button
                    onClick={onClose}
                    className="md:hidden p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors absolute top-4 right-4"
                >
                    <X size={20} />
                </button>

                {/* Navigation */}
                <div className={cn(
                    "flex-1 overflow-y-auto overflow-x-visible py-2 px-3 space-y-1 custom-scrollbar",
                    effectiveCollapsed && "no-scrollbar px-2"
                )}>

                    {/* Menu Label Removed for Minimalism */}

                    {filteredMenuItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onMouseEnter={(event) => handleItemHover(event, item, isActive)}
                                onMouseLeave={clearHoveredItem}
                                className={() => cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group relative border border-transparent",
                                    isActive
                                        ? "bg-emerald-50/70 text-emerald-800 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.02)] border-emerald-100/50"
                                        : "text-slate-500 hover:text-emerald-800 hover:bg-emerald-50/50",
                                    effectiveCollapsed && "justify-center px-2 md:px-2.5",
                                    showHoverExpandPanel && "overflow-visible",
                                    showHoverExpandPanel && !isActive && "group-hover:rounded-r-none"
                                )}
                            >
                                <item.icon
                                    size={18}
                                    strokeWidth={1.5}
                                    className={cn(
                                        "shrink-0 transition-colors",
                                        isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500"
                                    )}
                                />

                                {!effectiveCollapsed && (
                                    <span className={cn(
                                        "text-[13px] tracking-tight sidebar-laptop-item-label",
                                        isActive ? "font-bold" : "font-semibold"
                                    )}>{item.label}</span>
                                )}

                                {/* Tooltip for collapsed state */}
                                {effectiveCollapsed && (
                                    !showHoverExpandPanel ? (
                                        <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                            {item.label}
                                        </div>
                                    ) : null
                                )}
                            </NavLink>
                        );
                    })}
                </div>

                <div className="flex-none">
                    <div className="relative w-full" ref={profileMenuRef}>
                        <button
                            type="button"
                            onClick={handleProfileClick}
                            onMouseEnter={(event) => handleItemHover(event, { label: 'Profile', icon: UserIcon })}
                            onMouseLeave={clearHoveredItem}
                            className={cn(
                                "flex h-10 w-full items-center transition-all duration-200 group relative border border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/80",
                                effectiveCollapsed ? "justify-center px-4" : "gap-3.5 px-6",
                                showHoverExpandPanel && "overflow-visible",
                                location.pathname.startsWith('/profile') && "bg-white text-slate-800 shadow-sm border-slate-200"
                            )}
                        >
                            {!effectiveCollapsed && (
                                <>
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                                        {user?.profilePhoto ? (
                                            <img
                                                src={user.profilePhoto}
                                                alt={displayName}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-[11px] font-bold text-slate-600">
                                                {String(displayName).charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <span className="min-w-0 flex-1 truncate text-left text-[13px] tracking-tight sidebar-laptop-item-label font-semibold">
                                        {displayName}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        strokeWidth={2.2}
                                        className={cn(
                                            "ml-auto shrink-0 text-slate-400 transition-all duration-300",
                                            (showProfileMenu || showLogoutConfirm) && "rotate-180 text-primary-500"
                                        )}
                                    />
                                </>
                            )}

                            {effectiveCollapsed && (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                                    {user?.profilePhoto ? (
                                        <img
                                            src={user.profilePhoto}
                                            alt={displayName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-[11px] font-bold text-slate-600">
                                            {String(displayName).charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            )}

                            {effectiveCollapsed && (
                                !showHoverExpandPanel ? (
                                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                        Profile
                                    </div>
                                ) : null
                            )}
                        </button>

                        {showProfileMenu && !effectiveCollapsed && (
                            <div className="bg-white animate-in slide-in-from-top-2 duration-200 relative w-full border-t border-slate-100">
                                <div className="relative">
                                    {hasChanges && (
                                        <button
                                            type="button"
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className="absolute left-6 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Check size={11} strokeWidth={3} />
                                            <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                        </button>
                                    )}

                                    {/* Avatar centered at top */}
                                    <div className="flex justify-center pt-4 pb-2">
                                        <div
                                            className="group/avatar relative flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[2px] border-white bg-slate-100 text-slate-400 shadow-[0_4px_12px_rgb(15,23,42,0.1)] cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {tempProfilePhoto ? (
                                                <img src={tempProfilePhoto} alt="Profile" className="h-full w-full object-cover" />
                                            ) : (
                                                <UserIcon size={22} strokeWidth={1.5} />
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 opacity-0 transition-opacity group-hover/avatar:opacity-100">
                                                <Camera size={15} className="text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>

                                    {/* Name + Email left-aligned */}
                                    <div className="px-6 pb-3 space-y-0.5">
                                        {activeEditField === 'name' ? (
                                            <input
                                                value={tempDisplayName}
                                                onChange={(event) => setTempDisplayName(event.target.value)}
                                                onBlur={() => setActiveEditField((current) => (current === 'name' ? null : current))}
                                                autoFocus
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-bold text-slate-900 shadow-sm transition-colors focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
                                            />
                                        ) : (
                                            <div className="group/name flex items-center gap-2">
                                                <p className="min-w-0 flex-1 text-[14px] font-bold text-[#1e293b] leading-5 tracking-tight">
                                                    {tempDisplayName}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveEditField('name')}
                                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 pointer-events-none transition-all duration-200 group-hover/name:opacity-100 group-hover/name:pointer-events-auto hover:bg-slate-50 hover:text-slate-600"
                                                >
                                                    <Edit2 size={13} strokeWidth={2} />
                                                </button>
                                            </div>
                                        )}

                                        {activeEditField === 'email' ? (
                                            <input
                                                value={tempEmail}
                                                onChange={(event) => setTempEmail(event.target.value)}
                                                onBlur={() => setActiveEditField((current) => (current === 'email' ? null : current))}
                                                autoFocus
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-700 shadow-sm transition-colors focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
                                            />
                                        ) : (
                                            <div className="group/email flex items-center gap-2">
                                                <p className="min-w-0 flex-1 break-all text-[12px] font-semibold text-slate-500 leading-5">
                                                    {tempEmail || 'No email added'}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveEditField('email')}
                                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 pointer-events-none transition-all duration-200 group-hover/email:opacity-100 group-hover/email:pointer-events-auto hover:bg-slate-50 hover:text-slate-600"
                                                >
                                                    <Edit2 size={13} strokeWidth={2} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative border-t border-slate-100 pt-2 flex flex-col w-full">
                                        {isPreferencesExpanded && (
                                            <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 px-6">
                                                    Preferences
                                                </p>
                                                <div className="space-y-0.5">
                                                    {renderPrefSelect(
                                                        'currency',
                                                        'Currency',
                                                        currencyOptions.map((currency) => ({ value: currency.code, label: currency.label })),
                                                        draftPreferences.currency || 'INR'
                                                    )}
                                                    {renderPrefSelect('dateFormat', 'Date Format', dateFormats, draftPreferences.dateFormat)}
                                                    {renderPrefSelect('numberFormat', 'Number Format', numberFormats, draftPreferences.numberFormat)}
                                                    {renderPrefSelect('timeZone', 'Time Zone', timeZones, draftPreferences.timeZone)}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            className="group/acc flex w-full cursor-pointer items-center justify-between py-2 px-6 text-left hover:bg-slate-50"
                                            onClick={() => {
                                                setOpenPrefDropdown(null);
                                                setIsPreferencesExpanded((current) => !current);
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <ChevronDown
                                                    size={13}
                                                    strokeWidth={2.5}
                                                    className={cn(
                                                        'text-slate-400 transition-transform duration-200',
                                                        !isPreferencesExpanded && '-rotate-90'
                                                    )}
                                                />
                                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 transition-colors group-hover/acc:text-slate-700">
                                                    User Preferences
                                                </p>
                                            </div>

                                        </button>


                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-100" />

                    {showLogoutConfirm && !effectiveCollapsed && (
                        <div
                            ref={logoutConfirmRef}
                            className="bg-white px-5 py-4 animate-in slide-in-from-top-2 duration-300 border-b border-slate-100"
                        >
                            <p className="text-[14px] font-bold text-[#1e293b] mb-3 tracking-tight">
                                Are you sure?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={cancelLogout}
                                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-[#475569] transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] whitespace-nowrap"
                                >
                                    No, Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleActualLogout}
                                    disabled={isSaving}
                                    className="flex-1 rounded-lg bg-rose-50 px-2 py-2 text-[11px] font-bold text-rose-600 transition-all hover:bg-rose-100 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
                                >
                                    {isSaving ? 'Wait...' : 'Yes, Log Out'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="h-10">
                        <button
                            type="button"
                            onClick={handleLogout}
                            onMouseEnter={(event) => handleItemHover(event, { label: 'Log out', icon: LogOut })}
                            onMouseLeave={clearHoveredItem}
                            className={cn(
                                "flex h-full w-full items-center gap-3 px-6 transition-all duration-200 group relative border border-transparent text-slate-500 hover:text-rose-600 hover:bg-rose-50/80",
                                effectiveCollapsed && "justify-center px-4",
                                showHoverExpandPanel && "overflow-visible"
                            )}
                        >
                            <LogOut
                                size={18}
                                strokeWidth={1.5}
                                className="shrink-0 text-slate-400 transition-colors group-hover:text-rose-500"
                            />

                            {!effectiveCollapsed && (
                                <span className="text-[13px] tracking-tight sidebar-laptop-item-label font-semibold">
                                    Log out
                                </span>
                            )}

                            {effectiveCollapsed && (
                                !showHoverExpandPanel ? (
                                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                        Log out
                                    </div>
                                ) : null
                            )}
                        </button>
                    </div>
                </div>

                {showHoverExpandPanel && hoveredItem && (
                    <div
                        className="absolute -translate-y-1/2 whitespace-nowrap z-[80] pointer-events-none"
                        style={{
                            top: hoveredItem.top,
                            left: hoveredItem.left,
                            height: hoveredItem.height,
                            width: Math.max((hoveredItem.width || 0) + 180, 240)
                        }}
                    >
                        <div className="flex h-full items-center gap-4 px-4 bg-black text-white shadow-lg shadow-black/25 rounded-xl border border-black">
                            <hoveredItem.icon
                                size={18}
                                strokeWidth={1.5}
                                className={cn(
                                    "shrink-0",
                                    "text-white/80"
                                )}
                            />
                            <span className="text-base font-medium tracking-tight text-white">{hoveredItem.label}</span>
                        </div>
                    </div>
                )}
            </aside >
        </>
    );
};

export default Sidebar;
