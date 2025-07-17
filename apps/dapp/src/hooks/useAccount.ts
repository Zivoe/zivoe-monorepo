import { useAccount as useWagmiAccount } from 'wagmi';

export const useAccount = () => {
  const { status, address } = useWagmiAccount();

  return {
    isLoading: status === 'connecting' || status === 'reconnecting',
    isDisconnected: status === 'disconnected',
    address: status === 'connected' && address ? address : undefined
  };
};
