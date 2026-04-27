import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { Authors } from './src/collections/authors';
import { Categories } from './src/collections/categories';
import { InsightsPosts } from './src/collections/insights-posts';
import { Media } from './src/collections/media';
import { Users } from './src/collections/users';
import { env, getCmsServerUrl } from './src/env';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const r2PublicBaseUrl = env.R2_PUBLIC_URL.replace(/\/$/, '');

function buildPublicMediaUrl(filename: string, prefix?: string) {
  const segments = [prefix, filename]
    .filter((segment): segment is string => Boolean(segment))
    .flatMap((segment) => segment.split('/'))
    .map((segment) => encodeURIComponent(segment));

  return `${r2PublicBaseUrl}/${segments.join('/')}`;
}

export default buildConfig({
  admin: {
    importMap: {
      baseDir: dirname,
      importMapFile: path.resolve(dirname, 'src/app/(payload)/importMap.ts')
    },
    meta: {
      titleSuffix: ' | Zivoe CMS'
    },
    user: Users.slug
  },
  collections: [Users, Authors, Categories, Media, InsightsPosts],
  db: postgresAdapter({
    migrationDir: path.resolve(dirname, 'src/migrations'),
    pool: {
      connectionString: env.DATABASE_URL
    }
  }),
  plugins: [
    s3Storage({
      bucket: env.R2_BUCKET,
      collections: {
        media: {
          generateFileURL: ({ filename, prefix }) => buildPublicMediaUrl(filename, prefix)
        }
      },
      config: {
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY
        },
        endpoint: env.R2_ENDPOINT,
        forcePathStyle: true,
        region: 'auto'
      },
      disableLocalStorage: true
    })
  ],
  routes: {
    admin: '/admin',
    api: '/api'
  },
  secret: env.PAYLOAD_SECRET,
  serverURL: getCmsServerUrl(),
  sharp,
  telemetry: false,
  typescript: {
    declare: false,
    outputFile: path.resolve(dirname, '../../packages/cms-types/src/payload-types.ts')
  },
  upload: {
    abortOnLimit: true,
    limits: {
      fileSize: 10 * 1024 * 1024
    },
    responseOnLimit: 'Image is too large. Maximum size is 10 MB.'
  }
});
