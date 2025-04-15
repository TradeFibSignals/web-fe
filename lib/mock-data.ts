// Mock data generator for the liquidation visualization tool

type TimeframeType = "1h" | "4h" | "12h" | "24h" | "7d"

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

interface TradingSignal {
  type: "entry" | "exit"
  price: number
  description: string
  strength: "low" | "medium" | "high"
  riskReward: string
}

export function generateMockData(timeframe: TimeframeType) {
  // Base price around which we'll generate data
  const basePrice = 65000 + Math.random() * 5000

  // Current price with some random variation
  const currentPrice = basePrice + (Math.random() * 2000 - 1000)

  // Price change percentage (between -5% and 5%)
  const priceChangePercent = Math.random() * 10 - 5

  // Generate time range based on timeframe
  const now = Date.now()
  let startTime: number

  switch (timeframe) {
    case "1h":
      startTime = now - 60 * 60 * 1000
      break
    case "4h":
      startTime = now - 4 * 60 * 60 * 1000
      break
    case "12h":
      startTime = now - 12 * 60 * 60 * 1000
      break
    case "24h":
      startTime = now - 24 * 60 * 60 * 1000
      break
    case "7d":
      startTime = now - 7 * 24 * 60 * 60 * 1000
      break
    default:
      startTime = now - 24 * 60 * 60 * 1000
  }

  // Generate liquidation data
  const liquidationData: LiquidationData[] = []

  // Number of data points based on timeframe
  const numDataPoints =
    timeframe === "7d" ? 100 : timeframe === "24h" ? 50 : timeframe === "12h" ? 30 : timeframe === "4h" ? 20 : 10

  // Generate long liquidations (typically below current price)
  for (let i = 0; i < numDataPoints; i++) {
    const price = currentPrice * (0.85 + Math.random() * 0.1) // 85-95% of current price
    const volume = Math.random() * 10 + 0.5 // 0.5-10.5 BTC
    const time = startTime + (now - startTime) * Math.random()

    liquidationData.push({
      price,
      volume,
      time,
      type: "long",
    })
  }

  // Generate short liquidations (typically above current price)
  for (let i = 0; i < numDataPoints; i++) {
    const price = currentPrice * (1.05 + Math.random() * 0.1) // 105-115% of current price
    const volume = Math.random() * 10 + 0.5 // 0.5-10.5 BTC
    const time = startTime + (now - startTime) * Math.random()

    liquidationData.push({
      price,
      volume,
      time,
      type: "short",
    })
  }

  // Generate price data
  const priceData: PriceData[] = []
  const timeStep = (now - startTime) / 50 // 50 data points

  let lastPrice = basePrice - (Math.random() * 2000 - 1000)

  for (let i = 0; i < 50; i++) {
    const time = startTime + i * timeStep
    // Random walk with some trend based on price change
    const priceChange = Math.random() * 200 - 100 + priceChangePercent * 10
    lastPrice = lastPrice + priceChange

    priceData.push({
      price: lastPrice,
      time,
    })
  }

  // Sort price data by time
  priceData.sort((a, b) => a.time - b.time)

  // Generate LPI (Liquidation Pressure Index) - 0-100%
  const lpi = Math.floor(Math.random() * 100)

  // Generate LIO (Liquidation Imbalance Oscillator) - 0-100%
  const lio = Math.floor(Math.random() * 100)

  // Generate trading signals
  const tradingSignals: TradingSignal[] = []

  // Only generate signals sometimes
  if (Math.random() > 0.3) {
    // Entry signal
    tradingSignals.push({
      type: "entry",
      price: currentPrice * (0.97 + Math.random() * 0.02), // Slightly below current price
      description: "Strong buy zone with liquidation support. Multiple short liquidations clustered in this area.",
      strength: Math.random() > 0.6 ? "high" : Math.random() > 0.3 ? "medium" : "low",
      riskReward: `1:${Math.floor(Math.random() * 3) + 2}`, // 1:2 to 1:5
    })
  }

  if (Math.random() > 0.4) {
    // Exit signal
    tradingSignals.push({
      type: "exit",
      price: currentPrice * (1.03 + Math.random() * 0.05), // Slightly above current price
      description: "Take profit zone with potential resistance. Long liquidation cluster detected.",
      strength: Math.random() > 0.6 ? "high" : Math.random() > 0.3 ? "medium" : "low",
      riskReward: `1:${Math.floor(Math.random() * 3) + 2}`, // 1:2 to 1:5
    })
  }

  return {
    liquidationData,
    priceData,
    currentPrice,
    priceChangePercent,
    lpi,
    lio,
    tradingSignals,
  }
}
