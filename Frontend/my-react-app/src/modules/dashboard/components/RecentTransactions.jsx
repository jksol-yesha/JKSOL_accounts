import React from 'react';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import LoadingOverlay from '../../../components/common/LoadingOverlay';
import useDelayedOverlayLoader from '../../../hooks/useDelayedOverlayLoader';
import isIgnorableRequestError from '../../../utils/isIgnorableRequestError';
import { ListFilter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../utils/cn';
import apiService from '../../../services/api';
import { useBranch } from '../../../context/BranchContext';
import { useYear } from '../../../context/YearContext';
import { usePreferences } from '../../../context/PreferenceContext';
import { useOrganization } from '../../../context/OrganizationContext';
import { useAuth } from '../../../context/AuthContext';

const DescriptionTooltip = ({ description }) => {
    const [visible, setVisible] = React.useState(false);
    if (!description || description === '-') return <span className="text-[13px] font-medium text-gray-400 recent-laptop-description-text">-</span>;
    const needsTooltip = description.length > 25;
    return (
        <span
            className="relative inline-block w-full max-w-[200px]"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span className="block truncate text-[13px] font-medium text-gray-800 cursor-default hover:text-gray-900 transition-colors recent-laptop-description-text">
                {description}
            </span>
            {needsTooltip && visible && (
                <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[280px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 animate-in fade-in duration-150 pointer-events-none">
                    <span className="flex items-center gap-1.5 py-0.5">
                        <span className="text-[12px] font-semibold text-gray-700 whitespace-normal break-words leading-relaxed recent-laptop-description-text">{description}</span>
                    </span>
                </span>
            )}
        </span>
    );
};

const RecentTransactions = ({ maxVisibleDesktopRows = 9, fillAvailableHeight = false }) => {
    const { selectedBranch, loading: branchLoading, getBranchFilterValue } = useBranch();
    const navigate = useNavigate();
    const { selectedYear, loading: yearLoading } = useYear();
    const { selectedOrg } = useOrganization();
    const { user } = useAuth();
    const { formatCurrency, formatDate } = usePreferences();
    const [transactions, setTransactions] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = React.useState(false);
    const cacheKey = `dashboard:recentTx:${selectedOrg?.id || 'org'}:${selectedYear?.id || 'fy'}`;

    React.useEffect(() => {
        try {
            const raw = sessionStorage.getItem(cacheKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setTransactions(parsed);
                setHasFetchedOnce(true);
            }
        } catch (e) {
            // Ignore cache parse errors and continue with live fetch
        }
    }, [cacheKey]);

    const MAX_VISIBLE_ROWS = 9;

    const deriveCategoryName = (txn) => {
        return (
            txn.category?.name ||
            txn.categoryName ||
            txn.subCategory?.name ||
            txn.subCategoryName ||
            'Uncategorized'
        );
    };

    React.useEffect(() => {
        const controller = new AbortController();

        const fetchRecent = async () => {
            // Check loading states again inside (though guarded by debounce, good for safety)
            if (branchLoading || yearLoading) return;
            if (!user || !selectedBranch?.id || !selectedYear?.id) return;

            setLoading(true);
            try {
                const branchFilter = getBranchFilterValue();
                if (!branchFilter) return;
                const mapResponse = (rows = []) => rows.map(t => ({
                    id: t.id,
                    date: t.txnDate,
                    notes: t.notes || '-',
                    category: deriveCategoryName(t),
                    type: t.transactionType?.name || (t.txnType ? t.txnType.charAt(0).toUpperCase() + t.txnType.slice(1) : 'Unknown'),
                    amount: t.amountBaseCurrency || t.amountBase,
                    baseCurrency: t.baseCurrency,
                    party: t.contact || t.payee || '-',
                    createdBy: t.createdByName || '-'
                }));

                if (Array.isArray(branchFilter)) {
                    const responses = await Promise.all(
                        branchFilter.map((branchId) =>
                            apiService.transactions.getAll({
                                branchId,
                                financialYearId: selectedYear.id,
                                limit: 50
                            }, { signal: controller.signal })
                        )
                    );

                    const combined = responses
                        .filter(r => r?.success && Array.isArray(r?.data))
                        .flatMap(r => mapResponse(r.data))
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (!controller.signal.aborted) {
                        setTransactions(combined);
                        try {
                            sessionStorage.setItem(cacheKey, JSON.stringify(combined));
                        } catch (e) {
                            // Ignore storage errors
                        }
                    }
                } else {
                    const response = await apiService.transactions.getAll({
                        branchId: branchFilter,
                        financialYearId: selectedYear.id,
                        limit: 50
                    }, { signal: controller.signal });

                    if (response.success) {
                        const mapped = mapResponse(response.data);
                        if (!controller.signal.aborted) {
                            setTransactions(mapped);
                            try {
                                sessionStorage.setItem(cacheKey, JSON.stringify(mapped));
                            } catch (e) {
                                // Ignore storage errors
                            }
                        }
                    }
                }
            } catch (error) {
                if (isIgnorableRequestError(error)) return;
                console.error("Failed to fetch recent transactions:", error);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setHasFetchedOnce(true);
                }
            }
        };

        // Debounce fetch to prevent "Canceled" noise when dependencies update rapidly (e.g. Branch then Year context)
        const timeoutId = setTimeout(() => {
            // Dependencies check
            if (!branchLoading && !yearLoading && user && selectedBranch?.id && selectedYear?.id) {
                fetchRecent();
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [user, selectedBranch?.id, selectedYear?.id, selectedOrg?.id, branchLoading, yearLoading, getBranchFilterValue, cacheKey]);

    const displayTransactions = transactions;
    const showLoadingState = loading && !hasFetchedOnce;
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);
    const desktopTableHeight = (maxVisibleDesktopRows * 30) + 38;
    const desktopVisibleRows = Math.min(displayTransactions.length || maxVisibleDesktopRows, maxVisibleDesktopRows);
    const desktopContentHeight = (desktopVisibleRows * 30) + 38;
    const shouldAutoSizeDesktop = !fillAvailableHeight && displayTransactions.length > 0 && displayTransactions.length <= maxVisibleDesktopRows;
    const desktopTableStyle = fillAvailableHeight
        ? undefined
        : shouldAutoSizeDesktop
            ? { height: `${desktopContentHeight}px`, maxHeight: `${desktopTableHeight}px` }
            : { height: `${desktopTableHeight}px`, maxHeight: `${desktopTableHeight}px` };

    return (
        <Card
            title={
                <div className="flex items-center space-x-2 pt-1">
                    <ListFilter size={16} className="text-primary" />
                    <span className="text-[13px] font-bold recent-laptop-title">Recent Transactions</span>
                </div>
            }
            headerAction={<Button onClick={() => navigate('/transactions')} variant="primary" size="sm" className="text-[10px] uppercase font-bold px-4 py-1.5 h-auto">View All</Button>}
            headerClassName="py-3"
            noPadding
            className={cn("overflow-hidden", fillAvailableHeight ? "h-full" : shouldAutoSizeDesktop ? "h-auto self-start" : "h-full")}
        >
            <div
                className={cn(
                    "flex flex-col min-h-0 overflow-hidden",
                    fillAvailableHeight ? "h-full" : shouldAutoSizeDesktop ? "h-auto" : "h-full"
                )}
                aria-busy={loading}
            >

                {/* Mobile Card View */}
                <div
                    className="dashboard-tablet-recent-mobile relative lg:hidden flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar"
                    style={{ maxHeight: `${MAX_VISIBLE_ROWS * 54}px` }}
                >
                    {displayTransactions.length > 0 ? (
                        displayTransactions.map((tx) => (
                            <div key={tx.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm space-y-3">
                                <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Date</div>
                                        <div className="font-bold text-gray-800 text-sm">{formatDate(tx.date)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Amount</div>
                                        <div className={cn("font-bold text-sm tabular-nums", tx.type?.toLowerCase() === 'income' ? "text-emerald-600" : "text-gray-900")}>
                                            {formatCurrency(tx.amount)}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Description</div>
                                        <div className="font-medium text-gray-700 text-[10px] truncate">{tx.notes}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Party</div>
                                        <div className="font-medium text-gray-600 text-xs truncate">{tx.party}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Type</div>
                                        <span className={cn("text-[10px] font-bold",
                                            tx.type?.toLowerCase() === 'income' ? "text-emerald-600" :
                                                tx.type?.toLowerCase() === 'expense' ? "text-rose-600" :
                                                    "text-blue-600"
                                        )}>{tx.type}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        !showLoadingState && (
                            <div className="py-12 text-center text-gray-400 text-sm font-medium">No transactions found</div>
                        )
                    )}
                    {showOverlayLoader && <LoadingOverlay label="Loading transactions..." />}
                </div>

                {/* Desktop Table View */}
                <div
                    className={cn(
                        "dashboard-tablet-recent-desktop relative hidden lg:block min-h-0 overflow-y-auto recent-laptop-scroll",
                        fillAvailableHeight && "recent-laptop-scroll-fill",
                        fillAvailableHeight ? "flex-1" : shouldAutoSizeDesktop ? "flex-none" : "flex-1"
                    )}
                    style={desktopTableStyle}
                >
                    <table className="w-full text-sm text-left table-fixed recent-laptop-table">
                        <thead className="sticky top-0 z-10 text-xs text-gray-600 font-extrabold uppercase bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="w-[11%] px-4 py-2 font-bold whitespace-nowrap">Date</th>
                                <th className="w-[8%] px-4 py-2 font-bold whitespace-nowrap">Type</th>
                                <th className="w-[14%] px-4 py-2 font-bold whitespace-nowrap">Party</th>
                                <th className="w-[14%] pl-4 pr-0 py-2 font-bold whitespace-nowrap">Category</th>
                                <th className="w-[12%] pl-0 pr-20 py-2 font-bold whitespace-nowrap text-right">Amount</th>
                                <th className="w-[21%] pl-20 pr-4 py-2 font-bold whitespace-nowrap recent-laptop-description-col">Description</th>
                                <th className="w-[10%] px-4 py-2 font-bold whitespace-nowrap">Created by</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displayTransactions.length > 0 ? displayTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-[7px] text-[13px] font-medium text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                                    <td className="px-4 py-[7px] whitespace-nowrap">
                                        <span className={cn("text-[10px] font-bold",
                                            "recent-desktop-type-body",
                                            tx.type?.toLowerCase() === 'income' ? "text-emerald-600" :
                                                tx.type?.toLowerCase() === 'expense' ? "text-rose-600" :
                                                    "text-blue-600"
                                        )}>{tx.type}</span>
                                    </td>
                                    <td className="px-4 py-[7px] text-[13px] font-normal text-gray-700 truncate">{tx.party}</td>
                                    <td className="pl-4 pr-0 py-[7px] text-[13px] text-gray-500 truncate">{tx.category}</td>
                                    <td className={cn("pl-0 pr-20 py-[7px] text-[13px] font-bold tabular-nums text-right whitespace-nowrap", tx.type?.toLowerCase() === 'income' ? "text-emerald-600" : "text-gray-900")}>
                                        {formatCurrency(tx.amount)}
                                    </td>
                                    <td className="pl-20 pr-4 py-[7px] text-[13px] font-medium text-gray-800 recent-laptop-description">
                                        <DescriptionTooltip description={tx.notes} />
                                    </td>
                                    <td className="px-4 py-[7px] text-[11px] font-medium text-gray-500 whitespace-nowrap truncate">{tx.createdBy}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-gray-400 text-sm font-medium">
                                        {!showLoadingState ? 'No transactions found' : ''}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {showOverlayLoader && <LoadingOverlay label="Loading transactions..." />}
                </div>

            </div>
        </Card >
    );
};

export default RecentTransactions;
