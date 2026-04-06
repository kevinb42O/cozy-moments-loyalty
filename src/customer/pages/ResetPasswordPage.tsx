import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/store/AuthContext';
import { useLoyalty } from '../../shared/store/LoyaltyContext';
import { motion } from 'framer-motion';

export const ResetPasswordPage: React.FC = () => {
  const { recoveryMode, updatePassword, user } = useAuth();
  const { currentCustomer, loading: customerLoading, refreshCustomers } = useLoyalty();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const requiresPasswordReset = Boolean(user && currentCustomer?.mustResetPassword);
  const canResetPassword = recoveryMode || requiresPasswordReset;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minstens 6 tekens bevatten.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await updatePassword(password);
      await refreshCustomers();
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    } catch {
      setError('Er ging iets mis. Probeer opnieuw of vraag een nieuwe herstellink op.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-cozy-bg)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-sm w-full"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <a href="https://www.cozy-moments.be/" target="_blank" rel="noopener noreferrer">
            <img
              src="/cozylogo.png"
              alt="COZY Moments"
              className="w-36 h-36 object-contain drop-shadow-md"
            />
          </a>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock size={22} className="text-green-600" />
            </div>
            <p className="font-medium text-[var(--color-cozy-text)] mb-1">Wachtwoord gewijzigd!</p>
            <p className="text-sm text-gray-500">Je wordt doorgestuurd naar je spaarkaart…</p>
          </div>
        ) : customerLoading && !recoveryMode ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <div className="animate-pulse text-[var(--color-cozy-coffee)] text-sm">Account controleren…</div>
          </div>
        ) : !canResetPassword ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <div className="animate-pulse text-[var(--color-cozy-coffee)] text-sm">Herstellink verifiëren…</div>
            <p className="text-xs text-gray-400 mt-2">
              Klik op de link in je e-mail om hier te landen. Heb je geen link?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-[var(--color-cozy-coffee)] underline"
              >
                Vraag er een aan
              </button>
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-center font-display font-bold text-lg text-[var(--color-cozy-text)] mb-2">
              {requiresPasswordReset ? 'Kies nu je eigen wachtwoord' : 'Nieuw wachtwoord instellen'}
            </h2>
            <p className="text-center text-sm text-gray-500 mb-6">
              {requiresPasswordReset
                ? 'Je account is aangemaakt door een medewerker. Kies nu meteen een nieuw wachtwoord van minstens 6 tekens.'
                : 'Kies een sterk wachtwoord van minstens 6 tekens.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nieuw wachtwoord"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-white rounded-2xl py-4 pl-10 pr-12 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Wachtwoord bevestigen"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-white rounded-2xl py-4 pl-10 pr-5 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
                />
              </div>

              {error && <p className="text-red-500 text-xs px-1">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting || !password || !confirmPassword}
                className="w-full bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 px-5 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Bezig...' : 'Wachtwoord opslaan'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};
