import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors the `pair_price` widget of apps/api/src/modules/services/registry/crypto/crypto.service.ts.
export interface PairPriceData {
  /** `BTC/EUR`. */
  pair: string;
  price: number;
  /** Over the last 24 hours. */
  changePercent: number;
  high: number;
  low: number;
}

/** Not `style: "currency"`: quotes like USDT are not ISO currencies. */
export function formatPrice(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: value < 1 ? 6 : 2 });
}

export function formatChange(percent: number): string {
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)} %`;
}

export function ChangeBadge({ percent, period }: { percent: number; period: string }) {
  const up = percent >= 0;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-sm font-medium tabular-nums",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {formatChange(percent)}
      <span className="font-normal text-muted-foreground">{period}</span>
    </span>
  );
}

export function CryptoPrice({ data }: { data: PairPriceData }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{data.pair}</p>
      <p className="text-3xl font-semibold tabular-nums">{formatPrice(data.price)}</p>
      <ChangeBadge percent={data.changePercent} period="24h" />
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        High {formatPrice(data.high)} · Low {formatPrice(data.low)}
      </p>
    </div>
  );
}
