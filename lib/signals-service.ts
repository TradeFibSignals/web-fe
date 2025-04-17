import { supabase } from "@/lib/supabase-client"
import { v4 as uuidv4 } from "uuid"

// Přidám import pro typ CandleData
import type { CandleData } from "@/lib/binance-api"

export interface TradingSignal {
  id?: string
  type: "long" | "short"
  entry: number
  stopLoss: number
  takeProfit: number
  entryTime: Date
  pair: string
  timeframe: string
  source: string
  strength?: "low" | "medium" | "high"
  notes?: string
  status?: "active" | "completed" | "cancelled"
  exitPrice?: number
  exitTime?: Date
  exitType?: "tp" | "sl" | "manual"
  profitLoss?: number
  profitLossPercent?: number
  riskRewardRatio?: number
}

export interface SignalStats {
  totalSignals: number
  winningSignals: number
  losingSignals: number
  winRate: number
  averageProfitPercent: number
  averageLossPercent: number
  totalProfitLoss: number
  profitFactor: number
  expectancy: number
  largestWin: number
  largestLoss: number
  averageRRR: number
}

// Save active signal to local storage
export function saveActiveSignal(signal: TradingSignal): void {
  if (!signal.id) {
    signal.id = uuidv4()
  }

  signal.status = "active"

  // Get existing signals
  const existingSignalsJson = localStorage.getItem("activeSignals")
  const existingSignals: TradingSignal[] = existingSignalsJson ? JSON.parse(existingSignalsJson) : []

  // Add new signal
  existingSignals.push(signal)

  // Save back to local storage
  localStorage.setItem("activeSignals", JSON.stringify(existingSignals))
}

// Get all active signals from local storage
export function getActiveSignals(): TradingSignal[] {
  const signalsJson = localStorage.getItem("activeSignals")
  return signalsJson ? JSON.parse(signalsJson) : []
}

