type DemoEnvironment = {
  enabled?: string;
  nodeEnv?: string;
  publicEnv?: string;
  vercel?: string;
  vercelEnv?: string;
};

export function isPerenaDemoAllowed(environment: DemoEnvironment) {
  const { enabled, nodeEnv, publicEnv, vercel, vercelEnv } = environment;
  if (enabled !== 'true' || publicEnv === 'production' || vercelEnv === 'production') return false;

  const localDevelopment = nodeEnv === 'development' && vercel !== '1' && (!vercelEnv || vercelEnv === 'development');
  const vercelPreview = vercel === '1' && vercelEnv === 'preview';
  return localDevelopment || vercelPreview;
}
