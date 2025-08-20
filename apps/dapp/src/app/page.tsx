import Home from './home';
import { depositPageViewSchema } from './home/deposit/_utils';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const validatedView = depositPageViewSchema.parse(params.view);

  return <Home initialView={validatedView} />;
}