// Upravená funkce checkActiveSignals pro správnou kontrolu dosažení TP/SL
export async function checkActiveSignals(
  currentPrice: number,
  pair: string,
  historicalCandles?: CandleData[],
): Promise<void> {
  const activeSignals = getActiveSignals()
  const updatedSignals: TradingSignal[] = []
  const completedSignals: TradingSignal[] = []

  // Přidám debug log
  console.log(`Checking active signals for ${pair} at price ${currentPrice}`)
  console.log(`Active signals:`, activeSignals)

  if (historicalCandles && historicalCandles.length > 0) {
    console.log(`Historical candles available: ${historicalCandles.length}`)
    console.log(`Latest candle high: ${historicalCandles[historicalCandles.length - 1].high}`)

    // Najděme nejvyšší a nejnižší cenu v historických svíčkách
    const highestPrice = Math.max(...historicalCandles.map((candle) => candle.high))
    const lowestPrice = Math.min(...historicalCandles.map((candle) => candle.low))

    console.log(`Highest price in historical candles: ${highestPrice}`)
    console.log(`Lowest price in historical candles: ${lowestPrice}`)
  }

  for (const signal of activeSignals) {
    // Skip signals for other pairs
    if (signal.pair !== pair) {
      updatedSignals.push(signal)
      continue
    }

    console.log(
      `Checking signal: ${signal.type} ${signal.pair} Entry: ${signal.entry} TP: ${signal.takeProfit} SL: ${signal.stopLoss}`,
    )

    let isCompleted = false
    let exitType: "tp" | "sl" | null = null
    let exitPrice = currentPrice
    let exitTime = new Date()

    // Nejprve zkontrolujeme aktuální cenu
    if (signal.type === "long") {
      // Pro long pozice
      if (currentPrice >= signal.takeProfit) {
        console.log(`Current price ${currentPrice} hit TP ${signal.takeProfit}`)
        isCompleted = true
        exitType = "tp"
        exitPrice = signal.takeProfit
      } else if (currentPrice <= signal.stopLoss) {
        console.log(`Current price ${currentPrice} hit SL ${signal.stopLoss}`)
        isCompleted = true
        exitType = "sl"
        exitPrice = signal.stopLoss
      }
    } else {
      // Pro short pozice
      if (currentPrice <= signal.takeProfit) {
        console.log(`Current price ${currentPrice} hit TP ${signal.takeProfit}`)
        isCompleted = true
        exitType = "tp"
        exitPrice = signal.takeProfit
      } else if (currentPrice >= signal.stopLoss) {
        console.log(`Current price ${currentPrice} hit SL ${signal.stopLoss}`)
        isCompleted = true
        exitType = "sl"
        exitPrice = signal.stopLoss
      }
    }

    // Pokud signál nebyl dokončen aktuální cenou a máme historické svíčky,
    // projdeme všechny svíčky a zkontrolujeme, zda někde nedošlo k zasažení TP nebo SL
    if (!isCompleted && historicalCandles && historicalCandles.length > 0) {
      console.log(`Checking historical candles for signal completion`)

      // Projdeme všechny svíčky a zkontrolujeme, zda někde nedošlo k zasažení TP nebo SL
      for (const candle of historicalCandles) {
        // Zkontrolujeme, zda svíčka je novější než čas vstupu do signálu
        const entryTime = signal.entryTime instanceof Date ? signal.entryTime : new Date(signal.entryTime)
        if (candle.time < entryTime.getTime()) {
          continue // Přeskočíme svíčky před vstupem do signálu
        }

        if (signal.type === "long") {
          // Pro long pozice
          if (candle.high >= signal.takeProfit) {
            console.log(
              `Historical candle at ${new Date(candle.time).toISOString()} hit TP with high ${candle.high} >= ${signal.takeProfit}`,
            )
            isCompleted = true
            exitType = "tp"
            exitPrice = signal.takeProfit
            exitTime = new Date(candle.time)
            break
          } else if (candle.low <= signal.stopLoss) {
            console.log(
              `Historical candle at ${new Date(candle.time).toISOString()} hit SL with low ${candle.low} <= ${signal.stopLoss}`,
            )
            isCompleted = true
            exitType = "sl"
            exitPrice = signal.stopLoss
            exitTime = new Date(candle.time)
            break
          }
        } else {
          // Pro short pozice
          if (candle.low <= signal.takeProfit) {
            console.log(
              `Historical candle at ${new Date(candle.time).toISOString()} hit TP with low ${candle.low} <= ${signal.takeProfit}`,
            )
            isCompleted = true
            exitType = "tp"
            exitPrice = signal.takeProfit
            exitTime = new Date(candle.time)
            break
          } else if (candle.high >= signal.stopLoss) {
            console.log(
              `Historical candle at ${new Date(candle.time).toISOString()} hit SL with high ${candle.high} >= ${signal.stopLoss}`,
            )
            isCompleted = true
            exitType = "sl"
            exitPrice = signal.stopLoss
            exitTime = new Date(candle.time)
            break
          }
        }
      }

      // Pokud signál stále není dokončen, zkontrolujeme ještě jednou pomocí nejvyšší a nejnižší ceny
      if (!isCompleted) {
        const highestPrice = Math.max(...historicalCandles.map((candle) => candle.high))
        const lowestPrice = Math.min(...historicalCandles.map((candle) => candle.low))

        if (signal.type === "long") {
          // Pro long pozice
          if (highestPrice >= signal.takeProfit) {
            console.log(`Highest price in historical candles ${highestPrice} hit TP ${signal.takeProfit}`)
            isCompleted = true
            exitType = "tp"
            exitPrice = signal.takeProfit
          } else if (lowestPrice <= signal.stopLoss) {
            console.log(`Lowest price in historical candles ${lowestPrice} hit SL ${signal.stopLoss}`)
            isCompleted = true
            exitType = "sl"
            exitPrice = signal.stopLoss
          }
        } else {
          // Pro short pozice
          if (lowestPrice <= signal.takeProfit) {
            console.log(`Lowest price in historical candles ${lowestPrice} hit TP ${signal.takeProfit}`)
            isCompleted = true
            exitType = "tp"
            exitPrice = signal.takeProfit
          } else if (highestPrice >= signal.stopLoss) {
            console.log(`Highest price in historical candles ${highestPrice} hit SL ${signal.stopLoss}`)
            isCompleted = true
            exitType = "sl"
            exitPrice = signal.stopLoss
          }
        }
      }
    }

    // Pokud byl signál dokončen, zpracujeme ho
    if (isCompleted && exitType) {
      console.log(`Signal completed with ${exitType} at price ${exitPrice}`)

      // Označíme jako dokončený
      signal.status = "completed"
      signal.exitPrice = exitPrice
      signal.exitTime = exitTime
      signal.exitType = exitType

      // Vypočítáme P&L
      let profitLoss = 0

      if (signal.type === "long") {
        profitLoss = exitPrice - signal.entry
      } else {
        // short
        profitLoss = signal.entry - exitPrice
      }

      signal.profitLoss = profitLoss
      signal.profitLossPercent = (profitLoss / signal.entry) * 100

      // Vypočítáme RRR (Risk-Reward Ratio)
      const risk = Math.abs(signal.entry - signal.stopLoss)
      const reward = Math.abs(signal.takeProfit - signal.entry)
      signal.riskRewardRatio = reward / risk

      // Přidáme do dokončených signálů
      completedSignals.push(signal)
    } else {
      // Ponecháme jako aktivní
      updatedSignals.push(signal)
    }
  }

  // Aktualizujeme aktivní signály v local storage
  localStorage.setItem("activeSignals", JSON.stringify(updatedSignals))
  console.log(`Updated active signals count: ${updatedSignals.length}`)

  // Uložíme dokončené signály do databáze
  for (const signal of completedSignals) {
    console.log(`Saving completed signal to database: ${signal.id}`)
    await saveCompletedSignal(signal)
  }
}

