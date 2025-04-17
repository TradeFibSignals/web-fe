"use client"

import { createContext, useContext, useState, useCallback, type ReactNode, useEffect, useRef } from "react"
import {
  fetchBinanceData,
  fetchAvailablePairs, 
  fetchHistoricalCandles,
  fetchTimeframeCandles,
  type CandleData
} from "@/lib/binance-api"
import { binanceWebSocket } from "@/lib/websocket-service"
import { checkActiveSignals, getActiveSignals, completeSignal, cancelSignal } from "@/lib/signals-service"

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

interface TradingSignal {
  type: "entry" | "exit"
  price: number
  description: string
  strength: "low" | "medium" | "high"
}

interface LiquidationContextType {
  liquidationData: LiquidationData[]
  priceData: PriceData[]
  currentPrice: number
  priceChangePercent: number
  timeframe: TimeframeType
  setTimeframe: (timeframe: TimeframeType) => void
  selectedPair: string
  setSelectedPair: (pair: string) => void
  availablePairs: string[]
  lpi: number
  lio: number
  tradingSignals: TradingSignal[]
  fetchData: () => Promise<void>
  refreshData: () => Promise<void>
  isLoading: boolean
  lastUpdated: Date | null
  volumeData: {
    longVolumeByPrice: Record<number, number>
    shortVolumeByPrice: Record<number, number>
    maxBucketVolume: number
  }
  nextUpdateTime: Date | null
  historicalCandles: CandleData[]
  activeSignals: TradingSignal[]
  refreshActiveSignals: () => Promise<void>
  completeSignal: (signalId: string, exitPrice: number, exitType: "tp" | "sl" | "manual") => Promise<void>
  cancelSignal: (signalId: string) => void
}

const LiquidationContext = createContext<LiquidationContextType | undefined>(undefined)

// Default pairs to show
const DEFAULT_PAIRS = ["BTCUSDT", "SOLUSDT", "TIAUSDT", "ONDOUSDT", "VIRTUALUSDT", "SUSHIUSDT", "XTZUSDT"]

// Helper function to get update interval based on timeframe
function getUpdateInterval(timeframe: TimeframeType): number {
  switch (timeframe) {
    case "5m":
      return 30 * 1000 // 30 seconds
    case "15m":
      return 45 * 1000 // 45 seconds
    case "30m":
      return 60 * 1000 // 1 minute
    case "1h":
      return 2 * 60 * 1000 // 2 minutes
    default:
      return 45 * 1000 // 45 seconds default
  }
}

