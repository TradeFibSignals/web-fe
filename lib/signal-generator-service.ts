import { supabase } from "./supabase-client"
import { fetchTimeframeCandles, fetchCandlestickData } from "./binance-api"
import type { SupabaseClient } from "@supabase/supabase-js"
import { calculateLiquidityLevels } from "./liquidity-levels"
import { v4 as uuidv4 } from "uuid"
import type { CandleData } from "./binance-api"

// Timeframe types we'll process
const TIMEFRAMES = ["5m", "15m", "30m", "1h"]

// Historical data for seasonality
const historicalMonthlyReturns = {
  0: {
    // January
    2011: 66.67,
    2012: 10.0,
    2013: 15.38,
    2014: -14.29,
    2015: -33.33,
    2016: 11.11,
    2017: 15.79,
    2018: -14.29,
    2019: 2.7,
    2020: 4.73,
    2021: 10.37,
    2022: -2.17,
    2023: 25.0,
    2024: 0.72,
  },
  // Other months omitted for brevity
}

// Interface for generated signal
interface GeneratedSignal {
  signal_id: string
  signal_type: "long" | "short"
  entry_price: number
  stop_loss: number
  take_profit: number
  pair: string
  timeframe: string
  signal_source: string
  major_level?: number
  peak_price?: number
  peak_time?: Date
  fib_levels?: any
  risk_reward_ratio: number
  seasonality: "bullish" | "bearish" | "neutral"
  positive_probability: number
}

// Types for signals
export interface Signal {
  id: string
  pair: string
  timeframe: string
  direction: "long" | "short"
  entryPrice: number
  stopLoss: number
  takeProfit: number
  timestamp: number
  status: "active" | "completed" | "expired"
  entryHit?: boolean
  tpHit?: boolean
  slHit?: boolean
}

// Function to get current seasonality
function getCurrentSeasonality(): { seasonality: "bullish" | "bearish" | "neutral"; probability: number } {
  const currentMonth = new Date().getMonth()
  const monthData = historicalMonthlyReturns[currentMonth as keyof typeof historicalMonthlyReturns]

  if (monthData) {
    const returns = Object.values(monthData)
    const positiveCount = returns.filter((ret) => ret > 0).length
    const probability = (positiveCount / returns.length) * 100

    // Determine seasonality based on probability of positive returns
    if (probability >= 60) {
      return { seasonality: "bullish", probability }
    } else if (probability <= 40) {
      return { seasonality: "bearish", probability }
    } else {
      return { seasonality: "neutral", probability }
    }
  }

  return { seasonality: "neutral", probability: 50 }
}

// Function to analyze liquidity levels
function analyzeLiquidityLevels(candles: CandleData[]) {
  // Use calculateLiquidityLevels
  try {
    return calculateLiquidityLevels(candles, {
      swingStrength: 5,
      majorThreshold: 0.3,
      reqThreshold: 2.0,
    });
  } catch (error) {
    console.error("Error analyzing liquidity levels:", error);
    return { bsl: [], ssl: [] };
  }
}

// Function to generate signals
function generateSignals(pair: string, timeframe: string, candles: CandleData[], liquidityLevels: any): Signal[] {
  const signals: Signal[] = [];
  
  try {
    // Get current seasonality
    const { seasonality, probability } = getCurrentSeasonality();
    
    // Find all major levels
    const majorBSL = liquidityLevels.bsl.filter((level: any) => level.isMajor);
    const majorSSL = liquidityLevels.ssl.filter((level: any) => level.isMajor);
    
    // Current price (use close of last candle)
    const currentPrice = candles[candles.length - 1].close;
    
    // Determine signal type based on seasonality
    const signalType = seasonality === "bearish" ? "short" : "long";
    
    // Find appropriate major level based on signal type
    let relevantLevel = null;

    if (signalType === "long") {
      // For LONG signals, find lowest major SSL level
      const sortedSSL = [...majorSSL].sort((a, b) => a.price - b.price);
      relevantLevel = sortedSSL.length > 0 ? sortedSSL[0] : null;

      // If no SSL level found, try using BSL level in neutral seasonality
      if (!relevantLevel && seasonality === "neutral" && majorBSL.length > 0) {
        relevantLevel = majorBSL.sort((a, b) => a.price - b.price)[0];
      }
    } else {
      // For SHORT signals, find highest major BSL level
      const sortedBSL = [...majorBSL].sort((a, b) => b.price - a.price);
      relevantLevel = sortedBSL.length > 0 ? sortedBSL[0] : null;

      // If no BSL level found, try using SSL level in neutral seasonality
      if (!relevantLevel && seasonality === "neutral" && majorSSL.length > 0) {
        relevantLevel = majorSSL.sort((a, b) => b.price - a.price)[0];
      }
    }
    
    // If no relevant level found, return empty array
    if (!relevantLevel) {
      return signals;
    }
    
    // Get all candles after the major level formation
    const candlesAfterLevel = candles.filter((candle) => candle.time > relevantLevel.time);
    
    if (candlesAfterLevel.length < 5) {
      return signals;
    }
    
    // Create base signal
    const signalId = uuidv4();
    const now = Date.now();
    
    // Create conservative entry and SL/TP
    let entryPrice, stopLoss, takeProfit;
    
    if (signalType === "long") {
      // For LONG positions
      entryPrice = currentPrice * 0.985; // Entry slightly below current price
      stopLoss = relevantLevel.price * 0.99; // SL just below major level
      takeProfit = entryPrice + (entryPrice - stopLoss) * 3; // TP with 1:3 RRR
    } else {
      // For SHORT positions
      entryPrice = currentPrice * 1.015; // Entry slightly above current price
      stopLoss = relevantLevel.price * 1.01; // SL just above major level
      takeProfit = entryPrice - (stopLoss - entryPrice) * 3; // TP with 1:3 RRR
    }
    
    // Add signal to results
    signals.push({
      id: signalId,
      pair,
      timeframe,
      direction: signalType,
      entryPrice,
      stopLoss,
      takeProfit,
      timestamp: now,
      status: "active",
      entryHit: false,
      tpHit: false,
      slHit: false
    });
    
    return signals;
  } catch (error) {
    console.error("Error generating signals:", error);
    return [];
  }
}

