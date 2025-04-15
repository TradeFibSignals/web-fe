"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Calculator } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function CalculatorContent() {
  const searchParams = useSearchParams()

  // Default values
  const [entryPrice, setEntryPrice] = useState<number>(30000)
  const [takeProfit, setTakeProfit] = useState<number>(31500)
  const [stopLoss, setStopLoss] = useState<number>(29000)
  const [accountBalance, setAccountBalance] = useState<number>(1000)
  const [riskPercentage, setRiskPercentage] = useState<number>(1)
  const [leverage, setLeverage] = useState<number>(10)
  const [tradingFees, setTradingFees] = useState<number>(0.08)
  const [positionType, setPositionType] = useState<string>("long")
  const [positionSize, setPositionSize] = useState<number>(0)
  const [marginRequired, setMarginRequired] = useState<number>(0)
  const [riskReward, setRiskReward] = useState<number>(0)
  const [potentialProfit, setPotentialProfit] = useState<number>(0)
  const [potentialLoss, setPotentialLoss] = useState<number>(0)
  const [liquidationPrice, setLiquidationPrice] = useState<number | null>(null)
  const [signalInfo, setSignalInfo] = useState<string | null>(null)
  const [initialParamsLoaded, setInitialParamsLoaded] = useState<boolean>(false)

  // Parse URL parameters on component mount
  useEffect(() => {
    if (searchParams && !initialParamsLoaded) {
      // Get parameters from URL
      const type = searchParams.get("type")
      const entry = searchParams.get("entry")
      const tp = searchParams.get("tp")
      const sl = searchParams.get("sl")
      const signal = searchParams.get("signal")
      const strength = searchParams.get("strength")
      const timeframe = searchParams.get("timeframe")
      const riskRewardParam = searchParams.get("riskReward")
      const leverageParam = searchParams.get("leverage")

      // Set entry price
      if (entry && !isNaN(Number(entry))) {
        setEntryPrice(Number(entry))
      }

      // Set take profit
      if (tp && !isNaN(Number(tp))) {
        setTakeProfit(Number(tp))
      }

      // Set stop loss
      if (sl && !isNaN(Number(sl))) {
        setStopLoss(Number(sl))
      }

      // Set leverage based on signal strength or explicit parameter
      if (leverageParam && !isNaN(Number(leverageParam))) {
        // Ensure leverage is at least 1
        setLeverage(Math.max(1, Number(leverageParam)))
      } else if (strength && !isNaN(Number(strength))) {
        // Use signal strength as leverage if no explicit leverage provided
        // Ensure leverage is at least 1
        setLeverage(Math.max(1, Math.min(Number(strength) * 5, 20))) // Scale strength to reasonable leverage
      }

      // Set signal info for display
      if (signal) {
        const signalText = `${signal}${timeframe ? ` (${timeframe})` : ""}${strength ? ` - Strength: ${strength}/5` : ""}`
        setSignalInfo(signalText)
      }

      // Mark initial parameters as loaded to prevent overriding user changes
      setInitialParamsLoaded(true)
    }
  }, [searchParams, initialParamsLoaded])

  // Automatically determine position type based on entry, take profit and stop loss
  useEffect(() => {
    if (takeProfit > entryPrice) {
      setPositionType("long")
    } else if (takeProfit < entryPrice) {
      setPositionType("short")
    }
  }, [entryPrice, takeProfit])

  // Calculate position size based on risk percentage
  useEffect(() => {
    if (entryPrice && stopLoss && accountBalance && riskPercentage) {
      const riskAmount = (accountBalance * riskPercentage) / 100

      // Calculate price difference percentage based on position type
      let priceDifference
      if (positionType === "long") {
        priceDifference = Math.abs(((entryPrice - stopLoss) / entryPrice) * 100)
      } else {
        priceDifference = Math.abs(((stopLoss - entryPrice) / entryPrice) * 100)
      }

      // Calculate position size based on risk amount and price difference
      const calculatedPositionSize = riskAmount / (priceDifference / 100)

      // Ensure leverage is at least 1
      const safeLeverage = Math.max(1, leverage)

      // Calculate margin required with leverage
      const calculatedMargin = calculatedPositionSize / safeLeverage

      setPositionSize(Number.parseFloat(calculatedPositionSize.toFixed(2)))
      setMarginRequired(Number.parseFloat(calculatedMargin.toFixed(2)))
      setPotentialLoss(Number.parseFloat(riskAmount.toFixed(2)))

      // Calculate liquidation price
      const maintenanceMargin = 0.5 // 0.5% maintenance margin (typical for BTC)

      let liqPrice
      if (positionType === "long") {
        liqPrice = entryPrice * (1 - (1 / safeLeverage) * 0.9) // 90% of margin used
      } else {
        liqPrice = entryPrice * (1 + (1 / safeLeverage) * 0.9) // 90% of margin used
      }

      setLiquidationPrice(Number.parseFloat(liqPrice.toFixed(2)))
    }
  }, [entryPrice, stopLoss, accountBalance, riskPercentage, leverage, positionType])

  // Calculate risk/reward ratio and potential profit
  useEffect(() => {
    if (entryPrice && takeProfit && stopLoss && positionSize) {
      let priceDifferenceProfit, priceDifferenceLoss

      if (positionType === "long") {
        // For long positions
        priceDifferenceProfit = takeProfit - entryPrice
        priceDifferenceLoss = entryPrice - stopLoss
      } else {
        // For short positions
        priceDifferenceProfit = entryPrice - takeProfit
        priceDifferenceLoss = stopLoss - entryPrice
      }

      const profitPercentage = (priceDifferenceProfit / entryPrice) * 100
      const lossPercentage = (priceDifferenceLoss / entryPrice) * 100

      const calculatedRiskReward = profitPercentage / lossPercentage
      setRiskReward(Number.parseFloat(calculatedRiskReward.toFixed(2)))

      // Calculate potential profit in USD
      const profit = (positionSize * profitPercentage) / 100

      // Subtract trading fees
      const feesAmount = (positionSize * tradingFees) / 100
      const profitAfterFees = profit - feesAmount * 2 // Entry and exit fees

      setPotentialProfit(Number.parseFloat(profitAfterFees.toFixed(2)))
    }
  }, [entryPrice, takeProfit, stopLoss, positionSize, positionType, tradingFees])

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Bitcoin Position Calculator</h1>
      </div>

      {signalInfo && (
        <Alert className="mb-6 bg-[#1a1a1a] border-[#333]">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Position based on signal: <span className="font-medium">{signalInfo}</span>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <div>
          <Label htmlFor="entryPrice">Entry ($)</Label>
          <Input
            id="entryPrice"
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number.parseFloat(e.target.value))}
            className="bg-[#121212] border-[#333] mt-1"
          />
        </div>

        <div>
          <Label htmlFor="takeProfit">Take Profit ($)</Label>
          <Input
            id="takeProfit"
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(Number.parseFloat(e.target.value))}
            className="bg-[#121212] border-[#333] mt-1"
          />
        </div>

        <div>
          <Label htmlFor="stopLoss">Stop Loss ($)</Label>
          <Input
            id="stopLoss"
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number.parseFloat(e.target.value))}
            className="bg-[#121212] border-[#333] mt-1"
          />
        </div>

        <div>
          <Label htmlFor="accountBalance">Trading Capital ($)</Label>
          <Input
            id="accountBalance"
            type="number"
            value={accountBalance}
            onChange={(e) => setAccountBalance(Number.parseFloat(e.target.value))}
            className="bg-[#121212] border-[#333] mt-1"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label htmlFor="riskPercentage">Risk Percentage (%)</Label>
            <span>{riskPercentage}%</span>
          </div>
          <Slider
            id="riskPercentage"
            min={0.1}
            max={10}
            step={0.1}
            value={[riskPercentage]}
            onValueChange={(value) => setRiskPercentage(value[0])}
            className="h-6"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label htmlFor="leverage">Leverage (1-125x)</Label>
            <span>{leverage}x</span>
          </div>
          <Slider
            id="leverage"
            min={1} // Ensure minimum is 1
            max={125}
            step={1}
            value={[Math.max(1, leverage)]} // Ensure the value is at least 1
            onValueChange={(value) => setLeverage(Math.max(1, value[0]))} // Ensure the value is at least 1
            className="h-6"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <Label htmlFor="tradingFees">Trading Fees (%)</Label>
            <span>{tradingFees}%</span>
          </div>
          <Slider
            id="tradingFees"
            min={0}
            max={0.5}
            step={0.01}
            value={[tradingFees]}
            onValueChange={(value) => setTradingFees(value[0])}
            className="h-6"
          />
        </div>

        <Card className="bg-[#1a1a1a] border-[#333]">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Position Details</h2>

            <div className="grid grid-cols-2 gap-y-6">
              <div>
                <div className="text-sm text-gray-400">Position Type</div>
                <div className="mt-1">
                  <Badge
                    variant={positionType === "long" ? "default" : "destructive"}
                    className="bg-green-600 text-white"
                  >
                    {positionType.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Position Size ($)</div>
                <div className="mt-1 font-bold">${positionSize}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Margin Required ($)</div>
                <div className="mt-1 font-bold">${marginRequired}</div>
                <div className="text-xs text-gray-500">With {leverage}x leverage</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Risk/Reward Ratio</div>
                <div className="mt-1 font-bold">1:{riskReward}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Liquidation Price</div>
                <div className="mt-1 font-bold">${liquidationPrice ? liquidationPrice : "N/A"}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Potential Profit</div>
                <div className="mt-1 font-bold text-green-500">+${potentialProfit}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Potential Loss</div>
                <div className="mt-1 font-bold text-red-500">-${potentialLoss}</div>
                <div className="text-xs text-gray-500">{riskPercentage}% of capital</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert variant="warning" className="bg-[#1a1a1a] border-[#333]">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This calculator is for educational purposes only. Always manage your risk carefully and consider market
            conditions before trading.
          </AlertDescription>
        </Alert>

        <Card className="bg-[#1a1a1a] border-[#333]">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Trade Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Entry:</span>
                <span className="font-semibold">${entryPrice}</span>
              </div>
              <div className="flex justify-between">
                <span>Take Profit:</span>
                <span className="font-semibold">${takeProfit}</span>
              </div>
              <div className="flex justify-between">
                <span>Stop Loss:</span>
                <span className="font-semibold">${stopLoss}</span>
              </div>
              <div className="flex justify-between">
                <span>Position Type:</span>
                <span className="font-semibold">{positionType.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Leverage:</span>
                <span className="font-semibold">{leverage}x</span>
              </div>
              <div className="flex justify-between">
                <span>Risk Amount:</span>
                <span className="font-semibold">${potentialLoss.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Position Size:</span>
                <span className="font-semibold">${positionSize}</span>
              </div>
              <div className="flex justify-between">
                <span>Margin Required:</span>
                <span className="font-semibold">${marginRequired}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
