import React, { useState } from 'react';
import { Coffee } from 'lucide-react';
import { useAuth } from '../../shared/store/AuthContext';
import { motion } from 'framer-motion';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithFacebook, loginWithEmail } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading('google');
    await loginWithGoogle();
  };

  const handleFacebook = async () => {
    setLoading('facebook');
    await loginWithFacebook();
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setLoading('email');
    await loginWithEmail(email.trim(), name.trim());
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-cozy-bg)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-sm w-full"
      >
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-[var(--color-cozy-coffee)] text-[#f5f5f0] rounded-full flex items-center justify-center mb-5 shadow-xl">
            <Coffee size={40} strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-serif font-semibold text-[var(--color-cozy-coffee)]">
            Cozy Moments
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-serif italic">
            Jouw digitale spaarkaart
          </p>
        </div>

        {/* Social login buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogle}
            disabled={loading !== null}
            className="w-full bg-white hover:bg-gray-50 text-[var(--color-cozy-text)] rounded-2xl py-4 px-5 shadow-sm flex items-center gap-4 transition-all border border-gray-100 disabled:opacity-60"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-medium text-sm">
              {loading === 'google' ? 'Bezig...' : 'Doorgaan met Google'}
            </span>
          </button>

          <button
            onClick={handleFacebook}
            disabled={loading !== null}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-2xl py-4 px-5 shadow-sm flex items-center gap-4 transition-all disabled:opacity-60"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="font-medium text-sm">
              {loading === 'facebook' ? 'Bezig...' : 'Doorgaan met Facebook'}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase tracking-widest">of</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email option */}
        {!showEmail ? (
          <button
            onClick={() => setShowEmail(true)}
            className="w-full bg-white hover:bg-gray-50 text-[var(--color-cozy-text)] rounded-2xl py-4 px-5 shadow-sm text-sm font-medium transition-all border border-gray-100"
          >
            Doorgaan met e-mailadres
          </button>
        ) : (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            onSubmit={handleEmail}
            className="space-y-3"
          >
            <input
              type="text"
              placeholder="Je naam"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full bg-white rounded-2xl py-4 px-5 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
            />
            <input
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-white rounded-2xl py-4 px-5 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
            />
            <button
              type="submit"
              disabled={loading !== null || !email.trim() || !name.trim()}
              className="w-full bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 px-5 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading === 'email' ? 'Bezig...' : 'Account aanmaken & inloggen'}
            </button>
          </motion.form>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Door in te loggen ga je akkoord met onze voorwaarden
        </p>
      </motion.div>
    </div>
  );
};
