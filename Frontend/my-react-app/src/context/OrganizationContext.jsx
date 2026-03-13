import React, { useContext, useState, useEffect } from 'react';
import apiService from '../services/api';
import { useAuth } from './AuthContext';
import OrganizationContext from './OrganizationContextDefinition';

export const OrganizationProvider = ({ children }) => {
    const { user, updateUser, isLoading } = useAuth();
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(false);

    const [selectedOrg, setSelectedOrg] = useState(() => {
        try {
            const stored = localStorage.getItem('selectedOrg');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.role) {
                    parsed.role = parsed.role.toLowerCase();
                }
                return parsed;
            }
            return null;
        } catch (e) {
            return null;
        }
    });

    const fetchOrganizations = async (signal) => {
        const token = localStorage.getItem('accessToken');
        if (!user || !token) return;

        setLoading(true);
        try {
            const response = await apiService.organizations.getAll({ signal });

            // Robustly extract the array of organizations
            let list = [];
            if (Array.isArray(response)) {
                list = response;
            } else if (response?.data && Array.isArray(response.data)) {
                list = response.data;
            } else if (response?.orgs && Array.isArray(response.orgs)) {
                list = response.orgs;
            } else if (response?.organizations && Array.isArray(response.organizations)) {
                list = response.organizations;
            }

            if (signal?.aborted) return;

            setOrganizations(list);

            // If no selected org, or selected org not in list, select the one from user profile or first one
            // (Only on initial load or if selectedOrg is completely lost/invalid)
            if ((!selectedOrg || !list.find(o => o.id == selectedOrg.id)) && list.length > 0) {
                // If user has orgId, try to find it
                const defaultOrg = user.orgId ? list.find(o => o.id == user.orgId) : list[0];
                const nextOrg = defaultOrg || list[0];
                localStorage.setItem('selectedOrg', JSON.stringify(nextOrg));
                setSelectedOrg(nextOrg);
            } else if (selectedOrg) {
                // Refresh the currently selected org data in case it changed (e.g. status update)
                const updatedCurrent = list.find(o => o.id == selectedOrg.id);
                if (updatedCurrent) {
                    localStorage.setItem('selectedOrg', JSON.stringify(updatedCurrent));
                    setSelectedOrg(updatedCurrent); // Keeps state fresh
                    // No auto-switching even if inactive, per user request.
                }
            }
        } catch (error) {
            if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED' || signal?.aborted) return;
            console.error("Failed to fetch organizations:", error);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        if (isLoading) return; // Wait for auth to initialize

        const controller = new AbortController();

        if (user?.id) {
            fetchOrganizations(controller.signal);
        } else {
            setOrganizations([]);
            setSelectedOrg(null);
        }

        return () => controller.abort();
    }, [user?.id, isLoading]);

    useEffect(() => {
        if (selectedOrg) {
            localStorage.setItem('selectedOrg', JSON.stringify(selectedOrg));
        } else {
            localStorage.removeItem('selectedOrg');
        }
    }, [selectedOrg]);

    const createOrganization = async (data) => {
        try {
            const response = await apiService.organizations.create(data);
            const newOrg = response.data;
            setOrganizations([...organizations, newOrg]);
            setSelectedOrg(newOrg); // Auto switch
            return newOrg;
        } catch (error) {
            throw error;
        }
    };

    const switchOrganization = (org) => {
        // Save to localStorage immediately before reloading
        localStorage.setItem('selectedOrg', JSON.stringify(org));
        setSelectedOrg(org);
        window.location.reload();
    };

    return (
        <OrganizationContext.Provider value={{
            organizations,
            selectedOrg,
            loading,
            createOrganization,
            switchOrganization,
            refreshOrganizations: fetchOrganizations
        }}>
            {children}
        </OrganizationContext.Provider>
    );
};

export const useOrganization = () => {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error('useOrganization must be used within an OrganizationProvider');
    }
    return context;
};
