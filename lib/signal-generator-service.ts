import { supabase } from "./supabase-client"
import { fetchTimeframeCandles, fetchCandlestickData, type CandleData } from "./binance-api"
import type { SupabaseClient } from "@supabase/supabase-js"
import { calculateLiquidityLevels } from "./liquidity-levels"
import { v4 as uuidv4 } from "uuid"

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
  1: {
    // February
    2011: 100.0,
    2012: 0.0,
    2013: 33.33,
    2014: -16.67,
    2015: 25.0,
    2016: 20.0,
    2017: 18.18,
    2018: -16.67,
    2019: 5.26,
    2020: 20.0,
    2021: 40.63,
    2022: -11.11,
    2023: 8.0,
    2024: 43.76,
  },
  2: {
    // March
    2011: 400.0,
    2012: 9.09,
    2013: 50.0,
    2014: -10.0,
    2015: 0.0,
    2016: 8.33,
    2017: 7.69,
    2018: -10.0,
    2019: 25.0,
    2020: -16.67,
    2021: 33.33,
    2022: -12.5,
    2023: 5.56,
    2024: 16.62,
  },
  3: {
    // April
    2011: 10.0,
    2012: 0.0,
    2013: 733.33,
    2014: 33.33,
    2015: 0.0,
    2016: 7.69,
    2017: 28.57,
    2018: -11.11,
    2019: 20.0,
    2020: 20.0,
    2021: 6.67,
    2022: -8.57,
    2023: 2.79,
    2024: -15.0,
  },
  4: {
    // May
    2011: 81.82,
    2012: 0.0,
    2013: -40.0,
    2014: -8.33,
    2015: 8.0,
    2016: 7.14,
    2017: 11.11,
    2018: -12.5,
    2019: 33.33,
    2020: 5.56,
    2021: -14.06,
    2022: -9.38,
    2023: -6.87,
    2024: 11.35,
  },
  5: {
    // June
    2011: 200.0,
    2012: -8.33,
    2013: -20.0,
    2014: -9.09,
    2015: 7.41,
    2016: 20.0,
    2017: -25.0,
    2018: -14.29,
    2019: 25.0,
    2020: 5.26,
    2021: -9.09,
    2022: -13.79,
    2023: 11.97,
    2024: -7.13,
  },
  6: {
    // July
    2011: -33.33,
    2012: 0.0,
    2013: 8.33,
    2014: -20.0,
    2015: -13.79,
    2016: -5.56,
    2017: -6.67,
    2018: 16.67,
    2019: 10.0,
    2020: 5.0,
    2021: -10.0,
    2022: 20.0,
    2023: -4.09,
    2024: 3.1,
  },
  7: {
    // August
    2011: -25.0,
    2012: 9.09,
    2013: -7.69,
    2014: -12.5,
    2015: 4.0,
    2016: -5.88,
    2017: 7.14,
    2018: -14.29,
    2019: -13.64,
    2020: 14.29,
    2021: 11.11,
    2022: -6.67,
    2023: -11.29,
    2024: -8.75,
  },
  8: {
    // September
    2011: -33.33,
    2012: 0.0,
    2013: 8.33,
    2014: -14.29,
    2015: 7.69,
    2016: -6.25,
    2017: 33.33,
    2018: -16.67,
    2019: -10.53,
    2020: -8.33,
    2021: -20.0,
    2022: -3.57,
    2023: 3.99,
    2024: 7.39,
  },
  9: {
    // October
    2011: 0.0,
    2012: 8.33,
    2013: 53.85,
    2014: -16.67,
    2015: 7.14,
    2016: 6.67,
    2017: 50.0,
    2018: -10.0,
    2019: -5.88,
    2020: 9.09,
    2021: 50.0,
    2022: -3.7,
    2023: 28.55,
    2024: 10.87,
  },
  10: {
    // November
    2011: -30.0,
    2012: 7.69,
    2013: 400.0,
    2014: -20.0,
    2015: 33.33,
    2016: 12.5,
    2017: 133.33,
    2018: -11.11,
    2019: -12.5,
    2020: 53.19,
    2021: 15.0,
    2022: -3.85,
    2023: 8.81,
    2024: 37.36,
  },
  11: {
    // December
    2011: -28.57,
    2012: 92.14,
    2013: -30.0,
    2014: 50.0,
    2015: 12.5,
    2016: 5.56,
    2017: 100.0,
    2018: -7.5,
    2019: 0.0,
    2020: 57.72,
    2021: -33.33,
    2022: -20.0,
    2023: 12.06,
    2024: -3.14,
  },
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

  // Check if Supabase client is valid
  if (!supabase) {
    throw new Error("Supabase client is not available")
  }

  // List of pairs to generate signals for
  const pairs = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"]
  const results = []

  for (const pair of pairs) {
    try {
      console.log(`Processing pair: ${pair} with timeframe: ${timeframe}`)

      // Get candlestick data from Binance API
      let candlestickData
      try {
        candlestickData = await fetchTimeframeCandles(pair, timeframe, 100)
        
        // Add debugging to help diagnose issues
        console.log(`Received candlestick data for ${pair}: count=${candlestickData?.length || 0}`)
        
        // Check if we received valid data
        if (!candlestickData || !Array.isArray(candlestickData) || candlestickData.length === 0) {
          throw new Error("Invalid or empty candlestick data received")
        }
      } catch (fetchError) {
        console.error(`Error fetching candlestick data for ${pair}:`, fetchError)
        results.push({
          pair,
          error: fetchError instanceof Error ? fetchError.message : "Error fetching candlestick data"
        })
        continue // Skip to next pair
      }

      // Analyze liquidity levels
      let liquidityLevels
      try {
        liquidityLevels = analyzeLiquidityLevels(candlestickData)
        console.log(`Analyzed liquidity levels for ${pair}: bsl=${liquidityLevels.bsl.length}, ssl=${liquidityLevels.ssl.length}`)
      } catch (analysisError) {
        console.error(`Error analyzing liquidity levels for ${pair}:`, analysisError)
        results.push({
          pair,
          error: analysisError instanceof Error ? analysisError.message : "Error analyzing liquidity levels"
        })
        continue // Skip to next pair
      }

      // Generate signals based on liquidity levels
      let signals
      try {
        signals = generateSignals(pair, timeframe, candlestickData, liquidityLevels)
        console.log(`Generated ${signals.length} signals for ${pair}`)
      } catch (signalError) {
        console.error(`Error generating signals for ${pair}:`, signalError)
        results.push({
          pair,
          error: signalError instanceof Error ? signalError.message : "Error generating signals"
        })
        continue // Skip to next pair
      }

      // Save signals to database
      for (const signal of signals) {
        try {
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
        } catch (saveError) {
          console.error(`Error saving signal to database for ${pair}:`, saveError)
          // Continue with next signal even if this one fails
        }
      }

      // Update cache for quick access
      try {
        await updateSignalCacheForTimeframe(pair, timeframe, signals, supabase)
      } catch (cacheError) {
        console.error(`Error updating cache for ${pair}:`, cacheError)
        // Continue even if cache update fails
      }

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
  try {
    await cleanupOldCacheEntriesForTimeframe(timeframe, supabase)
  } catch (cleanupError) {
    console.error(`Error cleaning up cache entries:`, cleanupError)
    // Continue even if cleanup fails
  }

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

// Function to check and update signal statuses for a specific timeframe
export async function checkAndUpdateSignalStatuses(timeframe?: string): Promise<void> {
  try {
    console.log(`Checking and updating signal statuses${timeframe ? ` for ${timeframe} timeframe` : ""}...`)

    // Get all active signals
    let query = supabase.from("generated_signals").select("*").eq("status", "active")

    // If timeframe is specified, filter by it
    if (timeframe) {
      query = query.eq("timeframe", timeframe)
    }

    const { data: activeSignals, error } = await query

    if (error) {
      console.error("Error fetching active signals:", error)
      return
    }

    // Group signals by pair
    const signalsByPair: Record<string, any[]> = {}

    activeSignals?.forEach((signal) => {
      if (!signalsByPair[signal.pair]) {
        signalsByPair[signal.pair] = []
      }
      signalsByPair[signal.pair].push(signal)
    })

    // Process signals for each pair
    for (const [pair, signals] of Object.entries(signalsByPair)) {
      try {
        // Get current price and historical candles for the pair
        const currentPriceData = await fetchTimeframeCandles(pair, "1m", 1)

        if (!currentPriceData || currentPriceData.length === 0) {
          console.log(`No current price data available for ${pair}, skipping...`)
          continue
        }

        const currentPrice = currentPriceData[0].close

        // Check each signal
        for (const signal of signals) {
          // Check if signal has already been activated (entry hit)
          let entryHit = signal.entry_hit
          let entryHitTime = signal.entry_hit_time
          let status = signal.status
          let isCompleted = false
          let exitType: string | null = null
          let exitPrice: number | null = null
          let exitTime: Date | null = null

          // First check if entry price has been hit (if not already)
          if (!entryHit) {
            if (signal.signal_type === "long") {
              // For long positions - price must drop to or below entry price
              if (currentPrice <= signal.entry_price) {
                entryHit = true
                entryHitTime = new Date().toISOString()
                status = "active"
                console.log(`Entry hit for ${pair} ${signal.timeframe} LONG signal at ${currentPrice}`)
              }
            } else {
              // For short positions - price must rise to or above entry price
              if (currentPrice >= signal.entry_price) {
                entryHit = true
                entryHitTime = new Date().toISOString()
                status = "active"
                console.log(`Entry hit for ${pair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
              }
            }
          }

          // If signal is active (entry price has been hit), check TP/SL
          if (entryHit) {
            if (signal.signal_type === "long") {
              // For long positions
              if (currentPrice >= signal.take_profit) {
                isCompleted = true
                exitType = "tp"
                exitPrice = signal.take_profit
                exitTime = new Date()
                status = "completed"
                console.log(`Take profit hit for ${pair} ${signal.timeframe} LONG signal at ${currentPrice}`)
              } else if (currentPrice <= signal.stop_loss) {
                isCompleted = true
                exitType = "sl"
                exitPrice = signal.stop_loss
                exitTime = new Date()
                status = "completed"
                console.log(`Stop loss hit for ${pair} ${signal.timeframe} LONG signal at ${currentPrice}`)
              }
            } else {
              // For short positions
              if (currentPrice <= signal.take_profit) {
                isCompleted = true
                exitType = "tp"
                exitPrice = signal.take_profit
                exitTime = new Date()
                status = "completed"
                console.log(`Take profit hit for ${pair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
              } else if (currentPrice >= signal.stop_loss) {
                isCompleted = true
                exitType = "sl"
                exitPrice = signal.stop_loss
                exitTime = new Date()
                status = "completed"
                console.log(`Stop loss hit for ${pair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
              }
            }
          }

          // Check signal expiration (if older than 7 days and not activated)
          const signalAge = Date.now() - new Date(signal.created_at).getTime()
          const maxSignalAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

          if (!entryHit && signalAge > maxSignalAge) {
            isCompleted = true
            exitType = "expired"
            exitPrice = currentPrice
            exitTime = new Date()
            status = "expired"
            console.log(`Signal expired for ${pair} ${signal.timeframe} ${signal.signal_type} signal`)
          }

          // Update signal in database if there was a change
          if (entryHit !== signal.entry_hit || status !== signal.status || isCompleted) {
            const updateData: any = {
              entry_hit: entryHit,
              status,
            }

            if (entryHit && !signal.entry_hit) {
              updateData.entry_hit_time = entryHitTime
            }

            if (isCompleted) {
              updateData.exit_type = exitType
              updateData.exit_price = exitPrice
              updateData.exit_time = exitTime

              // Calculate P&L
              let profitLoss = 0

              if (signal.signal_type === "long") {
                profitLoss = exitPrice! - signal.entry_price
              } else {
                profitLoss = signal.entry_price - exitPrice!
              }

              updateData.profit_loss = profitLoss
              updateData.profit_loss_percent = (profitLoss / signal.entry_price) * 100
            }

            // Update in database
            const { error: updateError } = await supabase
              .from("generated_signals")
              .update(updateData)
              .eq("signal_id", signal.signal_id)

            if (updateError) {
              console.error(`Error updating signal ${signal.signal_id}:`, updateError)
            } else {
              console.log(`Signal ${signal.signal_id} updated successfully`)
            }
          }
        }
      } catch (error) {
        console.error(`Error processing signals for ${pair}:`, error)
      }
    }

    console.log("Signal status check completed")
  } catch (error) {
    console.error("Error checking signal statuses:", error)
  }
}

// Function to get signals from cache
export async function getSignalsFromCache(pair: string, timeframe: string): Promise<any[]> {
  try {
    // Try to get signals from cache
    const { data: cacheEntries, error: cacheError } = await supabase
      .from("signal_cache")
      .select("signal_id")
      .eq("pair", pair)
      .eq("timeframe", timeframe)

    if (cacheError || !cacheEntries || cacheEntries.length === 0) {
      console.log(`No cache entries found for ${pair}_${timeframe}, fetching from database`)

      // If not in cache, get directly from database
      const { data: signals, error } = await supabase
        .from("generated_signals")
        .select("*")
        .eq("pair", pair)
        .eq("timeframe", timeframe)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        console.error(`Error fetching signals for ${pair} on ${timeframe}:`, error)
        return []
      }

      return signals || []
    }

    // Get signals by ID from cache
    const signalIds = cacheEntries.map(entry => entry.signal_id)

    if (signalIds.length === 0) {
      return []
    }

    const { data: signals, error } = await supabase
      .from("generated_signals")
      .select("*")
      .in("signal_id", signalIds)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(`Error fetching signals from cache for ${pair}_${timeframe}:`, error)
      return []
    }

    return signals || []
  } catch (error) {
    console.error("Error getting signals from cache:", error)
    return []
  }
}
