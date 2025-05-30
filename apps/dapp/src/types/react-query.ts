import '@tanstack/react-query';

interface IMeta extends Record<string, unknown> {
  skipErrorToast?: boolean;
  toastErrorMessage?: string;
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: IMeta;
    mutationMeta: IMeta;
  }
}
