import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  createAdminAccount,
  deleteAdminAccount,
  filterAdminAccounts,
  listAdminAccounts,
  type AdminAccount,
  type CreateAdminAccountResult,
} from '../lib/admin-accounts';

interface AdminAccountsPageProps {
  adminEmail: string | null;
  isDarkMode: boolean;
  onBackToCounter: () => void;
}

type AdminWorkspaceMode = 'create' | 'overview';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_ADMIN_PASSWORD_LENGTH = 8;

function cn(...inputs: Array<string | undefined | null | false>) {
  return twMerge(clsx(inputs));
}

function formatAbsoluteDateTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 'Onbekend';
  }

  return date.toLocaleString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildCredentialText(account: CreateAdminAccountResult) {
  return [
    'Cozy Moments admin login',
    `Naam: ${account.displayName ?? account.email}`,
    `E-mailadres: ${account.email}`,
    `Wachtwoord: ${account.password}`,
    'Deze admin heeft dezelfde rechten als de andere admins in het beheerpaneel.',
  ].join('\n');
}

function getCreatorLabel(account: AdminAccount, currentAdminEmail: string | null) {
  if (!account.createdByAdminEmail) {
    return 'Handmatig toegevoegd';
  }

  if (currentAdminEmail && account.createdByAdminEmail === currentAdminEmail.trim().toLowerCase()) {
    return 'Jij';
  }

  return account.createdByAdminEmail;
}

