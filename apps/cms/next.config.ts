import type { NextConfig } from 'next';

import { withPayload } from '@payloadcms/next/withPayload';

import './src/env';

const nextConfig: NextConfig = {};

export default withPayload(nextConfig);
