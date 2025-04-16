// ICT Liquidity Levels calculation utility
// Based on the Pine Script indicator by CCE_Charts

export type LiquidityLevel = {
  price: number
  time: number
  candleIndex: number
  isMajor: boolean
  isTraded: boolean
  isTradedByBody: boolean
  type: "BSL" | "SSL" // Buyside or Sellside Liquidity
}

export type CandleData = {
  open: number
  high: number
  low: number
  close: number
  time: number
}

interface LiquidityLevelsOptions {
  swingStrength?: number
  majorThreshold?: number
  reqThreshold?: number
}

// Update the getTimeframeMs function in candlestick-chart.tsx
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

// Update the getSwingStrength function
function getSwingStrength(timeframe: string): number {
  switch (timeframe) {
    case "5m":
      return 3
    case "15m":
      return 4
    case "30m":
      return 5
    case "1h":
      return 6
    default:
      return 4
  }
}

// Update the calculateLiquidityLevels function to match the TradingView indicator more precisely
export function calculateLiquidityLevels(
  candles: CandleData[],
  options: LiquidityLevelsOptions = {},
): { bsl: LiquidityLevel[]; ssl: LiquidityLevel[] } {
  // Default options
  const swingStrength = options.swingStrength || 5
  const majorThreshold = options.majorThreshold || 0.3 // Sníženo z 0.5 na 0.3 pro lepší detekci major levelů
  const reqThreshold = options.reqThreshold || 2.0

  if (candles.length < swingStrength * 2 + 1) {
    return { bsl: [], ssl: [] }
  }

  const bsl: LiquidityLevel[] = []
  const ssl: LiquidityLevel[] = []

  // Find pivot highs and lows
  for (let i = swingStrength; i < candles.length - swingStrength; i++) {
    // Check for pivot high
    let isPivotHigh = true
    for (let j = 1; j <= swingStrength; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isPivotHigh = false
        break
      }
    }

    // Check for pivot low
    let isPivotLow = true
    for (let j = 1; j <= swingStrength; j++) {
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isPivotLow = false
        break
      }
    }

    // Calculate swing size and determine if it's a major level
    // Swap the BSL and SSL designations to match TradingView's implementation
    // For pivot highs (which were previously SSL), change to BSL
    if (isPivotHigh) {
      // For BSL (Buy Side Liquidity), calculate swing size as percentage
      const swingSize = ((candles[i - swingStrength].high - candles[i].high) / candles[i].high) * 100

      // IMPORTANT: Modified major level detection to match TradingView
      const isMajor =
        swingSize >= majorThreshold ||
        (i > swingStrength * 2 &&
          (Math.abs(candles[i].high - candles[i - swingStrength * 2].high) / candles[i].high) * 100 >=
            majorThreshold * 1.5)

      bsl.push({
        price: candles[i].high,
        time: candles[i].time,
        candleIndex: i,
        isMajor,
        isTraded: false,
        isTradedByBody: false,
        type: "BSL",
      })
    }

    // For pivot lows (which were previously BSL), change to SSL
    if (isPivotLow) {
      // For SSL (Sell Side Liquidity), calculate swing size as percentage
      const swingSize = ((candles[i].low - candles[i + swingStrength].low) / candles[i + swingStrength].low) * 100

      // IMPORTANT: Modified major level detection to match TradingView
      const isMajor =
        swingSize >= majorThreshold ||
        (i < candles.length - swingStrength * 2 &&
          (Math.abs(candles[i].low - candles[i + swingStrength * 2].low) / candles[i].low) * 100 >=
            majorThreshold * 1.5)

      ssl.push({
        price: candles[i].low,
        time: candles[i].time,
        candleIndex: i,
        isMajor,
        isTraded: false,
        isTradedByBody: false,
        type: "SSL",
      })
    }
  }

  // Process REQ (Relative Equal) levels exactly as in the Pine Script
  const processREQ = (levels: LiquidityLevel[], isBSL: boolean): LiquidityLevel[] => {
    const result: LiquidityLevel[] = [...levels]

    // Mark levels for removal
    const toRemove = new Set<number>()

    for (let i = 0; i < result.length; i++) {
      if (toRemove.has(i)) continue

      for (let j = i + 1; j < result.length; j++) {
        if (toRemove.has(j)) continue

        const priceDiff = Math.abs(result[i].price - result[j].price)
        const percentDiff = (priceDiff / result[i].price) * 100

        // Use percentage-based comparison for REQ detection
        if (percentDiff <= reqThreshold * 0.01) {
          // Convert to percentage threshold
          // For BSL: Keep higher level
          // For SSL: Keep lower level
          // Also preserve major levels over non-major ones
          if (result[i].isMajor && !result[j].isMajor) {
            toRemove.add(j)
          } else if (!result[i].isMajor && result[j].isMajor) {
            toRemove.add(i)
            break
          } else if (isBSL) {
            if (result[i].price > result[j].price) {
              toRemove.add(j)
            } else {
              toRemove.add(i)
              break
            }
          } else {
            if (result[i].price < result[j].price) {
              toRemove.add(j)
            } else {
              toRemove.add(i)
              break
            }
          }
        }
      }
    }

    // Filter out removed levels
    return result.filter((_, index) => !toRemove.has(index))
  }

  // Process REQ levels
  const processedBSL = processREQ(bsl, true)
  const processedSSL = processREQ(ssl, false)

  // Mark traded levels - check both wick and body penetration
  const markTraded = (levels: LiquidityLevel[], isBSL: boolean): LiquidityLevel[] => {
    return levels.map((level) => {
      let isTraded = false
      let isTradedByBody = false

      // Check if any candle has traded through this level
      // Only check candles that come AFTER the level was formed
      for (let i = level.candleIndex + 1; i < candles.length; i++) {
        const candle = candles[i]

        // For BSL (resistance levels above price)
        if (isBSL) {
          // Check if price went above the level (traded)
          if (candle.high > level.price) {
            isTraded = true

            // Check if candle body went above the level (traded by body)
            // For bullish candles: check if close went above
            // For bearish candles: check if open went above
            if (
              (candle.close >= candle.open && candle.close > level.price) ||
              (candle.close < candle.open && candle.open > level.price)
            ) {
              isTradedByBody = true
              break // Once we confirm it's traded by body, we can stop checking
            }
          }
        }
        // For SSL (support levels below price)
        else {
          // Check if price went below the level (traded)
          if (candle.low < level.price) {
            isTraded = true

            // Check if candle body went below the level (traded by body)
            // For bullish candles: check if open went below
            // For bearish candles: check if close went below
            if (
              (candle.close >= candle.open && candle.open < level.price) ||
              (candle.close < candle.open && candle.close < level.price)
            ) {
              isTradedByBody = true
              break // Once we confirm it's traded by body, we can stop checking
            }
          }
        }
      }

      return { ...level, isTraded, isTradedByBody }
    })
  }

  const finalBSL = markTraded(processedBSL, true)
  const finalSSL = markTraded(processedSSL, false)

  return {
    bsl: finalBSL,
    ssl: finalSSL,
  }
}

// Add the missing export
export function analyzeLiquidityLevels(
  candles: CandleData[],
  timeframe: string,
): {
  bsl: LiquidityLevel[]
  ssl: LiquidityLevel[]
} {
  // Determine appropriate swing strength based on timeframe
  const swingStrength = getSwingStrength(timeframe)

  // Calculate liquidity levels with appropriate parameters for the timeframe
  return calculateLiquidityLevels(candles, {
    swingStrength,
    majorThreshold: 0.3,
    reqThreshold: 2.0,
  })
}
