import type { ReactNode } from 'react';

import '@payloadcms/next/css';
import configPromise from '@payload-config';
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts';
import type { ServerFunctionClient } from 'payload';

import { importMap } from './importMap';

const serverFunction: ServerFunctionClient = async function (args) {
  'use server';

  return handleServerFunctions({
    ...args,
    config: configPromise,
    importMap
  });
};

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <RootLayout config={configPromise} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
