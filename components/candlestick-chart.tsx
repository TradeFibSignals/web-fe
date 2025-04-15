"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useLiquidation } from "@/context/liquidation-context"
import { calculateLiquidityLevels, type LiquidityLevel } from "@/lib/liquidity-levels"
import type { CandleData } from "@/lib/binance-api"

export function CandlestickChart() {
  const { priceData, currentPrice, timeframe, historicalCandles, selectedPair } = useLiquidation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [candles, setCandles] = useState<CandleData[]>([])
  const [liquidityLevels, setLiquidityLevels] = useState<{
    bsl: LiquidityLevel[]
    ssl: LiquidityLevel[]
  }>({ bsl: [], ssl: [] })
  const [crosshair, setCrosshair] = useState<{
    visible: boolean
    x: number
    y: number
    price: number
    time: number
    candleIndex: number
  } | null>(null)

  // Process candle data
  useEffect(() => {
    // Use historical candles if available, otherwise process price data
    if (historicalCandles && historicalCandles.length > 0) {
      setCandles(historicalCandles)

      // Calculate liquidity levels from historical candles
      const { bsl, ssl } = calculateLiquidityLevels(historicalCandles, {
        swingStrength: getSwingStrength(timeframe),
        majorThreshold: 0.5,
      })

      // Filter out levels that have been traded through by candle bodies
      const filteredBsl = bsl.filter((level) => !level.isTradedByBody)
      const filteredSsl = ssl.filter((level) => !level.isTradedByBody)

      // Filter to only show the most recent major levels
      const majorBSL = filteredBsl.filter((level) => level.isMajor)
      const majorSSL = filteredSsl.filter((level) => level.isMajor)

      // Sort by time (most recent first)
      majorBSL.sort((a, b) => b.time - a.time)
      majorSSL.sort((a, b) => b.time - a.time)

      // Take only the most recent major level of each type
      const recentBSL = majorBSL.length > 0 ? [majorBSL[0]] : []
      const recentSSL = majorSSL.length > 0 ? [majorSSL[0]] : []

      // Keep non-major levels for context
      const nonMajorBSL = filteredBsl.filter((level) => !level.isMajor)
      const nonMajorSSL = filteredSsl.filter((level) => !level.isMajor)

      setLiquidityLevels({
        bsl: [...recentBSL, ...nonMajorBSL],
        ssl: [...recentSSL, ...nonMajorSSL],
      })
    } else if (priceData && priceData.length >= 10) {
      // Group price data into candles based on timeframe
      const timeframeMs = getTimeframeMs(timeframe)
      const groupedData: Record<number, number[]> = {}

      priceData.forEach((point) => {
        const timeGroup = Math.floor(point.time / timeframeMs) * timeframeMs
        if (!groupedData[timeGroup]) {
          groupedData[timeGroup] = [point.price]
        } else {
          groupedData[timeGroup].push(point.price)
        }
      })

      const newCandles: CandleData[] = Object.entries(groupedData)
        .map(([time, prices]) => {
          const timeNumber = Number.parseInt(time)
          return {
            time: timeNumber,
            open: prices[0],
            high: Math.max(...prices),
            low: Math.min(...prices),
            close: prices[prices.length - 1],
          }
        })
        .sort((a, b) => a.time - b.time)

      setCandles(newCandles)

      // Calculate liquidity levels
      const { bsl, ssl } = calculateLiquidityLevels(newCandles, {
        swingStrength: getSwingStrength(timeframe),
        majorThreshold: 0.5,
      })

      // Filter out levels that have been traded through by candle bodies
      const filteredBsl = bsl.filter((level) => !level.isTradedByBody)
      const filteredSsl = ssl.filter((level) => !level.isTradedByBody)

      // Filter to only show the most recent major levels
      const majorBSL = filteredBsl.filter((level) => level.isMajor)
      const majorSSL = filteredSsl.filter((level) => level.isMajor)

      // Sort by time (most recent first)
      majorBSL.sort((a, b) => b.time - a.time)
      majorSSL.sort((a, b) => b.time - a.time)

      // Take only the most recent major level of each type
      const recentBSL = majorBSL.length > 0 ? [majorBSL[0]] : []
      const recentSSL = majorSSL.length > 0 ? [majorSSL[0]] : []

      // Keep non-major levels for context
      const nonMajorBSL = filteredBsl.filter((level) => !level.isMajor)
      const nonMajorSSL = filteredSsl.filter((level) => !level.isMajor)

      setLiquidityLevels({
        bsl: [...recentBSL, ...nonMajorBSL],
        ssl: [...recentSSL, ...nonMajorSSL],
      })
    }
  }, [priceData, timeframe, historicalCandles])

  // Handle mouse movement for crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || candles.length === 0) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const width = rect.width
    const height = rect.height
    const padding = { top: 20, right: 60, bottom: 30, left: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Only show crosshair if mouse is within chart area
    if (x >= padding.left && x <= width - padding.right && y >= padding.top && y <= height - padding.bottom) {
      // Find price range
      const allPrices = candles.flatMap((c) => [c.high, c.low])
      const bslPrices = liquidityLevels.bsl.map((level) => level.price)
      const sslPrices = liquidityLevels.ssl.map((level) => level.price)

      const allValues = [...allPrices, ...bslPrices, ...sslPrices, currentPrice]
      const minPrice = Math.min(...allValues) * 0.995
      const maxPrice = Math.max(...allValues) * 1.005

      // Calculate price at cursor position
      const priceAtCursor = maxPrice - ((y - padding.top) / chartHeight) * (maxPrice - minPrice)

      // Find closest candle
      const candleIndex = Math.min(
        Math.max(0, Math.round(((x - padding.left) / chartWidth) * (candles.length - 1))),
        candles.length - 1,
      )
      const timeAtCursor = candles[candleIndex].time

      setCrosshair({
        visible: true,
        x,
        y,
        price: priceAtCursor,
        time: timeAtCursor,
        candleIndex,
      })
    } else {
      setCrosshair(null)
    }
  }

  // Handle mouse leave
  const handleMouseLeave = () => {
    setCrosshair(null)
  }

  // Render chart
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const container = containerRef.current
    container.innerHTML = ""

    const width = container.clientWidth
    const height = container.clientHeight
    const padding = { top: 20, right: 60, bottom: 30, left: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Find price range
    const allPrices = candles.flatMap((c) => [c.high, c.low])
    const bslPrices = liquidityLevels.bsl.map((level) => level.price)
    const sslPrices = liquidityLevels.ssl.map((level) => level.price)

    const allValues = [...allPrices, ...bslPrices, ...sslPrices, currentPrice]
    const minPrice = Math.min(...allValues) * 0.995
    const maxPrice = Math.max(...allValues) * 1.005

    // Scale functions
    const xScale = (i: number) => padding.left + (i / (candles.length - 1)) * chartWidth
    const yScale = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight

    // Draw price grid
    const priceStep = getPriceStep(maxPrice)
    for (let price = Math.ceil(minPrice / priceStep) * priceStep; price <= maxPrice; price += priceStep) {
      const y = yScale(price)

      // Grid line
      const gridLine = document.createElement("div")
      gridLine.className = "absolute w-full border-t border-gray-800"
      gridLine.style.top = `${y}px`
      container.appendChild(gridLine)

      // Price label
      const priceLabel = document.createElement("div")
      priceLabel.className = "absolute text-xs text-gray-400"
      priceLabel.textContent = formatPrice(price)
      priceLabel.style.top = `${y}px`
      priceLabel.style.left = "0"
      priceLabel.style.transform = "translateY(-50%)"
      container.appendChild(priceLabel)
    }

    // Draw candles
    candles.forEach((candle, i) => {
      const x = xScale(i)
      const candleWidth = Math.max(Math.min(chartWidth / candles.length - 2, 8), 3) // Better width calculation

      const open = yScale(candle.open)
      const high = yScale(candle.high)
      const low = yScale(candle.low)
      const close = yScale(candle.close)

      const isBullish = candle.close >= candle.open
      const color = isBullish ? "#089981" : "#E91E63"

      // Draw wick
      const wick = document.createElement("div")
      wick.className = "absolute"
      wick.style.left = `${x + candleWidth / 2 - 0.5}px` // Center the wick with 1px width
      wick.style.top = `${high}px`
      wick.style.width = "1px"
      wick.style.height = `${low - high}px`
      wick.style.backgroundColor = color
      container.appendChild(wick)

      // Draw body
      const body = document.createElement("div")
      body.className = "absolute"
      body.style.left = `${x}px`
      body.style.top = `${Math.min(open, close)}px` // Always start from the minimum of open/close
      body.style.width = `${candleWidth}px`
      body.style.height = `${Math.max(Math.abs(open - close), 1)}px`
      body.style.backgroundColor = color
      container.appendChild(body)
    })

    // Draw time grid - improved version with day, hour, and candle markers
    // Get the first and last timestamp
    const firstTime = candles[0].time
    const lastTime = candles[candles.length - 1].time

    // Calculate time range in hours
    const timeRangeHours = (lastTime - firstTime) / (60 * 60 * 1000)

    // Create date objects for easier manipulation
    const firstDate = new Date(firstTime)
    const lastDate = new Date(lastTime)

    // Draw day separators (major milestones)
    const dayStart = new Date(firstDate)
    dayStart.setHours(0, 0, 0, 0)

    // If we're already past midnight, move to the next day
    if (dayStart.getTime() < firstTime) {
      dayStart.setDate(dayStart.getDate() + 1)
    }

    // Draw day lines and labels
    for (let time = dayStart.getTime(); time <= lastTime; time += 24 * 60 * 60 * 1000) {
      const date = new Date(time)

      // Find the closest candle index
      const closestIndex = findClosestCandleIndex(candles, time)
      if (closestIndex === -1) continue

      const x = xScale(closestIndex)

      // Draw vertical day separator (thicker and more visible)
      const dayLine = document.createElement("div")
      dayLine.className = "absolute border-l-2 border-gray-600"
      dayLine.style.left = `${x}px`
      dayLine.style.top = `${padding.top}px`
      dayLine.style.height = `${chartHeight}px`
      container.appendChild(dayLine)

      // Draw day label
      const dayLabel = document.createElement("div")
      dayLabel.className = "absolute text-xs font-bold text-gray-300 transform -translate-x-1/2"
      dayLabel.textContent = `${date.getDate()}.${date.getMonth() + 1}`
      dayLabel.style.left = `${x}px`
      dayLabel.style.top = `${height - 28}px`
      container.appendChild(dayLabel)
    }

    // Determine appropriate hour interval based on time range
    let hourInterval = 1 // Default
    if (timeRangeHours > 48) {
      hourInterval = 6
    } else if (timeRangeHours > 24) {
      hourInterval = 3
    } else if (timeRangeHours > 12) {
      hourInterval = 2
    }

    // Start from the first full hour
    const firstHour = new Date(firstTime)
    firstHour.setMinutes(0, 0, 0)

    // If we're already past the hour, move to the next hour
    if (firstHour.getTime() < firstTime) {
      firstHour.setHours(firstHour.getHours() + 1)
    }

    // Draw hour lines and labels
    for (let time = firstHour.getTime(); time <= lastTime; time += hourInterval * 60 * 60 * 1000) {
      const date = new Date(time)

      // Skip if this is exactly on a day boundary (to avoid overlap with day markers)
      if (date.getHours() === 0) continue

      // Find the closest candle index
      const closestIndex = findClosestCandleIndex(candles, time)
      if (closestIndex === -1) continue

      const x = xScale(closestIndex)

      // Draw vertical grid line for hours
      const gridLine = document.createElement("div")
      gridLine.className = "absolute border-l border-gray-700"
      gridLine.style.left = `${x}px`
      gridLine.style.top = `${padding.top}px`
      gridLine.style.height = `${chartHeight}px`
      container.appendChild(gridLine)

      // Draw hour label
      const hourLabel = document.createElement("div")
      hourLabel.className = "absolute text-xs text-gray-400 transform -translate-x-1/2"
      hourLabel.textContent = `${date.getHours().toString().padStart(2, "0")}:00`
      hourLabel.style.left = `${x}px`
      hourLabel.style.top = `${height - 15}px`
      container.appendChild(hourLabel)
    }

    // Add markers for individual candles based on timeframe
    // Only show these for shorter timeframes and if we have a reasonable number of candles
    if (timeframe === "5m" || timeframe === "15m") {
      // Determine interval for candle markers to avoid overcrowding
      const candleInterval = Math.max(1, Math.ceil(candles.length / 20))

      for (let i = 0; i < candles.length; i += candleInterval) {
        // Skip if this candle is already marked by an hour or day marker
        const candleTime = new Date(candles[i].time)
        if (candleTime.getMinutes() === 0 || candleTime.getHours() === 0) continue

        const x = xScale(i)

        // Draw small tick for candle
        const tickMark = document.createElement("div")
        tickMark.className = "absolute border-l border-gray-800"
        tickMark.style.left = `${x}px`
        tickMark.style.top = `${height - 8}px`
        tickMark.style.height = "4px"
        container.appendChild(tickMark)

        // For certain intervals, add minute labels
        if (i % (candleInterval * 2) === 0 && candles.length < 60) {
          const minuteLabel = document.createElement("div")
          minuteLabel.className = "absolute text-[10px] text-gray-500 transform -translate-x-1/2"
          minuteLabel.textContent = `${candleTime.getMinutes().toString().padStart(2, "0")}`
          minuteLabel.style.left = `${x}px`
          minuteLabel.style.top = `${height - 8}px`
          container.appendChild(minuteLabel)
        }
      }
    }

    // Draw liquidity levels
    // BSL is green (buy side), SSL is red (sell side)

    // For BSL levels (pivot highs - above price)
    liquidityLevels.bsl.forEach((level) => {
      const y = yScale(level.price)
      const startX = xScale(level.candleIndex)

      // Line extends from formation point to right edge
      const line = document.createElement("div")
      line.className = "absolute"
      line.style.top = `${y}px`
      line.style.left = `${startX}px`
      line.style.width = `${width - startX - padding.right}px`

      // Major levels: solid, 2px; Non-major levels: dotted, 1px
      if (level.isMajor) {
        line.style.borderTopWidth = "2px"
        line.style.borderTopStyle = "solid"
        line.style.borderColor = "#089981" // Green for BSL
      } else {
        line.style.borderTopWidth = "1px"
        line.style.borderTopStyle = "dotted"
        line.style.borderColor = "#089981" // Green for BSL but lighter/transparent
        line.style.opacity = "0.6"
      }

      container.appendChild(line)

      // Add label for major levels
      if (level.isMajor) {
        const label = document.createElement("div")
        label.className = "absolute text-xs text-[#089981] font-medium bg-[#121826] px-1 rounded"
        label.textContent = "Major BSL"
        label.style.top = `${y}px`
        label.style.right = "0"
        label.style.transform = "translateY(-50%)"
        container.appendChild(label)

        // Add price label on the y-axis for major levels
        const priceLabel = document.createElement("div")
        priceLabel.className = "absolute text-xs text-[#089981] font-medium bg-[#121826] px-1 rounded"
        priceLabel.textContent = formatPrice(level.price)
        priceLabel.style.top = `${y}px`
        priceLabel.style.left = "0"
        priceLabel.style.transform = "translateY(-50%)"
        container.appendChild(priceLabel)
      }
    })

    // For SSL levels (pivot lows - below price)
    liquidityLevels.ssl.forEach((level) => {
      const y = yScale(level.price)
      const startX = xScale(level.candleIndex)

      // Line extends from formation point to right edge
      const line = document.createElement("div")
      line.className = "absolute"
      line.style.top = `${y}px`
      line.style.left = `${startX}px`
      line.style.width = `${width - startX - padding.right}px`

      // Major levels: solid, 2px; Non-major levels: dotted, 1px
      if (level.isMajor) {
        line.style.borderTopWidth = "2px"
        line.style.borderTopStyle = "solid"
        line.style.borderColor = "#E91E63" // Red for SSL
      } else {
        line.style.borderTopWidth = "1px"
        line.style.borderTopStyle = "dotted"
        line.style.borderColor = "#E91E63" // Red for SSL but lighter/transparent
        line.style.opacity = "0.6"
      }

      container.appendChild(line)

      // Add label for major levels
      if (level.isMajor) {
        const label = document.createElement("div")
        label.className = "absolute text-xs text-[#E91E63] font-medium bg-[#121826] px-1 rounded"
        label.textContent = "Major SSL"
        label.style.top = `${y}px`
        label.style.right = "0"
        label.style.transform = "translateY(-50%)"
        container.appendChild(label)

        // Add price label on the y-axis for major levels
        const priceLabel = document.createElement("div")
        priceLabel.className = "absolute text-xs text-[#E91E63] font-medium bg-[#121826] px-1 rounded"
        priceLabel.textContent = formatPrice(level.price)
        priceLabel.style.top = `${y}px`
        priceLabel.style.left = "0"
        priceLabel.style.transform = "translateY(-50%)"
        container.appendChild(priceLabel)
      }
    })

    // Draw current price line
    const currentY = yScale(currentPrice)
    const priceLine = document.createElement("div")
    priceLine.className = "absolute w-full border-t-2 border-dashed border-yellow-500"
    priceLine.style.top = `${currentY}px`
    container.appendChild(priceLine)

    const priceLabel = document.createElement("div")
    priceLabel.className = "absolute text-xs font-bold bg-yellow-500 text-black px-1 rounded"
    priceLabel.textContent = formatPrice(currentPrice)
    priceLabel.style.top = `${currentY}px`
    priceLabel.style.right = "0"
    priceLabel.style.transform = "translateY(-50%)"
    container.appendChild(priceLabel)

    // Draw crosshair if active
    if (crosshair && crosshair.visible) {
      // Horizontal line
      const horizontalLine = document.createElement("div")
      horizontalLine.className = "absolute border-t border-dashed border-gray-400 z-10"
      horizontalLine.style.top = `${crosshair.y}px`
      horizontalLine.style.left = `${padding.left}px`
      horizontalLine.style.width = `${chartWidth}px`
      container.appendChild(horizontalLine)

      // Vertical line
      const verticalLine = document.createElement("div")
      verticalLine.className = "absolute border-l border-dashed border-gray-400 z-10"
      verticalLine.style.left = `${crosshair.x}px`
      verticalLine.style.top = `${padding.top}px`
      verticalLine.style.height = `${chartHeight}px`
      container.appendChild(verticalLine)

      // Price label at crosshair
      const crosshairPriceLabel = document.createElement("div")
      crosshairPriceLabel.className = "absolute text-xs bg-gray-800 text-white px-1 py-0.5 rounded z-20"
      crosshairPriceLabel.textContent = formatPriceForPair(crosshair.price, selectedPair)
      crosshairPriceLabel.style.top = `${crosshair.y}px`
      crosshairPriceLabel.style.left = "0"
      crosshairPriceLabel.style.transform = "translateY(-50%)"
      container.appendChild(crosshairPriceLabel)

      // Time label at crosshair
      const crosshairTimeLabel = document.createElement("div")
      crosshairTimeLabel.className = "absolute text-xs bg-gray-800 text-white px-1 py-0.5 rounded z-20"
      crosshairTimeLabel.textContent = formatTimeForTimeframe(crosshair.time, timeframe)
      crosshairTimeLabel.style.left = `${crosshair.x}px`
      crosshairTimeLabel.style.bottom = "0"
      crosshairTimeLabel.style.transform = "translateX(-50%)"
      container.appendChild(crosshairTimeLabel)
    }
  }, [candles, liquidityLevels, currentPrice, crosshair, selectedPair, timeframe])

  return (
    <div className="relative h-[400px]">
      <div
        ref={containerRef}
        className="absolute top-0 right-0 bottom-0 left-0 bg-[#121826]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      ></div>
    </div>
  )
}

