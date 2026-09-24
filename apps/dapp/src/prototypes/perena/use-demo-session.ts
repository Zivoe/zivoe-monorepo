'use client';

import { useEffect, useReducer, useState } from 'react';

import { PERENA_DEMO } from './config';
import { type DemoTab, demoReducer, initialDemoState, restoreDemoSession, serializeDemoSession } from './state';

export function useDemoSession(initialTab: DemoTab) {
  const [state, dispatch] = useReducer(demoReducer, initialTab, initialDemoState);
  const [ready, setReady] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    try {
      dispatch({ type: 'restore', state: restoreDemoSession(sessionStorage.getItem(PERENA_DEMO.storageKey)) });
    } catch {
      setStorageUnavailable(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(PERENA_DEMO.storageKey, serializeDemoSession(state));
    } catch {
      setStorageUnavailable(true);
    }
  }, [ready, state]);

  useEffect(() => {
    if (state.stage !== 'processing' || !state.transaction) return;
    const id = state.transaction.id;
    const timer = setTimeout(() => dispatch({ type: 'complete', id }), PERENA_DEMO.processingMs);
    return () => clearTimeout(timer);
  }, [state.stage, state.transaction]);

  return { state, dispatch, ready, storageUnavailable };
}
