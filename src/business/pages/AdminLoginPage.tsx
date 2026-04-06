import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
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
    <div className="relative min-h-screen overflow-hidden bg-[#f5f4ee] text-[var(--color-cozy-text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-7rem] top-[-4rem] h-72 w-72 rounded-full bg-[#efe7d7] opacity-85 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-3rem] h-80 w-80 rounded-full bg-[#ebe3d2] opacity-90 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.55),_transparent_40%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10"
      >
        <div className="grid w-full gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
          <section className="flex flex-col justify-center">
            <p className="admin-phase-kicker">Cozy Moments beheer</p>
            <img
              src="/cozylogo.png"
              alt="COZY Moments"
              className="mt-5 h-20 w-auto object-contain drop-shadow-sm"
            />
            <h1 className="mt-10 max-w-xl text-5xl font-display font-bold leading-[1.02] text-[var(--color-cozy-text)] md:text-6xl">
              Alles achter de schermen, helder op één plek.
            </h1>
            <p className="admin-phase-copy mt-5 max-w-xl text-base md:text-lg">
              Meld je aan om klanten, beloningen, historiek en dagelijkse opvolging vlot te beheren vanuit één duidelijke beheeromgeving.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="admin-phase-panel-soft rounded-[24px] px-5 py-4">
                <p className="admin-phase-kicker">Dagelijkse werking</p>
                <p className="mt-3 text-base font-semibold text-[var(--color-cozy-text)]">Van snelle registraties aan de toog tot gerichte klantenopvolging</p>
              </div>
              <div className="admin-phase-panel-soft rounded-[24px] px-5 py-4">
                <p className="admin-phase-kicker">Alleen voor admins</p>
                <p className="mt-3 text-base font-semibold text-[var(--color-cozy-text)]">Gevoelige acties, historiek en instellingen blijven netjes afgeschermd</p>
              </div>
            </div>
          </section>

          <section className="admin-phase-panel rounded-[32px] p-7 md:p-9 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfd5c2] bg-[#f7f2e7] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">
              <ShieldCheck size={14} />
              Adminportaal
            </div>

            <div className="mt-6">
              <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)]">Inloggen</h2>
              <p className="admin-phase-copy mt-2 text-sm md:text-base">
                Log in met je adminaccount om verder te gaan naar het beheerpaneel van Cozy Moments.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="admin-phase-label">E-mailadres</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={values.login}
                  onChange={e => setValues(v => ({ ...v, login: e.target.value }))}
                  placeholder="admin@cozy-moments.be"
                  className="admin-phase-input text-base"
                />
              </label>

              <label className="block">
                <span className="admin-phase-label">Wachtwoord</span>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={values.password}
                    onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
                    placeholder="••••••••••"
                    className="admin-phase-input pr-14 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
                >
                  {loginError}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="admin-phase-button-primary flex w-full items-center justify-center gap-2 text-base font-semibold"
              >
                <Lock size={16} />
                {loading ? 'Bezig met inloggen...' : 'Inloggen'}
              </button>
            </form>

            <p className="mt-6 text-xs text-gray-400">
              Cozy Moments Admin &copy; {new Date().getFullYear()}
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
};
