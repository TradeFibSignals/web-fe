"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, CheckCircle, RefreshCw, Clock, Activity } from "lucide-react"
import { useLiquidation } from "@/context/liquidation-context"
import { type TradingSignal, cancelSignal, completeSignal, checkActiveSignals } from "@/lib/signals-service"

export function ActiveSignalsPanel() {
  const { currentPrice, selectedPair, historicalCandles } = useLiquidation()
  const [activeSignals, setActiveSignals] = useState<TradingSignal[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Load active signals from local storage
  useEffect(() => {
    const signalsJson = localStorage.getItem("activeSignals")
    if (signalsJson) {
      try {
        const signals = JSON.parse(signalsJson)
        setActiveSignals(signals)
      } catch (error) {
        console.error("Error parsing active signals:", error)
      }
    }
  }, [])

  // Check active signals when price changes
  useEffect(() => {
    if (currentPrice && selectedPair) {
      refreshSignals()
    }
    // Refresh signals every 30 seconds
    const interval = setInterval(() => {
      if (currentPrice && selectedPair) {
        refreshSignals()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [currentPrice, selectedPair, historicalCandles])

  // Function to refresh signals
  const refreshSignals = async () => {
    setIsRefreshing(true)
    try {
      await checkActiveSignals(currentPrice, selectedPair, historicalCandles)

      // Reload active signals from local storage
      const signalsJson = localStorage.getItem("activeSignals")
      if (signalsJson) {
        const signals = JSON.parse(signalsJson)
        setActiveSignals(signals)
      } else {
        setActiveSignals([])
      }

      setLastRefreshed(new Date())
    } catch (error) {
      console.error("Error refreshing signals:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle manual completion
  const handleComplete = async (signal: TradingSignal) => {
    try {
      if (signal.id) {
        await completeSignal(signal.id, currentPrice)
        refreshSignals()
      }
    } catch (error) {
      console.error("Error completing signal:", error)
    }
  }

  // Handle cancellation
  const handleCancel = (signal: TradingSignal) => {
    try {
      if (signal.id) {
        cancelSignal(signal.id)
        refreshSignals()
      }
    } catch (error) {
      console.error("Error cancelling signal:", error)
    }
  }

  // Calculate profit/loss for display
  const calculatePL = (signal: TradingSignal) => {
    if (signal.type === "long") {
      const pl = currentPrice - signal.entry
      const plPercent = (pl / signal.entry) * 100
      return {
        value: pl,
        percent: plPercent,
        isProfit: pl >= 0,
      }
    } else {
      const pl = signal.entry - currentPrice
      const plPercent = (pl / signal.entry) * 100
      return {
        value: pl,
        percent: plPercent,
        isProfit: pl >= 0,
      }
    }
  }

  // Get status badge for a signal
  const getStatusBadge = (signal: TradingSignal) => {
    // Check if signal has status property, if not, determine based on entry_hit
    const status = signal.status || (signal.entryHit ? "active" : "waiting")
    
    if (status === "waiting" || !signal.entryHit) {
      return (
        <Badge variant="outline" className="bg-muted/50 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Waiting for Entry</span>
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="bg-primary/20 text-primary flex items-center gap-1">
          <div className="animate-pulse flex items-center">
            <span className="h-2 w-2 rounded-full bg-primary inline-block mr-1"></span>
            <Activity className="h-3 w-3" />
          </div>
          <span>Active Trade</span>
        </Badge>
      )
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-bold">Active Signals</CardTitle>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-xs text-gray-500">Last updated: {lastRefreshed.toLocaleTimeString()}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSignals}
            disabled={isRefreshing}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeSignals.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No active signals</div>
        ) : (
          <div className="space-y-4">
            {activeSignals.map((signal) => {
              const pl = calculatePL(signal)
              const entryHit = signal.entryHit || signal.status === "active"
              
              return (
                <div key={signal.id} className="border rounded-lg p-4 bg-card">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={signal.type === "long" ? "default" : "destructive"}>
                        {signal.type.toUpperCase()}
                      </Badge>
                      <span className="font-semibold">{signal.pair}</span>
                      <Badge variant="outline">{signal.timeframe}</Badge>
                      {getStatusBadge(signal)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleComplete(signal)}
                        title="Mark as completed"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleCancel(signal)} title="Cancel signal">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-gray-500">Entry</div>
                      <div className="font-medium">${signal.entry.toLocaleString()}</div>
                      {entryHit && signal.entryTime && (
                        <div className="text-xs text-success">
                          Hit on {new Date(signal.entryTime).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-500">Current</div>
                      <div className="font-medium">${currentPrice.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Stop Loss</div>
                      <div className="text-red-500 font-medium">${signal.stopLoss.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Take Profit</div>
                      <div className="text-green-500 font-medium">${signal.takeProfit.toLocaleString()}</div>
                    </div>
                  </div>

                  {entryHit && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-500">P/L</div>
                        <div className={`font-semibold ${pl.isProfit ? "text-green-500" : "text-red-500"}`}>
                          {pl.isProfit ? "+" : ""}$
                          {pl.value.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          ({pl.isProfit ? "+" : ""}
                          {pl.percent.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          %)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
