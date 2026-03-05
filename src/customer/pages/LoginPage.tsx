import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../shared/store/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

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
      await loginWithEmail(email.trim(), password);
    } catch {
      setError('Fout e-mailadres of wachtwoord. Probeer opnieuw.');
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
      await resetPassword(email.trim());
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
      {/* WebaanZee credit — fixed bottom right */}
      <a
        href="https://www.webaanzee.be"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-5 flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity z-50"
        style={{ fontSize: '10px', letterSpacing: '0.04em', textDecoration: 'none' }}
      >
        <span style={{ color: '#111', fontWeight: 500 }}>realisatie door </span>
        <span style={{ fontWeight: 700 }}>
          <span style={{ color: '#111' }}>Web</span><span style={{ color: '#f59e0b' }}>aan</span><span style={{ color: '#111' }}>Zee</span>
        </span>
      </a>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-sm w-full"
      >
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center text-center">
          <a href="https://www.cozy-moments.be/" target="_blank" rel="noopener noreferrer">
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
                  <p className="text-center text-sm text-gray-500 mb-5">Vul je e-mailadres in en we sturen je een herstellink.</p>

                  <form onSubmit={handleForgot} className="space-y-3">
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
        <div className="text-center mt-4">
          <a
            href="https://www.cozy-moments.be/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-cozy-coffee)] hover:underline font-medium"
          >
            Bezoek onze website →
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
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <h2 className="font-display font-bold text-lg text-[var(--color-cozy-text)]">Gebruiksvoorwaarden &amp; Privacybeleid</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Cozy Moments — Digitale Spaarkaart</p>
                </div>
                <button
                  onClick={() => setShowTerms(false)}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0 ml-4"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scroll hint */}
              <div className="flex items-center justify-center gap-1 py-2 text-gray-300 flex-shrink-0">
                <ChevronDown size={14} />
                <span className="text-[10px] uppercase tracking-widest">Scroll om alles te lezen</span>
                <ChevronDown size={14} />
              </div>

              {/* Content */}
              <div className="overflow-y-auto px-6 pb-8 flex-1 text-sm text-gray-600 space-y-6 leading-relaxed">

                <p className="text-xs text-gray-400 italic">Versie 1.0 — van kracht vanaf 3 maart 2026 &nbsp;|&nbsp; Onderneming: Cozy Moments</p>

                {/* 1 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">1. Verwerkingsverantwoordelijke</h3>
                  <p>
                    De verwerkingsverantwoordelijke in de zin van de Algemene Verordening Gegevensbescherming (AVG / GDPR, EU 2016/679) is:
                  </p>
                  <p className="mt-2 bg-gray-50 rounded-xl p-4 text-xs">
                    <strong>Cozy Moments</strong><br />
                    Grote Markt 2, 8370 Blankenberge, België<br />
                    E-mail: <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline">info@cozy-moments.be</a><br />
                    Website: <a href="https://www.cozy-moments.be" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cozy-coffee)] underline">www.cozy-moments.be</a>
                  </p>
                </section>

                {/* 2 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">2. Welke gegevens verwerken wij?</h3>
                  <p>Via de digitale spaarkaart verwerken wij de volgende persoonsgegevens:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Naam (voornaam en/of familienaam)</li>
                    <li>E-mailadres</li>
                    <li>Google-accountinformatie (enkel bij aanmelding via Google: profielnaam en e-mailadres)</li>
                    <li>Spaarpunten en beloningshistoriek (koffie, wijn, bier)</li>
                    <li>Datum en tijdstip van aanmaak van het account</li>
                    <li>Technische gegevens: IP-adres, browsertype en sessie-informatie (verkregen via Supabase Auth)</li>
                  </ul>
                </section>

                {/* 3 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">3. Doeleinden en rechtsgronden van verwerking</h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Uitvoering van de overeenkomst (art. 6.1.b AVG)</p>
                      <p>Het beheren van uw digitale spaarkaart, het registreren van consumptie-stempels en het toekennen van gratis consumpties als beloning.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Gerechtvaardigd belang (art. 6.1.f AVG)</p>
                      <p>Het beveiligen en verbeteren van onze digitale diensten, het voorkomen van misbruik en het bijhouden van statistieken over het gebruik van het spaarprogramma.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Toestemming (art. 6.1.a AVG) — Direct marketing</p>
                      <p>
                        Door gebruik te maken van de digitale spaarkaart en in te loggen, geeft u toestemming dat Cozy Moments uw e-mailadres mag gebruiken om u occasioneel te informeren over:
                      </p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Promoties en kortingsacties</li>
                        <li>Nieuwe producten of seizoensaanbiedingen</li>
                        <li>Updates aan het spaarprogramma</li>
                        <li>Uitnodigingen voor evenementen</li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-500">
                        U kunt deze toestemming te allen tijde intrekken door te klikken op de afmeldlink in elke e-mail die wij u sturen, of door ons te contacteren via <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline">info@cozy-moments.be</a>. Het intrekken van toestemming heeft geen invloed op de rechtmatigheid van de verwerking vóór de intrekking.
                      </p>
                    </div>
                  </div>
                </section>

                {/* 4 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">4. Bewaartermijnen</h3>
                  <p>Uw persoonsgegevens worden niet langer bewaard dan noodzakelijk voor de doeleinden waarvoor ze zijn verzameld:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Accountgegevens en spaarpunten:</strong> zolang uw account actief is, en tot maximaal 3 jaar na uw laatste aanmelding.</li>
                    <li><strong>Marketing-communicatie:</strong> tot u uw toestemming intrekt.</li>
                    <li><strong>Technische logingegevens:</strong> maximaal 12 maanden.</li>
                  </ul>
                  <p className="mt-2">Na afloop van de bewaartermijn worden uw gegevens veilig gewist of anoniem gemaakt.</p>
                </section>

                {/* 5 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">5. Doorgifte aan derden</h3>
                  <p>Wij geven uw persoonsgegevens niet door aan derden voor commerciële doeleinden zonder uw uitdrukkelijke toestemming. Wij maken gebruik van de volgende verwerkers:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Supabase Inc.</strong> (VS) — opslag van gebruikersgegevens en authenticatie, met passende waarborgen conform de AVG (Standard Contractual Clauses).</li>
                    <li><strong>Google LLC</strong> — optionele aanmelding via Google OAuth. Raadpleeg het <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cozy-coffee)] underline">privacybeleid van Google</a>.</li>
                    <li><strong>Vercel Inc.</strong> — hosting van de webapplicatie.</li>
                  </ul>
                  <p className="mt-2">Al onze verwerkers zijn contractueel gebonden aan strikte geheimhoudings- en beveiligingsvereisten.</p>
                </section>

                {/* 6 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">6. Uw rechten als betrokkene</h3>
                  <p>Op grond van de AVG heeft u de volgende rechten:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Recht op inzage (art. 15 AVG):</strong> u kunt opvragen welke gegevens wij van u verwerken.</li>
                    <li><strong>Recht op rectificatie (art. 16 AVG):</strong> u kunt onjuiste gegevens laten corrigeren.</li>
                    <li><strong>Recht op gegevenswissing (art. 17 AVG):</strong> u kunt vragen uw account en gegevens volledig te verwijderen.</li>
                    <li><strong>Recht op beperking van verwerking (art. 18 AVG).</strong></li>
                    <li><strong>Recht op gegevensoverdraagbaarheid (art. 20 AVG):</strong> u kunt uw gegevens in een machineleesbaar formaat opvragen.</li>
                    <li><strong>Recht van bezwaar (art. 21 AVG):</strong> u kunt bezwaar maken tegen verwerking op basis van gerechtvaardigd belang, in het bijzonder tegen direct marketing.</li>
                    <li><strong>Recht op intrekking van toestemming (art. 7.3 AVG):</strong> u kunt uw toestemming voor marketing te allen tijde intrekken.</li>
                  </ul>
                  <p className="mt-2">
                    Om een van bovenstaande rechten uit te oefenen, stuurt u een e-mail naar <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline">info@cozy-moments.be</a>. Wij behandelen uw verzoek binnen de wettelijke termijn van 30 kalenderdagen.
                  </p>
                </section>

                {/* 7 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">7. Klachtenrecht</h3>
                  <p>
                    Indien u van mening bent dat uw persoonsgegevens onrechtmatig worden verwerkt, heeft u het recht om een klacht in te dienen bij de bevoegde toezichthoudende autoriteit in België:
                  </p>
                  <p className="mt-2 bg-gray-50 rounded-xl p-4 text-xs">
                    <strong>Gegevensbeschermingsautoriteit (GBA)</strong><br />
                    Drukpersstraat 35, 1000 Brussel<br />
                    <a href="https://www.gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cozy-coffee)] underline">www.gegevensbeschermingsautoriteit.be</a><br />
                    Tel: +32 2 274 48 00
                  </p>
                </section>

                {/* 8 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">8. Beveiliging</h3>
                  <p>
                    Cozy Moments neemt passende technische en organisatorische maatregelen om uw persoonsgegevens te beschermen tegen ongeoorloofde toegang, verlies, vernietiging of openbaarmaking. Hierbij maken wij gebruik van versleutelde verbindingen (HTTPS/TLS), veilige authenticatiemethoden en beperkte toegangsrechten.
                  </p>
                </section>

                {/* 9 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">9. Wijzigingen aan dit beleid</h3>
                  <p>
                    Wij behouden ons het recht voor dit privacybeleid te allen tijde te wijzigen. Bij wezenlijke wijzigingen zullen wij u hiervan op de hoogte stellen via de app of per e-mail. De meest recente versie is steeds beschikbaar in de applicatie.
                  </p>
                </section>

                <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
                  Door gebruik te maken van de digitale spaarkaart van Cozy Moments bevestigt u deze voorwaarden gelezen en begrepen te hebben.
                </p>
              </div>

              {/* Footer button */}
              <div className="px-6 py-5 border-t border-gray-100 flex-shrink-0">
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


export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);

  const handleGoogle = async () => {
    setLoading('google');
    await loginWithGoogle();
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setLoading('email');
    setError('');
    try {
      await loginWithEmail(email.trim(), name.trim());
      setEmailSent(true);
    } catch (err: any) {
      setError('Er ging iets mis. Probeer opnieuw.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--color-cozy-bg)]">
      {/* WebaanZee credit — fixed bottom right */}
      <a
        href="https://www.webaanzee.be"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-5 flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity z-50"
        style={{ fontSize: '10px', letterSpacing: '0.04em', textDecoration: 'none' }}
      >
        <span style={{ color: '#111', fontWeight: 500 }}>realisatie door </span>
        <span style={{ fontWeight: 700 }}>
          <span style={{ color: '#111' }}>Web</span><span style={{ color: '#f59e0b' }}>aan</span><span style={{ color: '#111' }}>Zee</span>
        </span>
      </a>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-sm w-full"
      >
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center text-center">
          <a href="https://www.cozy-moments.be/" target="_blank" rel="noopener noreferrer">
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
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase tracking-widest">of</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email option */}
        {emailSent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center"
          >
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail size={24} className="text-green-600" />
            </div>
            <p className="font-medium text-[var(--color-cozy-text)] mb-1">Check je inbox!</p>
            <p className="text-sm text-gray-500">
              We stuurden een inloglink naar <strong>{email}</strong>. Klik op de link in de e-mail om in te loggen.
            </p>
            <button
              onClick={() => { setEmailSent(false); setEmail(''); setName(''); }}
              className="mt-4 text-xs text-gray-400 underline"
            >
              Ander e-mailadres gebruiken
            </button>
          </motion.div>
        ) : !showEmail ? (
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
            {error && <p className="text-red-500 text-xs px-1">{error}</p>}
            <button
              type="submit"
              disabled={loading !== null || !email.trim() || !name.trim()}
              className="w-full bg-[var(--color-cozy-coffee)] text-white rounded-2xl py-4 px-5 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading === 'email' ? 'Bezig...' : 'Stuur inloglink'}
            </button>
          </motion.form>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Door in te loggen ga je akkoord met onze{' '}
          <button
            onClick={() => setShowTerms(true)}
            className="underline text-[var(--color-cozy-coffee)] hover:opacity-80 transition-opacity"
          >
            voorwaarden
          </button>
        </p>
        <div className="text-center mt-4">
          <a
            href="https://www.cozy-moments.be/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-cozy-coffee)] hover:underline font-medium"
          >
            Bezoek onze website →
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
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <h2 className="font-display font-bold text-lg text-[var(--color-cozy-text)]">Gebruiksvoorwaarden &amp; Privacybeleid</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Cozy Moments — Digitale Spaarkaart</p>
                </div>
                <button
                  onClick={() => setShowTerms(false)}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0 ml-4"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scroll hint */}
              <div className="flex items-center justify-center gap-1 py-2 text-gray-300 flex-shrink-0">
                <ChevronDown size={14} />
                <span className="text-[10px] uppercase tracking-widest">Scroll om alles te lezen</span>
                <ChevronDown size={14} />
              </div>

              {/* Content */}
              <div className="overflow-y-auto px-6 pb-8 flex-1 text-sm text-gray-600 space-y-6 leading-relaxed">

                <p className="text-xs text-gray-400 italic">Versie 1.0 — van kracht vanaf 3 maart 2026 &nbsp;|&nbsp; Onderneming: Cozy Moments</p>

                {/* 1 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">1. Verwerkingsverantwoordelijke</h3>
                  <p>
                    De verwerkingsverantwoordelijke in de zin van de Algemene Verordening Gegevensbescherming (AVG / GDPR, EU 2016/679) is:
                  </p>
                  <p className="mt-2 bg-gray-50 rounded-xl p-4 text-xs">
                    <strong>Cozy Moments</strong><br />
                    Grote Markt 2, 8370 Blankenberge, België<br />
                    E-mail: <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline">info@cozy-moments.be</a><br />
                    Website: <a href="https://www.cozy-moments.be" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cozy-coffee)] underline">www.cozy-moments.be</a>
                  </p>
                </section>

                {/* 2 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">2. Welke gegevens verwerken wij?</h3>
                  <p>Via de digitale spaarkaart verwerken wij de volgende persoonsgegevens:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Naam (voornaam en/of familienaam)</li>
                    <li>E-mailadres</li>
                    <li>Google-accountinformatie (enkel bij aanmelding via Google: profielnaam en e-mailadres)</li>
                    <li>Spaarpunten en beloningshistoriek (koffie, wijn, bier)</li>
                    <li>Datum en tijdstip van aanmaak van het account</li>
                    <li>Technische gegevens: IP-adres, browsertype en sessie-informatie (verkregen via Supabase Auth)</li>
                  </ul>
                </section>

                {/* 3 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">3. Doeleinden en rechtsgronden van verwerking</h3>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Uitvoering van de overeenkomst (art. 6.1.b AVG)</p>
                      <p>Het beheren van uw digitale spaarkaart, het registreren van consumptie-stempels en het toekennen van gratis consumpties als beloning.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Gerechtvaardigd belang (art. 6.1.f AVG)</p>
                      <p>Het beveiligen en verbeteren van onze digitale diensten, het voorkomen van misbruik en het bijhouden van statistieken over het gebruik van het spaarprogramma.</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-[var(--color-cozy-text)] text-xs uppercase tracking-wide mb-1">Toestemming (art. 6.1.a AVG) — Direct marketing</p>
                      <p>
                        Door gebruik te maken van de digitale spaarkaart en in te loggen, geeft u toestemming dat Cozy Moments uw e-mailadres mag gebruiken om u occasioneel te informeren over:
                      </p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Promoties en kortingsacties</li>
                        <li>Nieuwe producten of seizoensaanbiedingen</li>
                        <li>Updates aan het spaarprogramma</li>
                        <li>Uitnodigingen voor evenementen</li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-500">
                        U kunt deze toestemming te allen tijde intrekken door te klikken op de afmeldlink in elke e-mail die wij u sturen, of door ons te contacteren via <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline">info@cozy-moments.be</a>. Het intrekken van toestemming heeft geen invloed op de rechtmatigheid van de verwerking vóór de intrekking.
                      </p>
                    </div>
                  </div>
                </section>

                {/* 4 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">4. Bewaartermijnen</h3>
                  <p>Uw persoonsgegevens worden niet langer bewaard dan noodzakelijk voor de doeleinden waarvoor ze zijn verzameld:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Accountgegevens en spaarpunten:</strong> zolang uw account actief is, en tot maximaal 3 jaar na uw laatste aanmelding.</li>
                    <li><strong>Marketing-communicatie:</strong> tot u uw toestemming intrekt.</li>
                    <li><strong>Technische logingegevens:</strong> maximaal 12 maanden.</li>
                  </ul>
                  <p className="mt-2">Na afloop van de bewaartermijn worden uw gegevens veilig gewist of anoniem gemaakt.</p>
                </section>

                {/* 5 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">5. Doorgifte aan derden</h3>
                  <p>Wij geven uw persoonsgegevens niet door aan derden voor commerciële doeleinden zonder uw uitdrukkelijke toestemming. Wij maken gebruik van de volgende verwerkers:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Supabase Inc.</strong> (VS) — opslag van gebruikersgegevens en authenticatie, met passende waarborgen conform de AVG (Standard Contractual Clauses).</li>
                    <li><strong>Google LLC</strong> — optionele aanmelding via Google OAuth. Raadpleeg het <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cozy-coffee)] underline">privacybeleid van Google</a>.</li>
                    <li><strong>Vercel Inc.</strong> — hosting van de webapplicatie.</li>
                  </ul>
                  <p className="mt-2">Al onze verwerkers zijn contractueel gebonden aan strikte geheimhoudings- en beveiligingsvereisten.</p>
                </section>

                {/* 6 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">6. Uw rechten als betrokkene</h3>
                  <p>Op grond van de AVG heeft u de volgende rechten:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Recht op inzage (art. 15 AVG):</strong> u kunt opvragen welke gegevens wij van u verwerken.</li>
                    <li><strong>Recht op rectificatie (art. 16 AVG):</strong> u kunt onjuiste gegevens laten corrigeren.</li>
                    <li><strong>Recht op gegevenswissing (art. 17 AVG):</strong> u kunt vragen uw account en gegevens volledig te verwijderen.</li>
                    <li><strong>Recht op beperking van verwerking (art. 18 AVG).</strong></li>
                    <li><strong>Recht op gegevensoverdraagbaarheid (art. 20 AVG):</strong> u kunt uw gegevens in een machineleesbaar formaat opvragen.</li>
                    <li><strong>Recht van bezwaar (art. 21 AVG):</strong> u kunt bezwaar maken tegen verwerking op basis van gerechtvaardigd belang, in het bijzonder tegen direct marketing.</li>
                    <li><strong>Recht op intrekking van toestemming (art. 7.3 AVG):</strong> u kunt uw toestemming voor marketing te allen tijde intrekken.</li>
                  </ul>
                  <p className="mt-2">
                    Om een van bovenstaande rechten uit te oefenen, stuurt u een e-mail naar <a href="mailto:info@cozy-moments.be" className="text-[var(--color-cozy-coffee)] underline">info@cozy-moments.be</a>. Wij behandelen uw verzoek binnen de wettelijke termijn van 30 kalenderdagen.
                  </p>
                </section>

                {/* 7 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">7. Klachtenrecht</h3>
                  <p>
                    Indien u van mening bent dat uw persoonsgegevens onrechtmatig worden verwerkt, heeft u het recht om een klacht in te dienen bij de bevoegde toezichthoudende autoriteit in België:
                  </p>
                  <p className="mt-2 bg-gray-50 rounded-xl p-4 text-xs">
                    <strong>Gegevensbeschermingsautoriteit (GBA)</strong><br />
                    Drukpersstraat 35, 1000 Brussel<br />
                    <a href="https://www.gegevensbeschermingsautoriteit.be" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cozy-coffee)] underline">www.gegevensbeschermingsautoriteit.be</a><br />
                    Tel: +32 2 274 48 00
                  </p>
                </section>

                {/* 8 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">8. Beveiliging</h3>
                  <p>
                    Cozy Moments neemt passende technische en organisatorische maatregelen om uw persoonsgegevens te beschermen tegen ongeoorloofde toegang, verlies, vernietiging of openbaarmaking. Hierbij maken wij gebruik van versleutelde verbindingen (HTTPS/TLS), veilige authenticatiemethoden en beperkte toegangsrechten.
                  </p>
                </section>

                {/* 9 */}
                <section>
                  <h3 className="font-display font-bold text-[var(--color-cozy-text)] mb-2">9. Wijzigingen aan dit beleid</h3>
                  <p>
                    Wij behouden ons het recht voor dit privacybeleid te allen tijde te wijzigen. Bij wezenlijke wijzigingen zullen wij u hiervan op de hoogte stellen via de app of per e-mail. De meest recente versie is steeds beschikbaar in de applicatie.
                  </p>
                </section>

                <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
                  Door gebruik te maken van de digitale spaarkaart van Cozy Moments bevestigt u deze voorwaarden gelezen en begrepen te hebben.
                </p>
              </div>

              {/* Footer button */}
              <div className="px-6 py-5 border-t border-gray-100 flex-shrink-0">
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
