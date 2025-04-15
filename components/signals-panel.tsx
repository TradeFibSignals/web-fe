"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLiquidation } from "@/context/liquidation-context"
import { ArrowDown, ArrowUp, AlertTriangle, Target, CheckCircle2, Clock, Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useEffect, useState } from "react"
import Link from "next/link"

interface FibSignal {
  signal_id: string
  signal_type: "long" | "short"
  entry_price: number
  stop_loss: number
  take_profit: number
  pair: string
  timeframe: string
  signal_source: string
  major_level?: number
  peak_price?: number
  peak_time?: Date | string
  fib_levels?: any
  risk_reward_ratio: number
  seasonality: "bullish" | "bearish" | "neutral"
  positive_probability: number
  status: "waiting" | "active" | "completed" | "expired"
  entry_hit: boolean
  entry_hit_time?: Date | string
  exit_price?: number
  exit_time?: Date | string
  exit_type?: "tp" | "sl" | "manual" | "expired"
  created_at: Date | string
  updated_at: Date | string
}

export function SignalsPanel() {
  const { selectedPair, timeframe, currentPrice } = useLiquidation()
  const [fibSignal, setFibSignal] = useState<FibSignal | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Funkce pro načtení signálů z API
  const fetchSignals = async () => {
    try {
      setIsLoading(true)

      const response = await fetch(`/api/signals?pair=${selectedPair}&timeframe=${timeframe}&status=active`)

      if (!response.ok) {
        throw new Error(`Failed to fetch signals: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data && data.data.length > 0) {
        // Použijeme nejnovější signál
        setFibSignal(data.data[0])
      } else {
        setFibSignal(null)
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error("Error fetching signals:", error)
      setFibSignal(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Načtení signálů při změně páru nebo timeframe
  useEffect(() => {
    fetchSignals()
  }, [selectedPair, timeframe])

  // Periodická aktualizace signálů
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSignals()
    }, 30000) // Každých 30 sekund

    return () => clearInterval(interval)
  }, [selectedPair, timeframe])

  // Format price with appropriate precision
  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } else if (price >= 1) {
      return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    } else {
      return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
    }
  }

  // Funkce pro získání správné ikony a textu podle stavu signálu
  const getStatusBadge = () => {
    if (!fibSignal) return null

    switch (fibSignal.status) {
      case "waiting":
        return (
          <Badge variant="outline" className="bg-muted/50 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Waiting for Entry</span>
          </Badge>
        )
      case "active":
        return (
          <Badge variant="outline" className="bg-primary/20 text-primary flex items-center gap-1">
            <div className="animate-pulse flex items-center">
              <span className="h-2 w-2 rounded-full bg-primary inline-block mr-1"></span>
              <Activity className="h-3 w-3" />
            </div>
            <span>Active Trade</span>
          </Badge>
        )
      case "completed":
        return (
          <Badge
            variant="outline"
            className={`flex items-center gap-1 ${
              fibSignal.exit_type === "tp" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>{fibSignal.exit_type === "tp" ? "Take Profit Hit" : "Stop Loss Hit"}</span>
          </Badge>
        )
      case "expired":
        return (
          <Badge variant="outline" className="bg-muted/50 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Signal Expired</span>
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div>
            <CardTitle>Fibonacci Signals</CardTitle>
            <CardDescription>Based on major liquidity levels and seasonality</CardDescription>
          </div>
          {fibSignal && <div className="mt-1 sm:mt-0 sm:ml-2">{getStatusBadge()}</div>}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Target className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Signals are generated using Fibonacci retracements from the major level to the peak/trough.</p>
                <p className="mt-1">
                  For LONG signals: Peak is identified as the first local high after the major level, confirmed by 3
                  consecutive lower highs.
                </p>
                <p className="mt-1">
                  For SHORT signals: Trough is identified as the first local low after the major level, confirmed by 3
                  consecutive higher lows.
                </p>
                <p className="mt-1">Entry is at the 61.8% Fibonacci retracement level.</p>
                <p className="mt-1">Stop loss is placed just beyond the major level.</p>
                <p className="mt-1">Take profit is calculated based on a 3:1 risk-to-reward ratio.</p>
                <p className="mt-1 font-medium">Only signals that align with current seasonality are shown.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSignals}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/signals/history">
            <Button variant="outline" size="sm">
              History
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : fibSignal ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {fibSignal.signal_type === "long" ? (
                    <Badge variant="outline" className="bg-success/10 text-success">
                      <ArrowUp className="mr-1 h-3 w-3" /> LONG
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive">
                      <ArrowDown className="mr-1 h-3 w-3" /> SHORT
                    </Badge>
                  )}
                </div>
                <Badge
                  variant={
                    fibSignal.seasonality === "bullish"
                      ? "success"
                      : fibSignal.seasonality === "bearish"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {fibSignal.seasonality.charAt(0).toUpperCase() + fibSignal.seasonality.slice(1)} Seasonality (
                  {fibSignal.positive_probability?.toFixed(0)}%)
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={`rounded p-2 ${fibSignal.status === "waiting" ? "bg-primary/10" : "bg-background/50"}`}>
                  <div className="text-xs text-muted-foreground">Entry (61.8%)</div>
                  <div className="font-medium">${formatPrice(fibSignal.entry_price)}</div>
                  {fibSignal.status === "waiting" && (
                    <div className="text-xs text-primary mt-1">Waiting to hit this price</div>
                  )}
                  {fibSignal.entry_hit && (
                    <div className="text-xs text-success mt-1">
                      Entry hit at {new Date(fibSignal.entry_hit_time || 0).toLocaleTimeString()}
                    </div>
                  )}
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Stop Loss</div>
                  <div className="font-medium text-destructive">${formatPrice(fibSignal.stop_loss)}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Take Profit</div>
                  <div className="font-medium text-success">${formatPrice(fibSignal.take_profit)}</div>
                </div>
                <div className="rounded bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Risk/Reward</div>
                  <div className="font-medium">1:{fibSignal.risk_reward_ratio}</div>
                </div>
              </div>

              {fibSignal.fib_levels && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Fibonacci Levels</div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    {fibSignal.fib_levels.map((level: any) => (
                      <div
                        key={level.level}
                        className={`p-1 rounded ${level.level === 61.8 ? "bg-primary/20 font-medium" : "bg-background/30"}`}
                      >
                        {level.level}%: ${formatPrice(level.price)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  <span>
                    Based on major {fibSignal.signal_type === "long" ? "SSL" : "BSL"} at $
                    {formatPrice(fibSignal.major_level || 0)}
                  </span>
                </div>
                <Link
                  href={`/calculator?entry=${fibSignal.entry_price}&tp=${fibSignal.take_profit}&sl=${fibSignal.stop_loss}&signal=Fibonacci&type=${fibSignal.signal_type}`}
                >
                  <Button variant="outline" size="sm">
                    Open in Calculator
                  </Button>
                </Link>
              </div>

              {lastUpdated && (
                <div className="mt-3 text-xs text-muted-foreground text-right">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No active signals available</p>
            <p className="text-xs text-muted-foreground">Try changing the pair or timeframe, or check back later</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
