"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChangeBadge, formatPrice } from "./crypto-price";
import { formatDay } from "./format";

// Mirrors the `price_history` widget of apps/api/src/modules/services/registry/crypto/crypto.service.ts.
export interface PriceHistoryData {
  /** `BTC/EUR`. */
  pair: string;
  /** One closing price per day, oldest first. */
  points: { date: string; close: number }[];
}

const chartConfig = {
  close: { label: "Close", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function CryptoHistory({ data }: { data: PriceHistoryData }) {
  const { points } = data;
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No price for this pair yet.</p>;
  }

  const first = points[0].close;
  const last = points[points.length - 1].close;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{data.pair}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatPrice(last)}</p>
        <ChangeBadge percent={((last - first) / first) * 100} period={`${points.length} days`} />
      </div>
      {/* Fills the card, but keeps a readable height in a preview. */}
      <ChartContainer config={chartConfig} className="aspect-auto min-h-40 w-full flex-1">
        <AreaChart data={points} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={(date: string) => formatDay(date)}
          />
          {/* Not from 0: a curve between 70 000 and 75 000 would look flat. */}
          <YAxis hide domain={["auto", "auto"]} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) => formatDay(String(payload[0]?.payload?.date ?? ""))}
              />
            }
          />
          <Area
            dataKey="close"
            type="monotone"
            stroke="var(--color-close)"
            fill="var(--color-close)"
            fillOpacity={0.15}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
