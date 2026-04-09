import React from 'react';
import CustomSelect from '../../../components/common/CustomSelect';
import { useCurrencyOptions } from '../../../hooks/useCurrencyOptions';
import { cn } from '../../../utils/cn';

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

export const PreferenceSettingsFields = ({ draftPreferences, onChange, className = '' }) => {
    const { currencyOptions } = useCurrencyOptions();

    return (
        <div className={cn("space-y-6 py-2", className)}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <label className="md:col-span-4 text-sm font-semibold text-gray-700 flex items-center gap-2">
                    Currency
                </label>
                <div className="md:col-span-8 relative group">
                    <CustomSelect
                        name="currency"
                        value={draftPreferences.currency || 'INR'}
                        onChange={onChange}
                        className="w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                    >
                        {currencyOptions.map((currency) => (
                            <option key={currency.code} value={currency.code}>{currency.label}</option>
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
                        className="w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
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
                        className="w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
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
                        className="w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
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
