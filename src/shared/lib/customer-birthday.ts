import type { Customer } from '../store/LoyaltyContext';

export interface CustomerBirthdayInput {
  day: number | null;
  month: number | null;
  year?: number | null;
}

export interface CustomerPartnerBirthdayInput {
  firstName: string | null;
  birthday: CustomerBirthdayInput;
}

export interface CustomerBirthdayEntry {
  owner: 'primary' | 'partner';
  personName: string;
  day: number | null;
  month: number | null;
  year: number | null;
}

export interface BirthdayReminder {
  customer: Customer;
  owner: 'primary' | 'partner';
  personName: string;
  date: Date;
  daysUntil: number;
  label: string;
  birthdayLabel: string;
}

const MONTH_LABELS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isValidBirthdayParts(input: CustomerBirthdayInput) {
  if (!input.day && !input.month && !input.year) return true;
  if (!input.day || !input.month) return false;
  if (!Number.isInteger(input.day) || !Number.isInteger(input.month)) return false;
  if (input.month < 1 || input.month > 12) return false;
  if (input.year && (!Number.isInteger(input.year) || input.year < 1900 || input.year > new Date().getFullYear())) return false;

  const year = input.year && Number.isInteger(input.year) ? input.year : 2000;
  const date = new Date(year, input.month - 1, input.day);
  return date.getFullYear() === year && date.getMonth() === input.month - 1 && date.getDate() === input.day;
}

export function normalizeBirthdayInput(input: CustomerBirthdayInput): Required<CustomerBirthdayInput> {
  const normalized = {
    day: input.day && Number.isFinite(input.day) ? Math.trunc(input.day) : null,
    month: input.month && Number.isFinite(input.month) ? Math.trunc(input.month) : null,
    year: input.year && Number.isFinite(input.year) ? Math.trunc(input.year) : null,
  };

  if (!normalized.day && !normalized.month && !normalized.year) {
    return { day: null, month: null, year: null };
  }

  if (!isValidBirthdayParts(normalized)) {
    throw new Error('Vul minstens een geldige dag en maand in. Het jaartal mag leeg blijven.');
  }

  return normalized;
}

export function normalizePartnerFirstName(value: string | null | undefined) {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  if (normalized.length < 2) throw new Error('Vul voor de partner minstens 2 letters in.');
  if (normalized.length > 40) throw new Error('De voornaam van de partner is te lang.');
  if (/\s/.test(normalized)) throw new Error('Vul alleen de voornaam van de partner in.');
  return normalized;
}

export function normalizePartnerBirthdayInput(input: CustomerPartnerBirthdayInput): { firstName: string | null; birthday: Required<CustomerBirthdayInput> } {
  const firstName = normalizePartnerFirstName(input.firstName);
  const birthday = normalizeBirthdayInput(input.birthday);
  const hasBirthday = Boolean(birthday.day || birthday.month || birthday.year);

  if (!firstName && hasBirthday) {
    throw new Error('Vul de voornaam van de partner in wanneer je een tweede verjaardag toevoegt.');
  }

  if (firstName && !hasBirthday) {
    throw new Error('Vul ook de verjaardag van de partner in.');
  }

  return { firstName, birthday: firstName ? birthday : { day: null, month: null, year: null } };
}

export function formatCustomerBirthday(customer: Pick<Customer, 'birthdayDay' | 'birthdayMonth' | 'birthdayYear'>) {
  if (!customer.birthdayDay || !customer.birthdayMonth) return 'Niet ingevuld';
  const monthLabel = MONTH_LABELS[customer.birthdayMonth - 1] ?? '';
  const baseLabel = `${customer.birthdayDay} ${monthLabel}`.trim();
  return customer.birthdayYear ? `${baseLabel} ${customer.birthdayYear}` : baseLabel;
}

function formatBirthdayParts(day: number | null, month: number | null, year: number | null) {
  if (!day || !month) return 'Niet ingevuld';
  const monthLabel = MONTH_LABELS[month - 1] ?? '';
  const baseLabel = `${day} ${monthLabel}`.trim();
  return year ? `${baseLabel} ${year}` : baseLabel;
}

function primaryFirstName(customer: Pick<Customer, 'name' | 'partnerFirstName'>) {
  const normalized = customer.name.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Klant';
  const parts = normalized.split(' ');
  if (parts.length >= 3 && parts[1] === '&') return parts[0];
  return parts[0];
}

