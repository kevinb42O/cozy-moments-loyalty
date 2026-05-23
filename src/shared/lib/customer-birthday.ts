import type { Customer } from '../store/LoyaltyContext';

export interface CustomerBirthdayInput {
  day: number | null;
  month: number | null;
  year?: number | null;
}

export interface BirthdayReminder {
  customer: Customer;
  date: Date;
  daysUntil: number;
  label: string;
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

export function formatCustomerBirthday(customer: Pick<Customer, 'birthdayDay' | 'birthdayMonth' | 'birthdayYear'>) {
  if (!customer.birthdayDay || !customer.birthdayMonth) return 'Niet ingevuld';
  const monthLabel = MONTH_LABELS[customer.birthdayMonth - 1] ?? '';
  const baseLabel = `${customer.birthdayDay} ${monthLabel}`.trim();
  return customer.birthdayYear ? `${baseLabel} ${customer.birthdayYear}` : baseLabel;
}

export function getNextBirthdayDate(customer: Pick<Customer, 'birthdayDay' | 'birthdayMonth'>, now = new Date()) {
  if (!customer.birthdayDay || !customer.birthdayMonth) return null;

  const currentYear = now.getFullYear();
  const today = new Date(currentYear, now.getMonth(), now.getDate());
  let nextBirthday = new Date(currentYear, customer.birthdayMonth - 1, customer.birthdayDay);

  if (nextBirthday.getMonth() !== customer.birthdayMonth - 1 || nextBirthday.getDate() !== customer.birthdayDay) {
    nextBirthday = new Date(currentYear, 1, 28);
  }

  if (nextBirthday < today) {
    nextBirthday = new Date(currentYear + 1, nextBirthday.getMonth(), nextBirthday.getDate());
  }

  return nextBirthday;
}

export function getBirthdayReminderLabel(daysUntil: number) {
  if (daysUntil === 0) return 'Vandaag jarig';
  if (daysUntil === 1) return 'Morgen jarig';
  return `Over ${daysUntil} dagen jarig`;
}

export function getBirthdayReminders(customers: Customer[], now = new Date(), windowDays = 7): BirthdayReminder[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return customers
    .map((customer) => {
      const date = getNextBirthdayDate(customer, now);
      if (!date) return null;
      const daysUntil = Math.round((date.getTime() - today.getTime()) / MS_PER_DAY);
      if (daysUntil < 0 || daysUntil > windowDays) return null;
      return {
        customer,
        date,
        daysUntil,
        label: getBirthdayReminderLabel(daysUntil),
      } satisfies BirthdayReminder;
    })
    .filter((item): item is BirthdayReminder => item !== null)
    .sort((left, right) => left.daysUntil - right.daysUntil || left.customer.name.localeCompare(right.customer.name, 'nl-BE'));
}