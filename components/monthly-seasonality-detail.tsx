"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'
import { monthNames } from "@/lib/seasonality-data"
import { useMonthlyStats } from "@/hooks/use-seasonality-data"

interface MonthlySeasonalityDetailProps {
  month?: number // Optional - if not provided, use current month
}

export function MonthlySeasonalityDetail({ month }: MonthlySeasonalityDetailProps) {
  const [currentMonth, setCurrentMonth] = useState<number>(0)
  
  useEffect(() => {
    // If month is provided, use it; otherwise, use current month
    const targetMonth = month !== undefined ? month : new Date().getMonth()
    setCurrentMonth(targetMonth)
  }, [month])
  
  // Use Redis-cached stats
  const { stats: monthStats, loading } = useMonthlyStats(currentMonth)

  const formatReturn = (value: number) => {
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
  }

  if (loading || !monthStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mr-3" />
        <span>Loading seasonality data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Direction indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`p-4 rounded-full ${
              monthStats.averageReturn > 3
                ? "bg-success/20"
                : monthStats.averageReturn < -3
                  ? "bg-destructive/20"
                  : "bg-yellow-500/20"
            }`}
          >
            {monthStats.averageReturn > 3 ? (
              <TrendingUp className="h-8 w-8 text-success" />
            ) : monthStats.averageReturn < -3 ? (
              <TrendingDown className="h-8 w-8 text-destructive" />
            ) : (
              <Minus className="h-8 w-8 text-yellow-500" />
            )}
          </div>
          <div>
            <div className="text-xl font-bold">
              {monthNames[currentMonth]} is historically{" "}
              {monthStats.averageReturn > 3 ? "Bullish" : monthStats.averageReturn < -3 ? "Bearish" : "Neutral"}
            </div>
            <div className="text-muted-foreground">
              {monthStats.positiveProb.toFixed(0)}% of years have positive returns
            </div>
          </div>
        </div>
        <div
          className={`text-3xl font-bold ${
            monthStats.averageReturn > 0
              ? "text-success"
              : monthStats.averageReturn < 0
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          {formatReturn(monthStats.averageReturn)}
        </div>
      </div>

      {/* Probability of positive returns */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Probability of Positive Returns</span>
          <span className="text-sm font-medium">{monthStats.positiveProb.toFixed(1)}%</span>
        </div>
        <Progress
          value={monthStats.positiveProb}
          className="h-2"
          indicatorColor={
            monthStats.positiveProb >= 60
              ? "bg-success"
              : monthStats.positiveProb >= 40
                ? "bg-yellow-500"
                : "bg-destructive"
          }
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{monthStats.positiveYears} positive years</span>
          <span>{monthStats.negativeYears} negative years</span>
        </div>
      </div>

      {/* Average and Median Returns */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#121826] p-3 rounded-lg">
          <div className="text-xs text-muted-foreground">Average Return</div>
          <div className={`text-xl font-bold ${monthStats.averageReturn > 0 ? "text-success" : "text-destructive"}`}>
            {formatReturn(monthStats.averageReturn)}
          </div>
        </div>
        <div className="bg-[#121826] p-3 rounded-lg">
          <div className="text-xs text-muted-foreground">Median Return</div>
          <div className={`text-xl font-bold ${monthStats.medianReturn > 0 ? "text-success" : "text-destructive"}`}>
            {formatReturn(monthStats.medianReturn)}
          </div>
        </div>
      </div>

      {/* Best and Worst Years */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#121826] p-3 rounded-lg">
          <div className="text-xs text-muted-foreground">Best Year</div>
          <div className="text-success font-bold">{formatReturn(monthStats.bestYear.return)}</div>
          <div className="text-xs text-muted-foreground">{monthStats.bestYear.year}</div>
        </div>
        <div className="bg-[#121826] p-3 rounded-lg">
          <div className="text-xs text-muted-foreground">Worst Year</div>
          <div className="text-destructive font-bold">{formatReturn(monthStats.worstYear.return)}</div>
          <div className="text-xs text-muted-foreground">{monthStats.worstYear.year}</div>
        </div>
      </div>

      {/* Historical Returns Table */}
      <div className="bg-[#121826] p-3 rounded-lg">
        <div className="text-sm font-medium mb-2">Historical Returns</div>
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {monthStats.returns.map((yearData: any) => (
            <div key={yearData.year} className="flex justify-between text-xs">
              <span>{yearData.year}</span>
              <span className={yearData.return > 0 ? "text-success" : "text-destructive"}>
                {formatReturn(yearData.return)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
