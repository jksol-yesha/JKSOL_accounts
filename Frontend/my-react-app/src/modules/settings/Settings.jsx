import React from 'react';
import PageHeader from '../../components/layout/PageHeader';
import PageContentShell from '../../components/layout/PageContentShell';
import PreferenceSettingsSection from './components/PreferenceSettingsSection';

const Settings = () => {
    return (
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
            <PreferenceSettingsSection />
        </PageContentShell>
    );
};

export default Settings;
