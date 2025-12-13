import { AppShell } from '@/components/app-shell';
import { verifySession } from '@/server/data/auth';

import Home from './home';
import { depositPageViewSchema } from './home/deposit/_utils';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await verifySession();

  const params = await searchParams;
  const validatedView = depositPageViewSchema.safeParse(params.view);

  return (
    <AppShell>
      <Home initialView={validatedView.success ? validatedView.data : null} />
    </AppShell>
  );
}
