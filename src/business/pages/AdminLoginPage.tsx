import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useBusinessAuth } from '../store/BusinessAuthContext';

export const AdminLoginPage: React.FC = () => {
  const { login, loginError } = useBusinessAuth();
  const [values, setValues] = useState({ login: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(values.login, values.password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f0]">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center text-center">
          <img
            src="/cozylogo.png"
            alt="COZY Moments"
            className="w-52 h-52 object-contain drop-shadow-md"
          />
          <p className="text-sm text-gray-400 mt-2 tracking-wider uppercase font-display font-bold">
            Beheerspaneel
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm p-8 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Login
            </label>
            <input
              type="text"
              autoComplete="username"
              required
              value={values.login}
              onChange={e => setValues(v => ({ ...v, login: e.target.value }))}
              placeholder="Gebruikersnaam"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Wachtwoord
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={values.password}
                onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
                placeholder="••••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)] transition"
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {loginError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-500 text-center"
            >
              {loginError}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-cozy-olive)] hover:bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 font-semibold text-sm transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Lock size={16} />
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-6">
          Cozy Moments Admin &copy; {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
};
