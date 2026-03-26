import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { type Address, isAddress } from 'viem';

export const useAccount = () => {
  const { sdkHasLoaded, primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();

  const isPending = !sdkHasLoaded;
  const isDisconnected = !isPending && !isLoggedIn;
  const walletAddress = primaryWallet?.address;
  const address: Address | undefined =
    !isPending && !isDisconnected && walletAddress && isAddress(walletAddress) ? walletAddress : undefined;

  return {
    isPending,
    isDisconnected,
    address
  };
};
