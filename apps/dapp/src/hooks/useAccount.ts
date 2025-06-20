import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { Address } from 'viem';

export const useAccount = () => {
  const { sdkHasLoaded, primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();

  const isPending = !sdkHasLoaded;
  const isDisconnected = !isPending && !isLoggedIn;

  return {
    isPending,
    isDisconnected,
    address: !isPending && !isDisconnected ? (primaryWallet?.address as Address) : undefined
  };
};
