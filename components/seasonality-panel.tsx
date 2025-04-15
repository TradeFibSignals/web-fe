"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Info, Loader2, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useEffect, useState } from "react"
import Link from "next/link"
import { monthNames } from "@/lib/seasonality-data"
import { useMonthlyStats } from "@/hooks/use-seasonality-data"

export function SeasonalityPanel() {
  const [currentMonth, setCurrentMonth] = useState<number>(0)
  
  useEffect(() => {
    // Get current month (0-11)
    const now = new Date()
    setCurrentMonth(now.getMonth())
  }, [])
  
  // Use Redis-cached stats
  const { stats: monthlyStats, loading } = useMonthlyStats(currentMonth)

  return (
    <Link href="/seasonality" className="block">
      <Card className="transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Bitcoin Seasonality</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Historical performance data for Bitcoin in {monthNames[currentMonth]} (2011-2024)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Month indicator */}
          <div className="flex items-center justify-center gap-2 bg-background/30 py-2 rounded-md">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="text-lg font-medium">{monthNames[currentMonth]}</span>
          </div>

          {loading || !monthlyStats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span>Loading historical data...</span>
            </div>
          ) : (
            <>
              {/* Direction indicator with separate percentage display */}
              <div className="flex flex-col items-center justify-center py-4">
                <div
                  className={`p-6 rounded-full ${
                    monthlyStats.positiveProb >= 60
                      ? "bg-success/20"
                      : monthlyStats.positiveProb <= 40
                        ? "bg-destructive/20"
                        : "bg-yellow-500/20"
                  }`}
                >
                  {monthlyStats.positiveProb >= 60 ? (
                    <TrendingUp className="h-16 w-16 text-success" />
                  ) : monthlyStats.positiveProb <= 40 ? (
                    <TrendingDown className="h-16 w-16 text-destructive" />
                  ) : (
                    <Minus className="h-16 w-16 text-yellow-500" />
                  )}
                </div>

                {/* Percentage display below icon */}
                <div className="mt-4 text-center">
                  <div
                    className={`text-3xl font-bold ${
                      monthlyStats.positiveProb >= 60
                        ? "text-success"
                        : monthlyStats.positiveProb <= 40
                          ? "text-destructive"
                          : "text-yellow-500"
                    }`}
                  >
                    {monthlyStats.positiveProb.toFixed(0)}%
                  </div>
                  <div className="font-medium mt-1">
                    {monthlyStats.positiveProb >= 60
                      ? "Bullish"
                      : monthlyStats.positiveProb <= 40
                        ? "Bearish"
                        : "Neutral"}{" "}
                    Seasonality
                  </div>
                  <div className="text-sm text-muted-foreground">positive years</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
