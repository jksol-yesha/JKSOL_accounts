import React from 'react';
import { usePreferences } from '../../context/PreferenceContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import Card from '../../components/common/Card';
import CustomSelect from '../../components/common/CustomSelect';
import { cn } from '../../utils/cn';
import { useOrganization } from '../../context/OrganizationContext';
import { useBranch } from '../../context/BranchContext';
import { useYear } from '../../context/YearContext';
import apiService from '../../services/api';
import { ChevronDown, Plus, Pencil, Trash2, Check, X, CheckCircle2, AlertTriangle } from 'lucide-react';

const Settings = () => {
    const { preferences, updatePreferences } = usePreferences();
    const { showToast } = useToast();
    const { selectedOrg, refreshOrganizations } = useOrganization();
    const { selectedBranch, refreshBranches } = useBranch();
    const { selectedYear } = useYear();
    const isSingleBranchScope = selectedBranch && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi';

    // Local state for Branch Level settings to allow editing before save
    const [baseCurrency, setBaseCurrency] = React.useState(
        (isSingleBranchScope ? selectedBranch?.currencyCode : preferences?.currency) || 'INR'
    );
    const [gstRateOptions, setGstRateOptions] = React.useState(['18']);
    const [defaultGstRate, setDefaultGstRate] = React.useState(String(
        (selectedBranch && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi')
            ? (selectedBranch?.defaultGstRate ?? preferences?.defaultGstRate ?? '18')
            : (preferences?.defaultGstRate ?? '18')
    ));
    const [newGstRate, setNewGstRate] = React.useState('');
    const [editingRate, setEditingRate] = React.useState(null);
    const [editingRateValue, setEditingRateValue] = React.useState('');
    const [isGstDropdownOpen, setIsGstDropdownOpen] = React.useState(false);
    const [isAddingRate, setIsAddingRate] = React.useState(false);
    const [saveDialog, setSaveDialog] = React.useState({
        open: false,
        title: '',
        message: '',
        tone: 'success'
    });
    const gstDropdownRef = React.useRef(null);
    const GST_RATES_STORAGE_KEY = `gst_rate_options_${selectedOrg?.id || 'org'}_${selectedBranch?.id || 'branch'}`;
    const canManageBranchSettings = selectedOrg?.role === 'owner' || selectedOrg?.role === 'admin';

    const normalizeRate = React.useCallback((value) => {
        const num = Number.parseFloat(value);
        if (!Number.isFinite(num) || num < 0) return null;
        return num.toString();
    }, []);

    const persistGstRates = React.useCallback((rates) => {
        const cleaned = Array.from(
            new Set(
                (rates || [])
                    .map((r) => normalizeRate(r))
                    .filter(Boolean)
            )
        ).sort((a, b) => Number(a) - Number(b));
        localStorage.setItem(GST_RATES_STORAGE_KEY, JSON.stringify(cleaned));
        setGstRateOptions(cleaned);
        return cleaned;
    }, [GST_RATES_STORAGE_KEY, normalizeRate]);

    React.useEffect(() => {
        const onClickOutside = (event) => {
            if (gstDropdownRef.current && !gstDropdownRef.current.contains(event.target)) {
                setIsGstDropdownOpen(false);
                setIsAddingRate(false);
                setEditingRate(null);
                setEditingRateValue('');
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    // Sync branch-level values when branch selection changes
    React.useEffect(() => {
        if (selectedBranch && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi') {
            if (selectedBranch.currencyCode) {
                setBaseCurrency(selectedBranch.currencyCode);
            }
            setDefaultGstRate(String(selectedBranch?.defaultGstRate ?? preferences?.defaultGstRate ?? '18'));
        } else {
            setDefaultGstRate(String(preferences?.defaultGstRate ?? '18'));
        }
    }, [selectedBranch?.id, selectedBranch?.currencyCode, selectedBranch?.defaultGstRate, preferences?.defaultGstRate]);

    // For all/multi branch scope, currency should reflect display preference (not hardcoded USD).
    React.useEffect(() => {
        if (!selectedBranch || selectedBranch.id === 'all' || selectedBranch.id === 'multi') {
            setBaseCurrency(preferences?.currency || 'INR');
        }
    }, [selectedBranch?.id, preferences?.currency]);

    // GST dropdown options should come from rates actually used in transactions.
    React.useEffect(() => {
        const controller = new AbortController();

        const loadUsedGstRates = async () => {
            const fallbackRate = normalizeRate(
                (selectedBranch && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi')
                    ? (selectedBranch?.defaultGstRate ?? preferences?.defaultGstRate ?? '18')
                    : (preferences?.defaultGstRate ?? '18')
            );
            const storedRatesRaw = localStorage.getItem(GST_RATES_STORAGE_KEY);
            const storedRates = storedRatesRaw ? JSON.parse(storedRatesRaw) : [];

            if (!selectedBranch?.id || selectedBranch.id === 'all' || selectedBranch.id === 'multi') {
                const combined = new Set([...(Array.isArray(storedRates) ? storedRates : []), fallbackRate]);
                const options = persistGstRates(Array.from(combined));
                const normalizedCurrent = normalizeRate(defaultGstRate);
                if (!normalizedCurrent || !options.includes(normalizedCurrent)) setDefaultGstRate(options[0]);
                return;
            }

            try {
                const response = await apiService.transactions.getAll({
                    branchId: selectedBranch.id,
                    financialYearId: selectedYear?.id
                }, { signal: controller.signal });

                const txns = Array.isArray(response)
                    ? response
                    : (Array.isArray(response?.data) ? response.data : []);

                const usedRateSet = new Set(Array.isArray(storedRates) ? storedRates : []);
                txns.forEach((txn) => {
                    const parsed = normalizeRate(txn?.gstRate ?? txn?.gst_rate);
                    if (parsed !== null) usedRateSet.add(parsed);
                });

                usedRateSet.add(fallbackRate);
                const derivedOptions = Array.from(usedRateSet)
                    .sort((a, b) => Number(a) - Number(b));

                const safeOptions = persistGstRates(derivedOptions.length ? derivedOptions : [fallbackRate]);

                const normalizedCurrent = normalizeRate(defaultGstRate);
                if (!normalizedCurrent || !safeOptions.includes(normalizedCurrent)) setDefaultGstRate(safeOptions[0]);
            } catch (error) {
                if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
                console.error('Failed to load GST rates from transactions:', error);

                const fallbackOptions = Array.isArray(storedRates) && storedRates.length > 0
                    ? persistGstRates(storedRates)
                    : persistGstRates([fallbackRate]);
                if (!fallbackOptions.includes(defaultGstRate)) setDefaultGstRate(fallbackOptions[0]);
            }
        };

        loadUsedGstRates();
        return () => controller.abort();
    }, [selectedBranch?.id, selectedBranch?.defaultGstRate, selectedYear?.id, GST_RATES_STORAGE_KEY, normalizeRate, persistGstRates]);

    const handleAddGstRate = () => {
        const normalized = normalizeRate(newGstRate);
        if (!normalized) {
            showToast('Enter a valid GST rate (0 or greater).', 'error');
            return;
        }
        if (gstRateOptions.includes(normalized)) {
            showToast('This GST rate already exists.', 'error');
            return;
        }
        const next = persistGstRates([...gstRateOptions, normalized]);
        setNewGstRate('');
        if (!next.includes(defaultGstRate)) setDefaultGstRate(normalized);
        showToast('GST rate added.', 'success');
    };

    const handleStartEditGstRate = (rate) => {
        setEditingRate(rate);
        setEditingRateValue(rate);
    };

    const handleSaveEditGstRate = () => {
        if (!editingRate) return;
        const normalized = normalizeRate(editingRateValue);
        if (!normalized) {
            showToast('Enter a valid GST rate (0 or greater).', 'error');
            return;
        }
        if (normalized !== editingRate && gstRateOptions.includes(normalized)) {
            showToast('This GST rate already exists.', 'error');
            return;
        }

        const next = gstRateOptions.map((rate) => (rate === editingRate ? normalized : rate));
        const saved = persistGstRates(next);
        if (defaultGstRate === editingRate) setDefaultGstRate(normalized);
        if (!saved.includes(defaultGstRate)) setDefaultGstRate(saved[0] || '0');
        setEditingRate(null);
        setEditingRateValue('');
        showToast('GST rate updated.', 'success');
    };

    const handleDeleteGstRate = (rate) => {
        if (gstRateOptions.length <= 1) {
            showToast('At least one GST rate must remain.', 'error');
            return;
        }
        const next = gstRateOptions.filter((r) => r !== rate);
        const saved = persistGstRates(next);
        if (defaultGstRate === rate) setDefaultGstRate(saved[0]);
        showToast('GST rate deleted.', 'success');
    };

    const handleSelectGstRate = (rate) => {
        setDefaultGstRate(rate);
        setIsGstDropdownOpen(false);
        setIsAddingRate(false);
        setEditingRate(null);
        setEditingRateValue('');
    };

    const currencies = [
        { code: 'INR', label: '₹ - Indian Rupee (INR)' },
        { code: 'USD', label: '$ - US Dollar (USD)' },
        { code: 'EUR', label: '€ - Euro (EUR)' },
        { code: 'GBP', label: '£ - British Pound (GBP)' },
        { code: 'JPY', label: '¥ - Japanese Yen (JPY)' },
        { code: 'AUD', label: '$ - Australian Dollar (AUD)' },
        { code: 'CAD', label: '$ - Canadian Dollar (CAD)' },
    ];

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

    const handleChange = async (e) => {
        const { name, value } = e.target;

        // System Setting: Branch Currency (Owner Only)
        if (name === 'baseCurrency') {
            setBaseCurrency(value);
            // Sync with display preference immediately to avoid confusion
            updatePreferences({ currency: value, exchangeRate: undefined });
        } else if (name === 'defaultGstRate') {
            setDefaultGstRate(value);
        }
        else {
            updatePreferences({ [name]: value });
        }
    };

    const handleSave = async () => {
        try {
            // 1. Save Branch Settings (Currency, State, GST)
            if (selectedBranch && selectedBranch.id !== 'all' && selectedBranch.id !== 'multi') {
                await apiService.branches.update(selectedBranch.id, {
                    currencyCode: baseCurrency,
                    defaultGstRate: defaultGstRate
                });
                await refreshBranches(); // Refresh branch context
            }

            // Always save to preferences as a global fallback
            updatePreferences({ defaultGstRate, currency: baseCurrency, exchangeRate: undefined });

            // Success Message
            setSaveDialog({
                open: true,
                title: 'Settings Saved',
                message: 'Settings saved successfully!',
                tone: 'success'
            });
        } catch (error) {
            console.error("Failed to save organization settings:", error);

            // Check for Permission Error
            const msg = error.response?.data?.message || error.message || "";
            if (msg.includes('Owner') || msg.includes('permission')) {
                setSaveDialog({
                    open: true,
                    title: 'Limited Update',
                    message: 'Branch Currency was not updated because it requires Owner access. Your local Display Currency has been updated successfully.',
                    tone: 'warning'
                });
            } else {
                setSaveDialog({
                    open: true,
                    title: 'Update Warning',
                    message: 'Failed to update Branch settings. Display settings are updated locally.',
                    tone: 'warning'
                });
            }
        } finally {
            // 2. Preferences are auto-saved by context, but we trigger event for listeners
            window.dispatchEvent(new Event('preferencesUpdated'));
        }
    };


    return (
        <>
            <PageContentShell
                header={(
                    <PageHeader
                        title="System Settings"
                        breadcrumbs={['Portal', 'Settings']}
                    />
                )}
                contentClassName="overflow-y-auto no-scrollbar max-w-5xl mx-auto w-full"
                cardClassName="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible"
            >
                <Card title="Preference Settings" className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible">
                    <div className="space-y-6 py-2">
                        {/* Currency */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-4 text-sm font-semibold text-gray-700 flex items-center gap-2">
                                Currency
                            </label>
                            <div className="md:col-span-8 relative group">
                                <CustomSelect
                                    name="baseCurrency"
                                    value={baseCurrency}
                                    onChange={handleChange}
                                    disabled={selectedOrg?.role !== 'owner' && selectedOrg?.role !== 'admin'}
                                    className={`w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none transition-all appearance-none ${(selectedOrg?.role === 'owner' || selectedOrg?.role === 'admin') ? 'cursor-pointer focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary' : 'cursor-not-allowed opacity-75'}`}
                                >
                                    {currencies.map(c => (
                                        <option key={c.code} value={c.code}>{c.label}</option>
                                    ))}
                                </CustomSelect>
                                {(selectedOrg?.role !== 'owner' && selectedOrg?.role !== 'admin') && (
                                    <div className="absolute inset-y-0 right-10 flex items-center pointer-events-none">
                                        <div className="invisible group-hover:visible absolute right-0 -top-8 bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                            Only Owners and Admins can change Branch Currency
                                            <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Default GST Rate */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-4 text-sm font-semibold text-gray-700">
                                Default GST Rate (%)
                            </label>
                            <div className="md:col-span-8 relative group">
                                <div className="relative" ref={gstDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!canManageBranchSettings) return;
                                            setIsGstDropdownOpen((prev) => !prev);
                                        }}
                                        className={`w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none transition-all flex items-center justify-between ${(canManageBranchSettings) ? 'cursor-pointer focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary' : 'cursor-not-allowed opacity-75'}`}
                                        disabled={!canManageBranchSettings}
                                    >
                                        <span>{defaultGstRate}%</span>
                                        <ChevronDown size={16} className={`text-gray-500 transition-transform ${isGstDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isGstDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                                            <div className="max-h-60 overflow-y-auto p-1.5 no-scrollbar">
                                                {gstRateOptions.map((rate) => (
                                                    <div key={rate} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50">
                                                        {editingRate === rate ? (
                                                            <div className="flex items-center gap-2 w-full">
                                                                <input
                                                                    type="text"
                                                                    value={editingRateValue}
                                                                    onChange={(e) => setEditingRateValue(e.target.value)}
                                                                    className="w-20 px-2 py-1 text-xs font-medium border border-gray-300 rounded"
                                                                />
                                                                <button type="button" onClick={handleSaveEditGstRate} className="text-emerald-700"><Check size={14} /></button>
                                                                <button type="button" onClick={() => { setEditingRate(null); setEditingRateValue(''); }} className="text-gray-500"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button type="button" onClick={() => handleSelectGstRate(rate)} className="text-sm font-medium text-gray-700 text-left flex-1">
                                                                    {rate}%
                                                                </button>
                                                                <div className="flex items-center gap-2">
                                                                    <button type="button" onClick={() => handleStartEditGstRate(rate)} className="text-blue-700"><Pencil size={14} /></button>
                                                                    <button type="button" onClick={() => handleDeleteGstRate(rate)} className="text-rose-700"><Trash2 size={14} /></button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}

                                                <div className="border-t border-gray-100 my-1" />

                                                {isAddingRate ? (
                                                    <div className="flex items-center gap-2 px-2.5 py-2">
                                                        <input
                                                            type="text"
                                                            value={newGstRate}
                                                            onChange={(e) => setNewGstRate(e.target.value)}
                                                            placeholder="New rate"
                                                            className="w-24 px-2 py-1 text-xs font-medium border border-gray-300 rounded"
                                                        />
                                                        <button type="button" onClick={() => { handleAddGstRate(); setIsAddingRate(false); }} className="text-emerald-700"><Check size={14} /></button>
                                                        <button type="button" onClick={() => { setIsAddingRate(false); setNewGstRate(''); }} className="text-gray-500"><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIsAddingRate(true); setEditingRate(null); }}
                                                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-left text-sm font-medium text-gray-700"
                                                    >
                                                        <Plus size={14} />
                                                        Add New
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {(selectedOrg?.role !== 'owner' && selectedOrg?.role !== 'admin') && (
                                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                        <div className="invisible group-hover:visible absolute right-0 -top-8 bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                            Only Owners and Admins can change Branch Settings
                                            <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-800"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Date Format */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-4 text-sm font-semibold text-gray-700">
                                Date Format
                            </label>
                            <div className="md:col-span-8">
                                <CustomSelect
                                    name="dateFormat"
                                    value={preferences.dateFormat}
                                    onChange={handleChange}
                                    className="w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                                >
                                    {dateFormats.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </CustomSelect>
                            </div>
                        </div>

                        {/* Number Format */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                            <label className="md:col-span-4 text-sm font-semibold text-gray-700 pt-2">
                                Number Format
                            </label>
                            <div className="md:col-span-8 space-y-1">
                                <CustomSelect
                                    name="numberFormat"
                                    value={preferences.numberFormat}
                                    onChange={handleChange}
                                    className="w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                                >
                                    {numberFormats.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </CustomSelect>
                                <p className="text-[10px] text-gray-400 font-medium">
                                    Determines how decimals and thousands are separated.
                                </p>
                            </div>
                        </div>

                        {/* Time Zone */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <label className="md:col-span-4 text-sm font-semibold text-gray-700">
                                Time Zone
                            </label>
                            <div className="md:col-span-8">
                                <CustomSelect
                                    name="timeZone"
                                    value={preferences.timeZone}
                                    onChange={handleChange}
                                    className="w-full py-2 px-3 bg-[#f1f3f9] border border-transparent rounded-xl text-sm font-medium text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                                >
                                    {timeZones.map(tz => (
                                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                                    ))}
                                </CustomSelect>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
                            <div className="md:col-span-4"></div>
                            <div className="md:col-span-8 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-black hover:bg-black/90 text-white text-sm font-bold rounded-lg shadow-md transition-all active:scale-95"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>
            </PageContentShell>

            {saveDialog.open && (
                <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-start gap-3">
                                <div className={cn(
                                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                                    saveDialog.tone === 'success' ? 'bg-gray-100' : 'bg-amber-50'
                                )}>
                                    {saveDialog.tone === 'success' ? (
                                        <CheckCircle2 size={24} className="text-gray-700" />
                                    ) : (
                                        <AlertTriangle size={24} className="text-amber-600" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-900">{saveDialog.title}</h3>
                                    <p className="mt-1 text-sm leading-6 text-gray-500">{saveDialog.message}</p>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setSaveDialog((prev) => ({ ...prev, open: false }))}
                                    className={cn(
                                        'px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors',
                                        saveDialog.tone === 'success'
                                            ? 'bg-gray-700 hover:bg-gray-800'
                                            : 'bg-amber-600 hover:bg-amber-700'
                                    )}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Settings;
