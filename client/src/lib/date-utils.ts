import { format, formatDistanceToNow, isToday, isSameDay, parseISO } from "date-fns";

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "MMM d, yyyy");
}

export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "MMM d, yyyy h:mm a");
}

export function formatTimeAgo(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  
  if (isToday(dateObj)) {
    return formatDistanceToNow(dateObj, { addSuffix: true });
  }
  
  return format(dateObj, "MMM d, yyyy");
}

export function formatDob(month: number, day: number): string {
  // Create a date with the current year
  const date = new Date();
  date.setMonth(month - 1);
  date.setDate(day);
  
  return format(date, "MM/dd");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRate(rate: number | null | undefined): string {
  // If rate is null, undefined, or 0, return "N/A" instead of formatting it
  if (rate === null || rate === undefined || rate === 0) {
    return "N/A";
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rate) + "/hr";
}

export function isDateEqual(date1: string | Date, date2: string | Date): boolean {
  const dateObj1 = typeof date1 === "string" ? new Date(date1) : date1;
  const dateObj2 = typeof date2 === "string" ? new Date(date2) : date2;
  
  return isSameDay(dateObj1, dateObj2);
}
