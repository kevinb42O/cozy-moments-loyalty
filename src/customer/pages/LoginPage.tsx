import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../shared/store/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { isManagedLoginEmail, normalizeCustomerLoginInput } from '../../shared/lib/customer-accounts';

type Mode = 'login' | 'register' | 'forgot';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    await loginWithGoogle();
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await loginWithEmail(normalizeCustomerLoginInput(email), password);
    } catch {
      setError('Fout e-mailadres, accountcode of wachtwoord. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minstens 6 tekens bevatten.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signUpWithEmail(email.trim(), password, name.trim());
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('already registered')) {
        setError('Dit e-mailadres is al geregistreerd. Probeer in te loggen.');
      } else {
        setError('Er ging iets mis. Probeer opnieuw.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const normalizedLogin = normalizeCustomerLoginInput(email);
      if (isManagedLoginEmail(normalizedLogin)) {
        setError('Voor een accountcode zonder e-mailadres helpt een medewerker je best verder.');
        return;
      }
      await resetPassword(normalizedLogin);
      setResetSent(true);
    } catch {
      setError('Er ging iets mis. Controleer je e-mailadres.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-cozy-bg)]">


      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-sm w-full"
      >
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center text-center">
          <a href="https://cozy-moments.be" target="_blank" rel="noopener noreferrer">
            <img
              src="/cozylogo.png"
              alt="COZY Moments"
              className="w-52 h-52 object-contain drop-shadow-md"
            />
          </a>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-3 text-xs font-medium tracking-[0.22em] uppercase text-[var(--color-cozy-coffee)] opacity-70"
          >
            Digitale Spaarkaart
          </motion.p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {/* Google */}
              <div className="space-y-3 mb-6">
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full bg-white hover:bg-gray-50 text-[var(--color-cozy-text)] rounded-2xl py-4 px-5 shadow-sm flex items-center gap-4 transition-all border border-gray-100 disabled:opacity-60"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="font-medium text-sm">Doorgaan met Google</span>
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 uppercase tracking-widest">of</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="E-mailadres of accountcode"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full bg-white rounded-2xl py-4 pl-10 pr-5 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Wachtwoord"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-[var(--color-cozy-coffee)] hover:underline"
                  >
                    Wachtwoord vergeten?
                  </button>
                </div>

                {error && <p className="text-red-500 text-xs px-1">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 px-5 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Bezig...' : 'Inloggen'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-5">
                Nog geen account?{' '}
                <button
                  onClick={() => switchMode('register')}
                  className="text-[var(--color-cozy-coffee)] font-semibold hover:underline"
                >
                  Registreer hier
                </button>
              </p>
              <p className="text-center text-xs text-gray-400 mt-3">
                Heb je van het personeel een accountcode gekregen? Die werkt hier ook.
              </p>
            </motion.div>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-center font-display font-bold text-lg text-[var(--color-cozy-text)] mb-5">Account aanmaken</h2>

              <form onSubmit={handleRegister} className="space-y-3">
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Je naam"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
                    className="w-full bg-white rounded-2xl py-4 pl-10 pr-5 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
                  />
                </div>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder="E-mailadres"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full bg-white rounded-2xl py-4 pl-10 pr-5 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Wachtwoord (min. 6 tekens)"
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
                  disabled={loading || !name.trim() || !email.trim() || !password || !confirmPassword}
                  className="w-full bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 px-5 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Bezig...' : 'Account aanmaken'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-5">
                Al een account?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-[var(--color-cozy-coffee)] font-semibold hover:underline"
                >
                  Inloggen
                </button>
              </p>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot' && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {resetSent ? (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Mail size={24} className="text-green-600" />
                  </div>
                  <p className="font-medium text-[var(--color-cozy-text)] mb-1">Check je inbox!</p>
                  <p className="text-sm text-gray-500">
                    We stuurden een herstellink naar <strong>{email}</strong>. Klik op de link om een nieuw wachtwoord in te stellen.
                  </p>
                  <button
                    onClick={() => { setResetSent(false); switchMode('login'); }}
                    className="mt-4 text-xs text-[var(--color-cozy-coffee)] underline"
                  >
                    Terug naar inloggen
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-center font-display font-bold text-lg text-[var(--color-cozy-text)] mb-2">Wachtwoord vergeten</h2>
                  <p className="text-center text-sm text-gray-500 mb-5">Vul je e-mailadres in en we sturen je een herstellink. Accountcodes zonder e-mailadres laat je best resetten door het personeel.</p>

                  <form onSubmit={handleForgot} className="space-y-3">
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="E-mailadres"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="username"
                        className="w-full bg-white rounded-2xl py-4 pl-10 pr-5 border border-gray-200 focus:border-[var(--color-cozy-coffee)] focus:outline-none text-sm transition-colors"
                      />
                    </div>

                    {error && <p className="text-red-500 text-xs px-1">{error}</p>}

                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 px-5 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Bezig...' : 'Stuur herstellink'}
                    </button>
                  </form>

                  <p className="text-center text-sm text-gray-500 mt-5">
                    <button
                      onClick={() => switchMode('login')}
                      className="text-[var(--color-cozy-coffee)] font-semibold hover:underline"
                    >
                      ← Terug naar inloggen
                    </button>
                  </p>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>

        <p className="text-center text-xs text-gray-400 mt-8">
          Door in te loggen ga je akkoord met onze{' '}
          <button
            onClick={() => setShowTerms(true)}
            className="underline text-[var(--color-cozy-coffee)] hover:opacity-80 transition-opacity"
          >
            voorwaarden
          </button>
        </p>
        <div className="text-center mt-5">
          <a
            href="https://cozy-moments.be"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-cozy-coffee)]/85 hover:text-[var(--color-cozy-coffee)] transition-colors"
          >
            <span className="font-medium">Bekijk onze website -&gt;</span>
          </a>
        </div>
      </motion.div>
    </div>

      {/* ─── GDPR Terms Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showTerms && (
          <motion.div
            key="terms-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={() => setShowTerms(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100 shrink-0 gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-bold text-lg text-[var(--color-cozy-text)] wrap-anywhere">Gebruiksvoorwaarden &amp; Privacybeleid</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Cozy Moments — Digitale Spaarkaart</p>
                </div>
                <button
                  onClick={() => setShowTerms(false)}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scroll hint */}
              <div className="flex items-center justify-center gap-1 py-2 text-gray-300 shrink-0">
                <ChevronDown size={14} />
                <span className="text-[10px] uppercase tracking-widest">Scroll om alles te lezen</span>
                <ChevronDown size={14} />
              </div>

              {/* Content */}
              <div className="overflow-y-auto px-5 sm:px-6 pb-8 flex-1 text-sm text-gray-600 space-y-6 leading-relaxed wrap-anywhere">
                <p className="text-xs text-gray-400 italic">Versie 1.1 — van kracht vanaf 26 maart 2026</p>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">DEEL 1: ALGEMENE GEBRUIKSVOORWAARDEN</h3>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">1. Bedrijfsgegevens</h3>
                  <p>Deze digitale spaarkaart wordt beheerd en aangeboden door:</p>
                  <p className="mt-2 bg-gray-50 rounded-xl p-4 text-xs wrap-anywhere">
                    <strong>Naam:</strong> Cozy Moments (Uitbater: Janssens, Sixtine)<br />
                    <strong>Adres:</strong> Grote Markt 2/0002, 8370 Blankenberge, België<br />
                    <strong>Ondernemingsnummer (BTW):</strong> BE1021.623.893<br />
                    <strong>E-mail:</strong> <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline break-all">info@cozy-moments.be</a>
                  </p>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">2. Toegang en Leeftijdsgrens</h3>
                  <p>Door een account aan te maken, ga je akkoord met deze voorwaarden.</p>
                  <p className="mt-2">Je moet minstens 16 jaar oud zijn om een account aan te maken.</p>
                  <p className="mt-2">
                    Voor het sparen en inwisselen van stempels voor alcoholische dranken (Wijn Kaart, Bier Kaart) geldt de absolute wettelijke minimumleeftijd van 18 jaar. Bij twijfel kan het personeel om een identiteitsbewijs vragen.
                  </p>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">3. Werking van de Spaarkaart &amp; Waarde</h3>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>De digitale spaarkaart is strikt persoonlijk en gekoppeld aan jouw account.</li>
                    <li>Spaarstempels en beloningen hebben geen contante waarde en kunnen in geen enkel geval worden ingewisseld voor geld.</li>
                    <li>Stempels zijn niet overdraagbaar naar andere accounts of personen.</li>
                    <li>Het combineren van volle spaarkaarten met andere acties of kortingen is niet mogelijk, tenzij uitdrukkelijk anders vermeld.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">4. Misbruik en Fraude</h3>
                  <p>
                    Cozy Moments behoudt zich het recht voor om bij een vermoeden van fraude (bijv. het onrechtmatig scannen van QR-codes, manipulatie van de app, of het aanmaken van meerdere accounts per persoon) het account onmiddellijk en zonder voorafgaande waarschuwing te blokkeren of te verwijderen. Alle opgebouwde stempels komen hierbij definitief te vervallen.
                  </p>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">5. Wijziging en Stopzetting</h3>
                  <p>
                    Cozy Moments heeft te allen tijde het recht om de voorwaarden van het spaarprogramma te wijzigen (bijv. het aantal benodigde stempels of de beloningen aanpassen) of het programma in zijn geheel stop te zetten. In geval van stopzetting vervallen alle niet-ingewisselde stempels en beloningen, zonder recht op enige vorm van compensatie.
                  </p>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">DEEL 2: PRIVACYBELEID (GDPR)</h3>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">1. Verwerkingsverantwoordelijke</h3>
                  <p>
                    Cozy Moments (zie contactgegevens in Deel 1) is de verwerkingsverantwoordelijke voor jouw persoonsgegevens in de zin van de Algemene Verordening Gegevensbescherming (AVG / GDPR).
                  </p>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">2. Welke gegevens verwerken wij?</h3>
                  <p>Via de digitale spaarkaart verwerken wij de volgende gegevens:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Naam en e-mailadres.</li>
                    <li>Google-accountinformatie (enkel bij aanmelding via Google: profielnaam en e-mailadres).</li>
                    <li>Spaarstempels, bezoeken en beloningshistoriek.</li>
                    <li>Technische gegevens (IP-adres en sessie-informatie voor een veilige login).</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">3. Doeleinden en Rechtsgronden</h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Uitvoering van de overeenkomst (art. 6.1.b AVG)</p>
                      <p>Het beheren van jouw account, het registreren van stempels en het toekennen van gratis consumpties.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Gerechtvaardigd belang (art. 6.1.f AVG)</p>
                      <p>Het beveiligen van de applicatie, het voorkomen van fraude, en het bijhouden van anonieme statistieken ter verbetering van onze diensten.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Toestemming (art. 6.1.a AVG) - Direct Marketing</p>
                      <p>
                        Enkel wanneer jij hier uitdrukkelijk en actief voor hebt gekozen (bijv. via een vinkje bij registratie), gebruiken wij jouw e-mailadres om je te informeren over promoties, nieuwe producten of evenementen. Je kan deze toestemming op elk moment intrekken via de uitschrijflink in onze e-mails of door ons te mailen via <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline break-all">info@cozy-moments.be</a>.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">4. Cookies en Lokale Opslag (Local Storage)</h3>
                  <p>
                    Om te voorkomen dat je bij elk bezoek opnieuw moet inloggen, maakt onze applicatie (via Supabase Auth) uitsluitend gebruik van functionele &apos;Local Storage&apos; en beveiligde sessie-tokens op jouw toestel. Wij gebruiken geen tracking- of advertentiecookies.
                  </p>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">5. Bewaartermijnen</h3>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Accountgegevens:</strong> Zolang je account actief is, tot maximaal 3 jaar na je laatste login. Daarna worden je gegevens veilig gewist of geanonimiseerd.</li>
                    <li><strong>Marketing:</strong> Tot je jouw toestemming intrekt.</li>
                    <li><strong>Technische logboeken:</strong> Maximaal 12 maanden ter beveiliging van het systeem.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">6. Doorgifte aan derden</h3>
                  <p>Wij verkopen jouw gegevens nooit door. Wij werken enkel samen met streng beveiligde technische partners (verwerkers) die contractueel gebonden zijn aan de AVG:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Supabase Inc. (VS):</strong> Database en veilige authenticatie (beschermd via Standard Contractual Clauses).</li>
                    <li><strong>Google LLC:</strong> Optionele aanmelding via Google OAuth.</li>
                    <li><strong>Vercel Inc.:</strong> Hosting van de applicatie.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">7. Jouw rechten</h3>
                  <p>
                    Je hebt het recht om jouw gegevens in te zien, te laten corrigeren, of te laten verwijderen. Daarnaast heb je het recht op beperking van de verwerking, gegevensoverdraagbaarheid en het recht om bezwaar te maken tegen verwerking voor marketingdoeleinden. Stuur hiervoor een e-mail naar <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline break-all">info@cozy-moments.be</a>. Wij behandelen je verzoek binnen 30 dagen.
                  </p>
                </section>

                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">8. Klachtenrecht</h3>
                  <p>
                    Indien je van mening bent dat wij jouw gegevens onrechtmatig verwerken, heb je het recht een klacht in te dienen bij de Gegevensbeschermingsautoriteit (GBA): Drukpersstraat 35, 1000 Brussel (<a href="https://www.gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cozy-coffee)] underline break-all">www.gegevensbeschermingsautoriteit.be</a>).
                  </p>
                </section>
              </div>

              {/* Footer button */}
              <div className="px-5 sm:px-6 py-5 border-t border-gray-100 shrink-0">
                <button
                  onClick={() => setShowTerms(false)}
                  className="w-full bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 font-display font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  Begrepen, sluiten
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
