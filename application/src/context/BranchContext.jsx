import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import apiService from '../services/api';
import { useOrganization } from './OrganizationContext';
import { useAuth } from './AuthContext';

const BranchContext = createContext();

export const BranchProvider = ({ children }) => {
    const { user, isLoading } = useAuth();
    const { selectedOrg } = useOrganization();

    const [selectedBranchIds, setSelectedBranchIds] = useState(() => {
        try {
            const storedIds = localStorage.getItem('selectedBranchIds');
            if (storedIds) {
                const parsed = JSON.parse(storedIds);
                return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
            }

            const legacyStored = localStorage.getItem('selectedBranch');
            if (!legacyStored) return [];
            const legacyBranch = JSON.parse(legacyStored);
            if (legacyBranch?.id === 'all') return [];
            if (legacyBranch?.id && !isNaN(Number(legacyBranch.id))) return [Number(legacyBranch.id)];
            return [];
        } catch (e) {
            console.error("Failed to parse stored branch:", e);
            return [];
        }
    });

    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);

    const persistSelectedBranchIds = useCallback((ids) => {
        const cleanIds = (ids || []).map(Number).filter(Boolean);
        if (cleanIds.length > 0) {
            localStorage.setItem('selectedBranchIds', JSON.stringify(cleanIds));
        } else {
            localStorage.removeItem('selectedBranchIds');
        }
    }, []);

    const fetchBranches = useCallback(async (signal) => {
        // Wait for Auth to initialize to prevent false negatives
        if (isLoading) return;

        // AUTH CHECK: Ensure user and token are available before even trying to fetch
        const token = localStorage.getItem('accessToken');
        if (!user || !token || !selectedOrg?.id) {
            setBranches([]);
            setSelectedBranchIds([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await apiService.branches.getAll({
                headers: { 'x-org-id': selectedOrg.id },
                signal
            });

            // Robustly extract the array of branches
            let branchesList = [];
            if (Array.isArray(response)) {
                branchesList = response;
            } else if (response?.data && Array.isArray(response.data)) {
                branchesList = response.data;
            } else if (response?.branches && Array.isArray(response.branches)) {
                branchesList = response.branches;
            }

            if (signal?.aborted) return;

            setBranches(branchesList);
            const availableIds = branchesList.map(b => Number(b.id)).filter(Boolean);
            const persistedIds = (() => {
                try {
                    const storedIds = localStorage.getItem('selectedBranchIds');
                    if (storedIds) {
                        const parsed = JSON.parse(storedIds);
                        if (Array.isArray(parsed)) return parsed.map(Number).filter(Boolean);
                    }

                    const legacyStored = localStorage.getItem('selectedBranch');
                    if (!legacyStored) return [];
                    const legacyBranch = JSON.parse(legacyStored);
                    if (legacyBranch?.id === 'all') return availableIds;
                    if (legacyBranch?.id && !isNaN(Number(legacyBranch.id))) return [Number(legacyBranch.id)];
                } catch {
                    return [];
                }
                return [];
            })();

            const filteredIds = persistedIds.filter(id => availableIds.includes(id));
            const nextSelectedIds = filteredIds.length > 0 ? filteredIds : availableIds;
            setSelectedBranchIds(nextSelectedIds);
            persistSelectedBranchIds(nextSelectedIds);

        } catch (error) {
            if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED' || signal?.aborted) return;

            console.error("Failed to fetch branches:", error);
            setBranches([]);
            setSelectedBranchIds([]);
            persistSelectedBranchIds([]);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [selectedOrg?.id, user?.id]); // Depend on both Org and User IDs for stability

    useEffect(() => {
        const controller = new AbortController();
        fetchBranches(controller.signal);

        return () => {
            controller.abort();
        };
    }, [fetchBranches]);

    const isAllBranchesSelected = useMemo(() => {
        if (!branches.length) return false;
        return branches.every(b => selectedBranchIds.includes(Number(b.id)));
    }, [branches, selectedBranchIds]);

    const selectedBranch = useMemo(() => {
        if (!branches.length || selectedBranchIds.length === 0) return null;

        if (isAllBranchesSelected) {
            return { id: 'all', name: 'All Branches', branchIds: selectedBranchIds };
        }

        if (selectedBranchIds.length === 1) {
            return branches.find(b => Number(b.id) === Number(selectedBranchIds[0])) || null;
        }

        return { id: 'multi', name: 'Multiple Branches', branchIds: selectedBranchIds };
    }, [branches, selectedBranchIds, isAllBranchesSelected]);

    useEffect(() => {
        persistSelectedBranchIds(selectedBranchIds);
    }, [selectedBranchIds, persistSelectedBranchIds]);

    useEffect(() => {
        if (selectedBranch) {
            localStorage.setItem('selectedBranch', JSON.stringify({
                ...selectedBranch,
                id: selectedBranch.id === 'multi' ? 'all' : selectedBranch.id
            }));
        } else {
            localStorage.removeItem('selectedBranch');
        }
    }, [selectedBranch]);

    const getBranchFilterValue = useCallback(() => {
        if (selectedBranchIds.length === 0) return null;
        if (isAllBranchesSelected) return 'all';
        if (selectedBranchIds.length === 1) return Number(selectedBranchIds[0]);
        return selectedBranchIds.map(Number);
    }, [selectedBranchIds, isAllBranchesSelected]);

    const setSelectedBranch = useCallback((branch) => {
        if (!branch) {
            setSelectedBranchIds([]);
            persistSelectedBranchIds([]);
            return;
        }
        if (branch.id === 'all') {
            const allIds = (branches || []).map(b => Number(b.id)).filter(Boolean);
            setSelectedBranchIds(allIds);
            persistSelectedBranchIds(allIds);
            return;
        }
        const id = Number(branch.id);
        if (!isNaN(id)) {
            setSelectedBranchIds([id]);
            persistSelectedBranchIds([id]);
        }
    }, [branches, persistSelectedBranchIds]);

    const selectAllBranches = useCallback(() => {
        const allIds = (branches || []).map(b => Number(b.id)).filter(Boolean);
        setSelectedBranchIds(allIds);
        persistSelectedBranchIds(allIds);
    }, [branches, persistSelectedBranchIds]);

    const toggleBranchSelection = useCallback((branchId) => {
        const id = Number(branchId);
        if (isNaN(id)) return;

        setSelectedBranchIds(prev => {
            const exists = prev.includes(id);
            const next = exists ? prev.filter(x => x !== id) : [...prev, id];
            const normalized = next.length === 0 ? [id] : next;
            persistSelectedBranchIds(normalized);
            return normalized;
        });
    }, [persistSelectedBranchIds]);

    const refreshBranches = () => fetchBranches();

    return (
        <BranchContext.Provider
            value={{
                selectedBranch,
                setSelectedBranch,
                selectedBranchIds,
                setSelectedBranchIds,
                isAllBranchesSelected,
                selectAllBranches,
                toggleBranchSelection,
                getBranchFilterValue,
                branches,
                loading,
                refreshBranches
            }}
        >
            {children}
        </BranchContext.Provider>
    );
};

export const useBranch = () => {
    const context = useContext(BranchContext);
    if (!context) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
};