// Save completed signal to database
export async function saveCompletedSignal(signal: TradingSignal): Promise<void> {
  if (!supabase) {
    console.error("Supabase client not available")
    return
  }

  try {
    const { error } = await supabase.from("completed_signals").insert({
      signal_id: signal.id,
      signal_type: signal.type,
      entry_price: signal.entry,
      stop_loss: signal.stopLoss,
      take_profit: signal.takeProfit,
      exit_price: signal.exitPrice,
      exit_type: signal.exitType,
      entry_time: signal.entryTime.toISOString(),
      exit_time: signal.exitTime?.toISOString(),
      pair: signal.pair,
      timeframe: signal.timeframe,
      profit_loss: signal.profitLoss,
      profit_loss_percent: signal.profitLossPercent,
      risk_reward_ratio: signal.riskRewardRatio,
      signal_source: signal.source,
      notes: signal.notes || null,
    })

    if (error) {
      console.error("Error saving completed signal:", error)
    }
  } catch (error) {
    console.error("Error saving completed signal:", error)
  }
}

// Manually complete a signal
export async function completeSignal(
  signalId: string,
  exitPrice: number,
  exitType: "tp" | "sl" | "manual" = "manual",
): Promise<void> {
  const activeSignals = getActiveSignals()
  const updatedSignals: TradingSignal[] = []
  let completedSignal: TradingSignal | null = null

  for (const signal of activeSignals) {
    if (signal.id === signalId) {
      // Mark as completed
      signal.status = "completed"
      signal.exitPrice = exitPrice
      signal.exitTime = new Date()
      signal.exitType = exitType

      // Calculate P&L
      let profitLoss = 0

      if (signal.type === "long") {
        profitLoss = exitPrice - signal.entry
      } else {
        // short
        profitLoss = signal.entry - exitPrice
      }

      signal.profitLoss = profitLoss
      signal.profitLossPercent = (profitLoss / signal.entry) * 100

      // Calculate RRR
      const risk = Math.abs(signal.entry - signal.stopLoss)
      const reward = Math.abs(signal.takeProfit - signal.entry)
      signal.riskRewardRatio = reward / risk

      completedSignal = signal
    } else {
      updatedSignals.push(signal)
    }
  }

  // Update active signals in local storage
  localStorage.setItem("activeSignals", JSON.stringify(updatedSignals))

  // Save completed signal to database
  if (completedSignal) {
    await saveCompletedSignal(completedSignal)
  }
}

