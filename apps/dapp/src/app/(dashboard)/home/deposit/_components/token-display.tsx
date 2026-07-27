import { UsdcIcon, ZMcaLogo } from '@zivoe/ui/icons';

type TokenSymbol = 'zMCA' | 'USDC';

const TOKEN_ICONS: Record<TokenSymbol, React.ReactNode> = {
  zMCA: <ZMcaLogo />,
  USDC: <UsdcIcon />
};

export function TokenDisplay({ symbol }: { symbol: TokenSymbol }) {
  const icon = TOKEN_ICONS[symbol];

  return (
    <div className="flex items-center gap-2 [&_svg]:size-6">
      {icon}
      <p className="text-small font-medium! text-primary">{symbol}</p>
    </div>
  );
}
