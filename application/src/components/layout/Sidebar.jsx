import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
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

import { useAuth } from '../../context/AuthContext'; // Import useAuth

const Sidebar = ({ isCollapsed, isOpen, onClose, className }) => {
    const [isTabletViewport, setIsTabletViewport] = React.useState(false);
    const [isMobileViewport, setIsMobileViewport] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    const [hoveredItem, setHoveredItem] = React.useState(null);
    const sidebarRef = React.useRef(null);
    const location = useLocation();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth(); // Get user for global role check
    const effectiveCollapsed = isMobileViewport ? false : isCollapsed;
    const showHoverExpandPanel = effectiveCollapsed && !isMobileViewport;

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
                                onMouseEnter={(event) => {
                                    if (!showHoverExpandPanel || !sidebarRef.current) return;
                                    const itemRect = event.currentTarget.getBoundingClientRect();
                                    const sidebarRect = sidebarRef.current.getBoundingClientRect();
                                    setHoveredItem({
                                        label: item.label,
                                        icon: item.icon,
                                        isActive,
                                        left: itemRect.left - sidebarRect.left,
                                        top: itemRect.top - sidebarRect.top + (itemRect.height / 2)
                                        ,
                                        width: itemRect.width,
                                        height: itemRect.height
                                    });
                                }}
                                onMouseLeave={() => {
                                    if (showHoverExpandPanel) {
                                        setHoveredItem(null);
                                    }
                                }}
                                className={() => cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group relative border border-transparent",
                                    isActive
                                        ? "bg-white text-slate-800 font-semibold shadow-sm border-slate-200"
                                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50",
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
                                        isActive ? "text-slate-700" : "text-slate-400 group-hover:text-slate-500"
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

                {/* Footer */}
                <div className="p-4 flex-none">
                    {/* Optional footer content */}
                </div>
            </aside >
        </>
    );
};

export default Sidebar;
