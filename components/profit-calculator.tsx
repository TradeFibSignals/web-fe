"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DollarSign } from "lucide-react"

export function ProfitCalculator() {
  const [entryPrice, setEntryPrice] = useState<number>(0)
  const [exitPrice, setExitPrice] = useState<number>(0)
  const [positionSize, setPositionSize] = useState<number>(1)
  const [profit, setProfit] = useState<number>(0)
  const [loss, setLoss] = useState<number>(0)

  useEffect(() => {
    // Calculate profit and loss
    const calculateProfitLoss = () => {
      if (!entryPrice || !exitPrice || !positionSize) {
        setProfit(0)
        setLoss(0)
        return
      }

      const profitPercentage = ((exitPrice - entryPrice) / entryPrice) * 100
      const lossPercentage = ((entryPrice - exitPrice) / entryPrice) * 100

      setProfit(positionSize * (profitPercentage / 100))
      setLoss(positionSize * (lossPercentage / 100))
    }

    calculateProfitLoss()
  }, [entryPrice, exitPrice, positionSize])

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profit/Loss Calculator</CardTitle>
          <CardDescription>Calculate potential profit or loss for a trade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-price">Entry Price (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="entry-price"
                  type="number"
                  placeholder="0"
                  className="pl-8"
                  value={entryPrice || ""}
                  onChange={(e) => setEntryPrice(Number.parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit-price">Exit Price (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="exit-price"
                  type="number"
                  placeholder="0"
                  className="pl-8"
                  value={exitPrice || ""}
                  onChange={(e) => setExitPrice(Number.parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-size">Position Size (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="position-size"
                  type="number"
                  placeholder="0"
                  className="pl-8"
                  value={positionSize || ""}
                  onChange={(e) => setPositionSize(Number.parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Potential Profit</h3>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(profit)}</div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Potential Loss</h3>
              <div className="text-2xl font-bold text-red-500">{formatCurrency(loss)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
