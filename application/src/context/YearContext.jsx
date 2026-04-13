import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';

const defaultYearContext = {
    selectedYear: null,
    setSelectedYear: () => { },
    financialYears: [],
    loading: false
};

const YearContext = createContext(defaultYearContext);

import { useOrganization } from './OrganizationContext';
import { useAuth } from './AuthContext';

const formatLocalDateOnly = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDateOnly = (value) => {
    if (!value) return '';

    if (value instanceof Date) {
        return formatLocalDateOnly(value);
    }

    const rawValue = String(value).trim();
    if (!rawValue) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;

    const parsedDate = new Date(rawValue);
    if (!Number.isNaN(parsedDate.getTime())) {
        return formatLocalDateOnly(parsedDate);
    }

    return rawValue.slice(0, 10);
};

const normalizeFinancialYear = (year) => {
    if (!year || typeof year !== 'object') return year;

    return {
        ...year,
        startDate: normalizeDateOnly(year.startDate),
        endDate: normalizeDateOnly(year.endDate)
    };
};

export const YearProvider = ({ children }) => {
    const { user } = useAuth();
    const { selectedOrg } = useOrganization();
    const [selectedYear, setSelectedYear] = useState(null);
    const [financialYears, setFinancialYears] = useState([]);
    const [loading, setLoading] = useState(true);

    const prevOrgIdRef = React.useRef(null);

    useEffect(() => {
        // Wait for auth and org to be selected
        if (!user || !selectedOrg?.id) {
            setFinancialYears([]);
            setSelectedYear(null);
            setLoading(false);
            prevOrgIdRef.current = null;
            return;
        }

        // Prevent redundant fetch if we already have data for this Org
        if (prevOrgIdRef.current === selectedOrg.id && financialYears.length > 0) {
            return;
        }

        prevOrgIdRef.current = selectedOrg.id;
        const controller = new AbortController();

        const fetchYears = async () => {
            if (!localStorage.getItem('accessToken')) return;

            setLoading(true);
            try {
                const response = await apiService.financialYears.getAll({
                    headers: { 'x-org-id': selectedOrg.id },
                    signal: controller.signal
                });

                if (controller.signal.aborted) return;

                const years = (response.data || []).map(normalizeFinancialYear);
                setFinancialYears(years);

                // Auto-selection logic:
                // 1. Try to restore from localStorage for this specific organization
                // 2. Try to find the year that matches Today's local date
                // 3. Fallback to the most recent year (years[0] because backend sorts by DESC startDate)

                const savedYearId = localStorage.getItem(`selectedFY:${selectedOrg.id}`);
                let defaultYear = null;

                if (savedYearId && years.length > 0) {
                    defaultYear = years.find(y => String(y.id) === String(savedYearId));
                }

                if (!defaultYear && years.length > 0) {
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    defaultYear = years.find(y => todayStr >= y.startDate && todayStr <= y.endDate);
                }

                if (!defaultYear && years.length > 0) {
                    defaultYear = years[0];
                }

                setSelectedYear(defaultYear || null);

            } catch (error) {
                if (prevOrgIdRef.current === selectedOrg.id) prevOrgIdRef.current = null;
                if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
                console.error("Failed to fetch financial years:", error);
                if (!controller.signal.aborted) {
                    setFinancialYears([]);
                    setSelectedYear(null);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        fetchYears();
        return () => controller.abort();
    }, [selectedOrg?.id, user?.id]);

    const handleSetSelectedYear = (year) => {
        setSelectedYear(year);
        if (year?.id && selectedOrg?.id) {
            localStorage.setItem(`selectedFY:${selectedOrg.id}`, year.id);
        } else if (selectedOrg?.id) {
            localStorage.removeItem(`selectedFY:${selectedOrg.id}`);
        }
    };

    return (
        <YearContext.Provider value={{ selectedYear, setSelectedYear: handleSetSelectedYear, financialYears, loading }}>
            {children}
        </YearContext.Provider>
    );
};

export const useYear = () => {
    const context = useContext(YearContext);
    return context || defaultYearContext;
};
