import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Beer,
  CheckCircle,
  Clock3,
  Coffee,
  Copy,
  Gift,
  GlassWater,
  KeyRound,
  Mail,
  Printer,
  Search,
  ShieldCheck,
  UserPlus,
  Wine,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DeltaControl } from '../components/DeltaControl';
import {
  buildTransactionSummaryParts,
  emptyDeltaRecord,
  fetchCustomerTransactions,
  getTransactionLabel,
  type CustomerTransaction,
  validateManualAdjustmentDraft,
} from '../lib/transaction-history';
import { filterManagedCustomers } from '../lib/managed-customers';
import { useLoyalty, type CardType, cardTypeLabels, type Customer } from '../../shared/store/LoyaltyContext';
import {
  buildManagedLoginAlias,
  getCustomerContactLabel,
  getCustomerLoginIdentifier,
  TEMP_CUSTOMER_PASSWORD,
} from '../../shared/lib/customer-accounts';
import { createCustomerAccount, type CreateCustomerAccountResult } from '../lib/create-customer-account';

interface CreateCustomerPageProps {
  adminEmail: string | null;
  isDarkMode: boolean;
  onOpenCustomers: () => void;
}

type ManagedWorkspaceMode = 'create' | 'manage';

const DRINK_META: Array<{
  type: CardType;
  icon: React.ElementType;
  label: string;
  bgClassName: string;
  textClassName: string;
  surfaceClassName: string;
}> = [
  {
    type: 'coffee',
    icon: Coffee,
    label: 'Koffie',
    bgClassName: 'bg-[#e8dcc8]/35',
    textClassName: 'text-[var(--color-cozy-coffee)]',
    surfaceClassName: 'border-[#e8dcc8]/70 bg-[#e8dcc8]/16',
  },
  {
    type: 'wine',
    icon: Wine,
    label: 'Wijn',
    bgClassName: 'bg-[#f0d8dc]/35',
    textClassName: 'text-[var(--color-cozy-wine)]',
    surfaceClassName: 'border-[#f0d8dc]/70 bg-[#f0d8dc]/16',
  },
  {
    type: 'beer',
    icon: Beer,
    label: 'Bier',
    bgClassName: 'bg-[#fcf4d9]/55',
    textClassName: 'text-[var(--color-cozy-beer)]',
    surfaceClassName: 'border-[#fcf4d9]/85 bg-[#fcf4d9]/22',
  },
  {
    type: 'soda',
    icon: GlassWater,
    label: 'Frisdrank',
    bgClassName: 'bg-[#fce4f0]/40',
    textClassName: 'text-[var(--color-cozy-soda)]',
    surfaceClassName: 'border-[#fce4f0]/80 bg-[#fce4f0]/18',
  },
];

const QUICK_REASON_CHIPS = [
  'Gemiste stempel',
  'Verkeerde boeking',
  'Beloning manueel aangepast',
  'Overgezet vanaf papieren kaart',
] as const;

