import React from 'react';

const IconBase = ({ children, size = 24, className, color = "currentColor", strokeWidth = 1.5, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
    >
        {children}
    </svg>
);

export const DashboardIcon = (props) => (
    <IconBase {...props}>
        {/* Minimal widget overview layout */}
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="16" height="6" rx="1.5" />
    </IconBase>
);

export const AccountsIcon = (props) => (
    <IconBase {...props}>
        {/* Secure Ledger Vault / Lockbox */}
        <rect x="4" y="8" width="16" height="12" rx="2.5" />
        <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
        <circle cx="12" cy="14" r="2.5" />
        <path d="M12 14v2.5" />
    </IconBase>
);

export const TransactionsIcon = (props) => (
    <IconBase {...props}>
        {/* Outflow/Inflow Data Blocks (Cashflow Wires) */}
        {/* Outgoing */}
        <rect x="3" y="6" width="13" height="4" rx="1" />
        <path d="M16 8h5 M18 5l3 3-3 3" />
        {/* Incoming */}
        <rect x="8" y="14" width="13" height="4" rx="1" />
        <path d="M8 16H3 M6 13l-3 3 3 3" />
    </IconBase>
);

export const PartiesIcon = (props) => (
    <IconBase {...props}>
        {/* Vendor/Company Identification Record */}
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <circle cx="8" cy="12" r="2.5" />
        <path d="M13 10h4 M13 14h2" />
        <path d="M9 5V3h6v2" />
    </IconBase>
);

export const CategoryIcon = (props) => (
    <IconBase {...props}>
        {/* Sub-account Indentation Hierarchy */}
        {/* Root Node */}
        <rect x="4" y="4" width="11" height="4" rx="1" />
        {/* Sub Node 1 */}
        <path d="M6 8v4h2" />
        <rect x="8" y="10" width="12" height="4" rx="1" />
        {/* Sub Node 2 */}
        <path d="M6 12v6h2" />
        <rect x="8" y="16" width="12" height="4" rx="1" />
    </IconBase>
);

export const ReportsIcon = (props) => (
    <IconBase {...props}>
        {/* Summary Table with embedded Chart Protrusion */}
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16 M10 10v10" />
        {/* Inner bar charts rising from cells */}
        <path d="M12 18v-6 M15 18v-3 M18 18v-8" />
    </IconBase>
);

export const AuditLogsIcon = (props) => (
    <IconBase {...props}>
        {/* Chronological Ledger Spine and Event Nodes */}
        <path d="M6 3v18" />
        <circle cx="6" cy="6" r="2" />
        <path d="M10 6h8" />
        <circle cx="6" cy="12" r="2" />
        <path d="M10 12h5" />
        <circle cx="6" cy="18" r="2" />
        <path d="M10 18h8" />
    </IconBase>
);
