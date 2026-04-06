import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
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

export function AdminAccountsPage({ adminEmail, isDarkMode }: AdminAccountsPageProps) {
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
            <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)]">Admin</h2>
            <p className={cn('mt-2 max-w-3xl text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
              Registreer hier nieuwe admins met exact dezelfde toegang als jij, en hou tegelijk proper bij wie welke admin heeft aangemaakt.
            </p>
          </div>

          <div className={cn('rounded-[24px] px-5 py-4 shadow-sm', isDarkMode ? 'bg-[#1a2230] text-[#e8edf5]' : 'bg-white text-[var(--color-cozy-text)]')}>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-cozy-olive)]">Actieve admin</p>
            <p className="mt-2 break-all font-mono text-sm font-bold">{adminEmail ?? 'Onbekend'}</p>
          </div>
        </div>

        <div className={cn('inline-flex flex-wrap gap-2 rounded-[26px] p-2 shadow-sm', isDarkMode ? 'bg-[#18202b]' : 'bg-white')}>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={cn(
              'inline-flex min-h-11 items-center justify-center rounded-[20px] px-5 text-sm font-semibold transition-all',
              mode === 'create'
                ? 'bg-[var(--color-cozy-text)] text-white shadow-sm'
                : isDarkMode
                  ? 'text-[#d7deea] hover:bg-white/10'
                  : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            Nieuwe admin
          </button>
          <button
            type="button"
            onClick={() => setMode('overview')}
            className={cn(
              'inline-flex min-h-11 items-center justify-center rounded-[20px] px-5 text-sm font-semibold transition-all',
              mode === 'overview'
                ? 'bg-[var(--color-cozy-text)] text-white shadow-sm'
                : isDarkMode
                  ? 'text-[#d7deea] hover:bg-white/10'
                  : 'text-gray-600 hover:bg-gray-50',
            )}
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
            <section className={cn('rounded-[30px] p-5 shadow-sm md:p-7', isDarkMode ? 'bg-[#18202b]' : 'bg-white')}>
              <form onSubmit={handleCreateAdmin} className="space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Nieuwe admin</p>
                  <h3 className="mt-3 text-2xl font-display font-bold text-[var(--color-cozy-text)]">
                    Geef iemand meteen dezelfde toegang als jij
                  </h3>
                  <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                    Jij kiest hier meteen het wachtwoord. De nieuwe admin kan daarmee onmiddellijk inloggen op exact hetzelfde beheerpaneel.
                  </p>
                </div>

                <div className="grid gap-4">
                  <label className="block">
                    <span className={cn('mb-2 block text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#c0cad8]' : 'text-gray-500')}>
                      Naam van de admin
                    </span>
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(event) => handleFormChange('displayName', event.target.value)}
                      placeholder="Bijvoorbeeld Sarah Vermeulen"
                      autoComplete="name"
                      className={cn(
                        'w-full rounded-[22px] border px-5 py-4 text-base text-[var(--color-cozy-text)] outline-none transition-colors',
                        isDarkMode
                          ? 'border-white/10 bg-[#111823] placeholder:text-[#6d7888] focus:border-[var(--color-cozy-olive)]'
                          : 'border-gray-200 bg-[#fbf8f2] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]',
                      )}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('mb-2 block text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#c0cad8]' : 'text-gray-500')}>
                      E-mailadres
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => handleFormChange('email', event.target.value)}
                      placeholder="admin@cozy-moments.be"
                      autoComplete="email"
                      className={cn(
                        'w-full rounded-[22px] border px-5 py-4 text-base text-[var(--color-cozy-text)] outline-none transition-colors',
                        isDarkMode
                          ? 'border-white/10 bg-[#111823] placeholder:text-[#6d7888] focus:border-[var(--color-cozy-olive)]'
                          : 'border-gray-200 bg-[#fbf8f2] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]',
                      )}
                    />
                  </label>

                  <label className="block">
                    <span className={cn('mb-2 block text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#c0cad8]' : 'text-gray-500')}>
                      Wachtwoord
                    </span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(event) => handleFormChange('password', event.target.value)}
                        placeholder={`Minstens ${MIN_ADMIN_PASSWORD_LENGTH} tekens`}
                        autoComplete="new-password"
                        className={cn(
                          'w-full rounded-[22px] border px-5 py-4 pr-14 text-base text-[var(--color-cozy-text)] outline-none transition-colors',
                          isDarkMode
                            ? 'border-white/10 bg-[#111823] placeholder:text-[#6d7888] focus:border-[var(--color-cozy-olive)]'
                            : 'border-gray-200 bg-[#fbf8f2] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className={cn('absolute right-4 top-1/2 -translate-y-1/2 transition-colors', isDarkMode ? 'text-[#a8b3c1] hover:text-white' : 'text-gray-400 hover:text-gray-600')}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>

                  <label className="block">
                    <span className={cn('mb-2 block text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#c0cad8]' : 'text-gray-500')}>
                      Herhaal wachtwoord
                    </span>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(event) => handleFormChange('confirmPassword', event.target.value)}
                        placeholder="Typ exact hetzelfde wachtwoord opnieuw"
                        autoComplete="new-password"
                        className={cn(
                          'w-full rounded-[22px] border px-5 py-4 pr-14 text-base text-[var(--color-cozy-text)] outline-none transition-colors',
                          isDarkMode
                            ? 'border-white/10 bg-[#111823] placeholder:text-[#6d7888] focus:border-[var(--color-cozy-olive)]'
                            : 'border-gray-200 bg-[#fbf8f2] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className={cn('absolute right-4 top-1/2 -translate-y-1/2 transition-colors', isDarkMode ? 'text-[#a8b3c1] hover:text-white' : 'text-gray-400 hover:text-gray-600')}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-[22px] bg-[var(--color-cozy-text)] px-5 text-base font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

            <aside className={cn('rounded-[30px] p-5 shadow-sm md:p-7', isDarkMode ? 'bg-[#18202b]' : 'bg-white')}>
              <div className="flex items-start gap-3">
                <div className={cn('mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full', isDarkMode ? 'bg-[#111823] text-[#e9eef6]' : 'bg-[#f4eee2] text-[var(--color-cozy-text)]')}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Wat dit doet</p>
                  <h3 className="mt-2 text-xl font-display font-bold text-[var(--color-cozy-text)]">Volledig adminbeheer zonder losse notities</h3>
                  <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                    Elke nieuwe admin krijgt exact dezelfde rechten in het business paneel. Je ziet later ook altijd wie de registratie gedaan heeft.
                  </p>
                </div>
              </div>

              <div className={cn('mt-6 rounded-[28px] border px-5 py-5', isDarkMode ? 'border-white/10 bg-[#111823]' : 'border-[#ece4d5] bg-[#fbf8f2]')}>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Nieuwe admin</p>
                    <p className="mt-2 font-display text-2xl font-bold text-[var(--color-cozy-text)]">{form.displayName.trim() || 'Nieuwe admin'}</p>
                  </div>

                  <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white')}>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">E-mailadres</p>
                    <p className="mt-2 break-all font-mono text-lg font-bold text-[var(--color-cozy-text)]">{form.email.trim().toLowerCase() || 'admin@cozy-moments.be'}</p>
                  </div>

                  <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white')}>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Gekozen wachtwoord</p>
                    <div className="mt-2 flex items-center gap-2">
                      <LockKeyhole size={16} className="text-[var(--color-cozy-olive)]" />
                      <p className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{form.password || 'Nog niet ingevuld'}</p>
                    </div>
                  </div>

                  <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white')}>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Aangemaakt door</p>
                    <div className="mt-2 flex items-start gap-2">
                      <Mail size={16} className="mt-0.5 text-[var(--color-cozy-olive)]" />
                      <p className="break-all text-sm font-medium text-[var(--color-cozy-text)]">{adminEmail ?? 'Onbekend'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn('mt-5 space-y-3 rounded-[28px] px-5 py-5', isDarkMode ? 'bg-[#111823]' : 'bg-[#f7f3eb]')}>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Wat krijgt deze admin?</p>
                  <p className={cn('mt-1 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>Precies dezelfde toegang tot klanten, historiek, beheerde klanten, drankkaart, screensaver en open flessen.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Beheerkeuze</p>
                  <p className={cn('mt-1 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>Jij kiest het wachtwoord nu bewust zelf, zodat je dat meteen intern kunt doorgeven zonder extra reset- of inviteflow.</p>
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
              <section className={cn('rounded-[30px] p-5 shadow-sm md:p-6', isDarkMode ? 'bg-[#18202b]' : 'bg-white')}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Admin overzicht</p>
                    <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Wie heeft welke admin aangemaakt?</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-[var(--color-cozy-text)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90"
                  >
                    <UserPlus size={16} />
                    Nieuwe admin
                  </button>
                </div>

                <label className={cn('mt-5 flex items-center gap-3 rounded-[22px] border px-4 py-3', isDarkMode ? 'border-white/10 bg-[#111823]' : 'border-gray-200 bg-[#fbf8f2]')}>
                  <Search size={16} className={isDarkMode ? 'text-[#9ca8b9]' : 'text-gray-400'} />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Zoek op naam, e-mail of maker"
                    className="w-full bg-transparent text-sm text-[var(--color-cozy-text)] outline-none placeholder:text-gray-400"
                  />
                </label>

                {loadError && (
                  <div className="mt-5 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {loadError}
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {loading ? (
                    <div className={cn('rounded-[24px] border px-4 py-5 text-sm', isDarkMode ? 'border-white/10 bg-[#111823] text-[#a8b3c1]' : 'border-gray-200 bg-[#fbf8f2] text-gray-500')}>
                      Adminaccounts laden...
                    </div>
                  ) : visibleAdmins.length === 0 ? (
                    <div className={cn('rounded-[24px] border px-4 py-5 text-sm', isDarkMode ? 'border-white/10 bg-[#111823] text-[#a8b3c1]' : 'border-gray-200 bg-[#fbf8f2] text-gray-500')}>
                      Geen admins gevonden voor deze zoekopdracht.
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
                          className={cn(
                            'w-full rounded-[24px] border px-4 py-4 text-left transition-all',
                            isSelected
                              ? 'border-[var(--color-cozy-olive)] bg-[var(--color-cozy-olive)]/10'
                              : isDarkMode
                                ? 'border-white/10 bg-[#111823] hover:border-white/20 hover:bg-white/5'
                                : 'border-gray-200 bg-[#fbf8f2] hover:border-gray-300 hover:bg-white',
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-[var(--color-cozy-text)]">{account.displayName ?? account.email}</p>
                              <p className={cn('mt-1 break-all text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                                {account.email}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-[var(--color-cozy-olive)]/30 bg-[var(--color-cozy-olive)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">
                                Admin
                              </span>
                              {isCurrentAdmin && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                  Jij
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
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">Aangemaakt door</p>
                              <p className="mt-1 font-medium">{getCreatorLabel(account, adminEmail)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">Aangemaakt op</p>
                              <p className="mt-1 font-medium">{formatAbsoluteDateTime(account.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className={cn('rounded-[30px] p-5 shadow-sm md:p-6', isDarkMode ? 'bg-[#18202b]' : 'bg-white')}>
                {selectedAdmin ? (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <div className={cn('inline-flex h-12 w-12 items-center justify-center rounded-full', isDarkMode ? 'bg-[#111823] text-[#ecf1f8]' : 'bg-[#f4eee2] text-[var(--color-cozy-text)]')}>
                        <UserCog size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Admin detail</p>
                        <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">{selectedAdmin.displayName ?? selectedAdmin.email}</h3>
                        <p className={cn('mt-2 text-sm break-all', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                          {selectedAdmin.email}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-[#111823]' : 'bg-[#fbf8f2]')}>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Aangemaakt door</p>
                        <p className="mt-2 break-all text-sm font-semibold text-[var(--color-cozy-text)]">{getCreatorLabel(selectedAdmin, adminEmail)}</p>
                      </div>
                      <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-[#111823]' : 'bg-[#fbf8f2]')}>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Aangemaakt op</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--color-cozy-text)]">{formatAbsoluteDateTime(selectedAdmin.createdAt)}</p>
                      </div>
                      <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-[#111823]' : 'bg-[#fbf8f2]')}>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Status</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--color-cozy-text)]">{selectedAdmin.isActive ? 'Actief adminaccount' : 'Inactief'}</p>
                      </div>
                      <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-[#111823]' : 'bg-[#fbf8f2]')}>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Rechten</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--color-cozy-text)]">Volledige toegang tot het business paneel</p>
                      </div>
                    </div>

                    {selectedResult ? (
                      <div className={cn('rounded-[26px] border px-5 py-5', isDarkMode ? 'border-emerald-500/30 bg-[#162722]' : 'border-emerald-200 bg-emerald-50')}>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-700">Recente login</p>
                        <p className="mt-3 text-sm font-medium text-[var(--color-cozy-text)]">
                          Dit is de admin die je net hebt aangemaakt. Het gekozen wachtwoord is alleen nu nog zichtbaar.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className={cn('rounded-[20px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">E-mailadres</p>
                            <p className="mt-2 break-all font-mono text-sm font-bold text-[var(--color-cozy-text)]">{selectedResult.email}</p>
                          </div>
                          <div className={cn('rounded-[20px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Wachtwoord</p>
                            <p className="mt-2 break-all font-mono text-sm font-bold text-[var(--color-cozy-text)]">{selectedResult.password}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyCredentials}
                          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-[var(--color-cozy-text)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90"
                        >
                          <Copy size={16} />
                          {copied ? 'Gekopieerd' : 'Kopieer login'}
                        </button>
                      </div>
                    ) : (
                      <div className={cn('rounded-[26px] px-5 py-5', isDarkMode ? 'bg-[#111823]' : 'bg-[#f7f3eb]')}>
                        <div className="flex items-start gap-3">
                          <Users size={18} className="mt-0.5 text-[var(--color-cozy-olive)]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Traceerbaarheid is hier het doel</p>
                            <p className={cn('mt-1 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                              Voor bestaande admins tonen we hier geen wachtwoord meer. Je ziet wel altijd wie de admin heeft toegevoegd en wanneer dat gebeurde.
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
                  <div className={cn('rounded-[26px] px-5 py-5 text-sm', isDarkMode ? 'bg-[#111823] text-[#a8b3c1]' : 'bg-[#f7f3eb] text-gray-500')}>
                    Selecteer links een admin om de details te bekijken.
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
