"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useLiquidation } from "@/context/liquidation-context"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function IndicatorsPanel() {
  const { lpi, lio, timeframe } = useLiquidation()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Indicators</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Both indicators update when changing timeframes or refreshing data.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Custom liquidation indicators for {timeframe}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Liquidation Pressure Index (LPI)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      LPI (Liquidation Pressure Index): Measures overall liquidation pressure within the selected{" "}
                      {timeframe} timeframe. Higher values indicate more pending liquidations.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-medium">{lpi.toFixed(2)}%</span>
          </div>
          <Progress value={lpi} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low (0-30%)</span>
            <span>Moderate (30-70%)</span>
            <span>High (70-100%)</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Liquidation Imbalance Oscillator (LIO)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      LIO (Liquidation Imbalance Oscillator): Shows balance between long/short liquidations within the{" "}
                      {timeframe} timeframe. Above 50% means more short liquidations (bullish), below 50% means more
                      long liquidations (bearish).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-medium">{lio.toFixed(2)}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`absolute inset-y-0 left-0 ${lio < 50 ? "bg-destructive" : "bg-success"}`}
              style={{ width: `${lio}%` }}
            />
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-background" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Long dominant (0-40%)</span>
            <span>Balanced (40-60%)</span>
            <span>Short dominant (60-100%)</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Cascade Risk</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Cascade Risk combines LPI and LIO to estimate the probability of cascading liquidations that could
                      trigger a chain reaction of forced liquidations.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-medium">
              {lpi > 70 && (lio < 30 || lio > 70) ? "High" : lpi > 50 && (lio < 40 || lio > 60) ? "Medium" : "Low"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <div className={`h-2 rounded-l-full ${lpi > 30 ? "bg-yellow-500" : "bg-secondary"}`} />
            <div className={`h-2 ${lpi > 50 ? "bg-orange-500" : "bg-secondary"}`} />
            <div className={`h-2 rounded-r-full ${lpi > 70 ? "bg-destructive" : "bg-secondary"}`} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low Risk</span>
            <span>Medium Risk</span>
            <span>High Risk</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