// Cancel a signal
export function cancelSignal(signalId: string): void {
  const activeSignals = getActiveSignals()
  const updatedSignals = activeSignals.filter((signal) => signal.id !== signalId)
  localStorage.setItem("activeSignals", JSON.stringify(updatedSignals))
}

// Get completed signals from database - UPDATED
export async function getCompletedSignals(
  limit = 100,
  offset = 0,
  filters: { pair?: string; timeframe?: string; signalType?: string; dateFrom?: Date; dateTo?: Date } = {},
): Promise<TradingSignal[]> {
  if (!supabase) {
    console.error("Supabase client not available")
    return []
  }

  try {
    console.log(`Fetching completed signals with limit ${limit}, offset ${offset}, filters:`, filters);
    
    // Try to sync any unsaved signals first
    try {
      await syncCompletedSignals();
    } catch (syncError) {
      console.error("Error syncing signals during getCompletedSignals:", syncError);
      // Continue anyway - we'll try to fetch what's available
    }
    
    let query = supabase
      .from("completed_signals")
      .select("*")
      .order("exit_time", { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    // Apply filters
    if (filters.pair) {
      query = query.eq("pair", filters.pair)
    }

    if (filters.timeframe) {
      query = query.eq("timeframe", filters.timeframe)
    }

    if (filters.signalType) {
      query = query.eq("signal_type", filters.signalType)
    }

    if (filters.dateFrom) {
      query = query.gte("exit_time", filters.dateFrom.toISOString())
    }

    if (filters.dateTo) {
      query = query.lte("exit_time", filters.dateTo.toISOString())
    }

    const { data, error } = await query
    
    if (error) {
      console.error("Error fetching completed signals:", error)
      
      // If there's an error with the completed_signals table, try the generated_signals table
      console.log("Attempting to fetch from generated_signals as fallback...");
      
      let fallbackQuery = supabase
        .from("generated_signals")
        .select("*")
        .in("status", ["completed", "expired"])
        .order("updated_at", { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)
        
      // Apply filters to fallback query
      if (filters.pair) {
        fallbackQuery = fallbackQuery.eq("pair", filters.pair)
      }

      if (filters.timeframe) {
        fallbackQuery = fallbackQuery.eq("timeframe", filters.timeframe)
      }

      if (filters.signalType) {
        fallbackQuery = fallbackQuery.eq("signal_type", filters.signalType)
      }
      
      const { data: fallbackData, error: fallbackError } = await fallbackQuery
      
      if (fallbackError) {
        console.error("Error fetching from fallback table:", fallbackError)
        return []
      }
      
      // Convert generated_signals format to TradingSignal format
      return fallbackData.map((record) => ({
        id: record.signal_id,
        type: record.signal_type as "long" | "short",
        entry: record.entry_price,
        stopLoss: record.stop_loss,
        takeProfit: record.take_profit,
        entryTime: new Date(record.created_at),
        pair: record.pair,
        timeframe: record.timeframe,
        source: record.signal_source || "unknown",
        status: record.status as "completed",
        exitPrice: record.exit_price || record.entry_price,
        exitTime: record.exit_time ? new Date(record.exit_time) : new Date(record.updated_at),
        exitType: record.exit_type as "tp" | "sl" | "manual" || "manual",
        profitLoss: record.profit_loss || 0,
        profitLossPercent: record.profit_loss_percent || 0,
        riskRewardRatio: record.risk_reward_ratio || 3.0,
        notes: null,
      }))
    }

    // Convert database records to TradingSignal objects
    console.log(`Successfully fetched ${data?.length || 0} completed signals`);
    return data.map((record) => ({
      id: record.signal_id,
      type: record.signal_type as "long" | "short",
      entry: record.entry_price,
      stopLoss: record.stop_loss,
      takeProfit: record.take_profit,
      entryTime: new Date(record.entry_time),
      pair: record.pair,
      timeframe: record.timeframe,
      source: record.signal_source,
      status: "completed",
      exitPrice: record.exit_price,
      exitTime: new Date(record.exit_time),
      exitType: record.exit_type as "tp" | "sl" | "manual",
      profitLoss: record.profit_loss,
      profitLossPercent: record.profit_loss_percent,
      riskRewardRatio: record.risk_reward_ratio,
      notes: record.notes,
    }))
  } catch (error) {
    console.error("Error fetching completed signals:", error)
    return []
  }
}

// Calculate signal statistics - UPDATED
export async function calculateSignalStats(
  filters: { pair?: string; timeframe?: string; signalType?: string; dateFrom?: Date; dateTo?: Date } = {},
): Promise<SignalStats> {
  // Fetch signals first
  const signals = await getCompletedSignals(1000, 0, filters);

  // Default empty stats
  const emptyStats = {
    totalSignals: 0,
    winningSignals: 0,
    losingSignals: 0,
    winRate: 0,
    averageProfitPercent: 0,
    averageLossPercent: 0,
    totalProfitLoss: 0,
    profitFactor: 0,
    expectancy: 0,
    largestWin: 0,
    largestLoss: 0,
    averageRRR: 0,
  };

  // If no signals found, return empty stats
  if (!signals || signals.length === 0) {
    return emptyStats;
  }

  try {
    // Calculate statistics from the signals array
    const totalSignals = signals.length;
    const winningSignals = signals.filter((signal) => signal.profitLoss !== undefined && signal.profitLoss > 0).length;
    const losingSignals = signals.filter((signal) => signal.profitLoss !== undefined && signal.profitLoss < 0).length;

    // Win rate
    const winRate = totalSignals > 0 ? (winningSignals / totalSignals) * 100 : 0;

    // Profit/loss calculations
    const winningTrades = signals.filter((signal) => signal.profitLoss !== undefined && signal.profitLoss > 0);
    const losingTrades = signals.filter((signal) => signal.profitLoss !== undefined && signal.profitLoss < 0);

    const totalProfit = winningTrades.reduce((sum, signal) => sum + (signal.profitLoss || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, signal) => sum + (signal.profitLoss || 0), 0));
    const totalProfitLoss = totalProfit - totalLoss;

    // Average profit/loss percentages
    const averageProfitPercent =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, signal) => sum + (signal.profitLossPercent || 0), 0) / winningTrades.length
        : 0;

    const averageLossPercent =
      losingTrades.length > 0
        ? Math.abs(losingTrades.reduce((sum, signal) => sum + (signal.profitLossPercent || 0), 0)) / losingTrades.length
        : 0;

    // Profit factor
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Number.POSITIVE_INFINITY : 0;

    // Expectancy
    const expectancy = (winRate / 100) * averageProfitPercent - (1 - winRate / 100) * averageLossPercent;

    // Largest win/loss
    const largestWin = winningTrades.length > 0
      ? Math.max(...winningTrades.map((signal) => signal.profitLoss || 0))
      : 0;

    const largestLoss = losingTrades.length > 0
      ? Math.abs(Math.min(...losingTrades.map((signal) => signal.profitLoss || 0)))
      : 0;

    // Average RRR
    const averageRRR =
      totalSignals > 0
        ? signals.reduce((sum, signal) => sum + (signal.riskRewardRatio || 0), 0) / totalSignals
        : 0;

    return {
      totalSignals,
      winningSignals,
      losingSignals,
      winRate,
      averageProfitPercent,
      averageLossPercent,
      totalProfitLoss,
      profitFactor,
      expectancy,
      largestWin,
      largestLoss,
      averageRRR,
    };
  } catch (error) {
    console.error("Error calculating signal stats:", error);
    return emptyStats;
  }
}

