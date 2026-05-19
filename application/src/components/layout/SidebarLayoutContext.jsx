import React from 'react';

const SidebarLayoutContext = React.createContext(null);

export const SidebarLayoutProvider = SidebarLayoutContext.Provider;

export const useSidebarLayout = () => {
    const context = React.useContext(SidebarLayoutContext);

    if (!context) {
        throw new Error('useSidebarLayout must be used within a SidebarLayoutProvider');
    }

    return context;
};
