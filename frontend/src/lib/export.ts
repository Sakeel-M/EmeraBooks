// Export utilities for CSV, PDF, and Excel formats
import { replaceAedSymbol } from "@/lib/utils";

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);

  // Sanitize a cell value to prevent CSV formula injection (=, +, -, @, \t, \r prefixes)
  const sanitizeCell = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Wrap in quotes if contains comma, quote, or newline
    const needsQuotes = str.includes(',') || str.includes('"') || str.includes('\n');
    // Prefix with a single quote if starts with formula-triggering characters
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return needsQuotes ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => sanitizeCell(row[header])).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

export function exportToJSON(data: any[], filename: string) {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return replaceAedSymbol(
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount),
    currency
  );
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