// New function to sync completed signals from generated_signals to completed_signals table
export async function syncCompletedSignals(): Promise<void> {
  if (!supabase) {
    console.error("Supabase client not available")
    return
  }

  try {
    console.log("Starting syncCompletedSignals function");

    // First check if we need to create the table
    try {
      const { error: tableError } = await supabase.rpc("create_completed_signals_table");
      if (tableError) {
        console.error("Error creating table:", tableError);
      } else {
        console.log("Table creation check successful");
      }
    } catch (tableError) {
      console.error("Error checking table:", tableError);
    }

    // Get completed signals from generated_signals table
    const { data: completedGeneratedSignals, error } = await supabase
      .from("generated_signals")
      .select("*")
      .in("status", ["completed", "expired"])
      .is("synced_to_completed", null) // Only get unsynced signals

    if (error) {
      console.error("Error fetching completed generated signals:", error)
      return
    }

    if (!completedGeneratedSignals || completedGeneratedSignals.length === 0) {
      console.log("No new completed signals to sync");
      return;
    }

    console.log(`Found ${completedGeneratedSignals.length} completed signals to sync`)

    // Insert each completed signal into completed_signals table
    for (const signal of completedGeneratedSignals) {
      try {
        // Calculate P&L if not already calculated
        let profitLoss = signal.profit_loss;
        let profitLossPercent = signal.profit_loss_percent;

        if (!profitLoss && signal.exit_price && signal.entry_price) {
          if (signal.signal_type === "long") {
            profitLoss = signal.exit_price - signal.entry_price;
          } else {
            profitLoss = signal.entry_price - signal.exit_price;
          }

          profitLossPercent = (profitLoss / signal.entry_price) * 100;
        }

        const { error: insertError } = await supabase.from("completed_signals").insert({
          signal_id: signal.signal_id,
          signal_type: signal.signal_type,
          entry_price: signal.entry_price,
          stop_loss: signal.stop_loss,
          take_profit: signal.take_profit,
          exit_price: signal.exit_price || signal.entry_price, // Fallback to entry price if no exit price
          exit_type: signal.exit_type || "manual", // Default to manual if no exit type
          entry_time: signal.created_at,
          exit_time: signal.exit_time || signal.updated_at || new Date().toISOString(),
          pair: signal.pair,
          timeframe: signal.timeframe,
          profit_loss: profitLoss || 0,
          profit_loss_percent: profitLossPercent || 0,
          risk_reward_ratio: signal.risk_reward_ratio || 3.0, // Default to 3.0 if not specified
          signal_source: signal.signal_source || "unknown",
          notes: null,
        })

        if (insertError) {
          console.error(`Error inserting completed signal ${signal.signal_id}:`, insertError)
        } else {
          // Mark as synced
          await supabase
            .from("generated_signals")
            .update({ synced_to_completed: true })
            .eq("signal_id", signal.signal_id)

          console.log(`Signal ${signal.signal_id} synced to completed_signals`)
        }
      } catch (error) {
        console.error(`Error syncing signal ${signal.signal_id}:`, error)
      }
    }

    console.log("Completed syncCompletedSignals function");
  } catch (error) {
    console.error("Error syncing completed signals:", error)
  }
}

