"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchTimeframeCandles } from "@/lib/binance-api"
import { useLiquidation } from "@/context/liquidation-context"
import { Loader2, BarChart3 } from "lucide-react"

interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function CurrentCandlesPanel() {
  const { selectedPair } = useLiquidation()
  const [monthlyCandle, setMonthlyCandle] = useState<CandleData | null>(null)
  const [dailyCandle, setDailyCandle] = useState<CandleData | null>(null)
  const [monthlyAvgVolume, setMonthlyAvgVolume] = useState<number>(0)
  const [dailyAvgVolume, setDailyAvgVolume] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const monthlyCanvasRef = useRef<HTMLCanvasElement>(null)
  const dailyCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function fetchCandles() {
      setLoading(true)
      try {
        // Fetch monthly candles (last 20)
        const monthlyCandles = await fetchTimeframeCandles(selectedPair, "1M", 20)
        if (monthlyCandles.length > 0) {
          setMonthlyCandle(monthlyCandles[monthlyCandles.length - 1])

          // Calculate average volume for monthly candles
          const totalVolume = monthlyCandles.reduce((sum, candle) => sum + candle.volume, 0)
          setMonthlyAvgVolume(totalVolume / monthlyCandles.length)
        }

        // Fetch daily candles (last 20)
        const dailyCandles = await fetchTimeframeCandles(selectedPair, "1d", 20)
        if (dailyCandles.length > 0) {
          setDailyCandle(dailyCandles[dailyCandles.length - 1])

          // Calculate average volume for daily candles
          const totalVolume = dailyCandles.reduce((sum, candle) => sum + candle.volume, 0)
          setDailyAvgVolume(totalVolume / dailyCandles.length)
        }
      } catch (error) {
        console.error("Error fetching candle data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCandles()

    // Set up interval to refresh data every minute
    const intervalId = setInterval(fetchCandles, 60000)

    return () => clearInterval(intervalId)
  }, [selectedPair])

  // Draw candles on canvas when data changes
  useEffect(() => {
    if (monthlyCandle && monthlyCanvasRef.current) {
      drawCandle(monthlyCanvasRef.current, monthlyCandle)
    }

    if (dailyCandle && dailyCanvasRef.current) {
      drawCandle(dailyCanvasRef.current, dailyCandle)
    }
  }, [monthlyCandle, dailyCandle])

  // Format price with appropriate precision
  const formatPrice = (price: number | undefined) => {
    if (!price) return "N/A"

    if (price >= 1000) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } else if (price >= 1) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    } else {
      return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
    }
  }

  // Format volume with appropriate units (K, M, B)
  const formatVolume = (volume: number | undefined) => {
    if (!volume) return "N/A"

    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(2)}B`
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`
    } else {
      return volume.toFixed(2)
    }
  }

  // Format date from timestamp
  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "N/A"

    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Calculate percentage change between open and close
  const calculateChange = (open?: number, close?: number) => {
    if (!open || !close) return 0
    return ((close - open) / open) * 100
  }

  // Determine if candle is bullish or bearish
  const isBullish = (candle?: CandleData | null) => {
    if (!candle) return false
    return candle.close >= candle.open
  }

  // Calculate volume percentage compared to average
  const calculateVolumePercentage = (volume?: number, avgVolume?: number) => {
    if (!volume || !avgVolume) return 0
    return (volume / avgVolume) * 100
  }

  // Function to draw a candle on canvas
  const drawCandle = (canvas: HTMLCanvasElement, candle: CandleData) => {
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Calculate price range for scaling
    const priceRange = candle.high - candle.low
    const padding = priceRange * 0.2 // Add 20% padding
    const minPrice = candle.low - padding
    const maxPrice = candle.high + padding

    // Scale function to convert price to y-coordinate
    const scaleY = (price: number) => {
      return height - ((price - minPrice) / (maxPrice - minPrice)) * height
    }

    // Draw candle
    const candleWidth = width * 0.3
    const candleX = (width - candleWidth) / 2

    // Draw wick
    ctx.beginPath()
    ctx.moveTo(width / 2, scaleY(candle.high))
    ctx.lineTo(width / 2, scaleY(candle.low))
    ctx.strokeStyle = isBullish(candle) ? "#10b981" : "#ef4444"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw body
    const openY = scaleY(candle.open)
    const closeY = scaleY(candle.close)
    const bodyHeight = Math.abs(closeY - openY)

    ctx.fillStyle = isBullish(candle) ? "#10b981" : "#ef4444"
    ctx.fillRect(
      candleX,
      Math.min(openY, closeY),
      candleWidth,
      Math.max(bodyHeight, 1), // Ensure minimum height of 1px
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Current Candles - {selectedPair}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Candle */}
            <div className="bg-[#121826] rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4">Monthly Candle</h3>

              <div className="flex flex-row gap-6">
                {/* Candle Visualization */}
                <div className="w-1/3">
                  <canvas ref={monthlyCanvasRef} className="w-full h-[150px]" width={150} height={150}></canvas>
                </div>

                {/* OHLC Values */}
                <div className="w-2/3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Open:</span>
                    <span className="text-sm font-medium">${formatPrice(monthlyCandle?.open)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">High:</span>
                    <span className="text-sm font-medium">${formatPrice(monthlyCandle?.high)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Low:</span>
                    <span className="text-sm font-medium">${formatPrice(monthlyCandle?.low)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Close:</span>
                    <span className="text-sm font-medium">${formatPrice(monthlyCandle?.close)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Change:</span>
                    <span
                      className={`text-sm font-medium ${isBullish(monthlyCandle) ? "text-success" : "text-destructive"}`}
                    >
                      {isBullish(monthlyCandle) ? "+" : ""}
                      {calculateChange(monthlyCandle?.open, monthlyCandle?.close).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Volume:</span>
                    <span className="text-sm font-medium">{formatVolume(monthlyCandle?.volume)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Vol % of Avg:</span>
                    <span className="text-sm font-medium">
                      {calculateVolumePercentage(monthlyCandle?.volume, monthlyAvgVolume).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Candle */}
            <div className="bg-[#121826] rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4">Daily Candle</h3>

              <div className="flex flex-row gap-6">
                {/* Candle Visualization */}
                <div className="w-1/3">
                  <canvas ref={dailyCanvasRef} className="w-full h-[150px]" width={150} height={150}></canvas>
                </div>

                {/* OHLC Values */}
                <div className="w-2/3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Open:</span>
                    <span className="text-sm font-medium">${formatPrice(dailyCandle?.open)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">High:</span>
                    <span className="text-sm font-medium">${formatPrice(dailyCandle?.high)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Low:</span>
                    <span className="text-sm font-medium">${formatPrice(dailyCandle?.low)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Close:</span>
                    <span className="text-sm font-medium">${formatPrice(dailyCandle?.close)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Change:</span>
                    <span
                      className={`text-sm font-medium ${isBullish(dailyCandle) ? "text-success" : "text-destructive"}`}
                    >
                      {isBullish(dailyCandle) ? "+" : ""}
                      {calculateChange(dailyCandle?.open, dailyCandle?.close).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Volume:</span>
                    <span className="text-sm font-medium">{formatVolume(dailyCandle?.volume)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Vol % of Avg:</span>
                    <span className="text-sm font-medium">
                      {calculateVolumePercentage(dailyCandle?.volume, dailyAvgVolume).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
