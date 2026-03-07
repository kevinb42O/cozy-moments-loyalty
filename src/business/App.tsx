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

const TestWatermark = () => (
  <div
    className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-400 text-black text-center py-1 text-xs font-bold tracking-wide shadow-md"
    style={{ letterSpacing: '0.08em' }}
  >
    Testversie — Ontwikkeld door WebAanZee
  </div>
);

export default function App() {
  return (
    <BusinessAuthProvider>
      <TestWatermark />
      <AdminGuard />
    </BusinessAuthProvider>
  );
}