// Helper functions
function getTimeframeMs(timeframe: string): number {
  switch (timeframe) {
    case "5m":
      return 5 * 60 * 1000
    case "15m":
      return 15 * 60 * 1000
    case "30m":
      return 30 * 60 * 1000
    case "1h":
      return 60 * 60 * 1000
    default:
      return 15 * 60 * 1000
  }
}

// Update the getSwingStrength function to match the TradingView indicator
function getSwingStrength(timeframe: string): number {
  switch (timeframe) {
    case "5m":
      return 5 // Match the default in the Pine Script
    case "15m":
      return 5 // Match the default in the Pine Script
    case "30m":
      return 5 // Match the default in the Pine Script
    case "1h":
      return 5 // Match the default in the Pine Script
    default:
      return 5 // Match the default in the Pine Script
  }
}

function getPriceStep(maxPrice: number): number {
  if (maxPrice > 50000) return 1000
  if (maxPrice > 10000) return 500
  if (maxPrice > 5000) return 200
  if (maxPrice > 1000) return 100
  if (maxPrice > 500) return 50
  if (maxPrice > 100) return 10
  if (maxPrice > 50) return 5
  if (maxPrice > 10) return 1
  if (maxPrice > 1) return 0.1
  return 0.01
}

function formatPrice(price: number): string {
  if (price >= 10000) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  } else if (price >= 1000) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  } else if (price >= 100) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } else if (price >= 10) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  } else if (price >= 1) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  } else if (price >= 0.1) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
  } else if (price >= 0.01) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })
  } else if (price >= 0.001) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 7, maximumFractionDigits: 7 })
  } else {
    return price.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })
  }
}

