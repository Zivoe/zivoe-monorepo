import configPromise from '@payload-config';
import { RootPage, generatePageMetadata } from '@payloadcms/next/views';

import { importMap } from '../../importMap';

type PageProps = {
  params: Promise<{
    segments: Array<string>;
  }>;
  searchParams: Promise<Record<string, string | Array<string>>>;
};

export const generateMetadata = ({ params, searchParams }: PageProps) =>
  generatePageMetadata({
    config: configPromise,
    params,
    searchParams
  });

export default async function Page({ params, searchParams }: PageProps) {
  return <RootPage config={configPromise} importMap={importMap} params={params} searchParams={searchParams} />;
}
