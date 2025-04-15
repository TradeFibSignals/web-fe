"use client"

import { CandlestickChart } from "@/components/candlestick-chart"
import { useLiquidation } from "@/context/liquidation-context"
import { useEffect } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { binanceWebSocket } from "@/lib/websocket-service"
import { SeasonalityPanel } from "@/components/seasonality-panel"
import { SignalsPanel } from "@/components/signals-panel"
import { CryptoNewsPanel } from "@/components/crypto-news-panel"
import { Footer } from "@/components/footer"
import { HeaderNav } from "@/components/header-nav"
import { PriceDisplay } from "@/components/price-display"
import { CurrentCandlesPanel } from "@/components/current-candles-panel"

export function Dashboard() {
  const {
    fetchData,
    selectedPair,
    setSelectedPair,
    availablePairs,
    isLoading,
    lastUpdated,
    refreshData,
    timeframe,
    setTimeframe,
    currentPrice,
    priceChangePercent,
    nextUpdateTime,
    historicalCandles,
    tradingSignals,
  } = useLiquidation()

  // Extract base asset from pair (e.g., "BTC" from "BTCUSDT")
  const baseAsset = selectedPair.replace("USDT", "")

  useEffect(() => {
    // Fetch data immediately on load
    fetchData()
  }, [fetchData])

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

  const isPriceUp = priceChangePercent >= 0
  const isWebSocketConnected = binanceWebSocket.isConnected()
  const hasHistoricalData = historicalCandles && historicalCandles.length > 0

  // Find entry and exit prices from trading signals
  const entrySignal = tradingSignals.find((signal) => signal.type === "entry")
  const exitSignal = tradingSignals.find((signal) => signal.type === "exit")

  const entryPrice = entrySignal ? entrySignal.price : currentPrice * 0.95
  const exitPrice = exitSignal ? exitSignal.price : currentPrice * 1.05

  return (
    <div className="min-h-screen bg-[#1a1f2e]">
      <div className="sticky top-0 z-50 w-full">
        <HeaderNav />
        <div className="container mx-auto flex justify-end py-2">
          <PriceDisplay />
        </div>
      </div>
      <div className="p-4">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4">
            {/* ICT Liquidity Levels Chart with Candlesticks */}
            <div className="bg-[#1e2538] rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">ICT Liquidity Levels</h2>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Liquidity levels are displayed as horizontal lines starting from their formation point.</p>
                        <p className="mt-1">Green lines represent Sellside Liquidity levels.</p>
                        <p className="mt-1">Red lines represent Buyside Liquidity levels.</p>
                        <p className="mt-1">Solid lines are major levels, dashed lines are minor levels.</p>
                        <p className="mt-1">
                          Levels that have been traded through by candle bodies are automatically removed.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <CandlestickChart />
            </div>

            {/* Settings Panel - Full Width */}
            <div className="bg-[#1e2538] rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm mb-2">Pair:</label>
                  <select
                    value={selectedPair}
                    onChange={(e) => setSelectedPair(e.target.value)}
                    className="w-full bg-[#121826] text-foreground p-2 rounded"
                  >
                    {availablePairs.map((pair) => (
                      <option key={pair} value={pair}>
                        {pair.replace("USDT", "")} Perpetual
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-2">Timeframe:</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as any)}
                    className="w-full bg-[#121826] text-foreground p-2 rounded"
                  >
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="30m">30m</option>
                    <option value="1h">1h</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Current Candles Panel */}
            <CurrentCandlesPanel />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SeasonalityPanel />
              <SignalsPanel />
            </div>

            {/* Crypto News Panel */}
            <CryptoNewsPanel />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
