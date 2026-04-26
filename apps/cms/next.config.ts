import { withPayload } from '@payloadcms/next/withPayload';
import type { NextConfig } from 'next';

import './src/env';

const nextConfig: NextConfig = {};

export default withPayload(nextConfig);