// Add this at the end of the signals-service.ts file
// Run synchronization on module load if we're on the server
if (typeof window === 'undefined') {
  console.log('Server-side execution - running initial sync');
  // We're on the server, try to sync signals
  syncCompletedSignals().catch(err => {
    console.error('Error in initial signal sync:', err);
  });
}

// Add the missing export
export async function generateSignals(
  symbol: string,
  timeframe: string,
  candles: CandleData[],
): Promise<TradingSignal[]> {
  // This is a simplified implementation - in a real system, you would use
  // technical analysis to generate actual trading signals
  const signals: TradingSignal[] = []

  if (candles.length < 10) {
    return signals
  }

  // Get the most recent candles
  const recentCandles = candles.slice(-10)
  const lastCandle = recentCandles[recentCandles.length - 1]
  const prevCandle = recentCandles[recentCandles.length - 2]

  // Simple example: Generate a long signal if the last candle closed higher than the previous
  if (lastCandle.close > prevCandle.close) {
    const entry = lastCandle.close
    const stopLoss = Math.min(...recentCandles.map((c) => c.low)) * 0.99 // 1% below recent lows
    const takeProfit = entry + (entry - stopLoss) * 2 // 2:1 risk-reward ratio

    signals.push({
      type: "long",
      entry,
      stopLoss,
      takeProfit,
      entryTime: new Date(lastCandle.time),
      pair: symbol,
      timeframe,
      source: "algorithm",
      strength: "medium",
      notes: "Bullish momentum signal",
    })
  }

  // Generate a short signal if the last candle closed lower than the previous
  if (lastCandle.close < prevCandle.close) {
    const entry = lastCandle.close
    const stopLoss = Math.max(...recentCandles.map((c) => c.high)) * 1.01 // 1% above recent highs
    const takeProfit = entry - (stopLoss - entry) * 2 // 2:1 risk-reward ratio

    signals.push({
      type: "short",
      entry,
      stopLoss,
      takeProfit,
      entryTime: new Date(lastCandle.time),
      pair: symbol,
      timeframe,
      source: "algorithm",
      strength: "medium",
      notes: "Bearish momentum signal",
    })
  }

  return signals
}

