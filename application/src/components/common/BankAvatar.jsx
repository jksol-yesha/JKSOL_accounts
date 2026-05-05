import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { getBankLogoAPIUrl } from '../../utils/banks';

const bankLogoModules = import.meta.glob('../../assets/bank-logos/*.{png,jpg,jpeg,svg}', {
    eager: true,
    import: 'default'
});

const normalizeLogoKey = (value = '') => String(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

const bankLogoAssets = Object.entries(bankLogoModules).reduce((acc, [path, asset]) => {
    const fileName = path.split('/').pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    acc[normalizeLogoKey(baseName)] = asset;
    return acc;
}, {});

export const BankAvatar = ({ name, bankLogoKey, bankName, bankCode, subtype, subtypeLabel, sizeClass = 'w-7 h-7', monochrome = false }) => {
    const [imageError, setImageError] = useState(false);
    useEffect(() => { setImageError(false); }, [name, bankName]);
    const isCashAccount = Number(subtype) === 11 || String(subtypeLabel || '').toLowerCase() === 'cash';
    const isPersonalAccount = String(name || '').toLowerCase().includes('personal');
    
    // Strictly evaluate only the formal bank name property for API logos, ignoring the custom account alias
    const remoteLogoUrl = getBankLogoAPIUrl(bankName);
    
    const plainIconShellClassName = `${sizeClass} flex items-center justify-center shrink-0`;
    const circularFallbackShellClassName = `${sizeClass} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm overflow-hidden shrink-0`;
    const iconImageClassName = cn("h-[18px] w-[18px] object-contain shrink-0", monochrome && "opacity-90 grayscale");

    if (isCashAccount && bankLogoAssets.wallet) {
        return <div className={plainIconShellClassName}><img src={bankLogoAssets.wallet} className={iconImageClassName} /></div>;
    }
    if (isPersonalAccount && bankLogoAssets.personalaccount) {
        return <div className={plainIconShellClassName}><img src={bankLogoAssets.personalaccount} className={iconImageClassName} /></div>;
    }
    
    if (remoteLogoUrl && !imageError) {
         return (
            <div className={cn(circularFallbackShellClassName, "bg-white overflow-hidden")}>
                <img src={remoteLogoUrl} className="w-[90%] h-[90%] object-contain" onError={() => setImageError(true)} />
            </div>
        );
    }

    return (
        <div className={`${circularFallbackShellClassName} text-slate-500 font-bold text-[10px] leading-none`}>
            {(name || '?').charAt(0).toUpperCase()}
        </div>
    );
};

export default BankAvatar;
