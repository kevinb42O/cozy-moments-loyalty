import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Copy, KeyRound, Mail, Printer, ShieldCheck, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLoyalty } from '../../shared/store/LoyaltyContext';
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

export function CreateCustomerPage({
  adminEmail,
  isDarkMode,
  onOpenCustomers,
}: CreateCustomerPageProps) {
  const { refreshCustomers } = useLoyalty();
  const [form, setForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<CreateCustomerAccountResult | null>(null);

  const previewAlias = useMemo(() => `${buildManagedLoginAlias(form.name || 'cozy klant')}-4821`, [form.name]);
  const previewLogin = form.email.trim() ? form.email.trim().toLowerCase() : previewAlias;
  const previewContact = form.email.trim()
    ? form.email.trim().toLowerCase()
    : `Accountcode: ${previewAlias}`;
  const activeAccount = result ?? {
    customerId: '',
    name: form.name.trim() || 'Nieuwe klant',
    contactEmail: form.email.trim() || null,
    loginEmail: form.email.trim().toLowerCase(),
    loginAlias: form.email.trim() ? null : previewAlias,
    loginIdentifier: previewLogin,
    temporaryPassword: TEMP_CUSTOMER_PASSWORD,
    mustResetPassword: true,
    createdByAdminEmail: adminEmail,
  };

  const handleChange = (field: 'name' | 'email', value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setCopied(false);
  };

  const resetForm = () => {
    setForm({ name: '', email: '' });
    setError('');
    setCopied(false);
    setResult(null);
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
      setError('Kopieren mislukte. Probeer het opnieuw.');
    }
  };

  const handlePrint = () => {
    if (!result) {
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=840,height=980');

    if (!printWindow) {
      setError('Printvenster kon niet geopend worden.');
      return;
    }

    printWindow.document.write(buildPrintableHandout(result));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const previewContactLabel = result
    ? getCustomerContactLabel(result.contactEmail, result.loginAlias, result.loginEmail)
    : previewContact;
  const previewLoginLabel = activeAccount.loginAlias ? 'Accountcode' : 'E-mailadres';
  const previewFirstLogin = result
    ? getCustomerLoginIdentifier(result.loginAlias, result.loginEmail)
    : previewLogin;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <button
            type="button"
            onClick={onOpenCustomers}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isDarkMode
                ? 'bg-white/10 text-[#f1f4f8] hover:bg-white/15'
                : 'bg-white text-[var(--color-cozy-text)] shadow-sm hover:bg-gray-50'
            }`}
          >
            <ArrowLeft size={16} />
            Terug naar klanten
          </button>
          <h2 className="mt-3 text-3xl font-display font-bold text-[var(--color-cozy-text)]">
            Nieuwe klant aanmaken
          </h2>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500'}`}>
            Typ enkel de naam in. Laat je het e-mailadres leeg, dan maken we automatisch een eenvoudige accountcode aan.
          </p>
        </div>

        <div className={`rounded-[24px] px-5 py-4 shadow-sm ${isDarkMode ? 'bg-[#1a2230] text-[#e8edf5]' : 'bg-white text-[var(--color-cozy-text)]'}`}>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-cozy-olive)]">Actieve admin</p>
          <p className="mt-2 break-all font-mono text-sm font-bold">{adminEmail ?? 'Onbekend'}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
        <section className={`rounded-[30px] p-5 shadow-sm md:p-7 ${isDarkMode ? 'bg-[#18202b]' : 'bg-white'}`}>
          {result ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle size={24} />
                  </div>
                  <h3 className="mt-4 text-2xl font-display font-bold text-[var(--color-cozy-text)]">
                    Account klaar voor gebruik
                  </h3>
                  <p className={`mt-2 text-sm ${isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500'}`}>
                    Geef onderstaande gegevens door. Bij de eerste login moet de klant meteen een eigen wachtwoord kiezen.
                  </p>
                </div>

                <div className={`rounded-[22px] px-4 py-3 ${isDarkMode ? 'bg-[#111823] text-[#d9e1ec]' : 'bg-[#f8f5ef] text-[var(--color-cozy-text)]'}`}>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Klant</p>
                  <p className="mt-2 font-display text-lg font-bold">{result.name}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className={`rounded-[24px] border px-5 py-4 ${isDarkMode ? 'border-white/10 bg-[#111823]' : 'border-[#ece4d5] bg-[#fbf8f2]'}`}>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">{result.loginAlias ? 'Accountcode' : 'E-mailadres'}</p>
                  <p className="mt-3 break-all font-mono text-xl font-bold text-[var(--color-cozy-text)]">{result.loginIdentifier}</p>
                </div>
                <div className={`rounded-[24px] border px-5 py-4 ${isDarkMode ? 'border-white/10 bg-[#111823]' : 'border-[#ece4d5] bg-[#fbf8f2]'}`}>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Tijdelijk wachtwoord</p>
                  <p className="mt-3 font-mono text-xl font-bold text-[var(--color-cozy-text)]">{result.temporaryPassword}</p>
                </div>
              </div>

              <div className={`rounded-[24px] border px-5 py-4 ${isDarkMode ? 'border-white/10 bg-[#111823]' : 'border-[#ece4d5] bg-[#fbf8f2]'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Contact op dossier</p>
                <p className="mt-3 break-all text-sm font-medium text-[var(--color-cozy-text)]">{previewContactLabel}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
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
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors ${
                    isDarkMode
                      ? 'border-white/10 bg-white/5 text-[#eef2f7] hover:bg-white/10'
                      : 'border-gray-200 bg-white text-[var(--color-cozy-text)] hover:bg-gray-50'
                  }`}
                >
                  <Printer size={16} />
                  Print handout
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors ${
                    isDarkMode
                      ? 'border-white/10 bg-white/5 text-[#eef2f7] hover:bg-white/10'
                      : 'border-gray-200 bg-white text-[var(--color-cozy-text)] hover:bg-gray-50'
                  }`}
                >
                  <UserPlus size={16} />
                  Maak nog een account
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Snelle workflow</p>
                <h3 className="mt-3 text-2xl font-display font-bold text-[var(--color-cozy-text)]">
                  Maak een account in minder dan een minuut
                </h3>
                <p className={`mt-2 text-sm ${isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500'}`}>
                  Standaardwachtwoord is <span className="font-mono font-bold text-[var(--color-cozy-text)]">{TEMP_CUSTOMER_PASSWORD}</span>. De klant moet dat bij de eerste login verplicht vervangen.
                </p>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? 'text-[#c0cad8]' : 'text-gray-500'}`}>
                    Naam van de klant
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => handleChange('name', event.target.value)}
                    placeholder="Bijvoorbeeld Maria Peeters"
                    autoComplete="name"
                    className={`w-full rounded-[22px] border px-5 py-4 text-base text-[var(--color-cozy-text)] outline-none transition-colors ${
                      isDarkMode
                        ? 'border-white/10 bg-[#111823] placeholder:text-[#6d7888] focus:border-[var(--color-cozy-olive)]'
                        : 'border-gray-200 bg-[#fbf8f2] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                    }`}
                  />
                </label>

                <label className="block">
                  <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? 'text-[#c0cad8]' : 'text-gray-500'}`}>
                    E-mailadres
                    <span className="ml-2 normal-case tracking-normal text-[var(--color-cozy-olive)]">optioneel</span>
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => handleChange('email', event.target.value)}
                    placeholder="Laat leeg voor een accountcode"
                    autoComplete="email"
                    className={`w-full rounded-[22px] border px-5 py-4 text-base text-[var(--color-cozy-text)] outline-none transition-colors ${
                      isDarkMode
                        ? 'border-white/10 bg-[#111823] placeholder:text-[#6d7888] focus:border-[var(--color-cozy-olive)]'
                        : 'border-gray-200 bg-[#fbf8f2] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                    }`}
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
                className="inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-[22px] bg-[var(--color-cozy-text)] px-5 text-base font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
          )}
        </section>

        <aside className={`rounded-[30px] p-5 shadow-sm md:p-7 ${isDarkMode ? 'bg-[#18202b]' : 'bg-white'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full ${isDarkMode ? 'bg-[#111823] text-[#e9eef6]' : 'bg-[#f4eee2] text-[var(--color-cozy-text)]'}`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Handout preview</p>
              <h3 className="mt-2 text-xl font-display font-bold text-[var(--color-cozy-text)]">Wat de klant straks nodig heeft</h3>
              <p className={`mt-2 text-sm ${isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500'}`}>
                Deze kaart toont exact wat je kunt voorlezen, kopieren of afdrukken voor de klant.
              </p>
            </div>
          </div>

          <div className={`mt-6 rounded-[28px] border px-5 py-5 ${isDarkMode ? 'border-white/10 bg-[#111823]' : 'border-[#ece4d5] bg-[#fbf8f2]'}`}>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Naam</p>
                <p className="mt-2 font-display text-2xl font-bold text-[var(--color-cozy-text)]">{activeAccount.name}</p>
              </div>

              <div className={`rounded-[22px] px-4 py-4 ${isDarkMode ? 'bg-white/5' : 'bg-white'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">{previewLoginLabel}</p>
                <p className="mt-2 break-all font-mono text-lg font-bold text-[var(--color-cozy-text)]">{previewFirstLogin}</p>
              </div>

              <div className={`rounded-[22px] px-4 py-4 ${isDarkMode ? 'bg-white/5' : 'bg-white'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Tijdelijk wachtwoord</p>
                <div className="mt-2 flex items-center gap-2">
                  <KeyRound size={16} className="text-[var(--color-cozy-olive)]" />
                  <p className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{TEMP_CUSTOMER_PASSWORD}</p>
                </div>
              </div>

              <div className={`rounded-[22px] px-4 py-4 ${isDarkMode ? 'bg-white/5' : 'bg-white'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-cozy-olive)]">Contact op dossier</p>
                <div className="mt-2 flex items-start gap-2">
                  <Mail size={16} className="mt-0.5 text-[var(--color-cozy-olive)]" />
                  <p className="break-all text-sm font-medium text-[var(--color-cozy-text)]">{previewContactLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`mt-5 space-y-3 rounded-[28px] px-5 py-5 ${isDarkMode ? 'bg-[#111823]' : 'bg-[#f7f3eb]'}`}>
            <div>
              <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Workflow op de vloer</p>
              <p className={`mt-1 text-sm ${isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500'}`}>1. Typ de naam in. 2. Druk op account aanmaken. 3. Geef de login door of print de fiche.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Eerste login</p>
              <p className={`mt-1 text-sm ${isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500'}`}>Na de eerste login wordt de klant automatisch naar het scherm gestuurd om een nieuw wachtwoord te kiezen.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-cozy-text)]">Geen e-mailadres?</p>
              <p className={`mt-1 text-sm ${isDarkMode ? 'text-[#a8b3c1]' : 'text-gray-500'}`}>Laat het veld leeg en gebruik gewoon de accountcode. Die kan op het gewone inlogscherm ingevuld worden.</p>
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
