import React from 'react';
import Card from '../../../components/common/Card';
import CustomSelect from '../../../components/common/CustomSelect';
import { useCurrencyOptions } from '../../../hooks/useCurrencyOptions';
import { usePreferences } from '../../../context/PreferenceContext';
import { cn } from '../../../utils/cn';
import { CheckCircle2, AlertTriangle, Check } from 'lucide-react';

const dateFormats = [
    { value: 'DD MMM, YYYY (d M, Y)', label: '08 Jan, 2026 (d M, Y)' },
    { value: 'MM/DD/YYYY', label: '01/08/2026 (M/d/Y)' },
    { value: 'YYYY-MM-DD', label: '2026-01-08 (Y-M-d)' },
    { value: 'DD/MM/YYYY', label: '08/01/2026 (d/M/Y)' },
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

const CurrencyOption = ({ symbol, code, isSelected }) => (
    <div className="flex items-center gap-2 w-full pr-1">
        <span className={cn(
            "text-[12px] min-w-[16px] text-right font-medium whitespace-nowrap",
            isSelected ? "text-slate-900" : "text-slate-400"
        )}>
            {symbol}
        </span>
        <span className={cn(
            "text-[11px] tracking-wide whitespace-nowrap",
            isSelected ? "font-bold text-slate-900" : "font-medium text-slate-700"
        )}>
            {code}
        </span>
    </div>
);

export const PreferenceSettingsFields = ({ draftPreferences, onChange, className = '' }) => {
    const { currencyOptions } = useCurrencyOptions();

    return (
    <div className={cn("space-y-4 py-1", className)}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <label className="md:col-span-4 text-sm font-semibold text-gray-700 flex items-center gap-2">
                Currency
            </label>
            <div className="md:col-span-8 relative group">
                <CustomSelect
                    name="currency"
                    value={draftPreferences.currency || 'INR'}
                    onChange={onChange}
                    showSelectedCheck
                    className="w-full py-1.5 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                    {currencyOptions
                        .filter(c => ['INR', 'USD', 'EUR', 'GBP', 'AED'].includes(c.code))
                        .map((currency) => (
                        <option key={currency.code} value={currency.code}>
                            <CurrencyOption symbol={currency.symbol} code={currency.code} isSelected={draftPreferences.currency === currency.code} />
                        </option>
                    ))}
                </CustomSelect>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <label className="md:col-span-4 text-sm font-semibold text-gray-700">
                Date Format
            </label>
            <div className="md:col-span-8">
                <CustomSelect
                    name="dateFormat"
                    value={draftPreferences.dateFormat}
                    onChange={onChange}
                    className="w-full py-1.5 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                    {dateFormats.map((format) => (
                        <option key={format.value} value={format.value}>{format.label}</option>
                    ))}
                </CustomSelect>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <label className="md:col-span-4 text-sm font-semibold text-gray-700 pt-2">
                Number Format
            </label>
            <div className="md:col-span-8 space-y-1">
                <CustomSelect
                    name="numberFormat"
                    value={draftPreferences.numberFormat}
                    onChange={onChange}
                    className="w-full py-1.5 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                    {numberFormats.map((format) => (
                        <option key={format.value} value={format.value}>{format.label}</option>
                    ))}
                </CustomSelect>
                <p className="text-[10px] text-gray-400 font-medium">
                    Determines how decimals and thousands are separated.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <label className="md:col-span-4 text-sm font-semibold text-gray-700">
                Time Zone
            </label>
            <div className="md:col-span-8">
                <CustomSelect
                    name="timeZone"
                    value={draftPreferences.timeZone}
                    onChange={onChange}
                    className="w-full py-1.5 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                    {timeZones.map((timeZone) => (
                        <option key={timeZone.value} value={timeZone.value}>{timeZone.label}</option>
                    ))}
                </CustomSelect>
            </div>
        </div>
    </div>
    );
};

const PreferenceSettingsSection = ({ className = '' }) => {
    const { preferences, updatePreferences } = usePreferences();
    const [draftPreferences, setDraftPreferences] = React.useState(preferences);

    React.useEffect(() => {
        setDraftPreferences(preferences);
    }, [preferences]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setDraftPreferences((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const changedPrefs = Object.entries(draftPreferences || {}).reduce((acc, [key, value]) => {
            if (preferences?.[key] !== value) {
                acc[key] = value;
            }
            return acc;
        }, {});

        if (Object.keys(changedPrefs).length > 0) {
            await updatePreferences(changedPrefs);
        }


        window.dispatchEvent(new Event('preferencesUpdated'));
    };

    return (
        <>
            <Card title="Preference Settings" className={cn("border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible", className)}>
                <PreferenceSettingsFields draftPreferences={draftPreferences} onChange={handleChange} />
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                    <div className="md:col-span-4"></div>
                    <div className="md:col-span-8 flex justify-end">
                        <button
                            onClick={handleSave}
                                className="w-11 h-11 rounded-full bg-black hover:bg-black/90 text-white shadow-md transition-all flex items-center justify-center shadow-black/20"
                            >
                                <Check size={20} strokeWidth={3.5} />
                            </button>
                    </div>
                </div>
            </Card>


        </>
    );
};

export default PreferenceSettingsSection;
