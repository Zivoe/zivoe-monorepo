import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAccount as useAccountWagmi } from 'wagmi';

export const useAccount = () => {
  const { sdkHasLoaded } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  const { address } = useAccountWagmi();

  const isPending = !sdkHasLoaded || (isLoggedIn && !address);
  const isDisconnected = !isPending && (!isLoggedIn || !address);

  return {
    isPending,
    isDisconnected,
    address
  };
};
