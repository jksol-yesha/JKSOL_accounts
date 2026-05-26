import React from 'react';
import { usePreferences } from '../../context/PreferenceContext';
import Tooltip from './Tooltip';

const CompactCurrency = ({ amount, currencyOverride = null, className = '', placement = 'top' }) => {
    const { formatCompactCurrency, formatCurrency } = usePreferences();

    const compactText = formatCompactCurrency(amount, currencyOverride);
    const fullText = formatCurrency(amount, currencyOverride);

    // If they are exactly the same, no need for tooltip
    if (compactText === fullText) {
        return <span className={className}>{compactText}</span>;
    }

    return (
        <Tooltip content={fullText} className={className} placement={placement}>
            {compactText}
        </Tooltip>
    );
};

export default CompactCurrency;