export async function generateSignalsForTimeframe(timeframe: string, supabase: SupabaseClient) {
  console.log(`Generating signals for timeframe: ${timeframe}`)

  // List of pairs to generate signals for
  const pairs = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"]
  const results = []

  for (const pair of pairs) {
    try {
      console.log(`Processing pair: ${pair} with timeframe: ${timeframe}`)

      // Get candlestick data from Binance API
      const candlestickData = await fetchTimeframeCandles(pair, timeframe, 100)
      
      // Check if we received valid data
      if (!candlestickData || !Array.isArray(candlestickData) || candlestickData.length === 0) {
        throw new Error("Invalid or empty candlestick data received")
      }

      // Analyze liquidity levels
      const liquidityLevels = analyzeLiquidityLevels(candlestickData)

      // Generate signals based on liquidity levels
      const signals = generateSignals(pair, timeframe, candlestickData, liquidityLevels)

      // Save signals to database
      for (const signal of signals) {
        const { data, error } = await supabase.from("generated_signals").upsert(
          {
            signal_id: signal.id,
            signal_type: signal.direction,
            entry_price: signal.entryPrice,
            stop_loss: signal.stopLoss,
            take_profit: signal.takeProfit,
            pair: signal.pair,
            timeframe: signal.timeframe,
            signal_source: "fibonacci",
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            entry_hit: signal.entryHit || false,
            seasonality: getCurrentSeasonality().seasonality,
            positive_probability: getCurrentSeasonality().probability,
            risk_reward_ratio: 3.0
          },
          {
            onConflict: "signal_id",
          }
        )

        if (error) {
          console.error(`Error saving signal for ${pair}:`, error)
        } else {
          console.log(`Signal saved for ${pair}: ${signal.id}`)
        }
      }

      // Update cache for quick access
      await updateSignalCacheForTimeframe(pair, timeframe, signals, supabase)

      results.push({
        pair,
        signalsGenerated: signals.length,
      })
    } catch (error) {
      console.error(`Error processing ${pair}:`, error)
      results.push({
        pair,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Clean up old cache entries
  await cleanupOldCacheEntriesForTimeframe(timeframe, supabase)

  return results
}

async function updateSignalCacheForTimeframe(
  pair: string,
  timeframe: string,
  signals: Signal[],
  supabase: SupabaseClient,
) {
  try {
    // First remove old entries for this pair and timeframe
    const { error: deleteError } = await supabase.from("signal_cache").delete().match({ pair, timeframe })

    if (deleteError) {
      console.error(`Error clearing cache for ${pair} ${timeframe}:`, deleteError)
      return
    }

    // Add new signals to cache
    if (signals.length > 0) {
      const cacheEntries = signals.map((signal) => ({
        signal_id: signal.id,
        pair: signal.pair,
        timeframe: signal.timeframe,
        cached_at: new Date().toISOString(),
      }))

      const { error: insertError } = await supabase.from("signal_cache").insert(cacheEntries)

      if (insertError) {
        console.error(`Error updating cache for ${pair} ${timeframe}:`, insertError)
      } else {
        console.log(`Cache updated for ${pair} ${timeframe}: ${signals.length} signals`)
      }
    }
  } catch (error) {
    console.error(`Error in updateSignalCacheForTimeframe:`, error)
  }
}

async function cleanupOldCacheEntriesForTimeframe(timeframe: string, supabase: SupabaseClient) {
  try {
    // Set time limit for old records (24 hours)
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - 24)

    const { error } = await supabase
      .from("signal_cache")
      .delete()
      .match({ timeframe })
      .lt("cached_at", cutoffTime.toISOString())

    if (error) {
      console.error(`Error cleaning up old cache entries for ${timeframe}:`, error)
    } else {
      console.log(`Old cache entries cleaned up for ${timeframe}`)
    }
  } catch (error) {
    console.error(`Error in cleanupOldCacheEntriesForTimeframe:`, error)
  }
}
