import { NextResponse } from "next/server"
import { type NextRequest } from "next/server"
import * as signalGeneratorService from "@/lib/signal-generator-service"
import { supabase } from "@/lib/supabase-client"
import { fetchBinanceTicker } from "@/lib/binance-api"

// Function to validate API key
const validateApiKey = (request: NextRequest) => {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false
  }
  const apiKey = authHeader.substring(7) // Remove 'Bearer ' from header
  const validApiKey = process.env.SIGNAL_GENERATOR_API_KEY
  return apiKey === validApiKey
}

export async function GET(request: NextRequest) {
  // Authenticate the request
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get("timeframe")
    const pair = searchParams.get("pair")
    const batchSize = parseInt(searchParams.get("batchSize") || "50", 10) // Default to 50 signals per batch
    const batchOffset = parseInt(searchParams.get("batchOffset") || "0", 10)
    const mode = searchParams.get("mode") || "normal" // 'normal' or 'count-only'
    const debugMode = searchParams.get("debug") === "true" // Enable detailed debugging
    
    // Validate timeframe if provided
    if (timeframe) {
      const validTimeframes = ["5m", "15m", "30m", "1h"]
      if (!validTimeframes.includes(timeframe)) {
        return NextResponse.json({ error: "Invalid timeframe. Must be one of: 5m, 15m, 30m, 1h" }, { status: 400 })
      }
    }
    
    // Check if Supabase client is available
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client not available" }, { status: 500 })
    }
    
    // Start time for performance tracking
    const startTime = Date.now()
    
    // For count-only mode, just return the total number of active signals
    if (mode === "count-only") {
      let query = supabase.from("generated_signals").select("id", { count: "exact" }).eq("status", "active")
      
      if (timeframe) {
        query = query.eq("timeframe", timeframe)
      }
      
      if (pair) {
        query = query.eq("pair", pair)
      }
      
      const { count, error } = await query
      
      if (error) {
        console.error("Error counting signals:", error)
        return NextResponse.json({ error: "Failed to count signals" }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        count: count || 0,
        timeframe: timeframe || "all",
        pair: pair || "all",
        executionTime: Date.now() - startTime
      })
    }
    
    // For normal mode, process signals in batches
    // Get active signals with pagination
    let query = supabase
      .from("generated_signals")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .range(batchOffset, batchOffset + batchSize - 1)
    
    if (timeframe) {
      query = query.eq("timeframe", timeframe)
    }
    
    if (pair) {
      query = query.eq("pair", pair)
    }
    
    const { data: activeSignals, error, count } = await query
    
    if (error) {
      console.error("Error fetching active signals:", error)
      return NextResponse.json({ error: "Failed to fetch signals" }, { status: 500 })
    }
    
    console.log(`Processing batch of ${activeSignals?.length || 0} signals (offset: ${batchOffset})`);
    
    // Initialize counters for tracking updates
    const results = {
      checked: activeSignals?.length || 0,
      updated: 0,
      completed: 0,
      expired: 0,
      errors: 0,
      hasMore: false,
      nextBatchOffset: 0
    }
    
    // For debug mode, collect detailed info about signals
    const debugInfo = debugMode ? [] : undefined
    
    // Check if there are more signals to process
    if (activeSignals && activeSignals.length === batchSize) {
      results.hasMore = true
      results.nextBatchOffset = batchOffset + batchSize
    }
    
    // If no signals to check, return early
    if (!activeSignals || activeSignals.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No signals to check${timeframe ? ` for timeframe: ${timeframe}` : ''}${pair ? ` and pair: ${pair}` : ''}`,
        result: results,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    }
    
    // Group signals by pair for more efficient processing
    const signalsByPair: Record<string, any[]> = {}
    
    activeSignals.forEach((signal) => {
      if (!signalsByPair[signal.pair]) {
        signalsByPair[signal.pair] = []
      }
      signalsByPair[signal.pair].push(signal)
    })
    
    // Process signals for each pair
    for (const [signalPair, signals] of Object.entries(signalsByPair)) {
      try {
        // Get current price for the pair (use fetchBinanceTicker directly for faster response)
        let currentPrice = 0
        let tickerSuccess = false
        let tickerError = null
        
        try {
          const tickerData = await fetchBinanceTicker(signalPair)
          currentPrice = parseFloat(tickerData.lastPrice)
          tickerSuccess = true
          console.log(`Current price for ${signalPair}: ${currentPrice}`)
        } catch (priceError) {
          tickerError = priceError
          console.error(`Error fetching price for ${signalPair}:`, priceError)
          results.errors += signals.length
          
          if (debugMode) {
            debugInfo?.push({
              pair: signalPair,
              ticker_error: priceError.message,
              signals_count: signals.length
            })
          }
          
          continue // Skip this pair if we can't get price
        }
        
        if (!currentPrice) {
          console.log(`Invalid current price (${currentPrice}) for ${signalPair}, skipping...`)
          results.errors += signals.length
          
          if (debugMode) {
            debugInfo?.push({
              pair: signalPair,
              error: `Invalid current price: ${currentPrice}`,
              signals_count: signals.length
            })
          }
          
          continue
        }
        
        // Process each signal for this pair
        const updates: any[] = []
        const pairDebugInfo = debugMode ? [] : undefined
        
        for (const signal of signals) {
          try {
            // Debug information for this signal
            const signalDebug = debugMode ? {
              signal_id: signal.signal_id,
              signal_type: signal.signal_type,
              entry_price: signal.entry_price,
              stop_loss: signal.stop_loss,
              take_profit: signal.take_profit,
              current_price: currentPrice,
              entry_hit: signal.entry_hit,
              status: signal.status,
              created_at: signal.created_at,
              // Check conditions
              long_entry_condition: signal.signal_type === "long" && currentPrice <= signal.entry_price,
              short_entry_condition: signal.signal_type === "short" && currentPrice >= signal.entry_price,
              price_diff_percent: ((currentPrice - signal.entry_price) / signal.entry_price * 100).toFixed(2) + '%',
              action: "none" // Will be updated if any action is taken
            } : undefined
            
            // Check if signal has already been activated (entry hit)
            let entryHit = signal.entry_hit || false // Ensure boolean value
            let entryHitTime = signal.entry_hit_time
            let status = signal.status
            let isCompleted = false
            let exitType: string | null = null
            let exitPrice: number | null = null
            let exitTime: Date | null = null
            let updateNeeded = false
            
            // Check if entry price has been hit (if not already)
            if (!entryHit) {
              if (signal.signal_type === "long") {
                // For long positions - price must drop to or below entry price
                if (currentPrice <= signal.entry_price) {
                  entryHit = true
                  entryHitTime = new Date().toISOString()
                  updateNeeded = true
                  if (signalDebug) signalDebug.action = "entry_hit_long"
                  console.log(`Entry hit for ${signalPair} ${signal.timeframe} LONG signal at ${currentPrice}`)
                }
              } else {
                // For short positions - price must rise to or above entry price
                if (currentPrice >= signal.entry_price) {
                  entryHit = true
                  entryHitTime = new Date().toISOString()
                  updateNeeded = true
                  if (signalDebug) signalDebug.action = "entry_hit_short"
                  console.log(`Entry hit for ${signalPair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
                }
              }
            }
            
            // If signal is active (entry price has been hit), check TP/SL
            if (entryHit) {
              if (signal.signal_type === "long") {
                // For long positions - TP above entry, SL below entry
                if (currentPrice >= signal.take_profit) {
                  isCompleted = true
                  exitType = "tp"
                  exitPrice = signal.take_profit
                  exitTime = new Date()
                  status = "completed"
                  updateNeeded = true
                  if (signalDebug) signalDebug.action = "tp_hit_long"
                  console.log(`Take profit hit for ${signalPair} ${signal.timeframe} LONG signal at ${currentPrice}`)
                } else if (currentPrice <= signal.stop_loss) {
                  isCompleted = true
                  exitType = "sl"
                  exitPrice = signal.stop_loss
                  exitTime = new Date()
                  status = "completed"
                  updateNeeded = true
                  if (signalDebug) signalDebug.action = "sl_hit_long"
                  console.log(`Stop loss hit for ${signalPair} ${signal.timeframe} LONG signal at ${currentPrice}`)
                }
              } else {
                // For short positions - TP below entry, SL above entry
                if (currentPrice <= signal.take_profit) {
                  isCompleted = true
                  exitType = "tp"
                  exitPrice = signal.take_profit
                  exitTime = new Date()
                  status = "completed"
                  updateNeeded = true
                  if (signalDebug) signalDebug.action = "tp_hit_short"
                  console.log(`Take profit hit for ${signalPair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
                } else if (currentPrice >= signal.stop_loss) {
                  isCompleted = true
                  exitType = "sl"
                  exitPrice = signal.stop_loss
                  exitTime = new Date()
                  status = "completed"
                  updateNeeded = true
                  if (signalDebug) signalDebug.action = "sl_hit_short"
                  console.log(`Stop loss hit for ${signalPair} ${signal.timeframe} SHORT signal at ${currentPrice}`)
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
              updateNeeded = true
              if (signalDebug) signalDebug.action = "expired"
              console.log(`Signal expired for ${signalPair} ${signal.timeframe} ${signal.signal_type} signal`)
            }
            
            // Add to debug info if in debug mode
            if (debugMode && signalDebug) {
              signalDebug.update_needed = updateNeeded
              signalDebug.age_days = (signalAge / (24 * 60 * 60 * 1000)).toFixed(1)
              pairDebugInfo?.push(signalDebug)
            }
            
            // If updates are needed, prepare the update data
            if (updateNeeded) {
              const updateData: any = {
                entry_hit: entryHit,
                status,
                updated_at: new Date().toISOString()
              }
              
              if (entryHit && !signal.entry_hit) {
                updateData.entry_hit_time = entryHitTime
              }
              
              if (isCompleted) {
                updateData.exit_type = exitType
                updateData.exit_price = exitPrice
                updateData.exit_time = exitTime?.toISOString()
                
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
              
              // Add to batch updates
              updates.push({
                id: signal.id,
                signal_id: signal.signal_id,
                updateData
              })
              
              if (isCompleted) {
                if (exitType === "expired") {
                  results.expired++
                } else {
                  results.completed++
                }
              }
              
              results.updated++
            }
          } catch (signalError) {
            console.error(`Error processing signal ${signal.signal_id}:`, signalError)
            results.errors++
            
            if (debugMode) {
              pairDebugInfo?.push({
                signal_id: signal.signal_id,
                error: signalError.message
              })
            }
          }
        }
        
        // Add pair debug info to overall debug info
        if (debugMode && pairDebugInfo) {
          debugInfo?.push({
            pair: signalPair,
            current_price: currentPrice,
            signals_count: signals.length,
            signals: pairDebugInfo
          })
        }
        
        // Perform batch updates if any
        if (updates.length > 0) {
          for (const update of updates) {
            try {
              const { error: updateError } = await supabase
                .from("generated_signals")
                .update(update.updateData)
                .eq("signal_id", update.signal_id)
              
              if (updateError) {
                console.error(`Error updating signal ${update.signal_id}:`, updateError)
                results.errors++
                results.updated--
                
                if (debugMode) {
                  // Find and update the debug info for this signal
                  for (const pairInfo of debugInfo || []) {
                    if (!pairInfo.signals) continue
                    
                    const signalDebug = pairInfo.signals.find((s: any) => s.signal_id === update.signal_id)
                    if (signalDebug) {
                      signalDebug.update_error = updateError.message
                    }
                  }
                }
              }
            } catch (updateError) {
              console.error(`Error updating signal:`, updateError)
              results.errors++
              results.updated--
            }
          }
        }
      } catch (pairError) {
        console.error(`Error processing signals for ${signalPair}:`, pairError)
        results.errors += signalsByPair[signalPair].length
        
        if (debugMode) {
          debugInfo?.push({
            pair: signalPair,
            error: pairError.message,
            signals_count: signalsByPair[signalPair].length
          })
        }
      }
    }
    
    // Calculate execution time
    const executionTime = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      message: `Signals checked and updated${timeframe ? ` for timeframe: ${timeframe}` : ''}${pair ? ` and pair: ${pair}` : ''}`,
      result: results,
      executionTime,
      timestamp: new Date().toISOString(),
      batchInfo: {
        batchSize,
        batchOffset,
        hasMore: results.hasMore,
        nextBatchOffset: results.nextBatchOffset
      },
      debug: debugMode ? debugInfo : undefined
    })
  } catch (error) {
    console.error("Error checking signals:", error)
    return NextResponse.json(
      {
        error: "Failed to check signals",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
