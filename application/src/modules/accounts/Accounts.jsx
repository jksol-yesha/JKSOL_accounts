import React, {
    useState,
    useMemo,
    useEffect,
    useLayoutEffect,
    useRef,
  } from "react";
  import { createPortal } from "react-dom";
  import { useLocation } from "react-router-dom";
  import {
    Edit,
    Trash2,
    Plus,
    Search,
    Copy,
    Check,
    ChevronDown,
    Loader2,
    Landmark,
    CreditCard,
    Banknote,
    ChevronUp,
    Calendar,
    TrendingUp,
    RefreshCcw,
    ArrowRight,
    Wallet,
    PiggyBank,
    Briefcase,
    Activity,
  } from "lucide-react";
  import { useBranch } from "../../context/BranchContext";
  import { useYear } from "../../context/YearContext";
  import { usePreferences } from "../../context/PreferenceContext";
  import { useWebSocket } from "../../hooks/useWebSocket";
  import useDelayedOverlayLoader from "../../hooks/useDelayedOverlayLoader";
  import LoadingOverlay from "../../components/common/LoadingOverlay";
  import ConfirmDialog from "../../components/common/ConfirmDialog";
  import PageHeader from "../../components/layout/PageHeader";
  import PageContentShell from "../../components/layout/PageContentShell";
  import CustomSelect from "../../components/common/CustomSelect";
  import apiService from "../../services/api";
  import { cn } from "../../utils/cn";
  import {
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_SUBTYPE_LABELS,
    ACCOUNT_SUBTYPES,
  } from "./constants";
  import isIgnorableRequestError from "../../utils/isIgnorableRequestError";
  import { TRANSACTION_DATA_CHANGED_EVENT } from "../transactions/transactionDataSync";
  import { useToast } from "../../context/ToastContext";
  import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
  } from "recharts";
  import { AgGridReact } from "ag-grid-react";
  import {
    ModuleRegistry,
    AllCommunityModule,
    themeQuartz,
  } from "ag-grid-community";
  
  ModuleRegistry.registerModules([AllCommunityModule]);
  import CreateAccount from "./components/CreateAccount";
  
  const FilterDropdown = ({
    value,
    onChange,
    options,
    variant = "default",
    hideIcon = false,
    placeholder = "",
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
  
    useLayoutEffect(() => {
      if (!isOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDropdownPosition(null);
        return;
      }
      const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left,
          minWidth: Math.max(160, rect.width),
        });
      };
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [isOpen]);
  
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          !dropdownRef.current?.contains(event.target) &&
          !dropdownMenuRef.current?.contains(event.target)
        )
          setIsOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    const selectedOption = options.find((opt) => opt.value === value) || {
      label: placeholder || options[0]?.label,
    };
    const isTitleVar = variant === "title";
  
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`group relative flex items-center justify-between gap-1 transition-colors focus:outline-none ${isTitleVar ? "px-1 py-1 text-[18px] md:text-[20px] font-extrabold text-slate-800 hover:text-primary" : "h-[32px] px-3 bg-white text-gray-600 border border-gray-200 text-[13px] font-medium rounded-md hover:bg-gray-50 focus:ring-4 focus:ring-primary/10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"}`}
        >
          <div
            className={`flex items-center gap-1.5 ${!isTitleVar ? "" : "font-extrabold"}`}
          >
            <span>{selectedOption?.label}</span>
          </div>
          {!hideIcon && (
            <ChevronDown
              size={isTitleVar ? 16 : 14}
              className={`transition-transform duration-200 ml-1 ${isOpen ? "rotate-180" : ""} ${isTitleVar ? "text-slate-400 group-hover:text-primary" : "text-gray-400 group-hover:text-gray-600"}`}
            />
          )}
        </button>
  
        {isOpen &&
          dropdownPosition &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropdownMenuRef}
              className="fixed bg-white rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 py-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-200"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                minWidth: dropdownPosition.minWidth,
              }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 transition-colors ${value === option.value ? "bg-[#EEF0FC]" : "hover:bg-[#EEF0FC]"}`}
                >
                  <span
                    className={`text-[13px] w-full flex items-center gap-2 ${value === option.value ? "font-bold text-[#4A8AF4]" : "font-medium text-slate-700"}`}
                  >
                    <div className="w-4 flex justify-center shrink-0">
                      {value === option.value && (
                        <Check
                          size={14}
                          className="text-[#4A8AF4]"
                          strokeWidth={2.5}
                        />
                      )}
                    </div>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>
    );
  };
  
  const MOCK_30_DAYS = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      bank: 45000 + Math.random() * 20000 - 5000,
      card: 5000 + Math.random() * 3000 - 1000,
      cash: 1000 + Math.random() * 800 - 200,
    };
  });
  
  const MOCK_12_MONTHS = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      bank: 40000 + i * 2000 + Math.random() * 10000,
      card: 8000 + i * 100 + Math.random() * 2000,
      cash: 1200 + i * 50 + Math.random() * 500,
    };
  });
  
  const SummaryItem = ({
    title,
    amount,
    // eslint-disable-next-line no-unused-vars
    icon: Icon,
    colorClass,
    bgClass,
    currency,
  }) => {
    const { formatCurrency } = usePreferences();
    return (
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/60",
            bgClass,
          )}
        >
          <Icon size={16} className={colorClass} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-0.5">
            {title}
          </p>
          <h3 className="text-[17px] font-bold text-gray-800 tracking-tight">
            {formatCurrency(amount, currency)}
          </h3>
        </div>
      </div>
    );
  };
  
  const CustomTooltip = ({ active, payload, label, currency }) => {
    const { formatCurrency } = usePreferences();
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-100 rounded-lg p-2.5 shadow-md z-50 min-w-[140px]">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            {label}
          </p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}
                </span>
                <span className="text-xs font-bold text-gray-900">
                  {formatCurrency(entry.value, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };
  
  const createInitialDeleteDialog = () => ({
    open: false,
    id: null,
    name: "",
    loading: false,
  });
  
  const isUsedAccountDeleteError = (message) => {
    const value = String(message || "");
    return (
      /cannot delete this account because it is used in associated records/i.test(
        value,
      ) || /modify (the )?status to 'inactive'/i.test(value)
    );
  };
  
  const normalizeAccount = (account) => ({
    ...account,
    accountNumber: account.accountNumber ?? account.account_number ?? null,
    accountHolderName:
      account.accountHolderName ?? account.account_holder_name ?? "",
    bankName: account.bankName ?? account.bank_name ?? null,
    ifsc: account.ifsc ?? null,
    zipCode: account.zipCode ?? account.zip_code ?? null,
    swiftCode: account.swiftCode ?? account.zipCode ?? account.zip_code ?? null,
    bankBranchName: account.bankBranchName ?? account.bank_branch_name ?? null,
    createdAt: account.createdAt ?? account.created_at ?? null,
    creatorName: account.creator?.fullName || "-",
    createdByDisplayName:
      account.lastEditor?.fullName || account.creator?.fullName || "-",
  });
  
  const getBankDetailItems = (account) => [
    {
      label: "Account Holder",
      value: account.accountHolderName?.trim() || "N/A",
    },
    { label: "Bank Name", value: account.bankName?.trim() || "N/A" },
    { label: "Account No", value: account.accountNumber?.trim() || "N/A" },
    { label: "IFSC Code", value: account.ifsc?.trim() || "N/A" },
    { label: "Swift Code", value: account.swiftCode?.trim() || "N/A" },
    { label: "Branch Name", value: account.bankBranchName?.trim() || "N/A" },
  ];
  
  const buildBankDetailsClipboardText = (account) =>
    [
      "Bank Details",
      ...getBankDetailItems(account).map(
        (item) => `${item.label}: ${item.value}`,
      ),
    ].join("\n");
  
  const copyTextToClipboard = async (text) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  
    if (typeof document === "undefined") {
      throw new Error("Clipboard is not available");
    }
  
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
  
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  };
  
  // Stable AG Grid pure functions (Hoist completely out to prevent structural Redraw loops)
  const genericIsFullWidthRow = (params) =>
    params.rowNode.data && params.rowNode.data.isGroupHeader;
  const genericGetRowHeight = (params) =>
    params.data && params.data.isGroupHeader ? 28 : 42;
  const GenericFullWidthGroupCellRenderer = (params) => {
    if (!params.data) return null;
    return (
      <div className="w-full h-full flex items-center px-4 border-b border-gray-100 bg-[#fafafa]">
        <span className="font-semibold text-[11px] text-gray-500 uppercase tracking-wider">
          {params.data.groupName}
        </span>
        <span className="ml-2 text-[11px] text-gray-400 font-medium">
          ({params.data.count} {params.data.count !== 1 ? "accounts" : "account"})
        </span>
      </div>
    );
  };
  
  const getDisplayBalance = (account) => {
    // API returns convertedBalance in target/base currency; fallback to raw openingBalance.
    const value = account?.convertedBalance ?? account?.openingBalance ?? 0;
    return Number(value) || 0;
  };
  
  const getDisplayClosingBalance = (account) => {
    const value =
      account?.closingBalance ??
      account?.convertedClosingBalance ??
      account?.closing_balance ??
      account?.openingBalance ??
      0;
    return Number(value) || 0;
  };
  
  const BranchTooltip = ({ branchNames }) => {
    if (!branchNames || branchNames.length === 0)
      return <span className="text-gray-400 text-xs">-</span>;
  
    const displayText = branchNames.join(", ");
    const needsTooltip = branchNames.length > 1 || displayText.length > 18;
  
    return (
      <span className="relative inline-block max-w-full group/branch">
        <span className="block truncate max-w-[120px] text-xs font-bold text-primary hover:text-primary/80 transition-colors">
          {displayText}
        </span>
        {needsTooltip && (
          <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[240px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 opacity-0 group-hover/branch:opacity-100 transition-opacity duration-150 pointer-events-none">
            <span className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
              Branches
            </span>
            {branchNames.map((branchName, idx) => (
              <span key={idx} className="flex items-center gap-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-gray-700 truncate">
                  {branchName}
                </span>
              </span>
            ))}
          </span>
        )}
      </span>
    );
  };
  
  const DescriptionTooltip = ({ description }) => {
    if (!description) return <span className="text-xs text-gray-500">-</span>;
  
    const needsTooltip = description.length > 18;
  
    return (
      <span className="relative inline-block max-w-full group/desc">
        <span className="text-xs text-gray-500 truncate max-w-[130px] inline-block hover:text-gray-700 transition-colors">
          {description}
        </span>
        {needsTooltip && (
          <span className="absolute left-0 top-full mt-1.5 z-[9999] min-w-[150px] max-w-[280px] bg-white border border-gray-100 rounded-xl shadow-xl p-2.5 opacity-0 group-hover/desc:opacity-100 transition-opacity duration-150 pointer-events-none">
            <span className="text-[12px] font-semibold text-gray-700 break-words leading-relaxed">
              {description}
            </span>
          </span>
        )}
      </span>
    );
  };
  
  const ACCOUNT_NAME_TOOLTIP_MAX_WIDTH = 280;
  const ACCOUNT_NAME_TOOLTIP_MIN_WIDTH = 160;
  const ACCOUNT_NAME_TOOLTIP_GAP = 8;
  const ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER = 12;
  
  const AccountNameTooltip = ({ name, className = "", textClassName = "" }) => {
    const [visible, setVisible] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const [position, setPosition] = useState(null);
    const wrapperRef = useRef(null);
    const textRef = useRef(null);
    const content = name || "-";
    const shouldEnableTooltip = isTruncated || content.trim().length >= 18;
  
    const measureTruncation = () => {
      const wrapperNode = wrapperRef.current;
      const textNode = textRef.current;
      if (!wrapperNode || !textNode) return false;
  
      const truncated =
        textNode.scrollWidth > textNode.clientWidth + 1 ||
        wrapperNode.scrollWidth > wrapperNode.clientWidth + 1;
  
      setIsTruncated(truncated);
      return truncated;
    };
  
    useEffect(() => {
      if (typeof window === "undefined") return undefined;
  
      let frameId = null;
  
      const scheduleMeasurement = () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
  
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          measureTruncation();
        });
      };
  
      scheduleMeasurement();
  
      const resizeObserver =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => scheduleMeasurement())
          : null;
  
      if (wrapperRef.current) {
        resizeObserver?.observe(wrapperRef.current);
      }
      if (textRef.current) {
        resizeObserver?.observe(textRef.current);
      }
  
      window.addEventListener("resize", scheduleMeasurement);
      document.fonts?.ready?.then(() => scheduleMeasurement()).catch(() => {});
  
      return () => {
        window.removeEventListener("resize", scheduleMeasurement);
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
        resizeObserver?.disconnect();
      };
    }, [name]);
  
    useLayoutEffect(() => {
      if (!visible || !wrapperRef.current) return undefined;
  
      const updatePosition = () => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
  
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const tooltipWidth = Math.min(
          ACCOUNT_NAME_TOOLTIP_MAX_WIDTH,
          Math.max(ACCOUNT_NAME_TOOLTIP_MIN_WIDTH, rect.width + 24),
        );
  
        let left = rect.left;
        if (
          left + tooltipWidth >
          viewportWidth - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER
        ) {
          left =
            viewportWidth - tooltipWidth - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
        }
        if (left < ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
          left = ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
        }
  
        let top = rect.bottom + ACCOUNT_NAME_TOOLTIP_GAP;
        const estimatedHeight = 44;
        if (
          top + estimatedHeight >
          viewportHeight - ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER
        ) {
          top = rect.top - estimatedHeight - ACCOUNT_NAME_TOOLTIP_GAP;
        }
        if (top < ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER) {
          top = ACCOUNT_NAME_TOOLTIP_VIEWPORT_GUTTER;
        }
  
        setPosition({ top, left, width: tooltipWidth });
      };
  
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
  
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [visible]);
  
    return (
      <>
        <span
          ref={wrapperRef}
          className={cn("block max-w-full min-w-0", className)}
          onMouseEnter={() => {
            if (measureTruncation() || content.trim().length >= 18) {
              setVisible(true);
            }
          }}
          onMouseLeave={() => setVisible(false)}
          title={shouldEnableTooltip ? content : undefined}
        >
          <span ref={textRef} className={cn("block truncate", textClassName)}>
            {content}
          </span>
        </span>
  
        {visible &&
          position &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[240] rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
              }}
            >
              <span className="block whitespace-nowrap text-[12px] font-semibold leading-relaxed text-gray-700">
                {content}
              </span>
            </div>,
            document.body,
          )}
      </>
    );
  };
  
  const MobileAccountField = ({
    label,
    value,
    align = "left",
    colSpan = 1,
    valueClassName = "",
  }) => (
    <div
      className={cn(
        "min-w-0 space-y-0.5",
        colSpan === 2 && "col-span-2",
        align === "right" && "text-right",
      )}
    >
      <div className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          "text-xs font-medium text-gray-600 break-words",
          align === "right" && "text-right",
          valueClassName,
        )}
      >
        {value}
      </div>
    </div>
  );
  
  const Accounts = () => {
    const location = useLocation();
    const { selectedBranch } = useBranch();
    const { selectedYear } = useYear();
    const { showToast } = useToast();
    const { formatCurrency, formatDate, preferences } = usePreferences();
    const socketBranchId =
      typeof selectedBranch?.id === "number" ? selectedBranch.id : null;
    const { on } = useWebSocket(socketBranchId);
  
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const [dataRefreshTick, setDataRefreshTick] = useState(0);
    const [copiedBankDetailsId, setCopiedBankDetailsId] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState(createInitialDeleteDialog);
    const [drawerState, setDrawerState] = useState({
      open: false,
      account: null,
    });
    const [isDesktopView, setIsDesktopView] = useState(() =>
      typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
    );
  
    const cacheKey = `accounts:list:${selectedYear?.id || "fy"}:${preferences.currency || "currency"}`;
  
    const computedBalances = useMemo(() => {
      let bank = 0,
        card = 0,
        cash = 0,
        investment = 0;
      accounts.forEach((a) => {
        // Only sum active accounts to match the filtered list view
        const isActive = a.isActive || a.status === 1 || a.status === "active";
        if (!isActive) return;

        const val = getDisplayClosingBalance(a);
        const subtype = Number(a.subtype);

        if (subtype === ACCOUNT_SUBTYPES.BANK) bank += val;
        else if (subtype === ACCOUNT_SUBTYPES.CREDIT_CARD) card += val;
        else if (subtype === ACCOUNT_SUBTYPES.CASH || subtype === ACCOUNT_SUBTYPES.WALLET) cash += val;
        else if (subtype === ACCOUNT_SUBTYPES.INVESTMENT) investment += val;
      });
      return { bankBalance: bank, cardBalance: card, cashBalance: cash, investmentBalance: investment };
    }, [accounts]);
    const { bankBalance, cardBalance, cashBalance, investmentBalance } = computedBalances;
  
    const [chartTimeframe] = useState("30D");
    const [chartVisible, setChartVisible] = useState(false);
    const [trendData, setTrendData] = useState([]);
    const [isTrendLoading, setIsTrendLoading] = useState(false);
    const [listFilter] = useState("Active Accounts");
  
    const [groupBy, setGroupBy] = useState("none");
    const [activeRowPopover, setActiveRowPopover] = useState(null);
  
    // Click-away listener for popovers
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          !event.target.closest(".popover-container") &&
          !event.target.closest(".popover-trigger")
        ) {
          setActiveRowPopover(null);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    const chartData = useMemo(() => {
      if (trendData && trendData.length > 0) return trendData;
      return chartTimeframe === "30D" ? MOCK_30_DAYS : MOCK_12_MONTHS;
    }, [trendData, chartTimeframe]);
  
    useEffect(() => {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.accounts)) {
          setAccounts(parsed.accounts);
        }
        if (Array.isArray(parsed?.accounts)) {
          setHasFetchedOnce(true);
        }
      } catch {
        // Ignore cache parse errors and continue with live fetch
      }
    }, [cacheKey]);
  
    useEffect(() => {
      if (!chartVisible || !selectedYear?.id) return;

      const fetchTrend = async () => {
        setIsTrendLoading(true);
        try {
          const response = await apiService.dashboard.getAccountBalanceTrend({
            financialYearId: selectedYear.id,
            timeframe: chartTimeframe,
            branchId: "all",
          });
          if (response.success && Array.isArray(response.data)) {
            setTrendData(response.data);
          }
        } catch (error) {
          console.error("Failed to fetch account trend:", error);
          if (!isIgnorableRequestError(error)) {
            // Silently fall back to mock or empty if failed
          }
        } finally {
          setIsTrendLoading(false);
        }
      };

      fetchTrend();
    }, [chartVisible, chartTimeframe, selectedYear?.id, dataRefreshTick]);

    useEffect(() => {
      const handleTransactionDataChanged = () => {
        setDataRefreshTick((current) => current + 1);
      };
  
      window.addEventListener(
        TRANSACTION_DATA_CHANGED_EVENT,
        handleTransactionDataChanged,
      );
      return () =>
        window.removeEventListener(
          TRANSACTION_DATA_CHANGED_EVENT,
          handleTransactionDataChanged,
        );
    }, []);
  
    useEffect(() => {
      const controller = new AbortController();
  
      const fetchAccounts = async () => {
        if (location.pathname !== "/accounts") {
          return;
        }
        // Rankings endpoint requires financialYearId; skip fetch until YearContext is ready.
        if (!selectedYear?.id) {
          setLoading(false);
          return;
        }
  
        // Bypass global branch filter: Always fetch 'all' branches
        setLoading(true);
        try {
          const accountsResponse = await apiService.accounts.getAll(
            {
              financialYearId: selectedYear?.id,
            },
            { signal: controller.signal },
          );
  
          let fetchedAccounts = [];
          if (accountsResponse.success) {
            fetchedAccounts = (accountsResponse.data || []).map(normalizeAccount);
            setAccounts(fetchedAccounts);
          } else {
            setAccounts([]);
          }
  
          try {
            sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ accounts: fetchedAccounts }),
            );
          } catch {
            // Ignore storage errors
          }
        } catch (error) {
          if (isIgnorableRequestError(error)) return;
  
          console.error("Failed to fetch accounts:", error);
          setAccounts([]);
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
            setHasFetchedOnce(true);
          }
        }
      };
  
      if (location.pathname === "/accounts") {
        fetchAccounts();
      }
  
      return () => controller.abort();
    }, [
      location.pathname,
      cacheKey,
      preferences.currency,
      selectedYear?.id,
      dataRefreshTick,
    ]);
  
    useEffect(() => {
      const handleResize = () => {
        setIsDesktopView(window.innerWidth >= 1280);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
  
    //  Listen for real-time account updates
    useEffect(() => {
      const refreshAccounts = () => {
        setDataRefreshTick((current) => current + 1);
      };
  
      const unsubscribeTransactionCreate = on(
        "transaction:created",
        refreshAccounts,
      );
      const unsubscribeTransactionUpdate = on(
        "transaction:updated",
        refreshAccounts,
      );
      const unsubscribeTransactionDelete = on(
        "transaction:deleted",
        refreshAccounts,
      );
  
      return () => {
        unsubscribeTransactionCreate();
        unsubscribeTransactionUpdate();
        unsubscribeTransactionDelete();
      };
    }, [on]);
  
    useEffect(() => {
      // Listen for new accounts
      const unsubscribeCreate = on("account:created", (newAccount) => {
        const normalized = normalizeAccount(newAccount);
  
        // Add the new account to the list
        setAccounts((prev) => {
          // Check if account already exists (avoid duplicates)
          const exists = prev.some((a) => a.id === normalized.id);
          if (exists) return prev;
  
          // Add new account at the beginning
          return [normalized, ...prev];
        });
      });
  
      // Listen for updated accounts
      const unsubscribeUpdate = on("account:updated", (updatedAccount) => {
        const normalized = normalizeAccount(updatedAccount);
  
        // Update the account in the list
        setAccounts((prev) =>
          prev.map((a) => (a.id === normalized.id ? normalized : a)),
        );
      });
  
      // Listen for deleted accounts
      const unsubscribeDelete = on("account:deleted", (data) => {
        // Remove the account from the list
        setAccounts((prev) => prev.filter((a) => a.id !== data.id));
      });
  
      return () => {
        unsubscribeCreate();
        unsubscribeUpdate();
        unsubscribeDelete();
      };
    }, [on]);
  
    const [searchTerm, setSearchTerm] = useState("");
  
    const filteredAccounts = useMemo(() => {
      let result = [...accounts];
  
      if (listFilter === "Active Accounts") {
        result = result.filter(
          (a) => a.isActive || a.status === 1 || a.status === "active",
        );
      } else if (listFilter === "Inactive Accounts") {
        result = result.filter(
          (a) => !a.isActive && a.status !== 1 && a.status !== "active",
        );
      }
  
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        result = result.filter((account) => {
          const branchText = Array.isArray(account.branchNames)
            ? account.branchNames.join(" ")
            : "";
          return (
            String(account.name || account.bankName || account.accountName || "")
              .toLowerCase()
              .includes(term) ||
            String(account.typeLabel || "")
              .toLowerCase()
              .includes(term) ||
            String(account.subtypeLabel || "")
              .toLowerCase()
              .includes(term) ||
            String(account.description || "")
              .toLowerCase()
              .includes(term) ||
            String(account.createdByDisplayName || account.creatorName || "")
              .toLowerCase()
              .includes(term) ||
            String(branchText).toLowerCase().includes(term)
          );
        });
      }
  
      // Base Sorting (Grouping inherently relies on pre-sorting mathematically)
      result.sort((a, b) => {
        if (groupBy !== "none") {
          const groupA =
            groupBy === "subtype"
              ? String(a.subtypeLabel || "").toLowerCase()
              : String(a.typeLabel || "").toLowerCase();
          const groupB =
            groupBy === "subtype"
              ? String(b.subtypeLabel || "").toLowerCase()
              : String(b.typeLabel || "").toLowerCase();
          if (groupA < groupB) return -1;
          if (groupA > groupB) return 1;
        }
        return 0;
      });
  
      if (groupBy !== "none") {
        const finalResult = [];
        let currentGroup = null;
        let groupIndex = -1;
  
        for (let i = 0; i < result.length; i++) {
          const account = result[i];
          const groupName =
            groupBy === "subtype"
              ? String(account.subtypeLabel || "Unspecified")
              : String(account.typeLabel || "Unspecified");
  
          if (currentGroup !== groupName) {
            currentGroup = groupName;
            groupIndex = finalResult.length;
            finalResult.push({
              isGroupHeader: true,
              groupName: currentGroup,
              id: `group-header-${currentGroup}`,
              count: 1,
            });
          } else {
            finalResult[groupIndex].count++;
          }
          finalResult.push(account);
        }
        return finalResult;
      }
  
      return result;
    }, [accounts, searchTerm, listFilter, groupBy]);
  
    const handleCreateAccount = () => {
      setDrawerState({ open: true, account: null });
    };
  
    const handleDelete = (account) => {
      setDeleteDialog({
        open: true,
        id: account.id,
        name: account.name || account.bankName || account.accountName || "",
        loading: false,
      });
    };
  
    const handleCloseDeleteDialog = () => {
      setDeleteDialog((current) =>
        current.loading ? current : createInitialDeleteDialog(),
      );
    };
  
    const handleConfirmDelete = async () => {
      if (!deleteDialog.id) return;
  
      setDeleteDialog((current) => ({ ...current, loading: true }));
  
      try {
        await apiService.accounts.delete(deleteDialog.id);
        setAccounts((prev) => prev.filter((a) => a.id !== deleteDialog.id));
        setDeleteDialog(createInitialDeleteDialog());
      } catch (error) {
        console.error("Failed to delete account:", error);
        const msg =
          error.response?.data?.message ||
          error.message ||
          "Failed to delete account";
        setDeleteDialog(createInitialDeleteDialog());
        showToast(
          msg,
          "error",
          isUsedAccountDeleteError(msg)
            ? {
                persistent: true,
                duration: 0,
              }
            : undefined,
        );
      }
    };
  

  
    const isAssetBankAccount = (account) =>
      Number(account.accountType) === 1 && Number(account.subtype) === 12;
  
    useEffect(() => {
      if (!copiedBankDetailsId) return undefined;
  
      const timeoutId = window.setTimeout(() => {
        setCopiedBankDetailsId(null);
      }, 1600);
  
      return () => window.clearTimeout(timeoutId);
    }, [copiedBankDetailsId]);
  
    const handleCopyBankDetails = async (account) => {
      try {
        await copyTextToClipboard(buildBankDetailsClipboardText(account));
        setCopiedBankDetailsId(account.id);
        showToast("Bank details copied", "success");
      } catch (error) {
        console.error("Failed to copy bank details:", error);
        showToast("Failed to copy bank details", "error");
      }
    };
  
    const showOverlayLoader = useDelayedOverlayLoader(loading, hasFetchedOnce);
  
    // Cell Renderers define how specific columns render complex UI
    const NameCellRenderer = (params) => {
      if (!params.data) return null;
      const account = params.data;
      let IconComponent = Banknote;
      if (account.subtype === 12 || account.subtype === "12")
        IconComponent = Landmark;
      else if (
        account.subtype === 22 ||
        account.subtype === "22" ||
        account.subtype === 21 ||
        account.subtype === "21"
      )
        IconComponent = CreditCard;
      else if (account.type === 20 || account.type === "20")
        IconComponent = PiggyBank;
      else if (account.subtype === 13 || account.subtype === "13")
        IconComponent = Briefcase;
      else if (account.subtype === 11 || account.subtype === "11")
        IconComponent = Wallet;
      else if (account.type === 4 || account.type === "4")
        IconComponent = Activity;
  
      return (
        <div className="flex items-center gap-2 h-full w-full group">
          <div className="flex items-center justify-center shrink-0 w-4 h-4 text-gray-400">
            <IconComponent size={14} strokeWidth={2} />
          </div>
          <AccountNameTooltip
            name={account.name}
            className="flex-1 min-w-0"
            textClassName="text-[12px] font-semibold text-gray-800 text-left cursor-default leading-snug"
          />
        </div>
      );
    };
  
    const SubtypeCellRenderer = (params) => {
      if (!params.data || params.data.isGroupHeader) return null;
      const account = params.data;
      const showExpand = isAssetBankAccount(account);
  
      return (
        <div className="flex items-center justify-between gap-2 h-full w-full">
          <span className="truncate">{account.subtypeLabel || ""}</span>
          {showExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveRowPopover((prev) =>
                  prev?.id === account.id
                    ? null
                    : {
                        id: account.id,
                        rect: { top: rect.top, right: rect.right },
                        account,
                      },
                );
              }}
              className="shrink-0 popover-trigger inline-flex items-center justify-center p-1 rounded-sm text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors bg-gray-100"
              title="View Bank Details"
            >
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      );
    };
  

  
    const ActionCellRenderer = (params) => {
      if (!params.data || params.data.isGroupHeader) return null;
      const account = params.data;
      return (
        <div className="flex items-center justify-end gap-1.5 h-full pr-1">
          <button
            onClick={() => setDrawerState({ open: true, account })}
            className="p-1 text-gray-400 hover:text-[#4A8AF4] transition-colors"
            title="Edit"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={() => handleDelete(account)}
            className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      );
    };
  
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const columnDefs = useMemo(
      () => [
        {
          field: "name",
          headerName: "Name",
          flex: 2,
          minWidth: 160,
          cellRenderer: NameCellRenderer,
          filter: "agTextColumnFilter",
        },
        {
          field: "subtypeLabel",
          headerName: "Subtype",
          flex: 1,
          minWidth: 100,
          cellRenderer: SubtypeCellRenderer,
          filter: "agTextColumnFilter",
        },
        {
          field: "totalTransactions",
          headerName: "Txns",
          width: 70,
          cellClass: "text-center font-bold text-slate-500 tabular-nums flex items-center justify-center",
          headerClass: "ag-center-aligned-header",
        },
        {
          field: "openingBalanceDate",
          headerName: "Date",
          flex: 1,
          minWidth: 90,
          valueFormatter: (p) => formatDate(p.value),
          filter: "agDateColumnFilter",
        },
        {
          field: "openingBalance",
          headerName: "Opening Balance",
          flex: 1.5,
          minWidth: 155,
          type: "numericColumn",
          valueGetter: (p) => getDisplayBalance(p.data),
          valueFormatter: (p) => formatCurrency(p.value, p.data?.baseCurrency),
          headerClass:
            "text-[11px] font-semibold text-gray-700 uppercase tracking-wider ag-right-aligned-header",
          cellClassRules: {
            "text-rose-600": (params) => params.value < 0,
            "text-emerald-700": (params) => params.value >= 0,
          },
          cellClass: "tabular-nums font-semibold text-[12px] text-right",
        },
        {
          field: "closingBalance",
          headerName: "Closing Balance",
          flex: 1.5,
          minWidth: 155,
          type: "numericColumn",
          valueGetter: (p) => getDisplayClosingBalance(p.data),
          valueFormatter: (p) => formatCurrency(p.value, p.data?.baseCurrency),
          headerClass:
            "text-[11px] font-semibold text-gray-700 uppercase tracking-wider ag-right-aligned-header",
          cellClassRules: {
            "text-rose-600": (params) => params.value < 0,
            "text-emerald-700": (params) => params.value >= 0,
          },
          cellClass: "tabular-nums font-semibold text-[12px] text-right",
        },

        {
          field: "createdByDisplayName",
          headerName: "Created By",
          minWidth: 90,
          cellClass: "text-gray-400",
        },
        {
          headerName: "Action",
          minWidth: 70,
          maxWidth: 80,
          cellRenderer: ActionCellRenderer,
          sortable: false,
          filter: false,
        },
      ],
      [preferences.currency],
    );
  
    const defaultColDef = useMemo(
      () => ({
        sortable: true,
        filter: true,
        resizable: true,
        cellClass: "text-[11px] font-medium text-gray-600",
        headerClass:
          "text-[11px] font-semibold text-gray-700 uppercase tracking-wider",
        comparator: (valueA, valueB, nodeA, nodeB, isDescending) => {
          if (groupBy !== "none" && nodeA?.data && nodeB?.data) {
            const groupA =
              groupBy === "subtype"
                ? String(nodeA.data.subtypeLabel || "").toLowerCase()
                : String(nodeA.data.typeLabel || "").toLowerCase();
            const groupB =
              groupBy === "subtype"
                ? String(nodeB.data.subtypeLabel || "").toLowerCase()
                : String(nodeB.data.typeLabel || "").toLowerCase();
  
            if (groupA < groupB) return isDescending ? 1 : -1;
            if (groupA > groupB) return isDescending ? -1 : 1;
          }
  
          if (valueA == null && valueB == null) return 0;
          if (valueA == null) return -1;
          if (valueB == null) return 1;
  
          if (typeof valueA === "number" && typeof valueB === "number") {
            return valueA - valueB;
          }
          return String(valueA).localeCompare(String(valueB));
        },
      }),
      [groupBy],
    );
    return (
      <div className="accounts-tablet-page flex flex-col h-full min-h-0 overflow-hidden">
        <style>{`
                  @media print {
                      @page { margin: 15mm; size: A4 portrait; }
                      body { 
                          -webkit-print-color-adjust: exact; 
                          background: white !important; 
                          color: black !important; 
                          font-family: Arial, Helvetica, sans-serif !important;
                      }
                      /* Hide non-print elements */
                      nav, aside, header, footer, .sidebar, .print\\:hidden, .hidden.print\\:hidden, button { display: none !important; }
                      
                      /* Reset layout for print */
                      .min-h-screen, .h-screen { height: auto !important; min-height: 0 !important; }
                      .overflow-hidden { overflow: visible !important; }
                      .overflow-y-auto { overflow: visible !important; }
                      .overflow-x-auto { overflow: visible !important; }
                      .max-h-\\[720px\\] { max-height: none !important; }
                      .flex-1 { flex: none !important; }
                      .shadow-\\[0_8px_30px_rgb\\(0\\,0\\,0\\,0\\.04\\)\\] { box-shadow: none !important; border: none !important; }
                      .bg-gray-50\\/50, .bg-gray-50\\/95 { background: white !important; }
                      
                      /* Ensure table visibility */
                      table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin-top: 20px; table-layout: fixed !important; }
                      th { border: 1px solid #000 !important; border-bottom: 2px solid #000 !important; color: black !important; font-weight: bold !important; text-align: left !important; padding: 8px !important; font-size: 11px !important; text-transform: uppercase; background: transparent !important; white-space: normal !important; overflow-wrap: break-word !important; }
                      td { border: 1px solid #000 !important; color: black !important; padding: 6px 8px !important; font-size: 11px !important; vertical-align: middle; background: transparent !important; word-break: break-word !important; overflow-wrap: break-word !important; white-space: normal !important; text-align: left !important; }
                      
                      /* Hide Action Column in Print */
                      th:last-child, td:last-child { display: none !important; }
  
                      /* Remove Sorting Symbols & Badges */
                      .lucide { display: none !important; }
                      
                      /* Show Print Header */
                      .print-header { display: block !important; margin-bottom: 20px; }
                      
                      /* Force Align Headers Left (overriding flex justify-end) by default */
                      th > div { justify-content: flex-start !important; }
  
                      /* Center Align Opening Balance (4th Column) */
                      th:nth-child(4), td:nth-child(4) { text-align: center !important; }
                      th:nth-child(4) > div { justify-content: center !important; }
                  }
                  .print-header, .print-footer { display: none; }
              `}</style>
  
        {/* Print Header */}
        <div className="print-header">
          <h1 className="text-2xl font-bold uppercase tracking-wider text-center mb-4 text-black">
            Account List
          </h1>
          <div className="flex justify-start border-b border-black pb-2 mb-4">
            <span className="text-sm font-bold text-gray-800">
              Date: {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
  
        <PageContentShell
          header={
            <PageHeader
              title="Account Overview"
              breadcrumbs={["Accounts", "Overview"]}
            />
          }
          contentClassName="p-0 lg:p-0"
          cardClassName="border-none shadow-none rounded-none overflow-visible"
        >
          {/* Summary Component Box */}
          <div className="px-5 pt-2 pb-0 print:hidden relative z-10">
            <div className="px-2 py-2">
              {/* Metrics Row */}
              <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
                <SummaryItem
                  title="Cash in Hand"
                  amount={cashBalance}
                  icon={Banknote}
                  colorClass="text-amber-600"
                  bgClass="bg-amber-50"
                  currency={preferences.currency}
                />
                <SummaryItem
                  title="Bank Balance"
                  amount={bankBalance}
                  icon={Landmark}
                  colorClass="text-emerald-600"
                  bgClass="bg-emerald-50"
                  currency={preferences.currency}
                />
                <SummaryItem
                  title="Card Balance"
                  amount={cardBalance}
                  icon={CreditCard}
                  colorClass="text-indigo-600"
                  bgClass="bg-indigo-50"
                  currency={preferences.currency}
                />
                <SummaryItem
                  title="Investment"
                  amount={investmentBalance}
                  icon={Briefcase}
                  colorClass="text-blue-600"
                  bgClass="bg-blue-50"
                  currency={preferences.currency}
                />
              </div>
  
              {/* Chart Toggle */}
              <div className="mt-4 border-t border-gray-50 flex justify-between items-center">
              <button
                onClick={() => setChartVisible(!chartVisible)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <TrendingUp size={14} />
                {chartVisible ? "Hide Chart" : "Show Chart"}
                {chartVisible ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
              {chartVisible && (
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-semibold">
                  <Calendar size={13} />
                  <span>Last 30 days</span>
                </div>
              )}
            </div>
  
              {/* Chart Section */}
              {chartVisible && (
                <div className="h-[220px] w-full mt-6 transition-all relative">
                  {isTrendLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-xl">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f3f4f6"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={{ stroke: "#f3f4f6" }}
                        tickLine={false}
                        tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }}
                        tickFormatter={(val) => {
                          if (val >= 1000000)
                            return `${(val / 1000000).toFixed(1)}M`;
                          if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                          return val;
                        }}
                      />
                      <Tooltip
                        content={
                          <CustomTooltip currency={preferences.currency} />
                        }
                      />
                      <Line
                        type="monotone"
                        name="Bank Balance"
                        dataKey="bank"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }}
                      />
                      <Line
                        type="monotone"
                        name="Card Balance"
                        dataKey="card"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#8b5cf6" }}
                      />
                      <Line
                        type="monotone"
                        name="Cash in Hand"
                        dataKey="cash"
                        stroke="#6b7280"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: "#6b7280" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
          {/* Minimal Horizontal Divider */}
          <hr className="mx-5 mt-3 mb-1 border-t border-gray-200/70" />
          {/* Custom List Header */}
          <div className="px-5 pb-4 pt-2 flex flex-col xl:flex-row xl:items-center justify-between print:hidden gap-4 relative z-10 w-full">
            {/* LEFT SIDE: Action pill-bar */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateAccount}
                  className="h-[32px] px-3.5 flex items-center gap-1.5 justify-center rounded-md bg-[#4A8AF4] text-white hover:bg-[#3b7ee1] transition-colors font-medium text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4A8AF4]/30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  <span className="hidden sm:inline">Add Account</span>
                </button>
  
                <button
                  onClick={() => setDataRefreshTick((t) => t + 1)}
                  className="w-[32px] h-[32px] flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all"
                  title="Refresh table data"
                >
                  <RefreshCcw
                    size={14}
                    strokeWidth={2}
                    className={cn(loading && "animate-spin text-primary")}
                  />
                </button>
  
                <FilterDropdown
                  value={groupBy}
                  onChange={(val) => setGroupBy(val === groupBy ? "none" : val)}
                  placeholder="Group"
                  options={[
                    { label: "Type", value: "type" },
                    { label: "Subtype", value: "subtype" },
                  ]}
                />
              </div>
            </div>
  
            {/* RIGHT SIDE: Dedicated Search */}
            <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2 w-full xl:w-auto">
              <div className="relative group w-full xl:w-[240px] max-w-[300px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 h-[32px] bg-white border border-gray-200 rounded-md text-[13px] font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                />
              </div>
            </div>
          </div>
          {/* Table View (AG Grid) */}
          {(isDesktopView || typeof window === "undefined") &&
            (() => {
              return (
                <div className="w-full px-5 pb-8 relative" aria-busy={loading}>
                  <div
                    style={{ height: "600px", width: "100%" }}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <AgGridReact
                      theme={themeQuartz}
                      rowData={filteredAccounts}
                      columnDefs={columnDefs}
                      defaultColDef={defaultColDef}
                      rowHeight={42}
                      headerHeight={44}
                      isFullWidthRow={genericIsFullWidthRow}
                      fullWidthCellRenderer={GenericFullWidthGroupCellRenderer}
                      getRowHeight={genericGetRowHeight}
                      animateRows={true}
                      pagination={true}
                      paginationPageSize={15}
                      paginationPageSizeSelector={[10, 15, 20, 50, 100]}
                      suppressCellFocus={true}
                    />
                  </div>
                  {showOverlayLoader && (
                    <LoadingOverlay label="Loading accounts..." />
                  )}
                </div>
              );
            })()}
          `
        </PageContentShell>
  
        <ConfirmDialog
          open={deleteDialog.open}
          title="Delete Account"
          message={
            deleteDialog.name
              ? `Are you sure you want to archive "${deleteDialog.name}"? It will be hidden from active lists.`
              : "Are you sure you want to archive this account? It will be hidden from active lists."
          }
          confirmLabel="Yes, Delete Account"
          isSubmitting={deleteDialog.loading}
          onCancel={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
        />
  
        {/* Root-Level Bank Details Popover (Evades AG Grid's pure render caching) */}
        {activeRowPopover?.account &&
          createPortal(
            <div
              className="popover-container fixed z-[9999] pointer-events-auto shadow-[0_4px_24px_rgba(0,0,0,0.15)] bg-white rounded-lg border border-[#e5e7eb] w-[300px] flex flex-col"
              style={{
                top: Math.min(
                  (activeRowPopover.rect?.top || 0) - 20,
                  window.innerHeight - 300,
                ),
                left: (activeRowPopover.rect?.right || 0) + 12,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#F9F9FB] px-3 py-2 border-b border-[#e5e7eb] flex items-center justify-between rounded-t-lg">
                <span className="text-[12px] font-bold text-gray-800">
                  Bank Details
                </span>
                <button
                  onClick={() => handleCopyBankDetails(activeRowPopover.account)}
                  className="text-gray-500 hover:text-gray-900 transition-colors p-0.5"
                  title="Copy Details"
                >
                  {copiedBankDetailsId === activeRowPopover.account.id ? (
                    <Check size={13} className="text-emerald-600" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto no-scrollbar bg-white rounded-b-lg">
                <table className="w-full text-left text-[11px]">
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {getBankDetailItems(activeRowPopover.account).map((item) => (
                      <tr
                        key={item.label}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-3 py-1.5 text-gray-500 font-medium w-[110px] align-top">
                          {item.label}
                        </td>
                        <td className="px-3 py-1.5 text-gray-900 font-medium break-all align-top border-l border-[#e5e7eb]">
                          {item.value || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>,
            document.body,
          )}
  
        <CreateAccount
          isOpen={drawerState.open}
          onClose={() => setDrawerState({ open: false, account: null })}
          accountToEdit={drawerState.account}
          onSuccess={() => setDataRefreshTick((t) => t + 1)}
        />
      </div>
    );
  };
  
  export default Accounts;
  
