import { type ContractEventName, type TransactionReceipt, parseAbi, parseEventLogs } from 'viem';

import { CENTRIFUGE_CONFIG } from './config';

// The configured vault's own lifecycle events. Grows one event at a time as a
// consumer needs it — every receipt reader in the app must go through
// `readVaultReceiptEvents` so filtering and aggregation policy cannot drift
// between the client decoders and the server Monitor.
export const VAULT_LIFECYCLE_EVENTS_ABI = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event CancelRedeemClaim(address indexed controller, address indexed receiver, uint256 indexed requestId, address sender, uint256 shares)'
]);

export type VaultLifecycleEventName = ContractEventName<typeof VAULT_LIFECYCLE_EVENTS_ABI>;

/**
 * Reads the configured vault's `eventName` logs out of a confirmed receipt,
 * already filtered to the vault's address. Pure viem + config — like
 * `config.ts`, this is server-importable.
 */
export function readVaultReceiptEvents<TEventName extends VaultLifecycleEventName>({
  receipt,
  eventName
}: {
  receipt: TransactionReceipt;
  eventName: TEventName;
}) {
  const logs = parseEventLogs({ abi: VAULT_LIFECYCLE_EVENTS_ABI, eventName, logs: receipt.logs });

  return logs
    .filter((log) => log.address.toLowerCase() === CENTRIFUGE_CONFIG.vaultAddress.toLowerCase())
    .map((log) => log.args);
}