// Get timeframe duration in milliseconds for S/R zone updates
function getTimeframeDuration(timeframe: TimeframeType): number {
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

// Calculate next update time based on timeframe
function getNextUpdateTime(timeframe: TimeframeType): Date {
  const now = new Date()
  const nextUpdate = new Date(now)

  switch (timeframe) {
    case "5m":
      // Next 5-minute mark
      nextUpdate.setUTCMinutes(Math.ceil(now.getUTCMinutes() / 5) * 5, 0, 0)
      break
    case "15m":
      // Next 15-minute mark
      nextUpdate.setUTCMinutes(Math.ceil(now.getUTCMinutes() / 15) * 15, 0, 0)
      break
    case "30m":
      // Next 30-minute mark
      nextUpdate.setUTCMinutes(Math.ceil(now.getUTCMinutes() / 30) * 30, 0, 0)
      break
    case "1h":
      // Next hour
      nextUpdate.setUTCHours(now.getUTCHours() + 1, 0, 0, 0)
      break
    default:
      nextUpdate.setUTCMinutes(Math.ceil(now.getUTCMinutes() / 15) * 15, 0, 0)
  }

  // If the calculated time is in the past (less than 10 seconds from now),
  // add one timeframe duration to get the next valid update time
  if (nextUpdate.getTime() - now.getTime() < 10000) {
    switch (timeframe) {
      case "5m":
        nextUpdate.setUTCMinutes(nextUpdate.getUTCMinutes() + 5)
        break
      case "15m":
        nextUpdate.setUTCMinutes(nextUpdate.getUTCMinutes() + 15)
        break
      case "30m":
        nextUpdate.setUTCMinutes(nextUpdate.getUTCMinutes() + 30)
        break
      case "1h":
        nextUpdate.setUTCHours(nextUpdate.getUTCHours() + 1)
        break
      default:
        nextUpdate.setUTCMinutes(nextUpdate.getUTCMinutes() + 15)
    }
  }

  return nextUpdate
}

// Default support and resistance levels for different timeframes
// These will be used as fallbacks if no strong clusters are found
const DEFAULT_LEVELS: Record<string, Record<string, { support: number; resistance: number }>> = {
  BTCUSDT: {
    "1h": { support: 63000, resistance: 67000 },
    "30m": { support: 63500, resistance: 66500 },
    "15m": { support: 63800, resistance: 66200 },
    "5m": { support: 64000, resistance: 66000 },
  },
}

export function LiquidationProvider({ children }: { children: ReactNode }) {
  const [liquidationData, setLiquidationData] = useState<LiquidationData[]>([])
  const [priceData, setPriceData] = useState<PriceData[]>([])
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0)
  const [timeframe, setTimeframe] = useState<TimeframeType>("15m")
  const [selectedPair, setSelectedPair] = useState<string>("BTCUSDT")
  const [availablePairs, setAvailablePairs] = useState<string[]>(DEFAULT_PAIRS)
  const [lpi, setLpi] = useState<number>(0)
  const [lio, setLio] = useState<number>(0)
  const [tradingSignals, setTradingSignals] = useState<TradingSignal[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nextUpdateTime, setNextUpdateTime] = useState<Date | null>(null)
  const [historicalCandles, setHistoricalCandles] = useState<CandleData[]>([])
  const [volumeData, setVolumeData] = useState<{
    longVolumeByPrice: Record<number, number>
    shortVolumeByPrice: Record<number, number>
    maxBucketVolume: number
  }>({
    longVolumeByPrice: {},
    shortVolumeByPrice: {},
    maxBucketVolume: 1,
  })
  
  // Added state for active signals
  const [activeSignals, setActiveSignals] = useState<TradingSignal[]>([])

  // Use refs to store stable data for each pair
  const stableDataRef = useRef
    Record
      string,
      {
        liquidationData: LiquidationData[]
        supportLevel: number
        resistanceLevel: number
        lpi: number
        lio: number
        lastFullUpdate: Date
        needsUpdate: boolean
        nextUpdateTime: Date
      }
    >
  >({})

  // Ref to track if an update is in progress
  const updateInProgressRef = useRef<boolean>(false)

  // WebSocket message handler
  const handleWebSocketMessage = useCallback(
    (data: any) => {
      if (data && data.s === selectedPair) {
        // Update current price from WebSocket
        const newPrice = Number.parseFloat(data.c)
        setCurrentPrice(newPrice)

        // Update price change percentage
        const priceChangePercent = Number.parseFloat(data.P)
        setPriceChangePercent(priceChangePercent)

        // Add new price data point
        const now = Date.now()
        setPriceData((prevData) => {
          // Keep only the last 50 data points to avoid memory issues
          const newData = [...prevData, { price: newPrice, time: now }]
          if (newData.length > 50) {
            return newData.slice(-50)
          }
          return newData
        })

        // Check if price has moved beyond S/R zones and mark for update if needed
        const key = `${selectedPair}-${timeframe}`
        if (stableDataRef.current[key]) {
          const { supportLevel, resistanceLevel } = stableDataRef.current[key]

          // If price moves below support or above resistance, mark for update
          if (newPrice < supportLevel * 0.98 || newPrice > resistanceLevel * 1.02) {
            stableDataRef.current[key].needsUpdate = true
          }
        }
      }
    },
    [selectedPair, timeframe],
  )

  // Fetch historical candles when pair or timeframe changes
  const fetchHistoricalData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Explicitly use fetchHistoricalCandles or fetchTimeframeCandles from binance-api.ts
      const candles = await fetchHistoricalCandles(selectedPair, timeframe)
      setHistoricalCandles(candles)
    } catch (error) {
      console.error("Error fetching historical data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedPair, timeframe])

  // Connect to WebSocket when selectedPair changes
  useEffect(() => {
    // Disconnect from previous WebSocket if any
    binanceWebSocket.disconnect()

    // Connect to new WebSocket for the selected pair
    binanceWebSocket.connect(selectedPair.toLowerCase())

    // Subscribe to WebSocket messages
    binanceWebSocket.subscribe("message", handleWebSocketMessage)

    // Cleanup on unmount or when selectedPair changes
    return () => {
      binanceWebSocket.unsubscribe("message", handleWebSocketMessage)
    }
  }, [selectedPair, handleWebSocketMessage])

  // Fetch available pairs on mount
  useEffect(() => {
    async function loadPairs() {
      try {
        const pairs = await fetchAvailablePairs()

        // Filter for USDT perpetual pairs and ensure our default pairs are included
        const usdtPairs = pairs.filter((pair) => pair.endsWith("USDT"))

        // Combine default pairs with fetched pairs, remove duplicates
        const combinedPairs = [...new Set([...DEFAULT_PAIRS, ...usdtPairs])]

        setAvailablePairs(combinedPairs)
      } catch (error) {
        console.error("Error fetching available pairs:", error)
        // Fallback to default pairs if API fails
        setAvailablePairs(DEFAULT_PAIRS)
      }
    }

    loadPairs()
  }, [])

  // Fetch historical data on mount and when pair/timeframe changes
  useEffect(() => {
    fetchHistoricalData()
  }, [selectedPair, timeframe, fetchHistoricalData])

  // Calculate volume data for visualization
  const calculateVolumeData = useCallback((liquidations: LiquidationData[], currentPrice: number) => {
    const longLiquidations = liquidations.filter((liq) => liq.type === "long")
    const shortLiquidations = liquidations.filter((liq) => liq.type === "short")

    // Calculate total volumes for normalization
    const totalLongVolume = longLiquidations.reduce((sum, liq) => sum + liq.volume, 0)
    const totalShortVolume = shortLiquidations.reduce((sum, liq) => sum + liq.volume, 0)

    // Determine price bucket size based on current price
    const priceMagnitude = Math.floor(Math.log10(currentPrice))
    const priceBucketSize = Math.max(0.0001, Math.pow(10, priceMagnitude - 2))

    // Group by price ranges for heatmap
    const longVolumeByPrice: Record<number, number> = {}
    const shortVolumeByPrice: Record<number, number> = {}

    longLiquidations.forEach((liq) => {
      const bucket = Math.floor(liq.price / priceBucketSize) * priceBucketSize
      longVolumeByPrice[bucket] = (longVolumeByPrice[bucket] || 0) + liq.volume
    })

    shortLiquidations.forEach((liq) => {
      const bucket = Math.floor(liq.price / priceBucketSize) * priceBucketSize
      shortVolumeByPrice[bucket] = (shortVolumeByPrice[bucket] || 0) + liq.volume
    })

    // Find max volume in a single bucket for intensity scaling
    const maxBucketVolume = Math.max(
      1, // Avoid division by zero
      ...Object.values(longVolumeByPrice),
      ...Object.values(shortVolumeByPrice),
    )

    return {
      longVolumeByPrice,
      shortVolumeByPrice,
      maxBucketVolume,
    }
  }, [])

  // Function for refreshing active signals
  const refreshActiveSignals = useCallback(async () => {
    await checkActiveSignals(currentPrice, selectedPair, historicalCandles)
    const signals = getActiveSignals()
    setActiveSignals(signals)
  }, [currentPrice, selectedPair, historicalCandles])

  // Load active signals on initialization
  useEffect(() => {
    refreshActiveSignals()
  }, [refreshActiveSignals])

  // Check signals when price changes
  useEffect(() => {
    if (currentPrice > 0) {
      checkActiveSignals(currentPrice, selectedPair, historicalCandles).then(refreshActiveSignals).catch(console.error)
    }
  }, [currentPrice, selectedPair, historicalCandles, refreshActiveSignals])

  // Signal handling functions
  const completeSignalHandler = useCallback(
    async (signalId: string, exitPrice: number, exitType: "tp" | "sl" | "manual" = "manual") => {
      await completeSignal(signalId, exitPrice, exitType)
      refreshActiveSignals()
    },
    [refreshActiveSignals],
  )

  const cancelSignalHandler = useCallback(
    (signalId: string) => {
      cancelSignal(signalId)
      refreshActiveSignals()
    },
    [refreshActiveSignals],
  )

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (isLoading || updateInProgressRef.current) return

      updateInProgressRef.current = true
      setIsLoading(true)

      try {
        const key = `${selectedPair}-${timeframe}`
        const now = new Date()

        // Check if we have stable data for this pair and timeframe
        const hasStableData = stableDataRef.current[key]

        // Get timeframe duration for update checks
        const timeframeDuration = getTimeframeDuration(timeframe)

        // Calculate the next update time for this timeframe
        const calculatedNextUpdateTime = getNextUpdateTime(timeframe)

        // Check if we're at or past the next update time
        const isPastUpdateTime = hasStableData && now >= stableDataRef.current[key].nextUpdateTime

        // Determine if we need a full refresh of S/R zones based on:
        // 1. User explicitly requested refresh with forceRefresh=true (but only for manual testing)
        // 2. No stable data exists for this pair/timeframe
        // 3. We're past the scheduled update time for this timeframe
        // 4. It's been more than one timeframe duration since last update (fallback)
        const needsFullSRRefresh =
          (forceRefresh && process.env.NODE_ENV === "development") || // Only allow force refresh in development
          !hasStableData ||
          isPastUpdateTime ||
          (hasStableData && now.getTime() - hasStableData.lastFullUpdate.getTime() > timeframeDuration * 1.1)

        // Always fetch complete data for visualization
        const data = await fetchBinanceData(timeframe, selectedPair, false)

        // Update price-related data from REST API (will be overridden by WebSocket later)
        setPriceData(data.priceData)

        // Only update price if WebSocket is not connected
        if (!binanceWebSocket.isConnected()) {
          setCurrentPrice(data.currentPrice)
          setPriceChangePercent(data.priceChangePercent)
        }

        // Always update liquidation data for visualization
        setLiquidationData(data.liquidationData)

        // Always update volume data for visualization with the fresh liquidation data
        const newVolumeData = calculateVolumeData(data.liquidationData, data.currentPrice)
        setVolumeData(newVolumeData)

        // Update S/R zones only if needed
        if (needsFullSRRefresh) {
          console.log(
            `Full S/R refresh for ${timeframe} at ${now.toISOString()}, next update at ${calculatedNextUpdateTime.toISOString()}`,
          )

          // Calculate LPI (Liquidation Pressure Index)
          const totalLiquidationVolume = data.liquidationData.reduce((sum, item) => sum + item.volume, 0)
          const maxPossibleVolume = 1000 // Arbitrary max for scaling
          const calculatedLpi = Math.min(100, (totalLiquidationVolume / maxPossibleVolume) * 100)
          setLpi(calculatedLpi)

          // Calculate LIO (Liquidation Imbalance Oscillator)
          const longVolume = data.liquidationData
            .filter((item) => item.type === "long")
            .reduce((sum, item) => sum + item.volume, 0)

          const shortVolume = data.liquidationData
            .filter((item) => item.type === "short")
            .reduce((sum, item) => sum + item.volume, 0)

          const totalVolume = longVolume + shortVolume
          const calculatedLio = totalVolume > 0 ? (shortVolume / totalVolume) * 100 : 50
          setLio(calculatedLio)

          // Find significant liquidation clusters
          const longClusters = findLiquidationClusters(data.liquidationData.filter((item) => item.type === "long"))
          const shortClusters = findLiquidationClusters(data.liquidationData.filter((item) => item.type === "short"))

          // Determine support and resistance levels based on historical data
          let resistanceLevel = 0
          let supportLevel = 0

          // Get the current price for proper positioning of support and resistance
          const price = data.currentPrice

          // Calculate appropriate price range percentage based on timeframe
          // Shorter timeframes should have tighter ranges
          let minDistancePercentage, resistancePercentage, supportPercentage

          switch (timeframe) {
            case "5m":
              // For 5m, resistance should be 2-3% above, support 1-2% below
              resistancePercentage = 0.025 // 2.5% above current price
              supportPercentage = 0.015 // 1.5% below current price
              minDistancePercentage = 0.035 // Minimum 3.5% between S/R
              break
            case "15m":
              // For 15m, slightly wider
              resistancePercentage = 0.03 // 3% above
              supportPercentage = 0.02 // 2% below
              minDistancePercentage = 0.045 // Minimum 4.5% between S/R
              break
            case "30m":
              // For 30m, slightly wider
              resistancePercentage = 0.035 // 3.5% above
              supportPercentage = 0.025 // 2.5% below
              minDistancePercentage = 0.05 // Minimum 5% between S/R
              break
            case "1h":
              // For 1h
              resistancePercentage = 0.045 // 4.5% above
              supportPercentage = 0.035 // 3.5% below
              minDistancePercentage = 0.07 // Minimum 7% between S/R
              break
            default:
              // Default
              resistancePercentage = 0.03 // 3% above
              supportPercentage = 0.02 // 2% below
              minDistancePercentage = 0.045 // Minimum 4.5% between S/R
          }

          // Find resistance level (above current price)
          if (longClusters.length > 0) {
            // Filter clusters that are ABOVE current price for resistance
            // But not too far above (within reasonable trading range)
            const maxResistancePrice = price * (1 + resistancePercentage * 2)
            const minResistancePrice = price * (1 + resistancePercentage * 0.5)
            const abovePriceClusters = longClusters.filter(
              (cluster) => cluster.price > minResistancePrice && cluster.price <= maxResistancePrice,
            )

            if (abovePriceClusters.length > 0) {
              // Use the strongest cluster above current price as resistance
              resistanceLevel = abovePriceClusters[0].price
            } else {
              // If no clusters in reasonable range, use a percentage above current price
              resistanceLevel = price * (1 + resistancePercentage)
            }
          } else {
            // Fallback if no long clusters
            resistanceLevel = price * (1 + resistancePercentage)
          }

          // Find support level (below current price)
          if (shortClusters.length > 0) {
            // Filter clusters that are BELOW current price for support
            // But not too far below (within reasonable trading range)
            const minSupportPrice = price * (1 - supportPercentage * 2)
            const maxSupportPrice = price * (1 - supportPercentage * 0.5)
            const belowPriceClusters = shortClusters.filter(
              (cluster) => cluster.price < maxSupportPrice && cluster.price >= minSupportPrice,
            )

            if (belowPriceClusters.length > 0) {
              // Use the strongest cluster below current price as support
              supportLevel = belowPriceClusters[0].price
            } else {
              // If no clusters in reasonable range, use a percentage below current price
              supportLevel = price * (1 - supportPercentage)
            }
          } else {
            // Fallback if no short clusters
            supportLevel = price * (1 - supportPercentage)
          }

          // If we still don't have valid levels (e.g., all clusters on one side),
          // ensure we have reasonable defaults based on current price
          if (resistanceLevel <= price) {
            resistanceLevel = price * (1 + resistancePercentage)
          }

          if (supportLevel >= price) {
            supportLevel = price * (1 - supportPercentage)
          }

          // Ensure minimum distance between support and resistance levels
          const minDistanceRequired = price * minDistancePercentage
          const currentDistance = resistanceLevel - supportLevel

          if (currentDistance < minDistanceRequired) {
            // If the distance is too small, adjust both levels to maintain proper spacing
            const additionalDistanceNeeded = minDistanceRequired - currentDistance

            // Distribute the adjustment proportionally
            resistanceLevel += additionalDistanceNeeded / 2
            supportLevel -= additionalDistanceNeeded / 2
          }

          // Generate trading signals
          const signals: TradingSignal[] = [
            {
              type: "entry",
              price: supportLevel,
              description: "Strong Support",
              strength: "high",
            },
            {
              type: "exit",
              price: resistanceLevel,
              description: "Liquidation Wall",
              strength: "high",
            },
          ]

          setTradingSignals(signals)
          setNextUpdateTime(calculatedNextUpdateTime)

          // Store stable data for this pair and timeframe
          stableDataRef.current[key] = {
            liquidationData: data.liquidationData,
            supportLevel,
            resistanceLevel,
            lpi: calculatedLpi,
            lio: calculatedLio,
            lastFullUpdate: now,
            needsUpdate: false, // Reset the update flag
            nextUpdateTime: calculatedNextUpdateTime,
          }
        } else {
          // Use cached stable data for S/R zones but update liquidation data
          const stableData = stableDataRef.current[key]

          // Keep the stable LPI/LIO values
          setLpi(stableData.lpi)
          setLio(stableData.lio)

          // Use the stable support/resistance levels
          const signals: TradingSignal[] = [
            {
              type: "entry",
              price: stableData.supportLevel,
              description: "Strong Support",
              strength: "high",
            },
            {
              type: "exit",
              price: stableData.resistanceLevel,
              description: "Liquidation Wall",
              strength: "high",
            },
          ]

          setTradingSignals(signals)
          setNextUpdateTime(stableData.nextUpdateTime)
        }

        setLastUpdated(now)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
        updateInProgressRef.current = false
      }
    },
    [timeframe, selectedPair, isLoading, calculateVolumeData],
  )

  // Helper function to get default level for a pair and timeframe
  function getDefaultLevel(
    pair: string,
    timeframe: TimeframeType,
    type: "support" | "resistance",
    fallback: number,
  ): number {
    if (DEFAULT_LEVELS[pair]) {
      const pairDefaults = DEFAULT_LEVELS[pair]
      if (pairDefaults[timeframe]) {
        return pairDefaults[timeframe][type]
      }
    }
    return fallback
  }

  // Force refresh data
  const refreshData = useCallback(async () => {
    // For manual refresh, we'll only update the liquidation data and price
    // but keep the S/R zones stable until the next scheduled update
    await fetchData(false)
  }, [fetchData])

  // Fetch data when pair or timeframe changes
  useEffect(() => {
    fetchData(true) // Force refresh when timeframe or pair changes
  }, [selectedPair, timeframe, fetchData])

  // Set up periodic updates based on timeframe
  useEffect(() => {
    const updateInterval = getUpdateInterval(timeframe)

    // For longer timeframes, use longer update intervals to reduce unnecessary updates
    const adjustedInterval = Math.max(updateInterval, 30 * 1000) // Minimum 30 seconds

    console.log(`Setting update interval for ${timeframe}: ${adjustedInterval / 1000}s`)

    // Only update price data periodically, S/R zones remain stable
    const interval = setInterval(() => {
      // Pass false to avoid forcing refresh of S/R zones
      fetchData(false)
    }, adjustedInterval)

    return () => clearInterval(interval)
  }, [timeframe, fetchData])

  // Helper function to find liquidation clusters
  function findLiquidationClusters(liquidations: LiquidationData[]) {
    // Group liquidations by price range
    const priceStep = 1000 // $1000 steps for BTC, will be adjusted for other assets
    const volumeByPrice: Record<number, number> = {}

    // Adjust price step based on current price magnitude
    const priceMagnitude = Math.floor(Math.log10(currentPrice))
    const adjustedPriceStep = Math.max(0.0001, Math.pow(10, priceMagnitude - 2))

    liquidations.forEach((liq) => {
      const priceRange = Math.floor(liq.price / adjustedPriceStep) * adjustedPriceStep
      volumeByPrice[priceRange] = (volumeByPrice[priceRange] || 0) + liq.volume
    })

    // Convert to array and sort by volume
    const clusters = Object.entries(volumeByPrice)
      .map(([price, volume]) => ({
        price: Number(price),
        volume,
        strength: volume > 20 ? "high" : volume > 10 ? "medium" : "low",
      }))
      .sort((a, b) => b.volume - a.volume)

    return clusters
  }

  // Check active signals on initialization
  useEffect(() => {
    const checkSignalsOnInit = async () => {
      const activeSignals = getActiveSignals()
      if (activeSignals.length > 0) {
        // Check if each active signal has been completed
        await checkActiveSignals(currentPrice, selectedPair, historicalCandles)
      }
    }

    checkSignalsOnInit()
  }, [currentPrice, selectedPair, historicalCandles])

  return (
    <LiquidationContext.Provider
      value={{
        liquidationData,
        priceData,
        currentPrice,
        priceChangePercent,
        timeframe,
        setTimeframe,
        selectedPair,
        setSelectedPair,
        availablePairs,
        lpi,
        lio,
        tradingSignals,
        fetchData: refreshData,
        refreshData,
        isLoading,
        lastUpdated,
        volumeData,
        nextUpdateTime,
        historicalCandles,
        // Signal-related values
        activeSignals,
        refreshActiveSignals,
        completeSignal: completeSignalHandler,
        cancelSignal: cancelSignalHandler,
      }}
    >
      {children}
    </LiquidationContext.Provider>
  )
}

export function useLiquidation() {
  const context = useContext(LiquidationContext)
  if (context === undefined) {
    throw new Error("useLiquidation must be used within a LiquidationProvider")
  }
  return context
}
