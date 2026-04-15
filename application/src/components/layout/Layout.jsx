import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

import Sidebar from './Sidebar';
import { SidebarLayoutProvider } from './SidebarLayoutContext';
import { cn } from '../../utils/cn';

const ACCOUNTS_CREATE_SCROLL_MODE_EVENT = 'accounts-create-scroll-mode';
const TRANSACTIONS_CREATE_SCROLL_MODE_EVENT = 'transactions-create-scroll-mode';
const PARTIES_CREATE_SCROLL_MODE_EVENT = 'parties-create-scroll-mode';
const SIDEBAR_MODE_STORAGE_KEY = 'app-sidebar-mode';

const isTransactionsCreateRoute = (pathname) => (
    pathname === '/transactions/create' || /^\/transactions\/edit\/[^/]+$/.test(pathname)
);

const isPartiesCreateRoute = (pathname) => pathname === '/parties/create';

const getDefaultSidebarMode = () => {
    if (typeof window === 'undefined') return 'expanded';

    const storedMode = window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
    if (storedMode === 'expanded' || storedMode === 'collapsed' || storedMode === 'hover') {
        return storedMode;
    }

    return window.innerWidth >= 768 && window.innerWidth <= 1024 ? 'collapsed' : 'expanded';
};

const Footer = ({ className }) => (
    <footer className={cn("bg-[#f4f6fe] border-t border-slate-200 h-10 px-6 text-center text-[10px] text-slate-400 flex items-center justify-center flex-none no-print print:hidden", className)}>
        <p>© 2026 JKSOL. All rights reserved.</p>
    </footer>
);

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarMode, setSidebarMode] = useState(getDefaultSidebarMode);
    const [isSidebarHoverExpanded, setIsSidebarHoverExpanded] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() =>
        typeof window !== 'undefined'
            ? window.innerWidth < 768
            : false
    );

    const [createRouteNeedsPageScroll, setCreateRouteNeedsPageScroll] = useState(false);

    const [showScrollTop, setShowScrollTop] = useState(false);
    const mainRef = React.useRef(null);
    const location = useLocation();

    // Check if current page is dashboard
    const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';
    const isSidebarCollapsed = !isMobileViewport && (sidebarMode === 'collapsed' || (sidebarMode === 'hover' && !isSidebarHoverExpanded));
    const usesSidebarHoverOverlay = !isMobileViewport && sidebarMode === 'hover';

    const applySidebarMode = (nextMode) => {
        setSidebarMode(nextMode);
        if (nextMode !== 'hover') {
            setIsSidebarHoverExpanded(false);
        }
    };

    const toggleSidebar = () => {
        if (isMobileViewport) {
            setIsSidebarOpen((current) => !current);
            return;
        }

        applySidebarMode(isSidebarCollapsed ? 'expanded' : 'collapsed');
    };

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleResize = () => {

            const nextIsMobile = window.innerWidth < 768;
            setIsMobileViewport(nextIsMobile);

            if (nextIsMobile) {
                setIsSidebarOpen(false);
                setIsSidebarHoverExpanded(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [createRouteNeedsPageScroll, location.pathname]);



    useEffect(() => {
        if (typeof window === 'undefined' || isMobileViewport) return;
        window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, sidebarMode);
    }, [sidebarMode, isMobileViewport]);

    useEffect(() => {
        if (sidebarMode !== 'hover') {
            setIsSidebarHoverExpanded(false);
        }
    }, [sidebarMode]);

    useEffect(() => {
        const scrollModeEventName = location.pathname === '/accounts/create'
            ? ACCOUNTS_CREATE_SCROLL_MODE_EVENT
            : isTransactionsCreateRoute(location.pathname)
                ? TRANSACTIONS_CREATE_SCROLL_MODE_EVENT
                : isPartiesCreateRoute(location.pathname)
                    ? PARTIES_CREATE_SCROLL_MODE_EVENT
                : null;

        if (!scrollModeEventName) {
            setCreateRouteNeedsPageScroll(false);
            return undefined;
        }

        const handleScrollModeChange = (event) => {
            setCreateRouteNeedsPageScroll(Boolean(event.detail?.shouldUseWholePageScroll));
        };

        window.addEventListener(scrollModeEventName, handleScrollModeChange);
        return () => window.removeEventListener(scrollModeEventName, handleScrollModeChange);
    }, [location.pathname]);

    // Prevent back navigation
    React.useEffect(() => {
        // Push current state to history stack
        window.history.pushState(null, document.title, window.location.href);

        const handlePopState = () => {
            // If back button clicked, push state again to stay on page
            window.history.pushState(null, document.title, window.location.href);
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    useEffect(() => {
        const container = mainRef.current;
        if (!container) {
            setShowScrollTop(false);
            return undefined;
        }

        const updateScrollState = () => {
            setShowScrollTop(container.scrollTop > 120);
        };

        updateScrollState();
        container.addEventListener('scroll', updateScrollState, { passive: true });
        return () => container.removeEventListener('scroll', updateScrollState);
    }, [location.pathname]);

    const scrollToTop = () => {
        const container = mainRef.current;
        if (!container) return;
        container.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const sidebarLayoutValue = {
        isMobileViewport,
        isSidebarCollapsed,
        isSidebarOpen,
        sidebarMode,
        toggleSidebar,
        setSidebarHoverExpanded: setIsSidebarHoverExpanded,
        setSidebarMode: applySidebarMode
    };

    return (
            <SidebarLayoutProvider value={sidebarLayoutValue}>
                <div className="flex h-screen bg-white overflow-hidden print:h-auto print:overflow-visible print:bg-white">
                <div className={cn(
                    "no-print print:hidden flex-none",
                    usesSidebarHoverOverlay && "md:w-[66px] lg:w-[68px]"
                )}>
                    <Sidebar
                        isOpen={isSidebarOpen}
                        onClose={() => setIsSidebarOpen(false)}
                        isCollapsed={isSidebarCollapsed}
                    />
                </div>

                <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out print:w-full print:block print:h-auto print:overflow-visible">
                    <main className={cn(
                        "flex-1 no-scrollbar relative min-h-0 flex flex-col print:h-auto print:overflow-visible print:block print:w-full print:flex-none",
                        isDashboard ? "overflow-hidden" : "overflow-y-auto"
                    )} ref={mainRef}>
                        <div className={cn(
                            "w-full flex flex-col print:h-auto print:block print:w-full",
                            "h-full min-h-0 flex-1", isDashboard && "overflow-hidden"
                        )}>
                            <div className={cn(
                                "flex-1 min-h-0"
                            )}>
                                {children}
                            </div>

                        </div>
                    </main>

                    {showScrollTop && (
                        <button
                            type="button"
                            onClick={scrollToTop}
                            className="fixed right-4 bottom-4 z-[90] flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white shadow-lg shadow-black/20 transition-colors hover:bg-neutral-800 no-print print:hidden"
                            aria-label="Scroll to top"
                        >
                            <ArrowUp size={20} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </div>
        </SidebarLayoutProvider>
    );
};

export default Layout;