// New function to sync completed signals from generated_signals to completed_signals table
export async function syncCompletedSignals(): Promise<void> {
  if (!supabase) {
    console.error("Supabase client not available")
    return
  }

  try {
    // Get completed signals from generated_signals table
    const { data: completedGeneratedSignals, error } = await supabase
      .from("generated_signals")
      .select("*")
      .in("status", ["completed", "expired"])
      .is("synced_to_completed", null) // Only get unsynced signals

    if (error) {
      console.error("Error fetching completed generated signals:", error)
      return
    }

    console.log(`Found ${completedGeneratedSignals?.length || 0} completed signals to sync`)

    // Insert each completed signal into completed_signals table
    for (const signal of completedGeneratedSignals || []) {
      try {
        const { error: insertError } = await supabase.from("completed_signals").insert({
          signal_id: signal.signal_id,
          signal_type: signal.signal_type,
          entry_price: signal.entry_price,
          stop_loss: signal.stop_loss,
          take_profit: signal.take_profit,
          exit_price: signal.exit_price,
          exit_type: signal.exit_type,
          entry_time: signal.created_at,
          exit_time: signal.exit_time || signal.updated_at,
          pair: signal.pair,
          timeframe: signal.timeframe,
          profit_loss: signal.profit_loss || 0,
          profit_loss_percent: signal.profit_loss_percent || 0,
          risk_reward_ratio: signal.risk_reward_ratio,
          signal_source: signal.signal_source,
          notes: null,
        })

        if (insertError) {
          console.error(`Error inserting completed signal ${signal.signal_id}:`, insertError)
        } else {
          // Mark as synced
          await supabase
            .from("generated_signals")
            .update({ synced_to_completed: true })
            .eq("signal_id", signal.signal_id)
          
          console.log(`Signal ${signal.signal_id} synced to completed_signals`)
        }
      } catch (error) {
        console.error(`Error syncing signal ${signal.signal_id}:`, error)
      }
    }
  } catch (error) {
    console.error("Error syncing completed signals:", error)
  }
}
