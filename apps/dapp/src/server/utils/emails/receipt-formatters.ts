const UTC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Indexer event times arrive as epoch milliseconds. */
export function formatEventTimestampUtc(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return '-';
  const date = new Date(timestampMs);

  const month = UTC_MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());

  return `${month} ${day}, ${year} ${hour}:${minute} UTC`;
}

export function truncateMiddle(value: string, prefixLength = 6, suffixLength = 4): string {
  if (!value) return '';
  if (value.length <= prefixLength + suffixLength + 3) return value;
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}

export function truncateWalletAddress(walletAddress: string): string {
  return truncateMiddle(walletAddress);
}

export function truncateTransactionHash(txHash: string): string {
  return truncateMiddle(txHash);
}