export function AdminAccountsPage({ adminEmail, isDarkMode, onBackToCounter }: AdminAccountsPageProps) {
  const normalizedAdminEmail = adminEmail?.trim().toLowerCase() ?? '';
  const [mode, setMode] = useState<AdminWorkspaceMode>('overview');
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [overviewNotice, setOverviewNotice] = useState<string | null>(null);
  const [result, setResult] = useState<CreateAdminAccountResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<AdminAccount | null>(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const nextAdmins = await listAdminAccounts();
      setAdmins(nextAdmins);
    } catch (error: any) {
      console.error('Kon adminaccounts niet laden:', error);
      setLoadError(error?.message || 'Adminaccounts laden mislukt.');
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const visibleAdmins = useMemo(() => filterAdminAccounts(admins, search), [admins, search]);
  const selectedAdmin = useMemo(
    () => visibleAdmins.find((account) => account.email === selectedEmail) ?? null,
    [visibleAdmins, selectedEmail],
  );
  const selectedResult = useMemo(() => {
    if (!result || !selectedAdmin || result.email !== selectedAdmin.email) {
      return null;
    }

    return result;
  }, [result, selectedAdmin]);
  const activeAdminCount = useMemo(
    () => admins.filter((account) => account.isActive).length,
    [admins],
  );
  const createdByCurrentAdminCount = useMemo(
    () => admins.filter((account) => account.createdByAdminEmail === normalizedAdminEmail).length,
    [admins, normalizedAdminEmail],
  );

  useEffect(() => {
    if (visibleAdmins.length === 0) {
      setSelectedEmail('');
      return;
    }

    if (!visibleAdmins.some((account) => account.email === selectedEmail)) {
      setSelectedEmail(visibleAdmins[0].email);
    }
  }, [selectedEmail, visibleAdmins]);

  const handleFormChange = (field: 'displayName' | 'email' | 'password' | 'confirmPassword', value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setCreateError(null);
    setOverviewNotice(null);
    setCopied(false);
  };

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();

    const displayName = form.displayName.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (displayName.length < 2) {
      setCreateError('Geef minstens een herkenbare naam in.');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setCreateError('Geef een geldig e-mailadres in.');
      return;
    }

    if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      setCreateError(`Kies een wachtwoord van minstens ${MIN_ADMIN_PASSWORD_LENGTH} tekens.`);
      return;
    }

    if (password !== confirmPassword) {
      setCreateError('De twee wachtwoorden zijn niet identiek.');
      return;
    }

    setSaving(true);
    setCreateError(null);
    setOverviewNotice(null);
    setCopied(false);

    try {
      const createdAdmin = await createAdminAccount({ displayName, email, password });
      setResult(createdAdmin);
      setForm({ displayName: '', email: '', password: '', confirmPassword: '' });
      setShowPassword(false);
      setShowConfirmPassword(false);
      await loadAdmins();
      setSelectedEmail(createdAdmin.email);
      setMode('overview');
    } catch (error: any) {
      setCreateError(error?.message || 'Adminaccount aanmaken mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildCredentialText(result));
      setCopied(true);
    } catch {
      setCreateError('Kopieren mislukte. Probeer opnieuw.');
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteConfirm) {
      return;
    }

    setDeleting(true);
    setCreateError(null);
    setOverviewNotice(null);

    try {
      await deleteAdminAccount(deleteConfirm.email);
      if (result?.email === deleteConfirm.email) {
        setResult(null);
        setCopied(false);
      }
      setOverviewNotice(`${deleteConfirm.displayName ?? deleteConfirm.email} werd verwijderd als admin.`);
      setDeleteConfirm(null);
      await loadAdmins();
    } catch (error: any) {
      setCreateError(error?.message || 'Admin verwijderen mislukt.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              type="button"
              onClick={onBackToCounter}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                isDarkMode
                  ? 'bg-white/10 text-[#f1f4f8] hover:bg-white/15'
                  : 'bg-white text-[var(--color-cozy-text)] shadow-sm hover:bg-gray-50',
              )}
            >
              <ArrowLeft size={16} />
              Terug naar kassa
            </button>
            <p className="admin-phase-kicker">Adminbeheer</p>
            <h2 className="mt-4 text-3xl font-display font-bold text-[var(--color-cozy-text)]">Admin</h2>
            <p className={cn('admin-phase-copy mt-2 max-w-3xl text-sm')}>
              Registreer hier nieuwe admins met exact dezelfde toegang als jij, en hou tegelijk proper bij wie welke admin heeft aangemaakt.
            </p>
          </div>

          <div className="admin-phase-identity rounded-[26px] px-5 py-4 text-[var(--color-cozy-text)]">
            <p className="admin-phase-kicker">Actieve admin</p>
            <p className="mt-2 break-all font-mono text-sm font-bold">{adminEmail ?? 'Onbekend'}</p>
          </div>
        </div>

        <div className="admin-phase-tabs inline-flex flex-wrap gap-2 rounded-[26px] p-2">
          <button
            type="button"
            onClick={() => setMode('create')}
            data-active={mode === 'create'}
            className="admin-phase-tab inline-flex items-center justify-center"
          >
            Nieuwe admin
          </button>
          <button
            type="button"
            onClick={() => setMode('overview')}
            data-active={mode === 'overview'}
            className="admin-phase-tab inline-flex items-center justify-center"
          >
            Admin overzicht ({admins.length})
          </button>
        </div>

        {createError && (
          <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {createError}
          </div>
        )}

        {overviewNotice && (
          <div className={cn('rounded-[22px] border px-4 py-3 text-sm font-medium', isDarkMode ? 'border-emerald-500/30 bg-[#162722] text-[#c9e4d8]' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
            {overviewNotice}
          </div>
        )}

        {mode === 'create' ? (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="admin-phase-panel rounded-[32px] p-6 md:p-8">
              <form onSubmit={handleCreateAdmin} className="space-y-5">
                <div>
                  <p className="admin-phase-kicker">Nieuwe admin</p>
                  <h3 className="mt-3 text-[2rem] font-display font-bold leading-tight text-[var(--color-cozy-text)]">
                    Geef iemand meteen dezelfde toegang als jij
                  </h3>
                  <p className="admin-phase-copy mt-3 text-sm">
                    Jij kiest hier meteen het wachtwoord. De nieuwe admin kan daarmee onmiddellijk inloggen op exact hetzelfde beheerpaneel.
                  </p>
                </div>

                <div className="grid gap-4">
                  <label className="block">
                    <span className="admin-phase-label">
                      Naam van de admin
                    </span>
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(event) => handleFormChange('displayName', event.target.value)}
                      placeholder="Bijvoorbeeld Sarah Vermeulen"
                      autoComplete="name"
                      className="admin-phase-input text-base"
                    />
                  </label>

                  <label className="block">
                    <span className="admin-phase-label">
                      E-mailadres
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => handleFormChange('email', event.target.value)}
                      placeholder="admin@cozy-moments.be"
                      autoComplete="email"
                      className="admin-phase-input text-base"
                    />
                  </label>

                  <label className="block">
                    <span className="admin-phase-label">
                      Wachtwoord
                    </span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(event) => handleFormChange('password', event.target.value)}
                        placeholder={`Minstens ${MIN_ADMIN_PASSWORD_LENGTH} tekens`}
                        autoComplete="new-password"
                        className="admin-phase-input pr-14 text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-[var(--color-cozy-text)]"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>

                  <label className="block">
                    <span className="admin-phase-label">
                      Herhaal wachtwoord
                    </span>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(event) => handleFormChange('confirmPassword', event.target.value)}
                        placeholder="Typ exact hetzelfde wachtwoord opnieuw"
                        autoComplete="new-password"
                        className="admin-phase-input pr-14 text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-[var(--color-cozy-text)]"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="admin-phase-button-primary inline-flex w-full items-center justify-center gap-3 px-5 text-base font-semibold"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                      Admin wordt aangemaakt...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Adminaccount aanmaken
                    </>
                  )}
                </button>
              </form>
            </section>

            <aside className="admin-phase-panel rounded-[32px] p-6 md:p-8">
              <div className="flex items-start gap-3">
                <div className="admin-phase-panel-soft mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-cozy-text)]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="admin-phase-kicker">Wat dit doet</p>
                  <h3 className="mt-2 text-xl font-display font-bold text-[var(--color-cozy-text)]">Volledig adminbeheer zonder losse notities</h3>
                  <p className="admin-phase-copy mt-2 text-sm">
                    Elke nieuwe admin krijgt exact dezelfde rechten in het business paneel. Je ziet later ook altijd wie de registratie gedaan heeft.
                  </p>
                </div>
              </div>

              <div className="admin-phase-panel-soft mt-6 rounded-[28px] px-5 py-5">
                <div className="space-y-4">
                  <div>
                    <p className="admin-phase-kicker">Nieuwe admin</p>
                    <p className="mt-2 font-display text-2xl font-bold text-[var(--color-cozy-text)]">{form.displayName.trim() || 'Nieuwe admin'}</p>
                  </div>

                  <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white/80')}>
                    <p className="admin-phase-kicker">E-mailadres</p>
                    <p className="mt-2 break-all font-mono text-lg font-bold text-[var(--color-cozy-text)]">{form.email.trim().toLowerCase() || 'admin@cozy-moments.be'}</p>
                  </div>

                  <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white/80')}>
                    <p className="admin-phase-kicker">Gekozen wachtwoord</p>
                    <div className="mt-2 flex items-center gap-2">
                      <LockKeyhole size={16} className="text-[var(--color-cozy-olive)]" />
                      <p className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{form.password || 'Nog niet ingevuld'}</p>
                    </div>
                  </div>

                  <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white/80')}>
                    <p className="admin-phase-kicker">Aangemaakt door</p>
                    <div className="mt-2 flex items-start gap-2">
                      <Mail size={16} className="mt-0.5 text-[var(--color-cozy-olive)]" />
                      <p className="break-all text-sm font-medium text-[var(--color-cozy-text)]">{adminEmail ?? 'Onbekend'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-phase-panel-soft mt-5 space-y-3 rounded-[28px] px-5 py-5">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Wat krijgt deze admin?</p>
                  <p className="admin-phase-copy mt-1 text-sm">Precies dezelfde toegang tot klanten, historiek, beheerde klanten, drankkaart, screensaver en open flessen.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Beheerkeuze</p>
                  <p className="admin-phase-copy mt-1 text-sm">Jij kiest het wachtwoord nu bewust zelf, zodat je dat meteen intern kunt doorgeven zonder extra reset- of inviteflow.</p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-5">
            {result && (
              <section className={cn('rounded-[30px] border p-5 shadow-sm md:p-6', isDarkMode ? 'border-emerald-500/30 bg-[#162722]' : 'border-emerald-200 bg-emerald-50')}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-700">Nieuwe admin geregistreerd</p>
                        <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">{result.displayName ?? result.email} heeft nu adminrechten</h3>
                        <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#b7c8c2]' : 'text-emerald-900/75')}>
                          Het gekozen wachtwoord wordt enkel in deze sessie nog even getoond zodat je het meteen kunt doorgeven.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Naam</p>
                        <p className="mt-2 text-lg font-bold text-[var(--color-cozy-text)]">{result.displayName ?? 'Geen naam'}</p>
                      </div>
                      <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">E-mailadres</p>
                        <p className="mt-2 break-all font-mono text-lg font-bold text-[var(--color-cozy-text)]">{result.email}</p>
                      </div>
                      <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Wachtwoord</p>
                        <p className="mt-2 break-all font-mono text-lg font-bold text-[var(--color-cozy-text)]">{result.password}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-[220px]">
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--color-cozy-text)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90"
                    >
                      <Copy size={16} />
                      {copied ? 'Gekopieerd' : 'Kopieer login'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('create')}
                      className={cn(
                        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors',
                        isDarkMode
                          ? 'border-white/10 bg-white/5 text-[#eef2f7] hover:bg-white/10'
                          : 'border-emerald-200 bg-white text-[var(--color-cozy-text)] hover:bg-emerald-50',
                      )}
                    >
                      <UserPlus size={16} />
                      Nog een admin
                    </button>
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <section className="admin-phase-panel rounded-[32px] p-6 md:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="admin-phase-kicker">Admin overzicht</p>
                    <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Overzicht van alle adminaccounts</h3>
                    <p className="admin-phase-copy mt-2 text-sm">
                      Bekijk in één oogopslag wie toegang heeft, wie een account heeft toegevoegd en welke admin je nu geselecteerd hebt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    className="admin-phase-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                  >
                    <UserPlus size={16} />
                    Nieuwe admin
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                    <p className="admin-phase-kicker">Actieve admins</p>
                    <p className="mt-3 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{activeAdminCount}</p>
                  </div>
                  <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                    <p className="admin-phase-kicker">Zichtbaar nu</p>
                    <p className="mt-3 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{visibleAdmins.length}</p>
                  </div>
                  <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                    <p className="admin-phase-kicker">Door jou toegevoegd</p>
                    <p className="mt-3 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{createdByCurrentAdminCount}</p>
                  </div>
                </div>

                <div className="admin-phase-panel-soft mt-5 rounded-[24px] px-4 py-4">
                  <label className="flex items-center gap-3">
                    <Search size={16} className={isDarkMode ? 'text-[#9ca8b9]' : 'text-gray-400'} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Zoek op naam, e-mailadres of maker"
                      className="w-full bg-transparent text-sm text-[var(--color-cozy-text)] outline-none placeholder:text-gray-400"
                    />
                  </label>
                  <p className="admin-phase-muted-note mt-3 text-xs">
                    Gebruik dit overzicht om snel te controleren wie toegang heeft en wie welke admin geregistreerd heeft.
                  </p>
                </div>

                {loadError && (
                  <div className="mt-5 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {loadError}
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {loading ? (
                    <div className={cn('admin-phase-empty rounded-[24px] px-4 py-5 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                      Adminaccounts worden geladen...
                    </div>
                  ) : visibleAdmins.length === 0 ? (
                    <div className={cn('admin-phase-empty rounded-[24px] px-4 py-5 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                      Geen adminaccounts gevonden voor deze zoekopdracht.
                    </div>
                  ) : (
                    visibleAdmins.map((account) => {
                      const isSelected = account.email === selectedEmail;
                      const createdByCurrentAdmin = Boolean(normalizedAdminEmail && account.createdByAdminEmail === normalizedAdminEmail);
                      const isCurrentAdmin = Boolean(normalizedAdminEmail && account.email === normalizedAdminEmail);

                      return (
                        <button
                          key={account.email}
                          type="button"
                          onClick={() => setSelectedEmail(account.email)}
                          data-selected={isSelected}
                          className="admin-phase-list-item w-full rounded-[24px] px-4 py-4 text-left"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-[var(--color-cozy-text)]">{account.displayName ?? account.email}</p>
                              <p className={cn('mt-1 break-all text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                                {account.email}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={cn(
                                'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                                account.isActive
                                  ? 'border-[var(--color-cozy-olive)]/30 bg-[var(--color-cozy-olive)]/10 text-[var(--color-cozy-olive)]'
                                  : isDarkMode
                                    ? 'border-white/10 bg-white/5 text-[#a8b3c1]'
                                    : 'border-gray-200 bg-white text-gray-500',
                              )}>
                                {account.isActive ? 'Actief' : 'Inactief'}
                              </span>
                              {isCurrentAdmin && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                  Dit ben jij
                                </span>
                              )}
                              {createdByCurrentAdmin && !isCurrentAdmin && (
                                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                                  Door jou
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={cn('mt-4 grid gap-3 text-sm sm:grid-cols-2', isDarkMode ? 'text-[#d5dbe5]' : 'text-gray-600')}>
                            <div>
                              <p className="admin-phase-kicker">Aangemaakt door</p>
                              <p className="mt-1 font-medium">{getCreatorLabel(account, adminEmail)}</p>
                            </div>
                            <div>
                              <p className="admin-phase-kicker">Aangemaakt op</p>
                              <p className="mt-1 font-medium">{formatAbsoluteDateTime(account.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className="admin-phase-panel rounded-[32px] p-6 md:p-7">
                {selectedAdmin ? (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="admin-phase-panel-soft inline-flex h-12 w-12 items-center justify-center rounded-full text-[var(--color-cozy-text)]">
                        <UserCog size={22} />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="admin-phase-kicker">Admin detail</p>
                            <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">{selectedAdmin.displayName ?? selectedAdmin.email}</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={cn(
                              'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                              selectedAdmin.isActive
                                ? 'border-[var(--color-cozy-olive)]/30 bg-[var(--color-cozy-olive)]/10 text-[var(--color-cozy-olive)]'
                                : isDarkMode
                                  ? 'border-white/10 bg-white/5 text-[#a8b3c1]'
                                  : 'border-gray-200 bg-white text-gray-500',
                            )}>
                              {selectedAdmin.isActive ? 'Actief adminaccount' : 'Inactief'}
                            </span>
                            <span className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'border-white/10 bg-white/5 text-[#d5dbe5]' : 'border-gray-200 bg-white text-gray-600')}>
                              Volledige rechten
                            </span>
                          </div>
                        </div>
                        <p className={cn('mt-2 text-sm break-all', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                          {selectedAdmin.email}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="admin-phase-detail-card rounded-[22px] px-4 py-4">
                        <p className="admin-phase-kicker">Aangemaakt door</p>
                        <p className="mt-2 break-all text-sm font-semibold text-[var(--color-cozy-text)]">{getCreatorLabel(selectedAdmin, adminEmail)}</p>
                      </div>
                      <div className="admin-phase-detail-card rounded-[22px] px-4 py-4">
                        <p className="admin-phase-kicker">Aangemaakt op</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--color-cozy-text)]">{formatAbsoluteDateTime(selectedAdmin.createdAt)}</p>
                      </div>
                      <div className="admin-phase-detail-card rounded-[22px] px-4 py-4">
                        <p className="admin-phase-kicker">Status</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--color-cozy-text)]">{selectedAdmin.isActive ? 'Actief adminaccount' : 'Inactief'}</p>
                      </div>
                      <div className="admin-phase-detail-card rounded-[22px] px-4 py-4">
                        <p className="admin-phase-kicker">Rechten</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--color-cozy-text)]">Volledige toegang tot het business paneel</p>
                      </div>
                    </div>

                    {selectedResult ? (
                      <div className={cn('rounded-[26px] border px-5 py-5', isDarkMode ? 'border-emerald-500/30 bg-[#162722]' : 'border-emerald-200 bg-emerald-50')}>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-700">Zojuist aangemaakt</p>
                        <p className="mt-3 text-sm font-medium text-[var(--color-cozy-text)]">
                          Dit is het adminaccount dat je net hebt toegevoegd. Het gekozen wachtwoord blijft alleen in deze sessie zichtbaar.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className={cn('rounded-[20px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                            <p className="admin-phase-kicker text-emerald-700">E-mailadres</p>
                            <p className="mt-2 break-all font-mono text-sm font-bold text-[var(--color-cozy-text)]">{selectedResult.email}</p>
                          </div>
                          <div className={cn('rounded-[20px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                            <p className="admin-phase-kicker text-emerald-700">Wachtwoord</p>
                            <p className="mt-2 break-all font-mono text-sm font-bold text-[var(--color-cozy-text)]">{selectedResult.password}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyCredentials}
                          className="admin-phase-button-primary mt-4 inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                        >
                          <Copy size={16} />
                          {copied ? 'Gekopieerd' : 'Kopieer login'}
                        </button>
                      </div>
                    ) : (
                      <div className="admin-phase-panel-soft rounded-[26px] px-5 py-5">
                        <div className="flex items-start gap-3">
                          <Users size={18} className="mt-0.5 text-[var(--color-cozy-olive)]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Hier zie je alles wat relevant is</p>
                            <p className="admin-phase-copy mt-1 text-sm">
                              Voor bestaande admins tonen we geen wachtwoord meer. Je ziet wel altijd wie het account heeft toegevoegd en wanneer dat gebeurde.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedAdmin.email === normalizedAdminEmail ? (
                      <div className={cn('rounded-[26px] border px-5 py-5', isDarkMode ? 'border-amber-500/20 bg-[#2a2418] text-[#f5dfb5]' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                        Je kunt jezelf hier niet verwijderen. Zo vermijden we dat je per ongeluk je eigen toegang blokkeert.
                      </div>
                    ) : (
                      <div className={cn('rounded-[26px] border px-5 py-5', isDarkMode ? 'border-red-500/20 bg-[#2a1717]' : 'border-red-200 bg-red-50')}>
                        <div className="flex items-start gap-3">
                          <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-full', isDarkMode ? 'bg-red-500/10 text-red-300' : 'bg-white text-red-500')}>
                            <Trash2 size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Admin verwijderen</p>
                            <p className={cn('mt-1 text-sm', isDarkMode ? 'text-[#d7b7b7]' : 'text-red-700/80')}>
                              Dit verwijdert de adminrechten en probeert ook het onderliggende loginaccount uit Supabase Auth te verwijderen.
                            </p>
                            <p className={cn('mt-2 text-xs', isDarkMode ? 'text-[#b69494]' : 'text-red-600/80')}>
                              Actieve admins momenteel: {activeAdminCount}
                            </p>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(selectedAdmin)}
                              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-red-500 px-4 text-sm font-semibold text-white transition-all hover:bg-red-600"
                            >
                              <Trash2 size={16} />
                              Verwijder admin
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="admin-phase-empty rounded-[28px] px-5 py-6">
                    <p className="text-lg font-display font-bold text-[var(--color-cozy-text)]">Nog geen admin geselecteerd</p>
                    <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                      Kies links een admin om de details te bekijken, of maak meteen een nieuw adminaccount aan.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode('create')}
                      className="admin-phase-button-primary mt-4 inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                    >
                      <UserPlus size={16} />
                      Nieuwe admin
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
            onClick={() => !deleting && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h3 className="mb-2 text-center text-xl font-serif font-semibold text-[var(--color-cozy-text)]">
                Admin verwijderen?
              </h3>
              <p className="mb-6 text-center text-sm leading-relaxed text-gray-500">
                <span className="font-semibold text-gray-700">{deleteConfirm.displayName ?? deleteConfirm.email}</span> verliest alle adminrechten.
                Het loginaccount wordt ook verwijderd wanneer dat gekoppeld is. Dit kan niet ongedaan worden.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteAdmin}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? (
                    <span className="animate-pulse">Verwijderen...</span>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Verwijderen
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
