import React from 'react';
import { LoyaltyProvider } from '../shared/store/LoyaltyContext';
import { BusinessAuthProvider, useBusinessAuth } from './store/BusinessAuthContext';
import { BusinessPage } from './pages/BusinessPage';
import { AdminLoginPage } from './pages/AdminLoginPage';

const AdminGuard: React.FC = () => {
  const { isAdmin, isLoading } = useBusinessAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <div className="animate-pulse text-[var(--color-cozy-olive)] font-serif text-xl">Laden...</div>
      </div>
    );
  }

  if (!isAdmin) return <AdminLoginPage />;

  return (
    <LoyaltyProvider>
      <BusinessPage />
    </LoyaltyProvider>
  );
};

export default function App() {
  return (
    <BusinessAuthProvider>
      <AdminGuard />
    </BusinessAuthProvider>
  );
}
