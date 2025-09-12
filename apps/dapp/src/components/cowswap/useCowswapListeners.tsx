'use client';

import { usePostHog } from 'posthog-js/react';

enum CowEvents {
  ON_TOAST_MESSAGE = 'ON_TOAST_MESSAGE',
  ON_POSTED_ORDER = 'ON_POSTED_ORDER',
  ON_FULFILLED_ORDER = 'ON_FULFILLED_ORDER',
  ON_CANCELLED_ORDER = 'ON_CANCELLED_ORDER',
  ON_EXPIRED_ORDER = 'ON_EXPIRED_ORDER',
  ON_PRESIGNED_ORDER = 'ON_PRESIGNED_ORDER',
  ON_ONCHAIN_TRANSACTION = 'ON_ONCHAIN_TRANSACTION',
  ON_CHANGE_TRADE_PARAMS = 'ON_CHANGE_TRADE_PARAMS',
  ON_BRIDGING_SUCCESS = 'ON_BRIDGING_SUCCESS'
}

export function useCowswapListeners() {
  const posthog = usePostHog();

  const capture = (eventName: string) => (payload: any) => {
    posthog.capture(eventName, payload);
  };

  const listeners = [
    {
      event: CowEvents.ON_POSTED_ORDER,
      handler: capture('cowswap_order_posted')
    },
    {
      event: CowEvents.ON_FULFILLED_ORDER,
      handler: capture('cowswap_order_fulfilled')
    },
    {
      event: CowEvents.ON_CANCELLED_ORDER,
      handler: capture('cowswap_order_cancelled')
    },
    {
      event: CowEvents.ON_EXPIRED_ORDER,
      handler: capture('cowswap_order_expired')
    },
    {
      event: CowEvents.ON_PRESIGNED_ORDER,
      handler: capture('cowswap_order_presigned')
    }
  ];

  return { listeners };
}
