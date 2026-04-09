import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './modules/dashboard/Dashboard';
import Accounts from './modules/accounts/Accounts';
import CreateAccount from './modules/accounts/components/CreateAccount';
import Category from './modules/category/Category';
import Parties from './modules/parties/Parties';
import CreateParty from './modules/parties/components/CreateParty';
import Transactions from './modules/transactions/Transactions';
import CreateTransaction from './modules/transactions/components/CreateTransaction';
import Reports from './modules/reports/Reports';
import Profile from './modules/profile/Profile';
import Organizations from './modules/organizations/Organizations';
import CreateOrganization from './modules/organizations/CreateOrganization';
import AuditLogs from './modules/audit/AuditLogs';
import PublicLayout from './components/layout/PublicLayout';
import './App.css';

// Placeholder components for other routes
const Placeholder = ({ title }) => (
  <div className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    <p className="text-gray-500 mt-2">This module is under development.</p>
  </div>
);

import { AuthProvider } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';
import { ToastProvider } from './context/ToastContext';
import { BranchProvider } from './context/BranchContext';
import { YearProvider } from './context/YearContext';
import { PreferenceProvider } from './context/PreferenceContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './modules/auth/Login';
import EnterOtp from './modules/auth/EnterOtp';

import Onboarding from './modules/onboarding/Onboarding';
// Removed: import { useEffect } from "react";

function App() {
  // Removed: useEffect hook
  return (
    <AuthProvider>
      <OrganizationProvider>
        <ToastProvider>
          <BranchProvider>
            <YearProvider>
              <PreferenceProvider>
                <Routes>
                  {/* Public Routes Wrapped in PublicLayout */}
                    <Route element={<PublicLayout />}>
                      <Route path="/login" element={<Login />} />
                      <Route path="/enter-otp" element={<EnterOtp />} />
                    </Route>

                  {/* Protected Routes */}
                  <Route path="/" element={<ProtectedRoute><Layout><Navigate to="/dashboard" replace /></Layout></ProtectedRoute>} />

                  <Route path="/onboarding" element={
                    <ProtectedRoute>
                      <PublicLayout>
                        <Onboarding />
                      </PublicLayout>
                    </ProtectedRoute>
                  } />

                  <Route element={
                    <ProtectedRoute>
                      <Layout>
                        <div />
                      </Layout>
                    </ProtectedRoute>
                  }>
                    {/* Wrapper for dashboard routes if needed, but the catch-all below handles it better usually.
                           However, the previous code had a specific structure. Let's stick to the route-based layout.
                       */}
                  </Route>


                  <Route path="/*" element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/accounts" element={<Accounts />} />
                          <Route path="/accounts/create" element={<CreateAccount />} />
                          <Route path="/parties" element={<Parties />} />
                          <Route path="/parties/create" element={<CreateParty />} />
                          <Route path="/category" element={<Category />} />
                          <Route path="/transactions" element={<Transactions />} />
                          <Route path="/transactions/create" element={<CreateTransaction />} />
                          <Route path="/transactions/edit/:id" element={<CreateTransaction />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/settings" element={<Navigate to="/profile" replace />} />
                          <Route path="/organizations" element={<Organizations />} />
                          <Route path="/organizations/create" element={<CreateOrganization />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/audit-logs" element={<AuditLogs />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                  />
                </Routes>
              </PreferenceProvider>
            </YearProvider>
          </BranchProvider>
        </ToastProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}

export default App;
