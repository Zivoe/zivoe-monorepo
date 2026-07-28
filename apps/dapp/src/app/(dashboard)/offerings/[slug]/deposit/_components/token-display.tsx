import { type Token } from '@/types/constants';

import { TOKEN_INFO } from '@/components/token-info';

export function TokenDisplay({ symbol }: { symbol: Token }) {
  return (
    <div className="flex items-center gap-2 [&_svg]:size-6">
      {TOKEN_INFO[symbol].icon}
      <p className="text-small font-medium! text-primary">{symbol}</p>
    </div>
  );
}
