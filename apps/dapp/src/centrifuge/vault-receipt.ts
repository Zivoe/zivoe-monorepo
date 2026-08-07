import { type Address, type ContractEventName, type TransactionReceipt, parseAbi, parseEventLogs } from 'viem';

// The vault lifecycle events. Grows one event at a time as a consumer needs
// it — every receipt reader must go through `readVaultReceiptEvents` so
// vault-address filtering and event aggregation cannot drift between readers.
export const VAULT_LIFECYCLE_EVENTS_ABI = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event CancelRedeemClaim(address indexed controller, address indexed receiver, uint256 indexed requestId, address sender, uint256 shares)'
]);

export type VaultLifecycleEventName = ContractEventName<typeof VAULT_LIFECYCLE_EVENTS_ABI>;

/**
 * Reads the transacted vault's `eventName` logs out of a confirmed receipt,
 * filtered to that vault's address — a receipt can only ever be decoded
 * against the vault it was transacted on. Pure viem — server-importable.
 */
export function readVaultReceiptEvents<TEventName extends VaultLifecycleEventName>({
  receipt,
  eventName,
  vaultAddress
}: {
  receipt: TransactionReceipt;
  eventName: TEventName;
  vaultAddress: Address;
}) {
  const logs = parseEventLogs({ abi: VAULT_LIFECYCLE_EVENTS_ABI, eventName, logs: receipt.logs });

  return logs.filter((log) => log.address.toLowerCase() === vaultAddress.toLowerCase()).map((log) => log.args);
}
