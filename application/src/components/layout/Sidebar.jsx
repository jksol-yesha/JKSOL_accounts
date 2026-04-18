import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    X,
    LogOut,
    ChevronDown,
    ChevronRight,
    User as UserIcon,
    Edit2,
    Check,
    Camera,
    AlignLeft,
    ArrowRight,
    Loader2,
    Trash2
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
import { useSidebarLayout } from './SidebarLayoutContext';
import { useOrganization } from '../../context/OrganizationContext';
import { usePreferences } from '../../context/PreferenceContext';
import { useCurrencyOptions } from '../../hooks/useCurrencyOptions';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

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

const PREFERENCE_CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
const PREFERENCE_CURRENCY_LABELS = {
    INR: '₹ - Indian Rupee (INR)',
    USD: '$ - US Dollar (USD)',
    EUR: '€ - Euro (EUR)',
    GBP: '£ - British Pound (GBP)',
    AED: 'AED - UAE Dirham (AED)'
};

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
    const [tempProfilePhoto, setTempProfilePhoto] = React.useState(null);
    const [showDeleteOption, setShowDeleteOption] = React.useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [showSidebarControlMenu, setShowSidebarControlMenu] = React.useState(false);
    const sidebarRef = React.useRef(null);
    const profileMenuRef = React.useRef(null);
    const sidebarControlRef = React.useRef(null);
    const logoutConfirmRef = React.useRef(null);
    const fileInputRef = React.useRef(null);
    const pendingPageFocusPathRef = React.useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedOrg } = useOrganization();
    const { user, logout, updateUser } = useAuth();
    const { showToast } = useToast();
    const { preferences, updatePreferences } = usePreferences();
    const { currencyOptions } = useCurrencyOptions();
    const { sidebarMode, setSidebarMode, setSidebarHoverExpanded } = useSidebarLayout();
    const preferenceCurrencyOptions = React.useMemo(() => {
        const availableOptions = new Map(
            (currencyOptions || []).map((currency) => [String(currency.code || '').toUpperCase(), currency])
        );

        return PREFERENCE_CURRENCY_CODES.map((code) => {
            const matchedOption = availableOptions.get(code);
            return {
                value: code,
                label: matchedOption?.label || PREFERENCE_CURRENCY_LABELS[code] || code,
                symbol: matchedOption?.symbol || PREFERENCE_CURRENCY_LABELS[code]?.split(' - ')[0] || code
            };
        });
    }, [currencyOptions]);
    const effectiveCollapsed = isMobileViewport ? false : isCollapsed;
    const usesHoverOverlay = !isMobileViewport && sidebarMode === 'hover';
    const showHoverExpandPanel = effectiveCollapsed && !isMobileViewport && sidebarMode !== 'hover';
    const SidebarToggleIcon = effectiveCollapsed ? ArrowRight : AlignLeft;
    const sidebarControlLabel = 'Sidebar control';
    const sidebarModeOptions = [
        { value: 'expanded', label: 'Expanded' },
        { value: 'collapsed', label: 'Collapsed' },
        { value: 'hover', label: 'Expand on hover' }
    ];
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
    
    // Check for changes against the RAW data
    const hasNameChange = tempDisplayName !== rawName;
    const hasEmailChange = tempEmail !== (user?.email || '');
    const hasPhotoChange = tempProfilePhoto !== (user?.profilePhoto || null);
    const hasPreferenceChanges = JSON.stringify(draftPreferences) !== JSON.stringify(preferences || {});
    
    const hasChanges = hasNameChange || hasEmailChange || hasPhotoChange || hasPreferenceChanges;

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
            setTempDisplayName(rawName); // Use RAW name for editing
            setTempEmail(user?.email || '');
            setTempProfilePhoto(user?.profilePhoto || null);
            setDraftPreferences(preferences || {});
            setActiveEditField(null);
            setIsPreferencesExpanded(false);
            setOpenPrefDropdown(null);
            setShowDeleteOption(false);
        }
    }, [showProfileMenu, rawName, user?.email, user?.profilePhoto, preferences]);

    React.useEffect(() => {
        if (isMobileViewport && !isOpen) {
            setShowProfileMenu(false);
        }
    }, [isMobileViewport, isOpen]);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            const clickedOutsideProfile = !profileMenuRef.current || !profileMenuRef.current.contains(event.target);
            const clickedOutsideSidebarControl = !sidebarControlRef.current || !sidebarControlRef.current.contains(event.target);
            const clickedOutsideLogoutConfirm = !logoutConfirmRef.current || !logoutConfirmRef.current.contains(event.target);

            if (clickedOutsideProfile && clickedOutsideSidebarControl && clickedOutsideLogoutConfirm) {
                setShowProfileMenu(false);
                setOpenPrefDropdown(null);
                setShowSidebarControlMenu(false);
                setShowLogoutConfirm(false);
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
            id: item.id || item.path || item.label,
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

    const getSidebarFocusableElements = React.useCallback(() => {
        if (!sidebarRef.current) return [];

        return Array.from(
            sidebarRef.current.querySelectorAll('[data-sidebar-focusable="true"]')
        ).filter((element) => {
            if (!(element instanceof HTMLElement)) return false;
            if (element.hasAttribute('disabled')) return false;
            return element.getClientRects().length > 0;
        });
    }, []);

    const focusNextSidebarItem = React.useCallback((currentElement) => {
        const focusableElements = getSidebarFocusableElements();
        const currentIndex = focusableElements.indexOf(currentElement);

        if (currentIndex === -1) {
            return false;
        }

        for (let index = currentIndex + 1; index < focusableElements.length; index += 1) {
            const nextElement = focusableElements[index];
            if (nextElement && typeof nextElement.focus === 'function') {
                nextElement.focus();
                return true;
            }
        }

        return false;
    }, [getSidebarFocusableElements]);

    const focusPageContent = React.useCallback(() => {
        if (typeof document === 'undefined') return;

        const mainContent = document.getElementById('app-main-content') || document.querySelector('main');
        if (!mainContent) return;

        const focusableSelector = [
            'button:not([disabled])',
            '[href]',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');

        const firstFocusable = Array.from(mainContent.querySelectorAll(focusableSelector)).find((element) => {
            if (!(element instanceof HTMLElement)) return false;
            if (element.getAttribute('aria-hidden') === 'true') return false;
            if (element.closest('[aria-hidden="true"]')) return false;
            return element.getClientRects().length > 0;
        });

        const target = firstFocusable || mainContent;

        if (target instanceof HTMLElement) {
            target.focus({ preventScroll: true });
            if (typeof target.select === 'function' && target.matches('input, textarea')) {
                target.select();
            }
        }
    }, []);

    React.useEffect(() => {
        if (!pendingPageFocusPathRef.current) return;
        if (location.pathname !== pendingPageFocusPathRef.current) return;

        const focusTimer = window.setTimeout(() => {
            focusPageContent();
            pendingPageFocusPathRef.current = null;
        }, 0);

        return () => window.clearTimeout(focusTimer);
    }, [focusPageContent, location.pathname]);

    const handleSidebarEnterToNext = React.useCallback((event) => {
        if (event.key !== 'Enter') return false;
        event.preventDefault();
        const moved = focusNextSidebarItem(event.currentTarget);
        if (!moved) {
            focusPageContent();
        }
        return true;
    }, [focusNextSidebarItem, focusPageContent]);

    const handleSidebarButtonKeyDown = React.useCallback((event) => {
        if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            focusPageContent();
            return;
        }

        handleSidebarEnterToNext(event);
    }, [focusPageContent, handleSidebarEnterToNext]);

    const activateSidebarItem = React.useCallback((path) => {
        setHoveredItem(null);
        setShowProfileMenu(false);
        setShowLogoutConfirm(false);
        setShowSidebarControlMenu(false);

        if (location.pathname !== path) {
            navigate(path);
        }

        if (isMobileViewport) {
            onClose?.();
        }
    }, [isMobileViewport, location.pathname, navigate, onClose]);

    const handleSidebarItemActivate = React.useCallback((event, path) => {
        event.preventDefault();
        activateSidebarItem(path);
    }, [activateSidebarItem]);

    const handleSidebarItemKeyDown = React.useCallback((event, path) => {
        if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            if (location.pathname !== path) {
                pendingPageFocusPathRef.current = path;
                activateSidebarItem(path);
            } else {
                focusPageContent();
            }
            return;
        }

        if (handleSidebarEnterToNext(event)) {
            return;
        }

        if (event.key === ' ') {
            event.preventDefault();
            activateSidebarItem(path);
        }
    }, [activateSidebarItem, focusPageContent, handleSidebarEnterToNext, location.pathname]);

    const openProfileLogoutConfirm = () => {
        setHoveredItem(null);
        setShowSidebarControlMenu(false);
        setOpenPrefDropdown(null);
        setIsPreferencesExpanded(false);
        setActiveEditField(null);
        setShowLogoutConfirm(true);
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

    const handleProfileClick = (e) => {
        e.stopPropagation();
        setShowProfileMenu(!showProfileMenu);
    };

    const handleSidebarModeSelect = (nextMode) => {
        setShowSidebarControlMenu(false);
        setHoveredItem(null);
        setShowProfileMenu(false);
        setShowLogoutConfirm(false);
        setSidebarMode(nextMode);
        if (nextMode === 'hover' && !isMobileViewport) {
            setSidebarHoverExpanded(true);
        }
    };

    const handleImageChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            console.error('File too large');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64data = reader.result;
            setIsSaving(true);
            try {
                await updateUser({
                    profilePhoto: base64data
                });
                setTempProfilePhoto(base64data);
                if (fileInputRef.current) fileInputRef.current.value = '';
                showToast('Profile photo updated successfully', 'success');
            } catch (error) {
                console.error('Failed to upload profile photo', error);
                showToast('Failed to upload profile photo', 'error');
            } finally {
                setIsSaving(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handlePreferenceChange = (event) => {
        const { name, value } = event.target;
        setDraftPreferences((previous) => ({ ...previous, [name]: value }));
    };

    const handleRemovePhoto = async (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        
        console.log('Remove photo triggered');
        showToast('Remove action started', 'info');
        setIsSaving(true);
        try {
            await updateUser({
                profilePhoto: null
            });
            setTempProfilePhoto(null);
            setShowDeleteOption(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            showToast('Profile photo removed', 'success');
        } catch (error) {
            console.error('Failed to remove profile photo', error);
            showToast('Failed to remove photo', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!hasChanges) return;

        setIsSaving(true);
        try {
            if (hasNameChange || hasEmailChange || (hasPhotoChange && !isSaving)) {
                await updateUser({
                    name: hasNameChange ? tempDisplayName : undefined,
                    email: hasEmailChange ? tempEmail : undefined,
                    profilePhoto: hasPhotoChange ? tempProfilePhoto : undefined,
                });
            }
            
            showToast('Profile saved successfully', 'success');

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
    
    // Child component for preference items with visual connection
    const PreferenceItem = ({ name, options, currentValue, onSelect }) => {
        const isOpen = openPrefDropdown === name;
        const selectedOption = options.find((option) => option.value === currentValue);
        const selectedLabel = selectedOption?.label || currentValue;
        const shouldScrollOptions = options.length > 4;
        const isCurrencyPreference = name === 'currency';

        const renderPreferenceLabel = (option, highlightMode = 'none') => {
            if (!isCurrencyPreference || !option) {
                return option?.label || selectedLabel;
            }

            const optionLabel = option.label || '';
            const symbol = option.symbol || '';

            if (!symbol || !optionLabel.startsWith(symbol)) {
                return optionLabel;
            }

            const remainder = optionLabel.slice(symbol.length).trimStart();

            return (
                <span className="flex min-w-0 items-center gap-0.5 overflow-hidden">
                    <span className={cn(
                        'shrink-0',
                        highlightMode === 'accent' && 'text-[#4A8AF4]',
                        highlightMode === 'inverse' && 'text-white'
                    )}>{symbol}</span>
                    {remainder ? <span className="truncate">{remainder}</span> : null}
                </span>
            );
        };

        // Diagnostic log to confirm component is working
        React.useEffect(() => {
            if (isOpen) console.log(`[Sidebar] PreferenceItem "${name}" opened`);
        }, [isOpen, name]);

        return (
            <div className="relative w-full overflow-visible">
                <div
                    className="px-3 py-1.5 transition-colors cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpenPrefDropdown(isOpen ? null : name);
                    }}
                >
                    <div className="flex items-center justify-between gap-x-3">
                        <span className="min-w-0 flex-1 text-[12px] font-bold text-[#1e293b] leading-5 whitespace-nowrap overflow-hidden text-ellipsis">
                            {renderPreferenceLabel(selectedOption || { label: selectedLabel }, 'none')}
                        </span>
                        <ChevronRight
                            size={14}
                            fill="currentColor"
                            className={cn(
                                'ml-auto shrink-0 text-slate-300 transition-all duration-200',
                                isOpen && 'text-[#4A8AF4] translate-x-0.5'
                            )}
                        />
                    </div>
                </div>

                {isOpen && (
                    <div className="absolute left-full bottom-0 z-[200] ml-1 overflow-visible animate-in fade-in zoom-in-95 duration-150">
                        {/* Main Content Container with scrollbar */}
                        <div
                            className={cn(
                                "relative w-[228px] overflow-x-hidden bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.03)] border border-slate-100 py-1",
                                shouldScrollOptions
                                    ? "max-h-[136px] overflow-y-auto overscroll-contain no-scrollbar"
                                    : "overflow-y-hidden"
                            )}
                        >
                            {options.map((option) => {
                                const isSelected = currentValue === option.value;
                                return (
                                    <div
                                        key={option.value}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onSelect(name, option.value);
                                            setOpenPrefDropdown(null);
                                        }}
                                        className={cn(
                                            'flex items-center justify-between gap-2 cursor-pointer px-2.5 py-1 text-[11px] font-bold transition-colors',
                                            isSelected ? 'bg-[#EEF0FC] text-[#1e293b]' : 'text-[#1e293b] hover:bg-[#EEF0FC]'
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 pr-1.5 leading-4">
                                            {renderPreferenceLabel(option, isSelected ? 'accent' : 'none')}
                                        </span>
                                        {isSelected && <Check size={14} strokeWidth={2.5} className="shrink-0 text-[#4A8AF4]" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
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

    const profileMenuContent = (
        <div className="relative bg-[#f4f6fe]">
            {hasChanges && (
                <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    title={isSaving ? 'Saving...' : 'Save Changes'}
                    className="absolute left-6 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
                >
                    {isSaving ? (
                        <Loader2 size={12} className="animate-spin" />
                    ) : (
                        <Check size={14} strokeWidth={3.5} />
                    )}
                </button>
            )}

            <div className="flex justify-center pt-4 pb-2">
                <div 
                    className="relative cursor-pointer group/avatar"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const nextState = !showDeleteOption;
                        setShowDeleteOption(nextState);
                        showToast(`Click detected. Toggle: ${nextState ? 'Show' : 'Hide'}`, 'info', { duration: 1500 });
                    }}
                >
                    <div
                        className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[2px] border-white bg-slate-100 text-slate-400 shadow-[0_4px_12px_rgb(15,23,42,0.1)] transition-transform active:scale-95 z-10"
                    >
                        {tempProfilePhoto ? (
                            <img src={tempProfilePhoto} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                            <UserIcon size={22} strokeWidth={1.5} />
                        )}
                        
                        {/* Saving overlay */}
                        {isSaving && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-20">
                                <Loader2 size={16} className="animate-spin text-slate-900" />
                            </div>
                        )}

                        {/* Hover Overlay - Only Camera Icon visible on hover */}
                        <div 
                            className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition-opacity group-hover/avatar:opacity-100 pointer-events-none z-30"
                        >
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                                className="p-2 rounded-full hover:bg-white/20 transition-colors pointer-events-auto"
                                title="Upload Photo"
                            >
                                <Camera size={18} className="text-white drop-shadow-md" />
                            </button>
                        </div>
                    </div>
                    
                    {tempProfilePhoto && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                handleRemovePhoto(e);
                            }}
                            title="Remove Photo"
                            className={cn(
                                "absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 transition-all hover:bg-slate-50 active:scale-95 z-50 duration-200",
                                showDeleteOption ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
                            )}
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                />
            </div>

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
                        <p className="min-w-0 flex-1 text-[15px] font-extrabold text-slate-900 leading-tight tracking-tight">
                            {tempDisplayName}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setShowLogoutConfirm(false);
                                setActiveEditField('name');
                            }}
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
                        <p className="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-medium tracking-[-0.01em] text-slate-400 leading-tight">
                            {tempEmail || 'No email added'}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setShowLogoutConfirm(false);
                                setActiveEditField('email');
                            }}
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
                        <button
                            type="button"
                            onClick={() => {
                                setOpenPrefDropdown(null);
                                setIsPreferencesExpanded(false);
                            }}
                            className="mb-3 flex w-full items-center justify-between px-3 text-left transition-colors"
                        >
                            <div className="flex items-center gap-2 flex-1">
                                <UserIcon size={13} strokeWidth={2.5} className="text-black" />
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black">
                                    Preferences
                                </p>
                            </div>
                            <ChevronDown
                                size={14}
                                strokeWidth={2.2}
                                className={cn(
                                    "ml-auto shrink-0 text-slate-400 transition-all duration-300 rotate-180 text-primary-500"
                                )}
                            />
                        </button>
                        <div className="space-y-0.5">
                            <PreferenceItem
                                name="currency"
                                options={preferenceCurrencyOptions}
                                currentValue={draftPreferences.currency || 'INR'}
                                onSelect={(name, value) => {
                                    handlePreferenceChange({ target: { name, value } });
                                    updatePreferences({ [name]: value });
                                }}
                            />
                            <PreferenceItem
                                name="dateFormat"
                                options={dateFormats}
                                currentValue={draftPreferences.dateFormat}
                                onSelect={(name, value) => {
                                    handlePreferenceChange({ target: { name, value } });
                                    updatePreferences({ [name]: value });
                                }}
                            />
                            <PreferenceItem
                                name="numberFormat"
                                options={numberFormats}
                                currentValue={draftPreferences.numberFormat}
                                onSelect={(name, value) => {
                                    handlePreferenceChange({ target: { name, value } });
                                    updatePreferences({ [name]: value });
                                }}
                            />
                            <PreferenceItem
                                name="timeZone"
                                options={timeZones}
                                currentValue={draftPreferences.timeZone}
                                onSelect={(name, value) => {
                                    handlePreferenceChange({ target: { name, value } });
                                    updatePreferences({ [name]: value });
                                }}
                            />
                        </div>
                    </div>
                )}

                {!isPreferencesExpanded && (
                    <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between py-2 px-3 text-left"
                        onClick={() => {
                            setOpenPrefDropdown(null);
                            setShowLogoutConfirm(false);
                            setIsPreferencesExpanded((current) => !current);
                        }}
                    >
                        <div className="flex items-center gap-2 flex-1">
                            <UserIcon size={12} strokeWidth={2.5} className="text-black" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black transition-colors">
                                Preferences
                            </p>
                        </div>
                        <ChevronDown
                            size={14}
                            strokeWidth={2.2}
                            className={cn(
                                "ml-auto shrink-0 text-slate-400 transition-all duration-300",
                                isPreferencesExpanded && "rotate-180 text-primary-500"
                            )}
                        />
                    </button>
                )}
            </div>

            <div className="mt-1">
                {!showLogoutConfirm ? (
                    <button
                        type="button"
                        onClick={openProfileLogoutConfirm}
                        className="flex w-full items-center gap-2 px-6 py-3 text-left text-slate-900 transition-colors"
                    >
                        <LogOut size={14} strokeWidth={1.8} className="shrink-0 text-black" />
                        <span className="text-[12px] font-semibold tracking-tight">Log out</span>
                    </button>
                ) : (
                    <div className="px-6 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-[13px] font-bold tracking-tight text-slate-800">
                            Log out?
                        </p>
                        <div className="mt-3 flex gap-2">
                            <button
                                type="button"
                                onClick={cancelLogout}
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleActualLogout}
                                disabled={isSaving}
                                className="flex-1 rounded-lg bg-rose-50 px-2 py-2 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60"
                            >
                                {isSaving ? 'Wait...' : 'Log out'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

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
                "fixed inset-y-0 left-0 z-[70] w-[208px] bg-[#f4f6fe] border-r border-slate-200 flex flex-col transition-[width,transform,box-shadow] duration-300 ease-in-out h-screen min-h-screen max-h-screen rounded-none overflow-visible",
                usesHoverOverlay ? "md:fixed md:translate-x-0" : "md:relative md:translate-x-0",
                isTabletViewport ? (effectiveCollapsed ? "md:w-[50px]" : "md:w-[208px]") : (isCollapsed && "lg:w-[52px]"),
                usesHoverOverlay && !effectiveCollapsed && "md:z-[85] md:shadow-[0_18px_40px_rgba(15,23,42,0.14)]",
                !isOpen && "-translate-x-full md:translate-x-0",
                className
            )}
                ref={sidebarRef}
                onMouseEnter={() => {
                    if (!isMobileViewport && sidebarMode === 'hover') {
                        setSidebarHoverExpanded(true);
                    }
                }}
                onMouseLeave={() => {
                    if (!isMobileViewport && sidebarMode === 'hover') {
                        setSidebarHoverExpanded(false);
                        setHoveredItem(null);
                    }
                }}
            >
                <div className={cn(
                    "flex flex-col pt-4 md:pt-0 mb-0.5 flex-none",
                    effectiveCollapsed ? "items-center px-0" : "px-3"
                )}>
                    <OrganizationSelector
                        isCollapsed={effectiveCollapsed}
                        onTriggerKeyDown={handleSidebarButtonKeyDown}
                        buttonProps={{ 'data-sidebar-focusable': 'true' }}
                    />
                </div>

                {/* Mobile Close Button */}
                <button
                    onClick={onClose}
                    onKeyDown={handleSidebarButtonKeyDown}
                    data-sidebar-focusable="true"
                    className="md:hidden p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors absolute top-4 right-4"
                >
                    <X size={20} />
                </button>

                {/* Navigation */}
                <div className={cn(
                    "flex-1 overflow-y-auto overflow-x-visible pt-1 pb-2 px-3 space-y-0.5 custom-scrollbar",
                    effectiveCollapsed && "no-scrollbar px-0 items-center"
                )}>

                    {/* Menu Label Removed for Minimalism */}

                    {filteredMenuItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={(event) => handleSidebarItemActivate(event, item.path)}
                                onKeyDown={(event) => handleSidebarItemKeyDown(event, item.path)}
                                data-sidebar-focusable="true"
                                onMouseEnter={(event) => handleItemHover(event, item, isActive)}
                                onMouseLeave={clearHoveredItem}
                                className={() => cn(
                                    "flex items-center gap-3 px-3 py-[7px] rounded-md transition-all duration-200 group relative border border-transparent",
                                    isActive
                                        ? "bg-[#4A8AF4] text-white border-[#4A8AF4]"
                                        : "text-slate-900 hover:text-slate-900 hover:bg-[#EEF0FC]",
                                    effectiveCollapsed && "mx-auto h-9 w-9 justify-center px-0 py-0",
                                    showHoverExpandPanel && "overflow-visible"
                                )}
                            >
                                <item.icon
                                    size={18}
                                    strokeWidth={1.5}
                                    className={cn(
                                        "shrink-0 transition-colors",
                                        isActive ? "text-white" : "text-slate-900 group-hover:text-slate-900"
                                    )}
                                />

                                {!effectiveCollapsed && (
                                    <span className={cn(
                                        "text-[13px] tracking-tight sidebar-laptop-item-label",
                                        isActive ? "font-semibold" : "font-medium"
                                    )}>{item.label}</span>
                                )}

                                {/* Tooltip for collapsed state */}
                                {effectiveCollapsed && (
                                    !showHoverExpandPanel ? (
                                        <div className="absolute left-full ml-2.5 px-1.5 py-px bg-gray-800 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
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
                        {(() => {
                            return (
                        <button
                            type="button"
                            onClick={handleProfileClick}
                            onKeyDown={handleSidebarButtonKeyDown}
                            data-sidebar-focusable="true"
                            className={cn(
                                "flex h-[38px] w-full items-center transition-all duration-200 group relative border border-transparent text-slate-900 px-3",
                                effectiveCollapsed ? "mx-auto h-[38px] w-[38px] justify-center rounded-md px-0" : "gap-3",
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
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200 transition-colors">
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

                        </button>
                            );
                        })()}

                        {showProfileMenu && !effectiveCollapsed && (
                            <div className="relative w-full border-t border-slate-100 bg-[#f4f6fe] overflow-visible animate-in slide-in-from-top-2 duration-200">
                                {profileMenuContent}
                            </div>
                        )}

                        {showProfileMenu && effectiveCollapsed && (
                            <div className="absolute bottom-0 left-full z-[120] ml-1 w-64 overflow-visible animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-300 ease-out">
                                <div
                                    className={cn(
                                        "relative rounded-2xl border border-slate-100 bg-[#f4f6fe] shadow-[0_10px_30px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.03)] overflow-visible",
                                    )}
                                >
                                    {profileMenuContent}
                                </div>
                            </div>
                        )}
                    </div>

                    {!isMobileViewport && (
                        <>
                            <div className="relative h-10 border-t border-slate-200" ref={sidebarControlRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHoveredItem(null);
                                        setShowProfileMenu(false);
                                        setShowLogoutConfirm(false);
                                        setShowSidebarControlMenu((current) => !current);
                                    }}
                                    onKeyDown={handleSidebarButtonKeyDown}
                                    data-sidebar-focusable="true"
                                    onMouseEnter={(event) => handleItemHover(event, { id: 'sidebar-control', label: sidebarControlLabel, icon: SidebarToggleIcon })}
                                    onMouseLeave={clearHoveredItem}
                                    className={cn(
                                        "flex h-full w-full items-center transition-all duration-200 group relative border border-transparent bg-[#EEF0FC] text-slate-900 hover:text-slate-900 hover:bg-[#EEF0FC]",
                                        effectiveCollapsed ? "mx-auto h-9 w-9 justify-center rounded-md px-0" : "justify-start px-6",
                                        showHoverExpandPanel && "overflow-visible",
                                        showSidebarControlMenu && "text-slate-900"
                                    )}
                                >
                                    <SidebarToggleIcon
                                        size={18}
                                        strokeWidth={1.8}
                                        className={cn(
                                            "shrink-0 transition-colors",
                                            showSidebarControlMenu ? "text-slate-900" : "text-slate-900 group-hover:text-slate-900"
                                        )}
                                    />

                                    {effectiveCollapsed && (
                                        !showHoverExpandPanel ? (
                                            <div className="absolute left-full ml-2.5 px-1.5 py-px bg-gray-800 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                                {sidebarControlLabel}
                                            </div>
                                        ) : null
                                    )}
                                </button>

                                {showSidebarControlMenu && (
                                    <div
                                        className={cn(
                                            "absolute bottom-11 z-[140] w-[168px] animate-in fade-in slide-in-from-left-2 duration-150",
                                            effectiveCollapsed ? "left-full ml-2" : "left-3"
                                        )}
                                    >
                                        <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
                                            <div className="px-1.5 py-1">
                                                {sidebarModeOptions.map((option) => {
                                                    const isSelected = sidebarMode === option.value;

                                                    return (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => handleSidebarModeSelect(option.value)}
                                                            className="flex w-full items-center gap-2 rounded-[7px] px-1.5 py-1.5 text-left text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                                        >
                                                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                                                                <span
                                                                    className={cn(
                                                                        "block h-2 w-2 rounded-full border transition-colors",
                                                                        isSelected ? "border-slate-600 bg-slate-600" : "border-transparent bg-transparent"
                                                                    )}
                                                                />
                                                            </span>
                                                            <span>{option.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {showHoverExpandPanel && hoveredItem && (
                    <div
                        className="absolute -translate-y-1/2 whitespace-nowrap z-[80] pointer-events-none animate-in fade-in slide-in-from-left-1 duration-150"
                        style={{
                            top: hoveredItem.top,
                            left: (hoveredItem.left || 0) + (hoveredItem.width || 0) + 8
                        }}
                    >
                        <div className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-slate-800 shadow-[0_5px_10px_rgba(15,23,42,0.08)]">
                            {hoveredItem.label}
                        </div>
                    </div>
                )}
            </aside >
        </>
    );
};

export default Sidebar;
