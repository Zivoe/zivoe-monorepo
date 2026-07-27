import { RawContractError, encodeErrorResult, parseAbi, stringToHex } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/utils';

import { createSimulationSigner } from './simulate';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) }));

const ERROR_COPY = {
  TransferBlocked: 'Wallet is restricted right now.',
  Paused: 'Protocol is paused. Try again later.',
  ExceedsMaxDeposit: 'Vault cannot accept that deposit.'
};

const SEND_TX = {
  method: 'eth_sendTransaction',
  params: [
    {
      from: '0xa28ef80d690844b586e192690d8fcdaecfd0281e',
      to: '0x792676c9b261b80bc3d7dd0f2d3a83d91a819bcd',
      data: '0xdeadbeef',
      value: '0x0'
    }
  ]
};

const revertingWith = (data: `0x${string}`) => ({ call: vi.fn().mockRejectedValue(new RawContractError({ data })) });

const TEST_ERROR_ABI = parseAbi([
  'error TransferBlocked()',
  'error Paused()',
  'error WrappedError(address target, bytes4 selector, bytes reason, bytes details)'
]);

const encodeRevert = (errorName: 'TransferBlocked' | 'Paused' | 'WrappedError', args: ReadonlyArray<unknown> = []) =>
  encodeErrorResult({ abi: TEST_ERROR_ABI, errorName, args: args as never });

function signerWith(simulationClient: { call: ReturnType<typeof vi.fn> }) {
  const walletRequest = vi.fn().mockResolvedValue('0xhash');
  const signer = createSimulationSigner({
    walletClient: { request: walletRequest },
    simulationClient,
    errorCopy: ERROR_COPY
  });
  return { signer, walletRequest };
}

describe('createSimulationSigner', () => {
  it('maps a decoded hook revert to the flow copy and never reaches the wallet', async () => {
    const { signer, walletRequest } = signerWith(revertingWith(encodeRevert('TransferBlocked')));

    await expect(signer.request(SEND_TX)).rejects.toMatchObject({ message: ERROR_COPY.TransferBlocked });
    expect(walletRequest).not.toHaveBeenCalled();
  });

  it('maps a decoded gateway revert to the flow copy', async () => {
    const { signer } = signerWith(revertingWith(encodeRevert('Paused')));

    await expect(signer.request(SEND_TX)).rejects.toMatchObject({ message: ERROR_COPY.Paused });
  });

  it('decodes the innermost error out of nested WrappedError reasons', async () => {
    const inner = encodeRevert('TransferBlocked');
    const wrapped = encodeRevert('WrappedError', [
      '0x792676c9b261b80bc3d7dd0f2d3a83d91a819bcd',
      '0x6e400700',
      inner,
      '0x'
    ]);
    const { signer } = signerWith(revertingWith(wrapped));

    await expect(signer.request(SEND_TX)).rejects.toMatchObject({ message: ERROR_COPY.TransferBlocked });
  });

  it('surfaces Error(string) reasons verbatim', async () => {
    const data = encodeErrorResult({
      abi: parseAbi(['error Error(string)']),
      errorName: 'Error',
      args: ['ERC20: transfer amount exceeds balance']
    });
    const { signer } = signerWith(revertingWith(data));

    await expect(signer.request(SEND_TX)).rejects.toMatchObject({
      message: 'Simulation error: ERC20: transfer amount exceeds balance'
    });
  });

  it('fails closed with generic copy on an unknown selector', async () => {
    const { signer, walletRequest } = signerWith(
      revertingWith(stringToHex('garbage-selector').slice(0, 10) as `0x${string}`)
    );

    await expect(signer.request(SEND_TX)).rejects.toMatchObject({ message: 'Simulation error' });
    expect(walletRequest).not.toHaveBeenCalled();
  });

  it('fails closed with generic copy when the RPC errors without revert data', async () => {
    const { signer, walletRequest } = signerWith({ call: vi.fn().mockRejectedValue(new Error('fetch failed')) });

    const rejection = expect(signer.request(SEND_TX)).rejects;
    await rejection.toBeInstanceOf(AppError);
    await rejection.toMatchObject({ message: 'Simulation error' });
    expect(walletRequest).not.toHaveBeenCalled();
  });

  it('forwards the exact send to the wallet when the simulation is clean', async () => {
    const simulationClient = { call: vi.fn().mockResolvedValue({ data: '0x' }) };
    const { signer, walletRequest } = signerWith(simulationClient);

    await expect(signer.request(SEND_TX)).resolves.toBe('0xhash');
    expect(simulationClient.call).toHaveBeenCalledWith(
      expect.objectContaining({
        account: SEND_TX.params[0]!.from,
        to: SEND_TX.params[0]!.to,
        data: SEND_TX.params[0]!.data,
        value: 0n
      })
    );
    expect(walletRequest).toHaveBeenCalledWith(SEND_TX);
  });

  it('passes every other method through without simulating', async () => {
    const simulationClient = { call: vi.fn() };
    const { signer, walletRequest } = signerWith(simulationClient);

    await signer.request({ method: 'eth_chainId' });

    expect(simulationClient.call).not.toHaveBeenCalled();
    expect(walletRequest).toHaveBeenCalledWith({ method: 'eth_chainId' });
  });
});