export function getCustomerBirthdayEntries(customer: Pick<Customer, 'name' | 'birthdayDay' | 'birthdayMonth' | 'birthdayYear' | 'partnerFirstName' | 'partnerBirthdayDay' | 'partnerBirthdayMonth' | 'partnerBirthdayYear'>): CustomerBirthdayEntry[] {
  const entries: CustomerBirthdayEntry[] = [];
  if (customer.birthdayDay && customer.birthdayMonth) {
    entries.push({
      owner: 'primary',
      personName: primaryFirstName(customer),
      day: customer.birthdayDay,
      month: customer.birthdayMonth,
      year: customer.birthdayYear ?? null,
    });
  }

  if (customer.partnerFirstName && customer.partnerBirthdayDay && customer.partnerBirthdayMonth) {
    entries.push({
      owner: 'partner',
      personName: customer.partnerFirstName,
      day: customer.partnerBirthdayDay,
      month: customer.partnerBirthdayMonth,
      year: customer.partnerBirthdayYear ?? null,
    });
  }

  return entries;
}

export function formatCustomerBirthdays(customer: Parameters<typeof getCustomerBirthdayEntries>[0]) {
  const entries = getCustomerBirthdayEntries(customer);
  if (entries.length === 0) return 'Niet ingevuld';
  return entries.map((entry) => `${entry.personName}: ${formatBirthdayParts(entry.day, entry.month, entry.year)}`).join(' | ');
}

export function buildSharedAccountName(currentName: string, partnerFirstName: string | null, previousPartnerFirstName?: string | null) {
  const normalizedName = currentName.trim().replace(/\s+/g, ' ');
  if (!normalizedName) return partnerFirstName ?? '';

  const parts = normalizedName.split(' ');
  let primary = parts[0];
  let lastName = parts.slice(1).join(' ');

  if (parts.length >= 3 && parts[1] === '&') {
    primary = parts[0];
    lastName = parts.slice(3).join(' ');
  } else if (previousPartnerFirstName) {
    const prefix = `${primary} & ${previousPartnerFirstName} `;
    if (normalizedName.toLowerCase().startsWith(prefix.toLowerCase())) {
      lastName = normalizedName.slice(prefix.length).trim();
    }
  }

  if (!partnerFirstName) {
    return [primary, lastName].filter(Boolean).join(' ');
  }

  return [primary, '&', partnerFirstName, lastName].filter(Boolean).join(' ');
}

export function getNextBirthdayDate(customer: Pick<Customer, 'birthdayDay' | 'birthdayMonth'>, now = new Date()) {
  if (!customer.birthdayDay || !customer.birthdayMonth) return null;
  return getNextBirthdayDateFromParts(customer.birthdayDay, customer.birthdayMonth, now);
}

export function getNextBirthdayDateFromParts(day: number | null, month: number | null, now = new Date()) {
  if (!day || !month) return null;

  const currentYear = now.getFullYear();
  const today = new Date(currentYear, now.getMonth(), now.getDate());
  let nextBirthday = new Date(currentYear, month - 1, day);

  if (nextBirthday.getMonth() !== month - 1 || nextBirthday.getDate() !== day) {
    nextBirthday = new Date(currentYear, 1, 28);
  }

  if (nextBirthday < today) {
    nextBirthday = new Date(currentYear + 1, nextBirthday.getMonth(), nextBirthday.getDate());
  }

  return nextBirthday;
}

export function hasCustomerBirthdayWithinWindow(customer: Parameters<typeof getCustomerBirthdayEntries>[0], now = new Date(), windowDays = 7) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return getCustomerBirthdayEntries(customer).some((entry) => {
    const date = getNextBirthdayDateFromParts(entry.day, entry.month, now);
    if (!date) return false;
    const daysUntil = Math.round((date.getTime() - today.getTime()) / MS_PER_DAY);
    return daysUntil >= 0 && daysUntil <= windowDays;
  });
}

export function getBirthdayReminderLabel(daysUntil: number) {
  if (daysUntil === 0) return 'Vandaag jarig';
  if (daysUntil === 1) return 'Morgen jarig';
  return `Over ${daysUntil} dagen jarig`;
}

export function getBirthdayReminders(customers: Customer[], now = new Date(), windowDays = 7): BirthdayReminder[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return customers
    .flatMap((customer) => getCustomerBirthdayEntries(customer).map((entry) => {
      const date = getNextBirthdayDateFromParts(entry.day, entry.month, now);
      if (!date) return null;
      const daysUntil = Math.round((date.getTime() - today.getTime()) / MS_PER_DAY);
      if (daysUntil < 0 || daysUntil > windowDays) return null;
      return {
        customer,
        owner: entry.owner,
        personName: entry.personName,
        date,
        daysUntil,
        label: getBirthdayReminderLabel(daysUntil),
        birthdayLabel: formatBirthdayParts(entry.day, entry.month, entry.year),
      } satisfies BirthdayReminder;
    }))
    .filter((item): item is BirthdayReminder => item !== null)
    .sort((left, right) => left.daysUntil - right.daysUntil || left.personName.localeCompare(right.personName, 'nl-BE') || left.customer.name.localeCompare(right.customer.name, 'nl-BE'));
}