import type { Access, PayloadRequest } from 'payload';

import { env } from '@/env';

type CmsUser = {
  role?: 'admin' | 'editor';
};

const getUserRole = (req: PayloadRequest) => (req.user as CmsUser | null | undefined)?.role;

export const isAdmin: Access = ({ req }) => getUserRole(req) === 'admin';

export const isAdminOrEditor: Access = ({ req }) => {
  const role = getUserRole(req);
  return role === 'admin' || role === 'editor';
};

export const hasCmsAccess = ({ req }: { req: PayloadRequest }) => {
  const role = getUserRole(req);
  return role === 'admin' || role === 'editor';
};

export const canReadPublishedInsights: Access = ({ req }) => {
  if (req.user) return true;
  if (req.headers.get('x-preview-secret') === env.INSIGHTS_PREVIEW_SECRET) return true;

  return {
    _status: {
      equals: 'published'
    }
  };
};
