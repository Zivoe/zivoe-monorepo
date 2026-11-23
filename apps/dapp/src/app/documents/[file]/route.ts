import { type NextRequest, NextResponse } from 'next/server';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { auth } from '@/server/auth';
import { isKycEnabled } from '@/server/verification/kyc-flag';

import { DOCUMENT_FILES } from '@/app/verification/verification-documents';

/**
 * The confidential PDFs `/verification` links to, from `apps/dapp/documents/` (not `public/`, which anyone
 * with any session cookie could read: the proxy only checks that one is present). Served to a valid session
 * the `kyc` flag is on for; a signed-out visitor goes to sign-in, anyone else and any other name get a 404.
 * `next.config.ts` traces the folder into the deployment.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!DOCUMENT_FILES.has(file)) return new NextResponse(null, { status: 404 });

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.redirect(new URL('/sign-in', req.url));
  if (!(await isKycEnabled({ user: session.user }))) return new NextResponse(null, { status: 404 });

  const pdf = await readFile(path.join(process.cwd(), 'documents', file));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex'
    }
  });
}
