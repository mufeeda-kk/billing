// Asia/Kolkata (IST) Date and Time Utilities

export function getNowIST(): Date {
  // Returns current date adjusted to IST representation
  return new Date();
}

export function formatDateIST(dateStrOrDate: string | Date | undefined): string {
  if (!dateStrOrDate) return 'N/A';
  const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
  if (isNaN(d.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

export function formatDateTimeIST(dateStrOrDate: string | Date | undefined): string {
  if (!dateStrOrDate) return 'N/A';
  const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
  if (isNaN(d.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

export function formatTimeIST(dateStrOrDate: string | Date | undefined): string {
  if (!dateStrOrDate) return 'N/A';
  const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
  if (isNaN(d.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount).replace('₹', '₹ ');
}

/**
 * Strict 7-Day Exchange Window Validator
 * Exchange is allowed strictly within 7 days of the original bill creation.
 */
export function checkExchangeEligibility(billDateStr: string | Date): {
  isEligible: boolean;
  daysPassed: number;
  daysRemaining: number;
  reason?: string;
  badgeColor: string;
} {
  const billDate = typeof billDateStr === 'string' ? new Date(billDateStr) : billDateStr;
  const now = new Date();

  if (isNaN(billDate.getTime())) {
    return { isEligible: false, daysPassed: 999, daysRemaining: 0, reason: 'Invalid bill date', badgeColor: 'bg-red-100 text-red-800' };
  }

  // Calculate difference in milliseconds and convert to floating days
  const diffMs = now.getTime() - billDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const daysPassed = Math.floor(diffDays);
  const daysRemaining = Math.max(0, 7 - daysPassed);

  if (diffDays > 7.0) {
    return {
      isEligible: false,
      daysPassed,
      daysRemaining: 0,
      reason: `Exchange window expired (${daysPassed} days since purchase). Policy allows exchange within 7 days only.`,
      badgeColor: 'bg-red-100 text-red-700'
    };
  }

  return {
    isEligible: true,
    daysPassed,
    daysRemaining,
    reason: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining for exchange`,
    badgeColor: daysRemaining <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
  };
}
