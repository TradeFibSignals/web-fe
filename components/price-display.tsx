"use client"

import { useLiquidation } from "@/context/liquidation-context"

export function PriceDisplay() {
  const { currentPrice, priceChangePercent } = useLiquidation()
  const isPriceUp = priceChangePercent >= 0

  return (
    <div className="flex items-center gap-2 bg-[#121826] px-3 py-2 rounded-lg">
      <span className="font-medium">
        $
        {currentPrice >= 1000
          ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : currentPrice >= 1
            ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
            : currentPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
      </span>
      <span className={`text-sm ${isPriceUp ? "text-success" : "text-destructive"}`}>
        {isPriceUp ? "+" : ""}
        {priceChangePercent.toFixed(2)}%
      </span>
    </div>
  )
}
