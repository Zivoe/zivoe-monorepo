import { ReactNode, Suspense } from 'react';

import { connection } from 'next/server';

import Providers from '../_components/providers';

// TODO
export default function Deposit() {
  return (
    <Suspense>
      <ProvidersWrapper>
        <div className="sticky top-14 hidden h-[432px] rounded-2xl bg-surface-elevated p-2 lg:block lg:min-w-[24.75rem] xl:min-w-[39.375rem]">
          <div className="p-4">
            <p className="text-h6 text-primary">Deposit & Earn</p>
          </div>
        </div>
      </ProvidersWrapper>
    </Suspense>
  );
}

async function ProvidersWrapper({ children }: { children: ReactNode }) {
  await connection();
  return <Providers>{children}</Providers>;
}
