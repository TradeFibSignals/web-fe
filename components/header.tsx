"use client"

import { useEffect, useState } from "react"
import { Settings, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLiquidation } from "@/context/liquidation-context"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SettingsPanel } from "@/components/settings-panel"

export function Header() {
  const { currentPrice, priceChangePercent, refreshData, isLoading } = useLiquidation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Liquidation Vision</h1>
            <span className="text-sm text-muted-foreground">BTCUSDT Perpetual</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-24 animate-pulse rounded bg-muted"></div>
            </div>
            <Button size="icon" variant="outline">
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
    )
  }

  const isPriceUp = priceChangePercent >= 0

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Liquidation Vision</h1>
          <span className="text-sm text-muted-foreground">BTCUSDT Perpetual</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
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
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>
                <SheetDescription>Configure your liquidation visualization preferences</SheetDescription>
              </SheetHeader>
              <SettingsPanel />
            </SheetContent>
          </Sheet>
          <Button size="icon" variant="outline" onClick={refreshData} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  )
}
