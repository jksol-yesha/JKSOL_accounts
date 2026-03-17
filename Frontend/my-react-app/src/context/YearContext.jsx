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
            prevOrgIdRef.current = null; // Reset on logout
            return;
        }

        // Prevent redundant fetch if we already have data for this Org
        if (prevOrgIdRef.current === selectedOrg.id && financialYears.length > 0) {
            return;
        }

        // Mark as being fetched immediately to block concurrent calls (e.g. from StrictMode or rapid state updates)
        prevOrgIdRef.current = selectedOrg.id;

        const controller = new AbortController();

        const fetchYears = async () => {
            // Prevent fetch if tokens are cleared (e.g. during logout)
            if (!localStorage.getItem('accessToken')) return;

            setLoading(true);
            try {
                const response = await apiService.financialYears.getAll({
                    headers: { 'x-org-id': selectedOrg.id },
                    signal: controller.signal
                });

                // If aborted, we don't care about the result
                if (controller.signal.aborted) return;

                const years = response.data || [];
                setFinancialYears(years);

                // Auto-select current year for this new org
                const current = years.find(y => y.isCurrent === 'yes') || years[0];
                setSelectedYear(current || null);

                if (current) {
                    // console.log(`[YearContext] Auto-selected FY: ${current.name} for Org ${selectedOrg.name}`);
                }

            } catch (error) {
                // If the fetch failed or was aborted, clear the ref so we can try again
                if (prevOrgIdRef.current === selectedOrg.id) {
                    prevOrgIdRef.current = null;
                }

                if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;

                console.error("Failed to fetch financial years:", error);
                if (!controller.signal.aborted) {
                    setFinancialYears([]);
                    setSelectedYear(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchYears();

        return () => {
            controller.abort();
        };
    }, [selectedOrg?.id, user?.id]); // Depend on IDs specifically for stability

    // Helper to get formatted name if needed, or just use selectedYear.name

    return (
        <YearContext.Provider value={{ selectedYear, setSelectedYear, financialYears, loading }}>
            {children}
        </YearContext.Provider>
    );
};

export const useYear = () => {
    const context = useContext(YearContext);
    return context || defaultYearContext;
};
