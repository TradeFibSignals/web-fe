// Binance API integration for fetching real liquidation and price data

import type { CandleData } from "@/types"

type TimeframeType = "5m" | "15m" | "30m" | "1h"

interface LiquidationData {
  price: number
  volume: number
  time: number
  type: "long" | "short"
}

interface PriceData {
  price: number
  time: number
}

interface BinanceApiResponse {
  liquidationData: LiquidationData[]
  priceData: PriceData[]
  currentPrice: number
  priceChangePercent: number
}

// Cache for seed values to ensure consistent data generation
const seedCache: Record<string, number> = {}

// Function to fetch available perpetual pairs from Binance
export async function fetchAvailablePairs(): Promise<string[]> {
  try {
    // Fetch exchange info from Binance
    const response = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo")
    const data = await response.json()

    // Extract USDT perpetual pairs
    const pairs = data.symbols
      .filter(
        (symbol: any) =>
          symbol.status === "TRADING" && symbol.contractType === "PERPETUAL" && symbol.quoteAsset === "USDT",
      )
      .map((symbol: any) => symbol.symbol)

    return pairs
  } catch (error) {
    console.error("Error fetching available pairs:", error)
    return []
  }
}

export async function fetchBinanceData(
  timeframe: TimeframeType,
  symbol = "BTCUSDT",
  priceDataOnly = false,
): Promise<BinanceApiResponse> {
  try {
    // Get current time and calculate start time (1 day ago)
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000 // 1 day in milliseconds

    // Fetch current price and 24h change
    const tickerResponse = await fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`)
    const tickerData = await tickerResponse.json()
    const currentPrice = Number.parseFloat(tickerData.lastPrice)
    const priceChangePercent = Number.parseFloat(tickerData.priceChangePercent)

    // Determine appropriate kline interval based on timeframe
    // For each timeframe, we want enough data points to create a good chart
    let interval: string
    let limit: number

    switch (timeframe) {
      case "5m":
        interval = "5m"
        limit = 288 // 5 minutes × 288 = 1 day
        break
      case "15m":
        interval = "15m"
        limit = 96 // 15 minutes × 96 = 1 day
        break
      case "30m":
        interval = "30m"
        limit = 48 // 30 minutes × 48 = 1 day
        break
      case "1h":
        interval = "1h"
        limit = 24 // 1 hour × 24 = 1 day
        break
      default:
        interval = "15m"
        limit = 96
    }

    // Fetch kline/candlestick data for price chart
    const klinesResponse = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${oneDayAgo}&limit=${limit}`,
    )
    const klinesData = await klinesResponse.json()

    const priceData: PriceData[] = klinesData.map((kline: any) => ({
      time: kline[0], // Open time
      price: Number.parseFloat(kline[4]), // Close price
    }))

    // If we only need price data, return early
    if (priceDataOnly) {
      return {
        liquidationData: [], // Empty array as we're not generating new liquidation data
        priceData,
        currentPrice,
        priceChangePercent,
      }
    }

    // Generate liquidation data based on real price levels
    // Since Binance doesn't provide a public API for liquidation data,
    // we'll generate synthetic data but based on real price ranges

    // Find min and max price from real data
    const prices = priceData.map((d) => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Calculate price range for liquidation levels
    const priceRange = maxPrice - minPrice
    const longLiquidationCenter = currentPrice * 0.95 // 5% below current price
    const shortLiquidationCenter = currentPrice * 1.05 // 5% above current price

    // Generate liquidation data with consistent seed for the same symbol and timeframe
    const liquidationData = generateLiquidationData(
      priceData,
      currentPrice,
      longLiquidationCenter,
      shortLiquidationCenter,
      symbol,
      timeframe,
    )

    return {
      liquidationData,
      priceData,
      currentPrice,
      priceChangePercent,
    }
  } catch (error) {
    console.error(`Error fetching data for ${symbol} from Binance:`, error)
    throw error
  }
}

// Simple hash function for string
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Generate synthetic liquidation data based on real price levels
function generateLiquidationData(
  priceData: PriceData[],
  currentPrice: number,
  longLiquidationCenter: number,
  shortLiquidationCenter: number,
  symbol: string,
  timeframe: TimeframeType,
): LiquidationData[] {
  const liquidationData: LiquidationData[] = []

  // Use consistent seed for the same symbol and timeframe
  const seedKey = `${symbol}-${timeframe}`
  if (!seedCache[seedKey]) {
    seedCache[seedKey] = hashString(seedKey)
  }
  const seed = seedCache[seedKey]

  // Pseudo-random number generator with seed
  const seededRandom = (min: number, max: number, index: number): number => {
    const x = Math.sin(seed + index) * 10000
    const rand = x - Math.floor(x)
    return min + rand * (max - min)
  }

  // Find time range from price data
  const times = priceData.map((d) => d.time)
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)

  // Calculate price volatility to adjust liquidation spread
  const prices = priceData.map((d) => d.price)
  const maxPrice = Math.max(...prices)
  const minPrice = Math.min(...prices)
  const priceRange = maxPrice - minPrice
  const volatilityFactor = priceRange / currentPrice // Normalized volatility

  // Adjust liquidation spreads based on volatility (min 2%, max 10%)
  const spreadFactor = Math.max(0.02, Math.min(0.1, volatilityFactor * 2))

  // Generate long liquidations (below current price)
  const longLiquidationSpread = currentPrice * spreadFactor

  for (let i = 0; i < 50; i++) {
    const price = longLiquidationCenter + seededRandom(-1, 1, i) * longLiquidationSpread
    const volume = seededRandom(0.5, 5.5, i + 100) // 0.5-5.5 units
    const time = minTime + seededRandom(0, 1, i + 200) * (maxTime - minTime)

    liquidationData.push({
      price,
      volume,
      time,
      type: "long",
    })
  }

  // Generate short liquidations (above current price)
  const shortLiquidationSpread = currentPrice * spreadFactor

  for (let i = 0; i < 50; i++) {
    const price = shortLiquidationCenter + seededRandom(-1, 1, i + 300) * shortLiquidationSpread
    const volume = seededRandom(0.5, 5.5, i + 400) // 0.5-5.5 units
    const time = minTime + seededRandom(0, 1, i + 500) * (maxTime - minTime)

    liquidationData.push({
      price,
      volume,
      time,
      type: "short",
    })
  }

  return liquidationData
}

