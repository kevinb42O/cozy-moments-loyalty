import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../shared/store/AuthContext';
import { LoyaltyProvider, useLoyalty } from '../shared/store/LoyaltyContext';
import { LoadingScreen } from '../shared/components/LoadingScreen';

// Code-split: each page is loaded only when visited
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const CustomerPage = lazy(() => import('./pages/CustomerPage').then(m => ({ default: m.CustomerPage })));
const Scanner = lazy(() => import('./pages/Scanner').then(m => ({ default: m.Scanner })));
const RewardsPage = lazy(() => import('./pages/RewardsPage').then(m => ({ default: m.RewardsPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

const LoadingFallback = () => <LoadingScreen variant="customer" />;

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
  const { currentCustomer, loading } = useLoyalty();

  if (isLoading || (user && loading)) return <LoadingScreen variant="customer" />;
  if (!user) return <Navigate to="/" replace />;
  if (currentCustomer?.mustResetPassword) return <Navigate to="/reset-password" replace />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const { currentCustomer, loading } = useLoyalty();

  if (isLoading || (user && loading)) return <LoadingScreen variant="customer" />;
  if (user) {
    if (currentCustomer?.mustResetPassword) return <Navigate to="/reset-password" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const ResetPasswordRoute: React.FC = () => {
  const { user, isLoading, recoveryMode } = useAuth();
  const { currentCustomer, loading } = useLoyalty();

  if (isLoading || (user && loading)) return <LoadingScreen variant="customer" />;

  if (recoveryMode || currentCustomer?.mustResetPassword) {
    return <ResetPasswordPage />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <LoyaltyProvider>
        <BrowserRouter>
          <CustomerSync />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPasswordRoute />} />
              <Route path="/dashboard" element={<ProtectedRoute><CustomerPage /></ProtectedRoute>} />
              <Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
              <Route path="/rewards" element={<ProtectedRoute><RewardsPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LoyaltyProvider>
    </AuthProvider>
  );
}
