"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calculator, TrendingUp, TrendingDown, Percent, DollarSign, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function PositionCalculator() {
  const searchParams = useSearchParams()

  // Default values
  const defaultType = "buy"
  const defaultPrice = 0
  const defaultEntry = 0
  const defaultStopLoss = 0
  const defaultTakeProfit = 0

  // Get parameters from URL
  const typeParam = searchParams.get("type") || defaultType
  const priceParam = searchParams.get("price") ? Number.parseFloat(searchParams.get("price") || "0") : defaultPrice
  const entryParam = searchParams.get("entry") ? Number.parseFloat(searchParams.get("entry") || "0") : defaultEntry
  const slParam = searchParams.get("sl") ? Number.parseFloat(searchParams.get("sl") || "0") : defaultStopLoss
  const tpParam = searchParams.get("tp") ? Number.parseFloat(searchParams.get("tp") || "0") : defaultTakeProfit

  // State for form values
  const [positionType, setPositionType] = useState<"buy" | "sell">(typeParam === "sell" ? "sell" : "buy")
  const [accountBalance, setAccountBalance] = useState<number>(10000)
  const [riskPercent, setRiskPercent] = useState<number>(1)
  const [entryPrice, setEntryPrice] = useState<number>(entryParam || priceParam || 0)
  const [stopLoss, setStopLoss] = useState<number>(slParam || 0)
  const [takeProfit, setTakeProfit] = useState<number>(tpParam || 0)
  const [positionSize, setPositionSize] = useState<number>(0)
  const [riskAmount, setRiskAmount] = useState<number>(0)
  const [potentialProfit, setPotentialProfit] = useState<number>(0)
  const [riskRewardRatio, setRiskRewardRatio] = useState<number>(0)
  const [leverage, setLeverage] = useState<number>(1)
  const [marginAmount, setMarginAmount] = useState<number>(0)
  const [liquidationPrice, setLiquidationPrice] = useState<number | null>(null)
  const [signalInfo, setSignalInfo] = useState<string | null>(null)

  // Check for signal info in URL
  useEffect(() => {
    const signal = searchParams.get("signal")
    const strength = searchParams.get("strength")
    const timeframe = searchParams.get("timeframe")

    if (signal) {
      const signalText = `${signal}${timeframe ? ` (${timeframe})` : ""}${strength ? ` - Strength: ${strength}/5` : ""}`
      setSignalInfo(signalText)
    }
  }, [searchParams])

  // Calculate position details
  useEffect(() => {
    if (!entryPrice || !stopLoss || !takeProfit || entryPrice === stopLoss) return

    // Calculate risk amount (maximum amount we're willing to lose)
    const calculatedRiskAmount = (accountBalance * riskPercent) / 100

    // Calculate price difference percentage based on position type
    let priceDifference = 0
    if (positionType === "buy") {
      priceDifference = Math.abs(entryPrice - stopLoss) / entryPrice
    } else {
      priceDifference = Math.abs(stopLoss - entryPrice) / entryPrice
    }

    // Ensure leverage is never less than 1
    const safetyLeverage = Math.max(1, leverage)

    // Calculate position size based on risk amount and price difference
    // This is the size we need to achieve our desired risk percentage
    const calculatedPositionSize = calculatedRiskAmount / priceDifference

    // Calculate margin required with leverage (position size / leverage)
    const calculatedMargin = calculatedPositionSize / safetyLeverage

    // Calculate potential profit
    let profitDifference = 0
    if (positionType === "buy") {
      profitDifference = Math.abs(takeProfit - entryPrice) / entryPrice
    } else {
      profitDifference = Math.abs(entryPrice - takeProfit) / entryPrice
    }

    const calculatedProfit = calculatedPositionSize * profitDifference

    // Calculate risk/reward ratio
    const calculatedRiskReward = calculatedProfit / calculatedRiskAmount

    // Calculate liquidation price (simplified)
    let calculatedLiquidationPrice = null
    if (positionType === "buy") {
      calculatedLiquidationPrice = entryPrice * (1 - (1 / safetyLeverage) * 0.9) // 90% of margin used
    } else {
      calculatedLiquidationPrice = entryPrice * (1 + (1 / safetyLeverage) * 0.9) // 90% of margin used
    }

    // Update state
    setRiskAmount(calculatedRiskAmount)
    setPositionSize(calculatedPositionSize)
    setMarginAmount(calculatedMargin)
    setPotentialProfit(calculatedProfit)
    setRiskRewardRatio(calculatedRiskReward)
    setLiquidationPrice(calculatedLiquidationPrice)
  }, [accountBalance, riskPercent, entryPrice, stopLoss, takeProfit, positionType, leverage])

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Format percentage
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Handle form reset
  const handleReset = () => {
    setAccountBalance(10000)
    setRiskPercent(1)
    setEntryPrice(0)
    setStopLoss(0)
    setTakeProfit(0)
    setLeverage(1)
  }

  // Handle position type change
  const handlePositionTypeChange = (value: string) => {
    setPositionType(value as "buy" | "sell")

    // Swap stop loss and take profit if changing position type
    if (stopLoss && takeProfit) {
      if (value === "buy" && stopLoss > entryPrice) {
        setStopLoss(entryPrice * 0.97)
        setTakeProfit(entryPrice * 1.05)
      } else if (value === "sell" && stopLoss < entryPrice) {
        setStopLoss(entryPrice * 1.03)
        setTakeProfit(entryPrice * 0.95)
      }
    }
  }

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Position Calculator
          </CardTitle>
          <CardDescription>Calculate optimal position size based on your risk tolerance</CardDescription>
          {signalInfo && (
            <div className="mt-2">
              <Badge variant="outline" className="text-sm">
                Signal: {signalInfo}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <Tabs defaultValue={positionType} onValueChange={handlePositionTypeChange}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="buy" className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Long
              </TabsTrigger>
              <TabsTrigger value="sell" className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Short
              </TabsTrigger>
            </TabsList>

            <div className="space-y-6">
              {/* Account Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Account Settings</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account-balance">Account Balance (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="account-balance"
                        type="number"
                        placeholder="10000"
                        className="pl-8"
                        value={accountBalance || ""}
                        onChange={(e) => setAccountBalance(Number.parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="risk-percent">Risk Per Trade (%)</Label>
                    <div className="relative">
                      <Percent className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="risk-percent"
                        type="number"
                        placeholder="1"
                        className="pl-8"
                        value={riskPercent || ""}
                        onChange={(e) => setRiskPercent(Number.parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <Slider
                      value={[riskPercent]}
                      min={0.1}
                      max={5}
                      step={0.1}
                      onValueChange={(value) => setRiskPercent(value[0])}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0.1%</span>
                      <span>1%</span>
                      <span>2%</span>
                      <span>5%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trade Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Trade Settings</h3>
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
                    <Label htmlFor="stop-loss">Stop Loss (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="stop-loss"
                        type="number"
                        placeholder="0"
                        className={`pl-8 ${
                          positionType === "buy"
                            ? "border-red-500 focus-visible:ring-red-500"
                            : "border-green-500 focus-visible:ring-green-500"
                        }`}
                        value={stopLoss || ""}
                        onChange={(e) => setStopLoss(Number.parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="take-profit">Take Profit (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="take-profit"
                        type="number"
                        placeholder="0"
                        className={`pl-8 ${
                          positionType === "buy"
                            ? "border-green-500 focus-visible:ring-green-500"
                            : "border-red-500 focus-visible:ring-red-500"
                        }`}
                        value={takeProfit || ""}
                        onChange={(e) => setTakeProfit(Number.parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Leverage Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Leverage</h3>
                  <Badge variant="outline">{leverage}x</Badge>
                </div>
                <Slider
                  value={[leverage]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={(value) => setLeverage(value[0])}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1x</span>
                  <span>5x</span>
                  <span>10x</span>
                  <span>20x</span>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-medium">Position Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Position Size</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(positionSize)}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Risk Amount</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1 text-red-500">
                        {formatCurrency(riskAmount)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{formatPercent(riskPercent)} of account</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Potential Profit</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1 text-green-500">
                        {formatCurrency(potentialProfit)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Risk/Reward Ratio</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1">{riskRewardRatio.toFixed(2)}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Required Margin</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(marginAmount)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatPercent((marginAmount / accountBalance) * 100)} of account balance
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Est. Liquidation Price</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1 text-red-500">
                        {liquidationPrice ? formatCurrency(liquidationPrice) : "N/A"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {liquidationPrice && entryPrice
                          ? `${formatPercent(Math.abs((liquidationPrice - entryPrice) / entryPrice) * 100)} from entry`
                          : ""}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Alert variant="warning" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This calculator is for educational purposes only. Always manage your risk carefully and consider
                    market conditions before trading.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