// Function to convert candle data to CandleData format for the chart
// export interface CandleData {
//   open: number
//   high: number
//   low: number
//   close: number
//   time: number
// }

export async function fetchHistoricalCandles(
  symbol: string,
  timeframe: TimeframeType,
  days = 1,
): Promise<CandleData[]> {
  try {
    const now = Date.now()
    const startTime = now - days * 24 * 60 * 60 * 1000 // X days ago

    // Determine appropriate kline interval and limit
    let interval: string
    let limit: number

    switch (timeframe) {
      case "5m":
        interval = "5m"
        limit = 288 * days // 5 minutes × 288 = 1 day
        break
      case "15m":
        interval = "15m"
        limit = 96 * days // 15 minutes × 96 = 1 day
        break
      case "30m":
        interval = "30m"
        limit = 48 * days // 30 minutes × 48 = 1 day
        break
      case "1h":
        interval = "1h"
        limit = 24 * days // 1 hour × 24 = 1 day
        break
      default:
        interval = "15m"
        limit = 96 * days
    }

    // Limit to maximum allowed by Binance API
    limit = Math.min(limit, 1000)

    const response = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&limit=${limit}`,
    )
    const data = await response.json()

    // Convert to CandleData format
    return data.map((kline: any) => ({
      time: kline[0], // Open time
      open: Number.parseFloat(kline[1]),
      high: Number.parseFloat(kline[2]),
      low: Number.parseFloat(kline[3]),
      close: Number.parseFloat(kline[4]),
    }))
  } catch (error) {
    console.error(`Error fetching historical candles for ${symbol}:`, error)
    return []
  }
}

// Add this function to fetch candles for different timeframes
export async function fetchTimeframeCandles(symbol: string, timeframe: string, limit = 20): Promise<CandleData[]> {
  try {
    // Map timeframe to Binance interval format
    let interval: string
    switch (timeframe) {
      case "1d":
        interval = "1d"
        break
      case "1M":
        interval = "1M"
        break
      default:
        interval = timeframe
    }

    const response = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch ${timeframe} candles: ${response.status}`)
    }

    const data = await response.json()

    // Convert to CandleData format
    return data.map((kline: any) => ({
      time: kline[0], // Open time
      open: Number.parseFloat(kline[1]),
      high: Number.parseFloat(kline[2]),
      low: Number.parseFloat(kline[3]),
      close: Number.parseFloat(kline[4]),
      volume: Number.parseFloat(kline[5]), // Volume
    }))
  } catch (error) {
    console.error(`Error fetching ${timeframe} candles for ${symbol}:`, error)
    return []
  }
}

// Přidám novou funkci pro získání historických high/low hodnot
export async function getHighLowSinceTimestamp(
  symbol: string,
  startTime: number,
): Promise<{ high: number; low: number }> {
  try {
    // Získáme 1-minutové svíčky od startTime do současnosti
    // Použijeme menší interval pro zachycení krátkodobých cenových špiček
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startTime}&limit=1000`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.statusText}`)
    }

    const data = await response.json()

    // Zpracování dat
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("No historical data received")
      return { high: 0, low: Number.MAX_SAFE_INTEGER }
    }

    // Najdeme nejvyšší high a nejnižší low ze všech svíček
    let highestPrice = 0
    let lowestPrice = Number.MAX_SAFE_INTEGER

    for (const candle of data) {
      const high = Number.parseFloat(candle[2]) // high je na indexu 2
      const low = Number.parseFloat(candle[3]) // low je na indexu 3

      if (high > highestPrice) {
        highestPrice = high
      }

      if (low < lowestPrice) {
        lowestPrice = low
      }
    }

    console.log(
      `Historical price range since ${new Date(startTime).toISOString()}: High: ${highestPrice}, Low: ${lowestPrice}`,
    )

    return {
      high: highestPrice,
      low: lowestPrice,
    }
  } catch (error) {
    console.error("Error fetching historical high/low:", error)
    return { high: 0, low: Number.MAX_SAFE_INTEGER }
  }
}
