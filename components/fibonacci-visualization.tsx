"use client"

import { useEffect, useRef } from "react"
import { useLiquidation } from "@/context/liquidation-context"

export function FibonacciVisualization() {
  const { historicalCandles, selectedPair } = useLiquidation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !historicalCandles || historicalCandles.length === 0) return

    // Import the liquidity levels calculation function
    import("@/lib/liquidity-levels").then(({ calculateLiquidityLevels }) => {
      // Calculate liquidity levels with the exact parameters from TradingView
      const { bsl, ssl } = calculateLiquidityLevels(historicalCandles, {
        swingStrength: 5,
        majorThreshold: 0.3, // Sníženo z 0.5 na 0.3 pro lepší detekci major levelů
        reqThreshold: 2.0,
      })

      // Find all major levels
      const majorBSL = bsl.filter((level) => level.isMajor)
      const majorSSL = ssl.filter((level) => level.isMajor)

      // Debug - log all major levels
      console.log(
        "Visualization - Major BSL levels:",
        majorBSL.map((l) => l.price),
      )
      console.log(
        "Visualization - Major SSL levels:",
        majorSSL.map((l) => l.price),
      )

      if (majorBSL.length === 0 && majorSSL.length === 0) return

      // For LONG signals, we need the lowest SSL (support)
      // For SHORT signals, we need the highest BSL (resistance)
      const isBullish = true // Assuming bullish for visualization

      // Find the appropriate major level
      let lastMajor = null

      if (isBullish) {
        // Pro LONG signály hledáme nejnižší major SSL level (kolem 82,991.5)
        const sortedSSL = [...majorSSL].sort((a, b) => a.price - b.price)
        lastMajor = sortedSSL.length > 0 ? sortedSSL[0] : null
      } else {
        // Pro SHORT signály hledáme nejvyšší major BSL level
        const sortedBSL = [...majorBSL].sort((a, b) => b.price - a.price)
        lastMajor = sortedBSL.length > 0 ? sortedBSL[0] : null
      }

      if (!lastMajor) return

      // Get candles after the major level formation
      const candlesAfterLevel = historicalCandles.filter((candle) => candle.time > lastMajor.time)

      if (candlesAfterLevel.length < 5) return // Need enough candles to find a peak

      // Najdeme první lokální vrchol po major levelu
      let peakFound = false
      let peakIndex = -1
      let peakPrice = 0
      let peakTime = 0

      // Procházíme svíce po major levelu a hledáme první lokální vrchol
      for (let i = 2; i < candlesAfterLevel.length - 3; i++) {
        // Kontrolujeme, zda svíce i má vyšší high než předchozí svíce
        if (
          candlesAfterLevel[i].high > candlesAfterLevel[i - 1].high &&
          candlesAfterLevel[i].high > candlesAfterLevel[i - 2].high
        ) {
          // Kontrolujeme, zda následující 3 svíce mají nižší high
          if (
            candlesAfterLevel[i + 1].high < candlesAfterLevel[i].high &&
            candlesAfterLevel[i + 2].high < candlesAfterLevel[i].high &&
            candlesAfterLevel[i + 3].high < candlesAfterLevel[i].high
          ) {
            peakFound = true
            peakIndex = i
            peakPrice = candlesAfterLevel[i].high
            peakTime = candlesAfterLevel[i].time
            break
          }
        }
      }

      // Pokud jsme nenašli lokální vrchol, zkusíme najít absolutní maximum
      if (!peakFound) {
        for (let i = 0; i < candlesAfterLevel.length; i++) {
          if (candlesAfterLevel[i].high > peakPrice) {
            peakPrice = candlesAfterLevel[i].high
            peakTime = candlesAfterLevel[i].time
            peakIndex = i
          }
        }
      }

      // If we found a peak, draw Fibonacci levels
      if (peakIndex !== -1) {
        const container = containerRef.current
        container.innerHTML = ""

        const peakCandle = candlesAfterLevel[peakIndex]

        // Calculate Fibonacci extension levels
        const startPrice = lastMajor.price
        const endPrice = peakPrice
        const priceDiff = endPrice - startPrice

        // Find price range for the chart
        const allPrices = historicalCandles.flatMap((c) => [c.high, c.low])
        const minPrice = Math.min(...allPrices) * 0.995
        const maxPrice = Math.max(...allPrices) * 1.005

        const width = container.clientWidth
        const height = container.clientHeight
        const padding = { top: 20, right: 60, bottom: 30, left: 60 }
        const chartHeight = height - padding.top - padding.bottom

        // Scale function for price to y-coordinate
        const yScale = (price: number) =>
          padding.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight

        // Find the candle index for the major level and peak
        const majorLevelIndex = historicalCandles.findIndex((c) => c.time >= lastMajor.time)
        const peakCandleIndex = historicalCandles.findIndex((c) => c.time === peakCandle.time)

        if (majorLevelIndex === -1 || peakCandleIndex === -1) return

        // Calculate x-coordinates
        const xScale = (i: number) =>
          padding.left + (i / (historicalCandles.length - 1)) * (width - padding.left - padding.right)
        const majorX = xScale(majorLevelIndex)
        const peakX = xScale(peakCandleIndex)

        // Draw only the needed Fibonacci levels (0%, 61.8%, 100%)
        const fibLevels = [0, 61.8, 100]

        fibLevels.forEach((level) => {
          // For LONG signals: 0% at high, 100% at major level
          const fibPrice = endPrice - (priceDiff * level) / 100

          const y = yScale(fibPrice)

          // Draw horizontal line for the Fibonacci level
          const line = document.createElement("div")
          line.className = "absolute"
          line.style.top = `${y}px`
          line.style.left = `${majorX}px`
          line.style.width = `${width - majorX - padding.right}px`
          line.style.height = "1px"

          // Style based on level
          if (level === 61.8) {
            // Highlight the 61.8% level (entry)
            line.style.borderTop = "2px solid #3b82f6" // Primary color
          } else if (level === 0 || level === 100) {
            // Highlight the 0% and 100% levels
            line.style.borderTop = "1px solid rgba(255, 255, 255, 0.5)"
          }

          container.appendChild(line)

          // Add label for the Fibonacci level
          const label = document.createElement("div")
          label.className = "absolute text-xs"
          label.textContent = `${level}%`
          label.style.top = `${y}px`
          label.style.right = "0"
          label.style.transform = "translateY(-50%)"

          // Style based on level
          if (level === 61.8) {
            label.className += " text-primary font-medium"
          } else if (level === 0 || level === 100) {
            label.className += " text-gray-300"
          }

          container.appendChild(label)
        })

        // Draw vertical line at the major level
        const majorLine = document.createElement("div")
        majorLine.className = "absolute border-l-2 border-yellow-500"
        majorLine.style.left = `${majorX}px`
        majorLine.style.top = `${padding.top}px`
        majorLine.style.height = `${chartHeight}px`
        container.appendChild(majorLine)

        // Draw vertical line at the peak
        const peakLine = document.createElement("div")
        peakLine.className = "absolute border-l-2 border-purple-500"
        peakLine.style.left = `${peakX}px`
        peakLine.style.top = `${padding.top}px`
        peakLine.style.height = `${chartHeight}px`
        container.appendChild(peakLine)

        // Add label for the major level
        const majorLabel = document.createElement("div")
        majorLabel.className = "absolute text-xs bg-yellow-500 text-black px-1 rounded"
        majorLabel.textContent = "Major Level"
        majorLabel.style.left = `${majorX}px`
        majorLabel.style.bottom = "0"
        majorLabel.style.transform = "translateX(-50%)"
        container.appendChild(majorLabel)

        // Add label for the peak
        const peakLabel = document.createElement("div")
        peakLabel.className = "absolute text-xs bg-purple-500 text-white px-1 rounded"
        peakLabel.textContent = "Peak"
        peakLabel.style.left = `${peakX}px`
        peakLabel.style.bottom = "0"
        peakLabel.style.transform = "translateX(-50%)"
        container.appendChild(peakLabel)

        // Calculate entry, SL, and TP levels
        // For LONG signals: 0% at high, 100% at major level
        const entryPrice = endPrice - (priceDiff * 61.8) / 100

        // Stop loss just beyond the major level
        const stopLossBuffer = priceDiff * 0.01 // 1% of the move
        const stopLoss = startPrice - stopLossBuffer

        // Calculate risk
        const risk = Math.abs(entryPrice - stopLoss)

        // Calculate take profit based on 3:1 RRR
        const takeProfit = entryPrice + risk * 3

        // Draw entry marker
        const entryY = yScale(entryPrice)
        const entryMarker = document.createElement("div")
        entryMarker.className = "absolute"
        entryMarker.style.top = `${entryY}px`
        entryMarker.style.right = `${padding.right - 10}px`
        entryMarker.innerHTML = `
          <div class="flex items-center">
            <div class="w-4 h-4 rounded-full bg-primary"></div>
            <span class="ml-1 text-xs text-primary font-medium">Entry</span>
          </div>
        `
        container.appendChild(entryMarker)

        // Draw SL marker
        const slY = yScale(stopLoss)
        const slMarker = document.createElement("div")
        slMarker.className = "absolute"
        slMarker.style.top = `${slY}px`
        slMarker.style.right = `${padding.right - 10}px`
        slMarker.innerHTML = `
          <div class="flex items-center">
            <div class="w-4 h-4 rounded-full bg-destructive"></div>
            <span class="ml-1 text-xs text-destructive font-medium">SL</span>
          </div>
        `
        container.appendChild(slMarker)

        // Draw TP marker
        const tpY = yScale(takeProfit)
        const tpMarker = document.createElement("div")
        tpMarker.className = "absolute"
        tpMarker.style.top = `${tpY}px`
        tpMarker.style.right = `${padding.right - 10}px`
        tpMarker.innerHTML = `
          <div class="flex items-center">
            <div class="w-4 h-4 rounded-full bg-success"></div>
            <span class="ml-1 text-xs text-success font-medium">TP</span>
          </div>
        `
        container.appendChild(tpMarker)
      }
    })
  }, [historicalCandles, selectedPair])

  return (
    <div className="relative h-[400px]">
      <div ref={containerRef} className="absolute top-0 right-0 bottom-0 left-0 bg-[#121826]"></div>
    </div>
  )
}
