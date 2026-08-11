import { type Address, type ContractEventName, type TransactionReceipt, parseAbi, parseEventLogs } from 'viem';

// The Centrifuge-vault lifecycle events. Grows one event at a time as a consumer needs
// it — every receipt reader must go through `readCentrifugeVaultReceiptEvents` so
// Centrifuge-vault-address filtering and event aggregation cannot drift between readers.
export const CENTRIFUGE_VAULT_LIFECYCLE_EVENTS_ABI = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event CancelRedeemClaim(address indexed controller, address indexed receiver, uint256 indexed requestId, address sender, uint256 shares)'
]);

export type CentrifugeVaultLifecycleEventName = ContractEventName<typeof CENTRIFUGE_VAULT_LIFECYCLE_EVENTS_ABI>;

/**
 * Reads the transacted Centrifuge vault's `eventName` logs out of a confirmed receipt,
 * filtered to that Centrifuge vault's address — a receipt can only ever be decoded
 * against the Centrifuge vault it was transacted on. Pure viem — server-importable.
 */
export function readCentrifugeVaultReceiptEvents<TEventName extends CentrifugeVaultLifecycleEventName>({
  receipt,
  eventName,
  centrifugeVaultAddress
}: {
  receipt: TransactionReceipt;
  eventName: TEventName;
  centrifugeVaultAddress: Address;
}) {
  const logs = parseEventLogs({ abi: CENTRIFUGE_VAULT_LIFECYCLE_EVENTS_ABI, eventName, logs: receipt.logs });

  return logs
    .filter((log) => log.address.toLowerCase() === centrifugeVaultAddress.toLowerCase())
    .map((log) => log.args);
}
