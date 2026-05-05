import re

content = """import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    X,
    ChevronDown,
    AlignLeft,
    ArrowRight
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
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isCollapsed, isOpen, onClose, className }) => {
    const [isTabletViewport, setIsTabletViewport] = React.useState(false);
    const [isMobileViewport, setIsMobileViewport] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    const [hoveredItem, setHoveredItem] = React.useState(null);
    const [showSidebarControlMenu, setShowSidebarControlMenu] = React.useState(false);
    const [expandedMenus, setExpandedMenus] = React.useState({});
    const sidebarRef = React.useRef(null);
    const sidebarControlRef = React.useRef(null);
    const pendingPageFocusPathRef = React.useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth();
    const { sidebarMode, setSidebarMode, setSidebarHoverExpanded } = useSidebarLayout();

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
        const parts = String(name).trim().split(/\\s+/);
        if (parts.length < 2) return parts[0];
        const firstName = parts[0];
        const lastNameFirstChar = parts[1].charAt(0).toUpperCase();
        return `${firstName} ${lastNameFirstChar}.`;
    };

    const rawName = user?.name || user?.fullName || (user?.email ? String(user.email).split('@')[0] : 'User');
    const displayName = getFormattedName(rawName);

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
        const handleClickOutside = (event) => {
            const clickedOutsideSidebarControl = !sidebarControlRef.current || !sidebarControlRef.current.contains(event.target);
            if (clickedOutsideSidebarControl) {
                setShowSidebarControlMenu(false);
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

    const handleProfileClick = (e) => {
        e.stopPropagation();
        if (location.pathname !== '/profile') {
            navigate('/profile');
        }
    };

    const handleSidebarModeSelect = (nextMode) => {
        setShowSidebarControlMenu(false);
        setHoveredItem(null);
        setSidebarMode(nextMode);
        if (nextMode === 'hover' && !isMobileViewport) {
            setSidebarHoverExpanded(true);
        }
    };

    const menuItems = [
        { icon: Home, label: 'Home', path: '/dashboard', permission: 'DASHBOARD_VIEW' },
        { icon: Landmark, label: 'Accounts', path: '/accounts' },
        { 
            icon: ArrowRightLeft, 
            label: 'Transactions', 
            path: '/transactions', 
            permission: 'TXN_VIEW',
            subItems: [
                { icon: Users, label: 'Parties', path: '/parties' },
                { icon: ShoppingBag, label: 'Categories', path: '/category' },
            ]
        },
        { icon: BarChart2, label: 'Reports', path: '/reports', permission: 'REPORT_VIEW' },
        { icon: History, label: 'Activity', path: '/audit-logs' },
    ];

    // Auto-expand/collapse menus based on current route
    React.useEffect(() => {
        setExpandedMenus(prev => {
            const newExpanded = { ...prev };
            let changed = false;
            menuItems.forEach(item => {
                if (item.subItems) {
                    const isActive = item.subItems.some(sub => location.pathname.startsWith(sub.path)) || location.pathname.startsWith(item.path);
                    if (isActive && !newExpanded[item.label]) {
                        newExpanded[item.label] = true;
                        changed = true;
                    } else if (!isActive && newExpanded[item.label]) {
                        newExpanded[item.label] = false;
                        changed = true;
                    }
                }
            });
            return changed ? newExpanded : prev;
        });
    }, [location.pathname]);

    const filteredMenuItems = menuItems.filter(item => {
        if (item.label === 'Audit Logs') {
            const orgRole = selectedOrg?.role?.toLowerCase();
            const globalRole = user?.globalRole?.toLowerCase();
            return ['owner', 'admin'].includes(orgRole) || ['owner', 'admin'].includes(globalRole);
        }
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

            <aside 
                id="app-main-sidebar"
                tabIndex={-1}
                className={cn(
                    "fixed inset-y-0 left-0 z-[70] w-[208px] bg-[#f4f6fe] border-r border-slate-200 flex flex-col transition-[width,transform,box-shadow] duration-300 ease-in-out h-screen min-h-screen max-h-screen rounded-none overflow-visible outline-none",
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
                    {filteredMenuItems.map((item) => {
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isExactParentActive = location.pathname === item.path || location.pathname === item.path + '/';
                        const isChildActive = hasSubItems && item.subItems.some(sub => location.pathname.startsWith(sub.path));
                        const isExpanded = expandedMenus[item.label];

                        let parentBgClass = "text-slate-900 hover:text-slate-900 hover:bg-[#EEF0FC]";
                        let parentTextClass = "font-medium text-slate-900";
                        let parentIconClass = "text-slate-900 group-hover:text-slate-900";

                        if (isExactParentActive) {
                            parentBgClass = "bg-[#4A8AF4] text-white border-[#4A8AF4]";
                            parentTextClass = "font-semibold text-white";
                            parentIconClass = "text-white";
                        } else if (isChildActive || isExpanded) {
                            parentBgClass = "bg-[#EEF0FC] text-[#4A8AF4] border-[#EEF0FC]";
                            parentTextClass = "font-semibold text-[#4A8AF4]";
                            parentIconClass = "text-[#4A8AF4]";
                        }

                        if (hasSubItems) {
                            return (
                                <div key={item.label} className="flex flex-col space-y-0.5">
                                    <button
                                        onClick={(e) => {
                                            handleSidebarItemActivate(e, item.path);
                                        }}
                                        data-sidebar-focusable="true"
                                        onMouseEnter={(event) => handleItemHover(event, item, isExactParentActive || isChildActive)}
                                        onMouseLeave={clearHoveredItem}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-[7px] rounded-md transition-all duration-200 group relative border border-transparent w-full text-left",
                                            parentBgClass,
                                            effectiveCollapsed && "mx-auto h-9 w-9 justify-center px-0 py-0",
                                            showHoverExpandPanel && "overflow-visible"
                                        )}
                                    >
                                        <item.icon
                                            size={18}
                                            strokeWidth={1.5}
                                            className={cn(
                                                "shrink-0 transition-colors",
                                                parentIconClass
                                            )}
                                        />

                                        {!effectiveCollapsed && (
                                            <span className={cn(
                                                "text-[13px] tracking-tight sidebar-laptop-item-label flex-1",
                                                parentTextClass
                                            )}>{item.label}</span>
                                        )}

                                        {effectiveCollapsed && !showHoverExpandPanel && (
                                            <div className="absolute left-full ml-2.5 px-1.5 py-px bg-gray-800 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                                {item.label}
                                            </div>
                                        )}
                                    </button>

                                    {/* Expanded SubItems */}
                                    {!effectiveCollapsed && (
                                        <div 
                                            className={cn(
                                                "grid transition-all duration-300 ease-in-out",
                                                isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
                                            )}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="flex flex-col space-y-0.5 py-1">
                                                    {item.subItems.map((subItem) => {
                                                        const isSubActive = location.pathname.startsWith(subItem.path);
                                                        return (
                                                            <NavLink
                                                                key={subItem.path}
                                                                to={subItem.path}
                                                                onClick={(event) => handleSidebarItemActivate(event, subItem.path)}
                                                                className={() => cn(
                                                                    "flex items-center gap-2 pl-[42px] pr-3 py-1.5 rounded-md transition-all duration-200 text-[13px]",
                                                                    isSubActive
                                                                        ? "bg-[#4A8AF4] text-white font-semibold shadow-sm"
                                                                        : "text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900"
                                                                )}
                                                            >
                                                                {subItem.icon && <subItem.icon size={15} strokeWidth={2} className={cn("shrink-0", isSubActive ? "text-white" : "text-slate-400")} />}
                                                                <span>{subItem.label}</span>
                                                            </NavLink>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Standard single item
                        const isItemActive = location.pathname.startsWith(item.path);
                        
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={(event) => handleSidebarItemActivate(event, item.path)}
                                onKeyDown={(event) => handleSidebarItemKeyDown(event, item.path)}
                                data-sidebar-focusable="true"
                                onMouseEnter={(event) => handleItemHover(event, item, isItemActive)}
                                onMouseLeave={clearHoveredItem}
                                className={() => cn(
                                    "flex items-center gap-3 px-3 py-[7px] rounded-md transition-all duration-200 group relative border border-transparent",
                                    isItemActive
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
                                        isItemActive ? "text-white" : "text-slate-900 group-hover:text-slate-900"
                                    )}
                                />

                                {!effectiveCollapsed && (
                                    <span className={cn(
                                        "text-[13px] tracking-tight sidebar-laptop-item-label",
                                        isItemActive ? "font-semibold" : "font-medium"
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
                    <div className="relative w-full">
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
                    </div>

                    {!isMobileViewport && (
                        <>
                            <div className="relative h-10 border-t border-slate-200" ref={sidebarControlRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHoveredItem(null);
                                        setShowSidebarControlMenu((current) => !current);
                                    }}
                                    onKeyDown={handleSidebarButtonKeyDown}
                                    data-sidebar-focusable="true"
                                    onMouseEnter={(event) => handleItemHover(event, { id: 'sidebar-control', label: sidebarControlLabel, icon: SidebarToggleIcon })}
                                    onMouseLeave={clearHoveredItem}
                                    className={cn(
                                        "flex h-full w-full items-center transition-all duration-200 group relative border border-transparent bg-[#EEF0FC] text-slate-900 hover:text-slate-900 hover:bg-[#EEF0FC]",
                                        effectiveCollapsed ? "mx-auto h-9 w-9 justify-center rounded-md px-0" : "justify-start px-3",
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
"""

with open("/Users/erasoft/Downloads/local-live copy 23/application/src/components/layout/Sidebar.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done writing to Sidebar.jsx")