// Format price with precision appropriate for the perpetual
function formatPriceForPair(price: number, pair: string): string {
  // Different precision for different assets
  if (pair.startsWith("BTC")) {
    return price >= 10000
      ? price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } else if (pair.startsWith("ETH")) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } else if (pair.startsWith("SOL") || pair.startsWith("AVAX")) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  } else if (price >= 100) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } else if (price >= 1) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  } else if (price >= 0.1) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  } else if (price >= 0.01) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
  } else if (price >= 0.001) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })
  } else {
    return price.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })
  }
}

// Format time with precision appropriate for the timeframe
function formatTimeForTimeframe(timestamp: number, timeframe: string): string {
  const date = new Date(timestamp)

  // Format based on timeframe
  switch (timeframe) {
    case "5m":
    case "15m":
    case "30m":
      // For shorter timeframes, show hours:minutes
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
    case "1h":
      // For 1h, show day and hour
      return `${date.getDate()}.${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:00`
    default:
      // Default format
      return `${date.getDate()}.${date.getMonth() + 1} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
  }
}

function findClosestCandleIndex(candles: CandleData[], timestamp: number): number {
  let closestIndex = -1
  let minDiff = Number.MAX_VALUE

  candles.forEach((candle, index) => {
    const diff = Math.abs(candle.time - timestamp)
    if (diff < minDiff) {
      minDiff = diff
      closestIndex = index
    }
  })

  return closestIndex
}
