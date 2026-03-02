import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../shared/store/AuthContext';
import { LoyaltyProvider, useLoyalty } from '../shared/store/LoyaltyContext';
import { LoginPage } from './pages/LoginPage';
import { CustomerPage } from './pages/CustomerPage';
import { Scanner } from './pages/Scanner';
import { RewardsPage } from './pages/RewardsPage';

// Auto-create/select customer row when user signs in
const CustomerSync: React.FC = () => {
  const { user } = useAuth();
  const { upsertCustomer } = useLoyalty();
  useEffect(() => {
    if (user) upsertCustomer(user.id, user.name, user.email);
  }, [user?.id]);
  return null;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-cozy-bg)]">
        <div className="animate-pulse text-[var(--color-cozy-coffee)] font-serif text-xl">Laden...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-cozy-bg)]">
        <div className="animate-pulse text-[var(--color-cozy-coffee)] font-serif text-xl">Laden...</div>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <LoyaltyProvider>
        <BrowserRouter>
          <CustomerSync />
          <Routes>
            <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><CustomerPage /></ProtectedRoute>} />
            <Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
            <Route path="/rewards" element={<ProtectedRoute><RewardsPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LoyaltyProvider>
    </AuthProvider>
  );
}
