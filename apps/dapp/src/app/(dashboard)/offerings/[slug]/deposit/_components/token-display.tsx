import { getTokenInfo } from '@/components/token-info';

/** Renders a runtime symbol — the page's Offering decides which share token appears. */
export function TokenDisplay({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center gap-2 [&_svg]:size-6">
      {getTokenInfo(symbol)?.icon}
      <p className="text-small font-medium! text-primary">{symbol}</p>
    </div>
  );
}
