import { type Address, createPublicClient, custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { describe, expect, it, vi } from 'vitest';

import { buildWalletLinkTypedData, toSignableTypedData } from './wallet-link-typed-data';

// Pins the viem behaviour the chain port relies on with `mode: 'eoa'`: a
// key's signature is settled by recovery alone, and a signature recovery
// cannot explain — a Safe's, a counterfactual wallet's — still goes to the
// chain and stands or falls by what the contract answers.

const signer = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const safe: Address = '0x1111111111111111111111111111111111111111';
const typedData = buildWalletLinkTypedData({
  chainId: sepolia.id,
  userId: 'user_1',
  address: signer.address,
  nonce: `0x${'ab'.repeat(32)}`,
  issuedAt: new Date('2026-10-18T00:00:00Z'),
  expiresAt: new Date('2026-10-19T00:00:00Z')
});

const clientWith = (answer: () => Promise<unknown>) => {
  const request = vi.fn(answer);
  return { request, client: createPublicClient({ chain: sepolia, transport: custom({ request }) }) };
};

describe("viem's verifyTypedData in eoa mode", () => {
  it("settles a key's signature by recovery, without a single RPC call", async () => {
    const { client, request } = clientWith(async () => {
      throw new Error('the RPC must not be asked');
    });
    const signature = await signer.signTypedData(toSignableTypedData(typedData));

    await expect(
      client.verifyTypedData({ address: signer.address, signature, mode: 'eoa', ...toSignableTypedData(typedData) })
    ).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('asks the chain about a signature recovery cannot explain, and takes its answer', async () => {
    // A Safe above threshold one hands back its owners' signatures; recovery
    // yields an owner, not the Safe, so the question goes to the contract.
    const signature = await signer.signTypedData(toSignableTypedData(typedData));
    const safeTypedData = { ...typedData, message: { ...typedData.message, wallet: safe } };

    const accepting = clientWith(async () => `0x${'0'.repeat(63)}1`);
    await expect(
      accepting.client.verifyTypedData({ address: safe, signature, mode: 'eoa', ...toSignableTypedData(safeTypedData) })
    ).resolves.toBe(true);
    expect(accepting.request).toHaveBeenCalledTimes(1);
    expect(accepting.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_call' }), undefined);

    const refusing = clientWith(async () => `0x${'0'.repeat(64)}`);
    await expect(
      refusing.client.verifyTypedData({ address: safe, signature, mode: 'eoa', ...toSignableTypedData(safeTypedData) })
    ).resolves.toBe(false);
  });
});