function cn(...inputs: Array<string | undefined | null | false>) {
  return twMerge(clsx(inputs));
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildPrintableHandout(result: CreateCustomerAccountResult) {
  const loginLabel = result.loginAlias ? 'Accountcode' : 'E-mailadres';
  const contactLabel = getCustomerContactLabel(result.contactEmail, result.loginAlias, result.loginEmail);

  return `
    <!doctype html>
    <html lang="nl">
      <head>
        <meta charset="utf-8" />
        <title>Cozy Moments accountfiche</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 32px;
            color: #2f261d;
            background: #f5f1e8;
          }
          .card {
            max-width: 720px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 28px;
            padding: 32px;
            box-shadow: 0 24px 60px rgba(79, 59, 30, 0.12);
          }
          .eyebrow {
            margin: 0 0 12px;
            font-size: 12px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #7c6a4d;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 28px;
          }
          p {
            margin: 0;
            line-height: 1.6;
          }
          .credentials {
            margin: 28px 0;
            padding: 24px;
            border-radius: 22px;
            background: #f8f4ec;
          }
          .row {
            margin-bottom: 14px;
          }
          .label {
            display: block;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #837054;
            margin-bottom: 6px;
          }
          .value {
            font-size: 22px;
            font-weight: 700;
            word-break: break-word;
          }
          .note {
            margin-top: 24px;
            padding: 18px 20px;
            border-radius: 18px;
            background: #eef3e6;
            color: #41522d;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <p class="eyebrow">Cozy Moments loyalty</p>
          <h1>Nieuwe accountgegevens</h1>
          <p>Deze account is aangemaakt door het team van Cozy Moments voor <strong>${escapeHtml(result.name)}</strong>.</p>
          <div class="credentials">
            <div class="row">
              <span class="label">Naam</span>
              <span class="value">${escapeHtml(result.name)}</span>
            </div>
            <div class="row">
              <span class="label">${loginLabel}</span>
              <span class="value">${escapeHtml(result.loginIdentifier)}</span>
            </div>
            <div class="row">
              <span class="label">Tijdelijk wachtwoord</span>
              <span class="value">${escapeHtml(result.temporaryPassword)}</span>
            </div>
            <div class="row">
              <span class="label">Contact op dossier</span>
              <span class="value" style="font-size:18px;">${escapeHtml(contactLabel)}</span>
            </div>
          </div>
          <div class="note">
            <strong>Belangrijk:</strong> na de eerste login moet het wachtwoord meteen gewijzigd worden.
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildCredentialText(result: CreateCustomerAccountResult) {
  const loginLabel = result.loginAlias ? 'Accountcode' : 'E-mailadres';

  return [
    'Cozy Moments login',
    `Naam: ${result.name}`,
    `${loginLabel}: ${result.loginIdentifier}`,
    `Tijdelijk wachtwoord: ${result.temporaryPassword}`,
    'Belangrijk: bij de eerste login meteen een nieuw wachtwoord kiezen.',
  ].join('\n');
}

function buildTxId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatLastVisitLabel(value: string | null) {
  if (!value) {
    return 'Nog geen bezoek';
  }

  const date = new Date(value);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) {
    return 'Nog geen bezoek';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return 'Vandaag actief';
  }
  if (diffDays === 1) {
    return 'Gisteren actief';
  }
  if (diffDays < 7) {
    return `${diffDays} dagen geleden`;
  }

  return date.toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatAbsoluteDateTime(value: string | null) {
  if (!value) {
    return 'Nog niet geregistreerd';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Nog niet geregistreerd';
  }

  return date.toLocaleString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildVisitSuccessMessage(
  customer: Customer,
  counts: Record<CardType, number>,
  earned: Record<CardType, number>,
  bonusType?: CardType,
) {
  const bookedParts = DRINK_META
    .filter((item) => counts[item.type] > 0)
    .map((item) => `${counts[item.type]} ${item.label.toLowerCase()}`);
  const earnedParts = DRINK_META
    .filter((item) => earned[item.type] > 0)
    .map((item) => `${earned[item.type]} ${item.label.toLowerCase()}-beloning${earned[item.type] > 1 ? 'en' : ''}`);

  let message = `${customer.name}: ${bookedParts.join(', ')} geboekt.`;

  if (earnedParts.length > 0) {
    message += ` Nieuwe beloning: ${earnedParts.join(', ')}.`;
  }

  if (bonusType) {
    message += ` Welkomstbonus op ${cardTypeLabels[bonusType].toLowerCase()} toegepast.`;
  }

  return message;
}

function getTransactionBadgeClass(eventType: CustomerTransaction['eventType']) {
  if (eventType === 'scan') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (eventType === 'redeem') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

interface ManagedCounterProps {
  type: CardType;
  count: number;
  disabled?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}

const ManagedCounter: React.FC<ManagedCounterProps> = ({
  type,
  count,
  disabled = false,
  onIncrease,
  onDecrease,
}) => {
  const meta = DRINK_META.find((item) => item.type === type);
  if (!meta) {
    return null;
  }

  const Icon = meta.icon;

  return (
    <div className={cn('rounded-[24px] border p-4', meta.surfaceClassName)}>
      <div className="flex items-center gap-3">
        <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', meta.bgClassName)}>
          <Icon size={20} className={meta.textClassName} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-cozy-text)]">{meta.label}</p>
          <p className="text-xs text-gray-400">Tel eerst op, boek daarna in 1 keer.</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDecrease}
          disabled={disabled || count === 0}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <div className="min-w-[84px] rounded-[20px] bg-white px-4 py-3 text-center shadow-sm ring-1 ring-black/5">
          <p className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{count}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">aantal</p>
        </div>
        <button
          type="button"
          onClick={onIncrease}
          disabled={disabled}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
};

export function CreateCustomerPage({
  adminEmail,
  isDarkMode,
  onOpenCustomers,
}: CreateCustomerPageProps) {
  const {
    customers,
    loading,
    refreshCustomers,
    addConsumptions,
    claimReward,
    applyManualAdjustment,
  } = useLoyalty();
  const [mode, setMode] = useState<ManagedWorkspaceMode>('create');
  const [resolvedInitialMode, setResolvedInitialMode] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<CreateCustomerAccountResult | null>(null);
  const [managedSearch, setManagedSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [recentTransactions, setRecentTransactions] = useState<CustomerTransaction[]>([]);
  const [recentTransactionsLoading, setRecentTransactionsLoading] = useState(false);
  const [recentTransactionsError, setRecentTransactionsError] = useState<string | null>(null);
  const [visitDraft, setVisitDraft] = useState<Record<CardType, number>>(emptyDeltaRecord);
  const [visitSaving, setVisitSaving] = useState(false);
  const [rewardSavingType, setRewardSavingType] = useState<CardType | null>(null);
  const [rewardConfirmType, setRewardConfirmType] = useState<CardType | null>(null);
  const [manageActionError, setManageActionError] = useState<string | null>(null);
  const [manageActionSuccess, setManageActionSuccess] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionStamps, setCorrectionStamps] = useState<Record<CardType, number>>(emptyDeltaRecord);
  const [correctionRewards, setCorrectionRewards] = useState<Record<CardType, number>>(emptyDeltaRecord);
  const [correctionClaimed, setCorrectionClaimed] = useState<Record<CardType, number>>(emptyDeltaRecord);
  const [correctionVisitDelta, setCorrectionVisitDelta] = useState(0);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);

  const allManagedCustomers = useMemo(
    () => filterManagedCustomers(customers, adminEmail),
    [customers, adminEmail],
  );
  const managedCustomers = useMemo(
    () => filterManagedCustomers(customers, adminEmail, managedSearch),
    [customers, adminEmail, managedSearch],
  );
  const selectedCustomer = useMemo(
    () => managedCustomers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [managedCustomers, selectedCustomerId],
  );
  const managedCustomersNeedingResetCount = useMemo(
    () => allManagedCustomers.filter((customer) => customer.mustResetPassword).length,
    [allManagedCustomers],
  );
  const managedCustomersWithRewardsCount = useMemo(
    () => allManagedCustomers.filter((customer) => DRINK_META.some((item) => (customer.rewards[item.type] || 0) > 0)).length,
    [allManagedCustomers],
  );

  useEffect(() => {
    if (loading || resolvedInitialMode) {
      return;
    }

    setMode(allManagedCustomers.length > 0 ? 'manage' : 'create');
    setResolvedInitialMode(true);
  }, [allManagedCustomers.length, loading, resolvedInitialMode]);

  useEffect(() => {
    if (managedCustomers.length === 0) {
      setSelectedCustomerId('');
      return;
    }

    if (!managedCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(managedCustomers[0].id);
    }
  }, [managedCustomers, selectedCustomerId]);

  useEffect(() => {
    setVisitDraft(emptyDeltaRecord());
    setRewardConfirmType(null);
    setManageActionError(null);
    setManageActionSuccess(null);
    setCorrectionError(null);
    setCorrectionSuccess(null);
    setCorrectionReason('');
    setCorrectionStamps(emptyDeltaRecord());
    setCorrectionRewards(emptyDeltaRecord());
    setCorrectionClaimed(emptyDeltaRecord());
    setCorrectionVisitDelta(0);
  }, [selectedCustomerId]);

  const loadRecentTransactions = useCallback(async (customerId: string) => {
    setRecentTransactionsLoading(true);
    setRecentTransactionsError(null);

    try {
      const items = await fetchCustomerTransactions({ customerId, limit: 10 });
      setRecentTransactions(items);
    } catch (transactionError: any) {
      console.error('Kon recente acties niet laden:', transactionError);
      setRecentTransactions([]);
      setRecentTransactionsError(transactionError?.message || 'Recente acties laden mislukt.');
    } finally {
      setRecentTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'manage' || !selectedCustomerId) {
      setRecentTransactions([]);
      setRecentTransactionsError(null);
      setRecentTransactionsLoading(false);
      return;
    }

    void loadRecentTransactions(selectedCustomerId);
  }, [loadRecentTransactions, mode, selectedCustomerId]);

  const previewAlias = useMemo(() => `${buildManagedLoginAlias(form.name || 'cozy klant')}-4821`, [form.name]);
  const previewLogin = form.email.trim() ? form.email.trim().toLowerCase() : previewAlias;
  const activeAccount = {
    customerId: '',
    name: form.name.trim() || 'Nieuwe klant',
    contactEmail: form.email.trim() || null,
    loginEmail: form.email.trim().toLowerCase(),
    loginAlias: form.email.trim() ? null : previewAlias,
    loginIdentifier: previewLogin,
    temporaryPassword: TEMP_CUSTOMER_PASSWORD,
    mustResetPassword: true,
    createdByAdminEmail: adminEmail,
  } satisfies CreateCustomerAccountResult;

  const totalVisitDraft = DRINK_META.reduce((total, item) => total + visitDraft[item.type], 0);
  const totalOpenRewards = selectedCustomer
    ? DRINK_META.reduce((total, item) => total + (selectedCustomer.rewards[item.type] || 0), 0)
    : 0;
  const previewContactLabel = getCustomerContactLabel(activeAccount.contactEmail, activeAccount.loginAlias, activeAccount.loginEmail);
  const previewLoginLabel = activeAccount.loginAlias ? 'Accountcode' : 'E-mailadres';
  const previewFirstLogin = getCustomerLoginIdentifier(activeAccount.loginAlias, activeAccount.loginEmail);

  const handleChange = (field: 'name' | 'email', value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setCopied(false);
  };

  const goToCreateMode = () => {
    setMode('create');
    setResolvedInitialMode(true);
    setForm({ name: '', email: '' });
    setError('');
    setCopied(false);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedName = form.name.trim();
    const normalizedEmail = form.email.trim().toLowerCase();

    if (normalizedName.length < 2) {
      setError('Geef minstens een voornaam of herkenbare naam in.');
      return;
    }

    setSaving(true);
    setError('');
    setCopied(false);

    try {
      const createdAccount = await createCustomerAccount({
        name: normalizedName,
        email: normalizedEmail || undefined,
      });

      setResult(createdAccount);
      await refreshCustomers();
      setManagedSearch('');
      setSelectedCustomerId(createdAccount.customerId);
      setMode('manage');
      setResolvedInitialMode(true);
      setForm({ name: '', email: '' });
    } catch (createError: any) {
      setError(createError?.message || 'Account aanmaken mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildCredentialText(result));
      setCopied(true);
    } catch {
      setManageActionError('Kopieren mislukte. Probeer het opnieuw.');
    }
  };

  const handlePrint = () => {
    if (!result) {
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=840,height=980');

    if (!printWindow) {
      setManageActionError('Printvenster kon niet geopend worden.');
      return;
    }

    printWindow.document.write(buildPrintableHandout(result));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleVisitDraftChange = (type: CardType, nextValue: number) => {
    setVisitDraft((current) => ({
      ...current,
      [type]: Math.max(0, nextValue),
    }));
    setManageActionError(null);
    setManageActionSuccess(null);
  };

  const handleVisitSubmit = async () => {
    if (!selectedCustomer || totalVisitDraft === 0) {
      return;
    }

    setVisitSaving(true);
    setManageActionError(null);
    setManageActionSuccess(null);

    try {
      const currentDraft = { ...visitDraft };
      const scanResult = await addConsumptions(selectedCustomer.id, currentDraft, {
        staffEmail: adminEmail,
        txId: buildTxId('managed-visit'),
      });
      await loadRecentTransactions(selectedCustomer.id);
      setVisitDraft(emptyDeltaRecord());
      setManageActionSuccess(
        buildVisitSuccessMessage(selectedCustomer, currentDraft, scanResult.earned, scanResult.bonusApplied ? scanResult.bonusType : undefined),
      );
    } catch (visitError: any) {
      setManageActionError(visitError?.message || 'Bezoek boeken mislukt.');
    } finally {
      setVisitSaving(false);
    }
  };

  const handleClaimReward = async (type: CardType) => {
    if (!selectedCustomer) {
      return;
    }

    setRewardSavingType(type);
    setManageActionError(null);
    setManageActionSuccess(null);

    try {
      const success = await claimReward(selectedCustomer.id, type, {
        staffEmail: adminEmail,
        txId: buildTxId(`managed-redeem-${type}`),
      });

      if (!success) {
        throw new Error('Beloning inwisselen mislukt.');
      }

      await loadRecentTransactions(selectedCustomer.id);
      setManageActionSuccess(`${selectedCustomer.name}: gratis ${cardTypeLabels[type].toLowerCase()} geregistreerd.`);
      setRewardConfirmType(null);
    } catch (rewardError: any) {
      setManageActionError(rewardError?.message || 'Beloning inwisselen mislukt.');
      setRewardConfirmType(null);
    } finally {
      setRewardSavingType(null);
    }
  };

  const changeCorrectionRecord = (
    section: 'stamps' | 'rewards' | 'claimed',
    type: CardType,
    nextValue: number,
  ) => {
    if (section === 'stamps') {
      setCorrectionStamps((current) => ({ ...current, [type]: nextValue }));
    } else if (section === 'rewards') {
      setCorrectionRewards((current) => ({ ...current, [type]: nextValue }));
    } else {
      setCorrectionClaimed((current) => ({ ...current, [type]: nextValue }));
    }
  };

  const handleCorrectionSubmit = async () => {
    if (!selectedCustomer) {
      return;
    }

    setCorrectionError(null);
    setCorrectionSuccess(null);

    const validationError = validateManualAdjustmentDraft({
      customerId: selectedCustomer.id,
      reason: correctionReason,
      stamps: correctionStamps,
      rewards: correctionRewards,
      claimedRewards: correctionClaimed,
      visitDelta: correctionVisitDelta,
    });

    if (validationError) {
      setCorrectionError(validationError);
      return;
    }

    setCorrectionSaving(true);

    try {
      await applyManualAdjustment({
        customerId: selectedCustomer.id,
        staffEmail: adminEmail,
        reason: correctionReason.trim(),
        stamps: correctionStamps,
        rewards: correctionRewards,
        claimedRewards: correctionClaimed,
        visitDelta: correctionVisitDelta,
      });
      await loadRecentTransactions(selectedCustomer.id);
      setCorrectionSuccess('Correctie opgeslagen en toegevoegd aan de historiek.');
      setCorrectionReason('');
      setCorrectionStamps(emptyDeltaRecord());
      setCorrectionRewards(emptyDeltaRecord());
      setCorrectionClaimed(emptyDeltaRecord());
      setCorrectionVisitDelta(0);
    } catch (adjustmentError: any) {
      setCorrectionError(adjustmentError?.message || 'Correctie opslaan mislukt.');
    } finally {
      setCorrectionSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <button
            type="button"
            onClick={onOpenCustomers}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              isDarkMode
                ? 'bg-white/10 text-[#f1f4f8] hover:bg-white/15'
                : 'bg-white text-[var(--color-cozy-text)] shadow-sm hover:bg-gray-50',
            )}
          >
            <ArrowLeft size={16} />
            Terug naar klanten
          </button>
          <p className="admin-phase-kicker mt-4">Beheerworkflow</p>
          <h2 className="mt-3 text-3xl font-display font-bold text-[var(--color-cozy-text)]">
            Beheerde klanten
          </h2>
          <p className="admin-phase-copy mt-2 max-w-3xl text-sm">
            Maak accounts aan voor klanten die jij opvolgt en beheer hun dagelijkse bezoeken, beloningen en uitzonderingen hier op 1 plek.
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
          onClick={goToCreateMode}
          data-active={mode === 'create'}
          className="admin-phase-tab inline-flex items-center justify-center"
        >
          Nieuwe klant
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('manage');
            setResolvedInitialMode(true);
          }}
          data-active={mode === 'manage'}
          className="admin-phase-tab inline-flex items-center justify-center"
        >
          Mijn beheerde klanten ({allManagedCustomers.length})
        </button>
      </div>

      {mode === 'create' ? (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
          <section className="admin-phase-panel rounded-[32px] p-6 md:p-8">
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <p className="admin-phase-kicker">Snelle workflow</p>
                <h3 className="mt-3 text-[2rem] font-display font-bold leading-tight text-[var(--color-cozy-text)]">
                  Maak een account in minder dan een minuut
                </h3>
                <p className="admin-phase-copy mt-3 text-sm">
                  Standaardwachtwoord is <span className="font-mono font-bold text-[var(--color-cozy-text)]">{TEMP_CUSTOMER_PASSWORD}</span>. De klant moet dat bij de eerste login verplicht vervangen.
                </p>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <span className="admin-phase-label">
                    Naam van de klant
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => handleChange('name', event.target.value)}
                    placeholder="Bijvoorbeeld Maria Peeters"
                    autoComplete="name"
                    className="admin-phase-input text-base"
                  />
                </label>

                <label className="block">
                  <span className="admin-phase-label">
                    E-mailadres
                    <span className="ml-2 normal-case tracking-normal text-[var(--color-cozy-olive)]">optioneel</span>
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => handleChange('email', event.target.value)}
                    placeholder="Laat leeg voor een accountcode"
                    autoComplete="email"
                    className="admin-phase-input text-base"
                  />
                </label>
              </div>

              {error && (
                <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="admin-phase-button-primary inline-flex w-full items-center justify-center gap-3 px-5 text-base font-semibold"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Account wordt aangemaakt...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Account aanmaken
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
                <p className="admin-phase-kicker">Handout preview</p>
                <h3 className="mt-2 text-xl font-display font-bold text-[var(--color-cozy-text)]">Wat de klant straks nodig heeft</h3>
                <p className="admin-phase-copy mt-2 text-sm">
                  Deze kaart toont exact wat je kunt voorlezen, kopieren of afdrukken voor de klant.
                </p>
              </div>
            </div>

            <div className="admin-phase-panel-soft mt-6 rounded-[28px] px-5 py-5">
              <div className="space-y-4">
                <div>
                  <p className="admin-phase-kicker">Naam</p>
                  <p className="mt-2 font-display text-2xl font-bold text-[var(--color-cozy-text)]">{activeAccount.name}</p>
                </div>

                <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white/80')}>
                  <p className="admin-phase-kicker">{previewLoginLabel}</p>
                  <p className="mt-2 break-all font-mono text-lg font-bold text-[var(--color-cozy-text)]">{previewFirstLogin}</p>
                </div>

                <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white/80')}>
                  <p className="admin-phase-kicker">Tijdelijk wachtwoord</p>
                  <div className="mt-2 flex items-center gap-2">
                    <KeyRound size={16} className="text-[var(--color-cozy-olive)]" />
                    <p className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{TEMP_CUSTOMER_PASSWORD}</p>
                  </div>
                </div>

                <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-white/5' : 'bg-white/80')}>
                  <p className="admin-phase-kicker">Contact op dossier</p>
                  <div className="mt-2 flex items-start gap-2">
                    <Mail size={16} className="mt-0.5 text-[var(--color-cozy-olive)]" />
                    <p className="break-all text-sm font-medium text-[var(--color-cozy-text)]">{previewContactLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-phase-panel-soft mt-5 space-y-3 rounded-[28px] px-5 py-5">
              <div>
                <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Workflow in de zaak</p>
                <p className="admin-phase-copy mt-1 text-sm">1. Typ de naam in. 2. Druk op account aanmaken. 3. Geef de login door of print de fiche.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Eerste login</p>
                <p className="admin-phase-copy mt-1 text-sm">Na de eerste login wordt de klant automatisch naar het scherm gestuurd om een nieuw wachtwoord te kiezen.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Geen e-mailadres?</p>
                <p className="admin-phase-copy mt-1 text-sm">Laat het veld leeg en gebruik gewoon de accountcode. Die kan op het gewone inlogscherm ingevuld worden.</p>
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
                      <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-700">Nieuwe beheerde klant</p>
                      <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">{result.name} staat nu in jouw beheer</h3>
                      <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#b7c8c2]' : 'text-emerald-900/75')}>
                        Logingegevens blijven hieronder beschikbaar zolang je ze nodig hebt.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">{result.loginAlias ? 'Accountcode' : 'E-mailadres'}</p>
                      <p className="mt-2 break-all font-mono text-lg font-bold text-[var(--color-cozy-text)]">{result.loginIdentifier}</p>
                    </div>
                    <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Tijdelijk wachtwoord</p>
                      <p className="mt-2 font-mono text-lg font-bold text-[var(--color-cozy-text)]">{result.temporaryPassword}</p>
                    </div>
                    <div className={cn('rounded-[22px] px-4 py-4', isDarkMode ? 'bg-black/20' : 'bg-white/80')}>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Contact op dossier</p>
                      <p className="mt-2 break-all text-sm font-semibold text-[var(--color-cozy-text)]">{getCustomerContactLabel(result.contactEmail, result.loginAlias, result.loginEmail)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:min-w-[220px]">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--color-cozy-text)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90"
                  >
                    <Copy size={16} />
                    {copied ? 'Gekopieerd' : 'Kopieer login'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className={cn(
                      'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors',
                      isDarkMode
                        ? 'border-white/10 bg-white/5 text-[#eef2f7] hover:bg-white/10'
                        : 'border-emerald-200 bg-white text-[var(--color-cozy-text)] hover:bg-emerald-50',
                    )}
                  >
                    <Printer size={16} />
                    Print handout
                  </button>
                  <button
                    type="button"
                    onClick={goToCreateMode}
                    className={cn(
                      'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors',
                      isDarkMode
                        ? 'border-white/10 bg-white/5 text-[#eef2f7] hover:bg-white/10'
                        : 'border-emerald-200 bg-white text-[var(--color-cozy-text)] hover:bg-emerald-50',
                    )}
                  >
                    <UserPlus size={16} />
                    Maak nog een account
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setCopied(false);
                }}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:text-emerald-800"
              >
                <X size={14} />
                Loginkaart sluiten
              </button>
            </section>
          )}

          <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
            <aside className="admin-phase-panel rounded-[32px] p-6 md:p-7">
              <div>
                <p className="admin-phase-kicker">Mijn beheerde klanten</p>
                <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">{allManagedCustomers.length} klant{allManagedCustomers.length === 1 ? '' : 'en'} in beheer</h3>
                <p className="admin-phase-copy mt-2 text-sm">
                  Alleen klanten die jij zelf hebt aangemaakt verschijnen hier.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                  <p className="admin-phase-kicker">Actief in beheer</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-[var(--color-cozy-text)]">{allManagedCustomers.length}</p>
                  <p className="admin-phase-copy mt-2 text-xs">Alle klanten die aan jouw adminaccount hangen.</p>
                </div>
                <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                  <p className="admin-phase-kicker">Nog nooit ingelogd</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-[var(--color-cozy-text)]">{managedCustomersNeedingResetCount}</p>
                  <p className="admin-phase-copy mt-2 text-xs">Handig om te zien wie nog hulp nodig heeft bij de eerste login.</p>
                </div>
                <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                  <p className="admin-phase-kicker">Met open beloning</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-[var(--color-cozy-text)]">{managedCustomersWithRewardsCount}</p>
                  <p className="admin-phase-copy mt-2 text-xs">Klanten waarvoor meteen een gratis consumptie klaarstaat.</p>
                </div>
              </div>

              <div className="admin-phase-panel-soft mt-5 rounded-[24px] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    value={managedSearch}
                    onChange={(event) => setManagedSearch(event.target.value)}
                    placeholder="Zoek op naam, e-mail of accountcode"
                    className="w-full bg-transparent text-sm text-[var(--color-cozy-text)] outline-none placeholder:text-gray-400"
                  />
                </div>
                <p className="admin-phase-muted-note mt-3 text-xs">
                  Zoek op naam, e-mailadres of accountcode om sneller de juiste klant terug te vinden.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {loading && (
                  <div className={cn('admin-phase-empty rounded-[24px] px-4 py-5 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                    Beheerde klanten laden...
                  </div>
                )}

                {!loading && allManagedCustomers.length === 0 && (
                  <div className="admin-phase-empty rounded-[28px] px-5 py-6 text-center">
                    <p className="text-lg font-display font-bold text-[var(--color-cozy-text)]">Nog geen beheerde klanten</p>
                    <p className="admin-phase-copy mt-2 text-sm">
                      Maak eerst een klant aan. Daarna kun je hier meteen consumpties boeken, beloningen inwisselen en correcties doen.
                    </p>
                    <button
                      type="button"
                      onClick={goToCreateMode}
                      className="admin-phase-button-primary mt-4 inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                    >
                      <UserPlus size={16} />
                      Maak eerste beheerde klant aan
                    </button>
                  </div>
                )}

                {!loading && allManagedCustomers.length > 0 && managedCustomers.length === 0 && (
                  <div className={cn('admin-phase-empty rounded-[24px] px-4 py-5 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                    Geen beheerde klanten gevonden voor deze zoekopdracht.
                  </div>
                )}

                {!loading && managedCustomers.map((customer) => {
                  const isSelected = customer.id === selectedCustomerId;
                  const totalRewards = DRINK_META.reduce((total, item) => total + (customer.rewards[item.type] || 0), 0);

                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomerId(customer.id)}
                      data-selected={isSelected ? 'true' : 'false'}
                      className="admin-phase-list-item w-full rounded-[28px] px-4 py-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-lg font-bold text-[var(--color-cozy-text)]">{customer.name}</p>
                            <span className="rounded-full bg-[var(--color-cozy-olive)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">
                              Beheerd
                            </span>
                            {customer.mustResetPassword && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                                Nog nooit ingelogd
                              </span>
                            )}
                          </div>
                          <p className={cn('mt-1 text-sm break-all', isDarkMode ? 'text-[#b6c1cf]' : 'text-gray-500')}>
                            {getCustomerContactLabel(customer.email, customer.loginAlias, customer.loginEmail)}
                          </p>
                        </div>
                        <div className={cn('rounded-full px-3 py-1 text-[11px] font-semibold', isSelected ? 'bg-[var(--color-cozy-olive)] text-white' : 'bg-gray-100 text-gray-500')}>
                          {formatLastVisitLabel(customer.lastVisitAt)}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {DRINK_META.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={`${customer.id}-${item.type}`} className={cn('rounded-[20px] border px-3 py-3 text-center', item.surfaceClassName)}>
                              <Icon size={14} className={cn('mx-auto', item.textClassName)} />
                              <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-gray-400">{item.label}</p>
                              <p className="mt-1 font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards[item.type]}/12</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="admin-phase-muted-note mt-3 flex items-center justify-between gap-3 text-xs">
                        <span>{totalRewards} open beloning{totalRewards === 1 ? '' : 'en'}</span>
                        <span>{customer.totalVisits} bezoek{customer.totalVisits === 1 ? '' : 'en'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="admin-phase-panel rounded-[32px] p-6 md:p-7">
              {!selectedCustomer ? (
                <div className="admin-phase-empty rounded-[30px] px-6 py-8 text-center">
                  <p className="admin-phase-kicker">Klantdetail</p>
                  <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">
                    {managedCustomers.length === 0 ? 'Geen klant in beeld' : 'Kies links een klant'}
                  </h3>
                  <p className="admin-phase-copy mt-2 text-sm">
                    {managedCustomers.length === 0
                      ? 'Pas je zoekopdracht aan of maak een extra beheerde klant aan. Zodra je een klant selecteert, kun je hier meteen bezoeken boeken en correcties doen.'
                      : 'Van hieruit boek je bezoeken, registreer je gratis consumpties en zet je uitzonderingen recht zonder naar andere schermen te springen.'}
                  </p>
                  {managedSearch.trim().length > 0 && managedCustomers.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setManagedSearch('')}
                      className="admin-phase-button-secondary mt-4 inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                    >
                      Toon opnieuw alle beheerde klanten
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="admin-phase-panel-soft rounded-[30px] px-5 py-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <p className="admin-phase-kicker">Klantdetail</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="mt-2 text-3xl font-display font-bold text-[var(--color-cozy-text)]">{selectedCustomer.name}</h3>
                          <span className="rounded-full bg-[var(--color-cozy-olive)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cozy-olive)]">Beheerd</span>
                          {selectedCustomer.mustResetPassword && (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">Nog nooit ingelogd</span>
                          )}
                        </div>
                        <p className={cn('mt-2 break-all text-sm', isDarkMode ? 'text-[#b6c1cf]' : 'text-gray-500')}>
                          {getCustomerContactLabel(selectedCustomer.email, selectedCustomer.loginAlias, selectedCustomer.loginEmail)}
                        </p>
                        <p className={cn('mt-2 text-xs uppercase tracking-[0.18em]', isDarkMode ? 'text-[#8d9aab]' : 'text-gray-400')}>
                          Laatste bezoek: {formatAbsoluteDateTime(selectedCustomer.lastVisitAt)}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                        <div className="admin-phase-detail-card rounded-[22px] px-4 py-4">
                          <p className="admin-phase-kicker">Aanmelden met</p>
                          <p className="mt-2 text-base font-semibold text-[var(--color-cozy-text)]">
                            {selectedCustomer.loginAlias ? 'Accountcode' : 'E-mailadres'}
                          </p>
                          <p className={cn('mt-2 text-sm break-all', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                            {getCustomerLoginIdentifier(selectedCustomer.loginAlias, selectedCustomer.loginEmail)}
                          </p>
                        </div>
                        <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">Bezoeken</p>
                          <p className="mt-2 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{selectedCustomer.totalVisits}</p>
                        </div>
                        <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">Open beloningen</p>
                          <p className="mt-2 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{totalOpenRewards}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {DRINK_META.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={`status-${item.type}`} className={cn('rounded-[24px] border px-4 py-4', item.surfaceClassName)}>
                            <div className="flex items-center gap-3">
                              <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl', item.bgClassName)}>
                                <Icon size={18} className={item.textClassName} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[var(--color-cozy-text)]">{item.label}</p>
                                <p className="text-[11px] text-gray-400">Huidige stand</p>
                              </div>
                            </div>
                            <div className="mt-4 space-y-2 text-sm text-gray-500">
                              <div className="flex items-center justify-between">
                                <span>Stempels</span>
                                <span className="font-mono font-bold text-[var(--color-cozy-text)]">{selectedCustomer.cards[item.type]}/12</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Beschikbaar</span>
                                <span className="font-mono font-bold text-[var(--color-cozy-text)]">{selectedCustomer.rewards[item.type]}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Ingewisseld</span>
                                <span className="font-mono font-bold text-[var(--color-cozy-text)]">{selectedCustomer.claimedRewards[item.type]}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-5">
                      <section className="admin-phase-detail-card rounded-[28px] px-5 py-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Snelle consumpties</p>
                            <h4 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Boek een bezoek zonder QR</h4>
                            <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                              Tel de drankjes op, bevestig daarna in 1 klik. De gewone scanlogica blijft identiek.
                            </p>
                          </div>
                          <div className={cn('rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]', totalVisitDraft > 0 ? 'bg-[var(--color-cozy-olive)] text-white' : 'bg-gray-100 text-gray-500')}>
                            {totalVisitDraft} consumptie{totalVisitDraft === 1 ? '' : 's'} klaar
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          {DRINK_META.map((item) => (
                            <ManagedCounter
                              key={`visit-${item.type}`}
                              type={item.type}
                              count={visitDraft[item.type]}
                              disabled={visitSaving}
                              onDecrease={() => handleVisitDraftChange(item.type, visitDraft[item.type] - 1)}
                              onIncrease={() => handleVisitDraftChange(item.type, visitDraft[item.type] + 1)}
                            />
                          ))}
                        </div>

                        {manageActionError && (
                          <div className="mt-4 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                            {manageActionError}
                          </div>
                        )}
                        {manageActionSuccess && (
                          <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                            {manageActionSuccess}
                          </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={handleVisitSubmit}
                            disabled={visitSaving || totalVisitDraft === 0}
                            className="admin-phase-button-primary inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {visitSaving ? 'Bezig met boeken...' : 'Boek bezoek'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisitDraft(emptyDeltaRecord())}
                            disabled={visitSaving || totalVisitDraft === 0}
                            className="admin-phase-button-secondary inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold"
                          >
                            Leegmaken
                          </button>
                        </div>
                      </section>

                      <section className="admin-phase-detail-card rounded-[28px] px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Beschikbare beloningen</p>
                            <h4 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Registreer een gratis consumptie</h4>
                            <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                              Gebruik de gewone inwissellogica, maar zonder klant-QR. Alles blijft in de historiek staan.
                            </p>
                          </div>
                          <div className={cn('inline-flex h-12 w-12 items-center justify-center rounded-full', isDarkMode ? 'bg-[#182333]' : 'bg-amber-50')}>
                            <Gift size={20} className="text-amber-600" />
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          {DRINK_META.map((item) => {
                            const Icon = item.icon;
                            const rewardCount = selectedCustomer.rewards[item.type] || 0;
                            const isSaving = rewardSavingType === item.type;

                            return (
                              <button
                                key={`reward-${item.type}`}
                                type="button"
                                onClick={() => setRewardConfirmType(item.type)}
                                disabled={rewardCount === 0 || rewardSavingType !== null}
                                className={cn(
                                  'rounded-[24px] border px-4 py-4 text-left transition-all',
                                  rewardCount > 0
                                    ? isDarkMode
                                      ? 'border-white/10 bg-[#182333] hover:border-[var(--color-cozy-olive)]/40'
                                      : 'border-gray-100 bg-[#fbf8f2] hover:border-[var(--color-cozy-olive)]/25'
                                    : isDarkMode
                                      ? 'border-white/10 bg-[#131a24] opacity-55'
                                      : 'border-gray-100 bg-gray-50 opacity-60',
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', item.bgClassName)}>
                                      <Icon size={20} className={item.textClassName} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Gratis {item.label.toLowerCase()}</p>
                                      <p className="text-xs text-gray-400">{rewardCount} beschikbaar</p>
                                    </div>
                                  </div>
                                  <div className={cn('rounded-full px-3 py-1 text-xs font-semibold', rewardCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500')}>
                                    {rewardCount}
                                  </div>
                                </div>
                                <p className="mt-4 text-sm font-medium text-[var(--color-cozy-text)]">
                                  {isSaving ? 'Bezig met registreren...' : rewardCount > 0 ? 'Registreer gratis consumptie' : 'Geen beloning beschikbaar'}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-5">
                      <section className="admin-phase-detail-card overflow-hidden rounded-[28px] shadow-sm">
                        <button
                          type="button"
                          onClick={() => setCorrectionOpen((current) => !current)}
                          className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left"
                        >
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Compacte correctie</p>
                            <h4 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Uitzondering of fout rechtzetten</h4>
                            <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                              Geen klant kiezen, geen historiek-tab nodig. Werk alleen op {selectedCustomer.name}.
                            </p>
                          </div>
                          <div className={cn('rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]', correctionOpen ? 'bg-[var(--color-cozy-olive)] text-white' : 'bg-gray-100 text-gray-500')}>
                            {correctionOpen ? 'Open' : 'Gesloten'}
                          </div>
                        </button>

                        {correctionOpen && (
                          <div className={cn('border-t px-5 py-5', isDarkMode ? 'border-white/10' : 'border-gray-100')}>
                            <div className="flex flex-wrap gap-2">
                              {QUICK_REASON_CHIPS.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => {
                                    setCorrectionReason(chip);
                                    setCorrectionError(null);
                                    setCorrectionSuccess(null);
                                  }}
                                  className={cn(
                                    'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
                                    correctionReason === chip
                                      ? 'bg-[var(--color-cozy-olive)] text-white'
                                      : isDarkMode
                                        ? 'bg-white/8 text-[#dde5ef] hover:bg-white/12'
                                        : 'bg-[#f8f5ef] text-[var(--color-cozy-text)] hover:bg-[#f0ebdf]',
                                  )}
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>

                            <div className="mt-4">
                              <label className="admin-phase-label mb-2 block">Reden</label>
                              <textarea
                                value={correctionReason}
                                onChange={(event) => setCorrectionReason(event.target.value)}
                                rows={3}
                                placeholder="Beschrijf kort waarom je deze correctie doet"
                                className="admin-phase-input w-full resize-none"
                              />
                            </div>

                            <div className="admin-phase-panel-soft mt-4 space-y-3 rounded-[24px] p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Stempels huidige kaart</p>
                                <span className="text-[11px] text-gray-400">Moet tussen 0 en 11 uitkomen</span>
                              </div>
                              {DRINK_META.map((item) => (
                                <DeltaControl
                                  key={`managed-stamp-${item.type}`}
                                  label={item.label}
                                  value={correctionStamps[item.type]}
                                  baseValue={selectedCustomer.cards[item.type]}
                                  onChange={(value) => changeCorrectionRecord('stamps', item.type, value)}
                                  accent="olive"
                                  minValue={-selectedCustomer.cards[item.type]}
                                  maxValue={11 - selectedCustomer.cards[item.type]}
                                  disabled={correctionSaving}
                                />
                              ))}
                            </div>

                            <div className="admin-phase-panel-soft mt-4 space-y-3 rounded-[24px] p-4">
                              <p className="text-xs text-gray-400 uppercase tracking-wider">Beschikbare beloningen</p>
                              {DRINK_META.map((item) => (
                                <DeltaControl
                                  key={`managed-reward-${item.type}`}
                                  label={item.label}
                                  value={correctionRewards[item.type]}
                                  baseValue={selectedCustomer.rewards[item.type]}
                                  onChange={(value) => changeCorrectionRecord('rewards', item.type, value)}
                                  accent="amber"
                                  minValue={-selectedCustomer.rewards[item.type]}
                                  disabled={correctionSaving}
                                />
                              ))}
                            </div>

                            <div className="admin-phase-panel-soft mt-4 space-y-3 rounded-[24px] p-4">
                              <p className="text-xs text-gray-400 uppercase tracking-wider">Ingewisselde beloningen</p>
                              {DRINK_META.map((item) => (
                                <DeltaControl
                                  key={`managed-claimed-${item.type}`}
                                  label={item.label}
                                  value={correctionClaimed[item.type]}
                                  baseValue={selectedCustomer.claimedRewards[item.type]}
                                  onChange={(value) => changeCorrectionRecord('claimed', item.type, value)}
                                  accent="rose"
                                  minValue={-selectedCustomer.claimedRewards[item.type]}
                                  disabled={correctionSaving}
                                />
                              ))}
                            </div>

                            <div className="admin-phase-panel-soft mt-4 space-y-2 rounded-[24px] p-4">
                              <p className="text-xs text-gray-400 uppercase tracking-wider">Bezoeken</p>
                              <DeltaControl
                                label="Totaal bezoeken"
                                value={correctionVisitDelta}
                                baseValue={selectedCustomer.totalVisits}
                                onChange={setCorrectionVisitDelta}
                                accent="blue"
                                minValue={-selectedCustomer.totalVisits}
                                disabled={correctionSaving}
                              />
                            </div>

                            {correctionError && (
                              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                {correctionError}
                              </div>
                            )}
                            {correctionSuccess && (
                              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {correctionSuccess}
                              </div>
                            )}

                            <div className="mt-5 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={handleCorrectionSubmit}
                                disabled={correctionSaving}
                                className="admin-phase-button-primary inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {correctionSaving ? 'Opslaan...' : 'Correctie opslaan'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCorrectionError(null);
                                  setCorrectionSuccess(null);
                                  setCorrectionReason('');
                                  setCorrectionStamps(emptyDeltaRecord());
                                  setCorrectionRewards(emptyDeltaRecord());
                                  setCorrectionClaimed(emptyDeltaRecord());
                                  setCorrectionVisitDelta(0);
                                }}
                                disabled={correctionSaving}
                                className="admin-phase-button-secondary inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold"
                              >
                                Formulier leegmaken
                              </button>
                            </div>
                          </div>
                        )}
                      </section>

                      <section className="admin-phase-detail-card rounded-[28px] px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Recente acties</p>
                            <h4 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Laatste registraties voor {selectedCustomer.name}</h4>
                            <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                              Handig om direct te zien wat er net werd geboekt en dubbel werk te vermijden.
                            </p>
                          </div>
                          <div className={cn('inline-flex h-12 w-12 items-center justify-center rounded-full', isDarkMode ? 'bg-[#182333]' : 'bg-[#f4eee2]')}>
                            <Clock3 size={20} className="text-[var(--color-cozy-olive)]" />
                          </div>
                        </div>

                        <div className="mt-5 space-y-3">
                          {recentTransactionsLoading && (
                            <div className={cn('admin-phase-empty rounded-[22px] px-4 py-4 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                              Recente acties laden...
                            </div>
                          )}
                          {recentTransactionsError && (
                            <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                              {recentTransactionsError}
                            </div>
                          )}
                          {!recentTransactionsLoading && !recentTransactionsError && recentTransactions.length === 0 && (
                            <div className={cn('admin-phase-empty rounded-[22px] px-4 py-4 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                              Nog geen acties voor deze klant.
                            </div>
                          )}

                          {!recentTransactionsLoading && !recentTransactionsError && recentTransactions.map((transaction) => {
                            const summaryParts = buildTransactionSummaryParts(transaction);

                            return (
                              <div key={transaction.id} className={cn('rounded-[24px] border px-4 py-4', isDarkMode ? 'border-white/10 bg-[#182333]' : 'border-gray-100 bg-[#fcfaf6]')}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider', getTransactionBadgeClass(transaction.eventType))}>
                                    {getTransactionLabel(transaction.eventType)}
                                  </span>
                                  <span className="text-xs text-gray-400">{formatAbsoluteDateTime(transaction.createdAt)}</span>
                                </div>

                                {summaryParts.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {summaryParts.map((part) => (
                                      <span key={`${transaction.id}-${part}`} className="inline-flex items-center rounded-full border border-gray-100 bg-white px-3 py-1 text-xs font-medium text-gray-600">
                                        {part}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {transaction.reason && (
                                  <p className="mt-3 text-sm text-gray-500">
                                    <span className="font-semibold text-[var(--color-cozy-text)]">Reden:</span> {transaction.reason}
                                  </p>
                                )}

                                <p className="mt-3 text-[11px] text-gray-400">
                                  Medewerker: {transaction.staffEmail ?? 'Onbekend'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {mode === 'manage' && selectedCustomer && rewardConfirmType && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className={cn('w-full max-w-md rounded-[28px] border p-6 shadow-2xl', isDarkMode ? 'border-white/10 bg-[#18202b]' : 'border-gray-200 bg-white')}>
            <div className="flex items-start gap-3">
              <div className={cn('inline-flex h-12 w-12 items-center justify-center rounded-full', isDarkMode ? 'bg-[#111823]' : 'bg-amber-50')}>
                <Gift size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Bevestiging</p>
                <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Ben je zeker?</h3>
                <p className={cn('mt-2 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                  Je staat op het punt een gratis {cardTypeLabels[rewardConfirmType].toLowerCase()} toe te kennen aan {selectedCustomer.name}.
                </p>
              </div>
            </div>

            <div className={cn('mt-5 rounded-[22px] px-4 py-4', isDarkMode ? 'bg-[#111823]' : 'bg-[#fbf8f2]')}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-cozy-olive)]">Beschikbaar voor deze klant</p>
              <p className="mt-2 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">
                {selectedCustomer.rewards[rewardConfirmType]}
              </p>
              <p className={cn('mt-1 text-sm', isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500')}>
                open beloning{selectedCustomer.rewards[rewardConfirmType] === 1 ? '' : 'en'} voor {cardTypeLabels[rewardConfirmType].toLowerCase()}.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setRewardConfirmType(null)}
                disabled={rewardSavingType !== null}
                className={cn(
                  'inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border px-5 text-sm font-semibold transition-colors',
                  isDarkMode
                    ? 'border-white/10 bg-white/5 text-[#eef2f7] hover:bg-white/10'
                    : 'border-gray-200 bg-white text-[var(--color-cozy-text)] hover:bg-gray-50',
                )}
              >
                Nee
              </button>
              <button
                type="button"
                onClick={() => handleClaimReward(rewardConfirmType)}
                disabled={rewardSavingType !== null}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-[var(--color-cozy-text)] px-5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rewardSavingType === rewardConfirmType ? 'Bezig...' : 'Ja, registreer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
