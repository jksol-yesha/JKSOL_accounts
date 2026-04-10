import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '../../utils/cn';

import { useWebSocket } from '../../hooks/useWebSocket';
import InvitationNotification from '../notifications/InvitationNotification';
import BranchAccessNotification from '../notifications/BranchAccessNotification';

const ACCOUNTS_CREATE_SCROLL_MODE_EVENT = 'accounts-create-scroll-mode';
const TRANSACTIONS_CREATE_SCROLL_MODE_EVENT = 'transactions-create-scroll-mode';
const PARTIES_CREATE_SCROLL_MODE_EVENT = 'parties-create-scroll-mode';

const isTransactionsCreateRoute = (pathname) => (
    pathname === '/transactions/create' || /^\/transactions\/edit\/[^/]+$/.test(pathname)
);

const isPartiesCreateRoute = (pathname) => pathname === '/parties/create';

const shouldUseDesktopFooter = (pathname, width, shouldUseWholePageScroll = false) => {
    if (pathname === '/accounts/create' || isTransactionsCreateRoute(pathname) || isPartiesCreateRoute(pathname)) {
        return width >= 1280 && !shouldUseWholePageScroll;
    }

    return width >= 1280;
};

const Footer = ({ className }) => (
    <footer className={cn("bg-white border-t border-gray-100 py-3 px-6 text-center text-[10px] text-gray-400 flex-none no-print print:hidden", className)}>
        <p>© 2026 JKSOL. All rights reserved.</p>
    </footer>
);

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() =>
        typeof window !== 'undefined'
            ? window.innerWidth >= 768 && window.innerWidth <= 1024
            : false
    );
    const [isDesktopFooter, setIsDesktopFooter] = useState(() =>
        typeof window !== 'undefined'
            ? shouldUseDesktopFooter(window.location.pathname, window.innerWidth)
            : true
    );
    const [createRouteNeedsPageScroll, setCreateRouteNeedsPageScroll] = useState(false);
    const [invitationNotification, setInvitationNotification] = useState(null);
    const [branchAccessNotification, setBranchAccessNotification] = useState(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const mainRef = React.useRef(null);
    const location = useLocation();
    const { on } = useWebSocket();

    // Check if current page is dashboard
    const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let previousMode = window.innerWidth < 768 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop';

        const handleResize = () => {
            setIsDesktopFooter(shouldUseDesktopFooter(location.pathname, window.innerWidth, createRouteNeedsPageScroll));
            const nextMode = window.innerWidth < 768 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop';
            if (nextMode === previousMode) return;

            if (nextMode === 'tablet') {
                setIsCollapsed(true);
                setIsSidebarOpen(false);
            } else if (nextMode === 'desktop') {
                setIsCollapsed(false);
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(false);
            }

            previousMode = nextMode;
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [createRouteNeedsPageScroll, location.pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setIsDesktopFooter(shouldUseDesktopFooter(location.pathname, window.innerWidth, createRouteNeedsPageScroll));
    }, [createRouteNeedsPageScroll, location.pathname]);

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

    // Listen for invitation notifications
    useEffect(() => {
        const unsubscribe = on('invitation:received', (data) => {
            setInvitationNotification(data);

            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                setInvitationNotification(null);
            }, 10000);
        });

        return unsubscribe;
    }, [on]);

    // Listen for branch access update notifications
    useEffect(() => {
        const unsubscribe = on('branch_access:updated', (data) => {
            setBranchAccessNotification(data);

            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                setBranchAccessNotification(null);
            }, 10000);
        });

        return unsubscribe;
    }, [on]);

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
        if (!container || isDesktopFooter) {
            setShowScrollTop(false);
            return undefined;
        }

        const updateScrollState = () => {
            setShowScrollTop(container.scrollTop > 120);
        };

        updateScrollState();
        container.addEventListener('scroll', updateScrollState, { passive: true });
        return () => container.removeEventListener('scroll', updateScrollState);
    }, [location.pathname, isDesktopFooter]);

    const scrollToTop = () => {
        const container = mainRef.current;
        if (!container) return;
        container.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (

        <div className="flex h-screen bg-slate-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
            {/* Sidebar with collapsed state prop */}
            <div className="no-print print:hidden">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    isCollapsed={isCollapsed}
                />
            </div>

            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out print:w-full print:block print:h-auto print:overflow-visible">
                {/* Header with toggle handler and Year Props */}
                <div className="no-print print:hidden">
                    <Header
                        onMenuClick={() => setIsSidebarOpen(true)}
                        isCollapsed={isCollapsed}
                        toggleSidebar={toggleSidebar}
                    />
                </div>

                {/* Main Content Area */}
                <main className={cn(
                    "flex-1 no-scrollbar relative min-h-0 flex flex-col print:h-auto print:overflow-visible print:block print:w-full print:flex-none",
                    isDesktopFooter && isDashboard ? "overflow-hidden" : "overflow-y-auto"
                )} ref={mainRef}>
                    <div className={cn(
                        "w-full flex flex-col print:h-auto print:block print:w-full",
                        isDesktopFooter
                            ? "h-full min-h-0 flex-1"
                            : "min-h-full",
                        isDesktopFooter && isDashboard && "overflow-hidden"
                    )}>
                        <div className={cn(
                            isDesktopFooter ? "flex-1 min-h-0" : "flex-none"
                        )}>
                            {children}
                        </div>

                        {!isDesktopFooter && <Footer className="mt-auto" />}
                    </div>
                </main>

                {isDesktopFooter && (
                    <Footer className="sticky bottom-0 z-10" />
                )}

                {!isDesktopFooter && showScrollTop && (
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

            {/* Invitation Notification Toast */}
            {invitationNotification && (
                <InvitationNotification
                    invitation={invitationNotification}
                    onClose={() => setInvitationNotification(null)}
                />
            )}

            {/* Branch Access Update Notification Toast */}
            {branchAccessNotification && (
                <BranchAccessNotification
                    notification={branchAccessNotification}
                    onClose={() => setBranchAccessNotification(null)}
                />
            )}
        </div>

    );
};

export default Layout;
