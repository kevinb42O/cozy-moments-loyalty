import React from 'react';
import { LoyaltyProvider } from '../shared/store/LoyaltyContext';
import { BusinessAuthProvider, useBusinessAuth } from './store/BusinessAuthContext';
import { BusinessPage } from './pages/BusinessPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { LoadingScreen } from '../shared/components/LoadingScreen';

const AdminGuard: React.FC = () => {
  const { isAdmin, isLoading } = useBusinessAuth();

  if (isLoading) return <LoadingScreen variant="business" />;

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
