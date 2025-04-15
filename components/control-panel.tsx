"use client"

import { useLiquidation } from "@/context/liquidation-context"
import { SeasonalityPanel } from "@/components/seasonality-panel"

export function ControlPanel() {
  const { lpi, lio, tradingSignals, timeframe, currentPrice, selectedPair } = useLiquidation()

  // Find entry and exit prices from trading signals
  const entrySignal = tradingSignals.find((signal) => signal.type === "entry")
  const exitSignal = tradingSignals.find((signal) => signal.type === "exit")

  const entryPrice = entrySignal ? entrySignal.price : currentPrice * 0.95
  const exitPrice = exitSignal ? exitSignal.price : currentPrice * 1.05

  // Format prices based on magnitude
  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } else if (price >= 1) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    } else if (price >= 0.1) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
    } else if (price >= 0.01) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })
    } else if (price >= 0.001) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 7, maximumFractionDigits: 7 })
    } else {
      return price.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })
    }
  }

  // Extract base asset from pair (e.g., "BTC" from "BTCUSDT")
  const baseAsset = selectedPair.replace("USDT", "")

  // Get LPI color
  const getLpiColor = () => {
    if (lpi < 30) return "bg-green-500"
    if (lpi < 70) return "bg-yellow-500"
    return "bg-red-500"
  }

  // Get LIO color
  const getLioColor = () => {
    if (lio < 40) return "bg-red-500" // Long liquidations dominant (bearish)
    if (lio > 60) return "bg-green-500" // Short liquidations dominant (bullish)
    return "bg-yellow-500" // Balanced
  }

  // Get cascade risk
  const getCascadeRisk = () => {
    if (lpi > 70 && (lio < 30 || lio > 70)) return { text: "High", color: "bg-red-500" }
    if (lpi > 50 && (lio < 40 || lio > 60)) return { text: "Medium", color: "bg-yellow-500" }
    return { text: "Low", color: "bg-green-500" }
  }

  const cascadeRisk = getCascadeRisk()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SeasonalityPanel />

      {/* Trading Signals */}
      <div className="bg-[#1e2538] rounded-lg p-4">
        <h2 className="text-lg font-bold mb-4">Trading Signals</h2>

        <div className="space-y-2">
          <div className="p-3 rounded bg-[#121826] border-l-4 border-[#10b981]">
            <div className="font-medium text-[#10b981]">
              BUY {baseAsset} @ {formatPrice(entryPrice)}
            </div>
            <div className="text-sm text-muted-foreground">Strong Support Zone</div>
          </div>
          <div className="p-3 rounded bg-[#121826] border-l-4 border-[#ef4444]">
            <div className="font-medium text-[#ef4444]">
              SELL {baseAsset} @ {formatPrice(exitPrice)}
            </div>
            <div className="text-sm text-muted-foreground">Liquidation Wall</div>
          </div>
        </div>
      </div>
    </div>
  )
}
