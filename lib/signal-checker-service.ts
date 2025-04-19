// A robust service for checking trading signals in the Liquidation Vision platform

import { supabase } from './supabase-client';
import { fetchBinanceTicker } from './binance-api';
import type { CandleData } from './binance-api';

/**
 * Interface for signal check result
 */
export interface SignalCheckResult {
  id: string;
  pair: string;
  timeframe: string;
  signalType: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  currentPrice: number;
  entryHit: boolean;
  completed: boolean;
  exitType: 'tp' | 'sl' | 'expired' | 'manual' | null;
  exitPrice: number | null;
  profitLoss: number | null;
  profitLossPercent: number | null;
  updatedInDb: boolean;
  error: string | null;
}

/**
 * Interface for batch check results
 */
export interface BatchCheckResult {
  signalsChecked: number;
  signalsUpdated: number;
  signalsCompleted: number;
  signalsExpired: number;
  errors: number;
  results: SignalCheckResult[];
  executionTime: number;
}

/**
 * Check a single trading signal against current market data
 * @param signalId ID of the signal to check
 * @returns Detailed result of the signal check
 */
export async function checkSignal(signalId: string): Promise<SignalCheckResult> {
  console.log(`Checking signal: ${signalId}`);
  
  // Default result structure with error state
  const defaultResult: SignalCheckResult = {
    id: signalId,
    pair: '',
    timeframe: '',
    signalType: 'long',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit: 0,
    currentPrice: 0,
    entryHit: false,
    completed: false,
    exitType: null,
    exitPrice: null,
    profitLoss: null,
    profitLossPercent: null,
    updatedInDb: false,
    error: 'Failed to check signal'
  };
  
  try {
    // 1. Fetch signal details from database
    if (!supabase) {
      return { ...defaultResult, error: 'Supabase client not available' };
    }
    
    const { data: signal, error } = await supabase
      .from('generated_signals')
      .select('*')
      .eq('signal_id', signalId)
      .single();
      
    if (error || !signal) {
      return { ...defaultResult, error: `Signal not found: ${error?.message || 'No data returned'}` };
    }
    
    // 2. Get current market price for the signal's pair
    let currentPrice: number;
    try {
      const tickerData = await fetchBinanceTicker(signal.pair);
      currentPrice = parseFloat(tickerData.lastPrice);
      
      if (!currentPrice || isNaN(currentPrice)) {
        return { 
          ...defaultResult, 
          pair: signal.pair,
          timeframe: signal.timeframe,
          signalType: signal.signal_type,
          entryPrice: signal.entry_price,
          stopLoss: signal.stop_loss,
          takeProfit: signal.take_profit,
          error: `Invalid price data returned: ${tickerData.lastPrice}` 
        };
      }
    } catch (priceError) {
      return { 
        ...defaultResult, 
        pair: signal.pair,
        timeframe: signal.timeframe,
        signalType: signal.signal_type,
        entryPrice: signal.entry_price,
        stopLoss: signal.stop_loss,
        takeProfit: signal.take_profit,
        error: `Error fetching current price: ${priceError instanceof Error ? priceError.message : String(priceError)}` 
      };
    }
    
    // 3. Prepare result object with signal data
    const result: SignalCheckResult = {
      id: signalId,
      pair: signal.pair,
      timeframe: signal.timeframe,
      signalType: signal.signal_type,
      entryPrice: signal.entry_price,
      stopLoss: signal.stop_loss,
      takeProfit: signal.take_profit,
      currentPrice,
      entryHit: signal.entry_hit || false,
      completed: signal.status === 'completed' || signal.status === 'expired',
      exitType: signal.exit_type || null,
      exitPrice: signal.exit_price || null,
      profitLoss: signal.profit_loss || null,
      profitLossPercent: signal.profit_loss_percent || null,
      updatedInDb: false,
      error: null
    };
    
    // 4. If signal is already completed, just return its status
    if (result.completed) {
      return result;
    }
    
    // 5. Check entry hit status (if not already hit)
    let updateNeeded = false;
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    
    if (!result.entryHit) {
      // Check if price has hit entry level
      if (
        (result.signalType === 'long' && currentPrice <= result.entryPrice) ||
        (result.signalType === 'short' && currentPrice >= result.entryPrice)
      ) {
        // Entry price has been hit
        result.entryHit = true;
        updates.entry_hit = true;
        updates.entry_hit_time = new Date().toISOString();
        updateNeeded = true;
        console.log(`Entry hit for ${result.pair} ${result.timeframe} ${result.signalType} signal at ${currentPrice}`);
      }
    }
    
    // 6. If entry has been hit, check for TP/SL
    if (result.entryHit) {
      if (result.signalType === 'long') {
        // For long signals
        if (currentPrice >= result.takeProfit) {
          // Take profit hit
          result.completed = true;
          result.exitType = 'tp';
          result.exitPrice = result.takeProfit;
          updateNeeded = true;
          console.log(`Take profit hit for ${result.pair} ${result.signalType} signal at ${currentPrice}`);
        } else if (currentPrice <= result.stopLoss) {
          // Stop loss hit
          result.completed = true;
          result.exitType = 'sl';
          result.exitPrice = result.stopLoss;
          updateNeeded = true;
          console.log(`Stop loss hit for ${result.pair} ${result.signalType} signal at ${currentPrice}`);
        }
      } else {
        // For short signals
        if (currentPrice <= result.takeProfit) {
          // Take profit hit
          result.completed = true;
          result.exitType = 'tp';
          result.exitPrice = result.takeProfit;
          updateNeeded = true;
          console.log(`Take profit hit for ${result.pair} ${result.signalType} signal at ${currentPrice}`);
        } else if (currentPrice >= result.stopLoss) {
          // Stop loss hit
          result.completed = true;
          result.exitType = 'sl';
          result.exitPrice = result.stopLoss;
          updateNeeded = true;
          console.log(`Stop loss hit for ${result.pair} ${result.signalType} signal at ${currentPrice}`);
        }
      }
    }
    
    // 7. Check for signal expiration (if not yet activated after 7 days)
    if (!result.entryHit) {
      const signalAge = Date.now() - new Date(signal.created_at).getTime();
      const maxSignalAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (signalAge > maxSignalAge) {
        result.completed = true;
        result.exitType = 'expired';
        result.exitPrice = currentPrice;
        updateNeeded = true;
        console.log(`Signal expired for ${result.pair} ${result.timeframe} ${result.signalType} signal`);
      }
    }
    
    // 8. If signal completed, calculate profit/loss
    if (result.completed && result.exitPrice) {
      let profitLoss = 0;
      
      if (result.signalType === 'long') {
        profitLoss = result.exitPrice - result.entryPrice;
      } else {
        profitLoss = result.entryPrice - result.exitPrice;
      }
      
      result.profitLoss = profitLoss;
      result.profitLossPercent = (profitLoss / result.entryPrice) * 100;
      
      // Add to updates
      updates.status = result.exitType === 'expired' ? 'expired' : 'completed';
      updates.exit_type = result.exitType;
      updates.exit_price = result.exitPrice;
      updates.exit_time = new Date().toISOString();
      updates.profit_loss = result.profitLoss;
      updates.profit_loss_percent = result.profitLossPercent;
    }
    
    // 9. Update database if needed
    if (updateNeeded) {
      try {
        const { error: updateError } = await supabase
          .from('generated_signals')
          .update(updates)
          .eq('signal_id', signalId);
          
        if (updateError) {
          result.error = `Error updating signal: ${updateError.message}`;
        } else {
          result.updatedInDb = true;
          
          // If signal was completed, also store in completed_signals table
          if (result.completed && result.exitPrice) {
            await storeCompletedSignal(signal, result);
          }
        }
      } catch (updateError) {
        result.error = `Exception updating signal: ${updateError instanceof Error ? updateError.message : String(updateError)}`;
      }
    }
    
    return result;
  } catch (error) {
    return { 
      ...defaultResult, 
      error: `Exception checking signal: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Store a completed signal in the completed_signals table
 * @param signal Original signal data from database
 * @param result Signal check result
 */
async function storeCompletedSignal(signal: any, result: SignalCheckResult): Promise<void> {
  if (!supabase || !result.exitPrice || !result.exitType) return;
  
  try {
    const { error } = await supabase.from('completed_signals').insert({
      signal_id: signal.signal_id,
      signal_type: signal.signal_type,
      entry_price: signal.entry_price,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      exit_price: result.exitPrice,
      exit_type: result.exitType,
      entry_time: signal.entry_hit_time || signal.created_at,
      exit_time: new Date().toISOString(),
      pair: signal.pair,
      timeframe: signal.timeframe,
      profit_loss: result.profitLoss || 0,
      profit_loss_percent: result.profitLossPercent || 0,
      risk_reward_ratio: signal.risk_reward_ratio || 0,
      signal_source: signal.signal_source || 'unknown',
      notes: signal.notes || null,
    });

    if (error) {
      console.error(`Error storing completed signal ${signal.signal_id}:`, error);
    } else {
      console.log(`Completed signal ${signal.signal_id} stored successfully`);
      
      // Mark as synced in generated_signals table
      await supabase
        .from('generated_signals')
        .update({ synced_to_completed: true })
        .eq('signal_id', signal.signal_id);
    }
  } catch (error) {
    console.error(`Exception storing completed signal:`, error);
  }
}

/**
 * Check multiple signals in a batch for efficiency
 * @param options Batch checking options
 * @returns Batch check results
 */
export async function checkSignalsBatch(options: {
  timeframe?: string;
  pair?: string;
  limit?: number;
  offset?: number;
  checkCompletedSignals?: boolean;
}): Promise<BatchCheckResult> {
  const startTime = Date.now();
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  
  // Initialize results
  const result: BatchCheckResult = {
    signalsChecked: 0,
    signalsUpdated: 0,
    signalsCompleted: 0,
    signalsExpired: 0,
    errors: 0,
    results: [],
    executionTime: 0
  };
  
  try {
    // 1. Get active signals from database
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    
    let query = supabase
      .from('generated_signals')
      .select('signal_id');
      
    // Only check active signals unless specifically requested to check completed ones
    if (!options.checkCompletedSignals) {
      query = query.eq('status', 'active');
    }
    
    // Apply filters if provided
    if (options.timeframe) {
      query = query.eq('timeframe', options.timeframe);
    }
    
    if (options.pair) {
      query = query.eq('pair', options.pair);
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: signals, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching signals: ${error.message}`);
    }
    
    result.signalsChecked = signals?.length || 0;
    console.log(`Found ${result.signalsChecked} signals to check`);
    
    // 2. Check each signal
    for (const signal of signals || []) {
      try {
        const checkResult = await checkSignal(signal.signal_id);
        result.results.push(checkResult);
        
        // Update counters
        if (checkResult.updatedInDb) {
          result.signalsUpdated++;
          
          if (checkResult.completed) {
            if (checkResult.exitType === 'expired') {
              result.signalsExpired++;
            } else {
              result.signalsCompleted++;
            }
          }
        }
        
        if (checkResult.error) {
          result.errors++;
        }
      } catch (checkError) {
        result.errors++;
        result.results.push({
          id: signal.signal_id,
          pair: '',
          timeframe: '',
          signalType: 'long',
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          currentPrice: 0,
          entryHit: false,
          completed: false,
          exitType: null,
          exitPrice: null,
          profitLoss: null,
          profitLossPercent: null,
          updatedInDb: false,
          error: `Exception checking signal: ${checkError instanceof Error ? checkError.message : String(checkError)}`
        });
      }
    }
    
    // 3. Calculate execution time
    result.executionTime = Date.now() - startTime;
    
    return result;
  } catch (error) {
    // Handle batch-level errors
    result.executionTime = Date.now() - startTime;
    console.error('Error in batch signal check:', error);
    throw error;
  }
}

/**
 * Group signals by pair for more efficient checking (reduces API calls)
 * @param options Check options
 * @returns Batch check results
 */
export async function checkSignalsGroupedByPair(options: {
  timeframe?: string;
  limit?: number;
  offset?: number;
}): Promise<BatchCheckResult> {
  const startTime = Date.now();
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  
  // Initialize results
  const result: BatchCheckResult = {
    signalsChecked: 0,
    signalsUpdated: 0,
    signalsCompleted: 0,
    signalsExpired: 0,
    errors: 0,
    results: [],
    executionTime: 0
  };
  
  try {
    // 1. Get active signals from database
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    
    let query = supabase
      .from('generated_signals')
      .select('*')
      .eq('status', 'active')
      .order('pair', { ascending: true })
      .range(offset, offset + limit - 1);
      
    // Apply timeframe filter if provided
    if (options.timeframe) {
      query = query.eq('timeframe', options.timeframe);
    }
    
    const { data: signals, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching signals: ${error.message}`);
    }
    
    result.signalsChecked = signals?.length || 0;
    console.log(`Found ${result.signalsChecked} signals to check`);
    
    // 2. Group signals by pair
    const signalsByPair: Record<string, any[]> = {};
    
    signals?.forEach(signal => {
      if (!signalsByPair[signal.pair]) {
        signalsByPair[signal.pair] = [];
      }
      signalsByPair[signal.pair].push(signal);
    });
    
    // 3. Process each pair group
    for (const [pair, pairSignals] of Object.entries(signalsByPair)) {
      try {
        // Get current price once for all signals of this pair
        const tickerData = await fetchBinanceTicker(pair);
        const currentPrice = parseFloat(tickerData.lastPrice);
        
        if (!currentPrice || isNaN(currentPrice)) {
          // Skip this pair if price data is invalid
          pairSignals.forEach(signal => {
            result.errors++;
            result.results.push({
              id: signal.signal_id,
              pair: signal.pair,
              timeframe: signal.timeframe,
              signalType: signal.signal_type,
              entryPrice: signal.entry_price,
              stopLoss: signal.stop_loss,
              takeProfit: signal.take_profit,
              currentPrice: 0,
              entryHit: signal.entry_hit || false,
              completed: false,
              exitType: null,
              exitPrice: null,
              profitLoss: null,
              profitLossPercent: null,
              updatedInDb: false,
              error: `Invalid price data for ${pair}: ${tickerData.lastPrice}`
            });
          });
          continue;
        }
        
        // Process each signal with the current price
        for (const signal of pairSignals) {
          try {
            // Check entry conditions
            let entryHit = signal.entry_hit || false;
            let completed = false;
            let exitType: 'tp' | 'sl' | 'expired' | null = null;
            let exitPrice: number | null = null;
            let profitLoss: number | null = null;
            let profitLossPercent: number | null = null;
            let updateNeeded = false;
            let error: string | null = null;
            
            const updates: Record<string, any> = {
              updated_at: new Date().toISOString()
            };
            
            // Check entry hit (if not already hit)
            if (!entryHit) {
              if (
                (signal.signal_type === 'long' && currentPrice <= signal.entry_price) ||
                (signal.signal_type === 'short' && currentPrice >= signal.entry_price)
              ) {
                entryHit = true;
                updates.entry_hit = true;
                updates.entry_hit_time = new Date().toISOString();
                updateNeeded = true;
              }
            }
            
            // Check TP/SL if entry has been hit
            if (entryHit) {
              if (signal.signal_type === 'long') {
                if (currentPrice >= signal.take_profit) {
                  completed = true;
                  exitType = 'tp';
                  exitPrice = signal.take_profit;
                  updateNeeded = true;
                } else if (currentPrice <= signal.stop_loss) {
                  completed = true;
                  exitType = 'sl';
                  exitPrice = signal.stop_loss;
                  updateNeeded = true;
                }
              } else {
                if (currentPrice <= signal.take_profit) {
                  completed = true;
                  exitType = 'tp';
                  exitPrice = signal.take_profit;
                  updateNeeded = true;
                } else if (currentPrice >= signal.stop_loss) {
                  completed = true;
                  exitType = 'sl';
                  exitPrice = signal.stop_loss;
                  updateNeeded = true;
                }
              }
            }
            
            // Check for expiration
            if (!entryHit) {
              const signalAge = Date.now() - new Date(signal.created_at).getTime();
              const maxSignalAge = 7 * 24 * 60 * 60 * 1000; // 7 days
              
              if (signalAge > maxSignalAge) {
                completed = true;
                exitType = 'expired';
                exitPrice = currentPrice;
                updateNeeded = true;
              }
            }
            
            // Calculate profit/loss if completed
            if (completed && exitPrice !== null) {
              if (signal.signal_type === 'long') {
                profitLoss = exitPrice - signal.entry_price;
              } else {
                profitLoss = signal.entry_price - exitPrice;
              }
              
              profitLossPercent = (profitLoss / signal.entry_price) * 100;
              
              // Add to updates
              updates.status = exitType === 'expired' ? 'expired' : 'completed';
              updates.exit_type = exitType;
              updates.exit_price = exitPrice;
              updates.exit_time = new Date().toISOString();
              updates.profit_loss = profitLoss;
              updates.profit_loss_percent = profitLossPercent;
            }
            
            // Update database if needed
            let updatedInDb = false;
            if (updateNeeded) {
              try {
                const { error: updateError } = await supabase
                  .from('generated_signals')
                  .update(updates)
                  .eq('signal_id', signal.signal_id);
                  
                if (updateError) {
                  error = `Error updating signal: ${updateError.message}`;
                } else {
                  updatedInDb = true;
                  
                  // Count updates
                  result.signalsUpdated++;
                  
                  if (completed) {
                    if (exitType === 'expired') {
                      result.signalsExpired++;
                    } else {
                      result.signalsCompleted++;
                    }
                    
                    // Store in completed_signals table
                    try {
                      await storeCompletedSignal(signal, {
                        id: signal.signal_id,
                        pair: signal.pair,
                        timeframe: signal.timeframe,
                        signalType: signal.signal_type,
                        entryPrice: signal.entry_price,
                        stopLoss: signal.stop_loss,
                        takeProfit: signal.take_profit,
                        currentPrice,
                        entryHit,
                        completed,
                        exitType,
                        exitPrice,
                        profitLoss,
                        profitLossPercent,
                        updatedInDb: true,
                        error: null
                      });
                    } catch (storeError) {
                      console.error(`Error storing completed signal:`, storeError);
                    }
                  }
                }
              } catch (updateError) {
                error = `Exception updating signal: ${updateError instanceof Error ? updateError.message : String(updateError)}`;
              }
            }
            
            // Add result
            result.results.push({
              id: signal.signal_id,
              pair: signal.pair,
              timeframe: signal.timeframe,
              signalType: signal.signal_type,
              entryPrice: signal.entry_price,
              stopLoss: signal.stop_loss,
              takeProfit: signal.take_profit,
              currentPrice,
              entryHit,
              completed,
              exitType,
              exitPrice,
              profitLoss,
              profitLossPercent,
              updatedInDb,
              error
            });
            
            if (error) {
              result.errors++;
            }
          } catch (signalError) {
            result.errors++;
            result.results.push({
              id: signal.signal_id,
              pair: signal.pair,
              timeframe: signal.timeframe,
              signalType: signal.signal_type,
              entryPrice: signal.entry_price,
              stopLoss: signal.stop_loss,
              takeProfit: signal.take_profit,
              currentPrice,
              entryHit: signal.entry_hit || false,
              completed: false,
              exitType: null,
              exitPrice: null,
              profitLoss: null,
              profitLossPercent: null,
              updatedInDb: false,
              error: `Exception processing signal: ${signalError instanceof Error ? signalError.message : String(signalError)}`
            });
          }
        }
      } catch (pairError) {
        // Handle errors for the entire pair
        pairSignals.forEach(signal => {
          result.errors++;
          result.results.push({
            id: signal.signal_id,
            pair: signal.pair,
            timeframe: signal.timeframe,
            signalType: signal.signal_type,
            entryPrice: signal.entry_price,
            stopLoss: signal.stop_loss,
            takeProfit: signal.take_profit,
            currentPrice: 0,
            entryHit: signal.entry_hit || false,
            completed: false,
            exitType: null,
            exitPrice: null,
            profitLoss: null,
            profitLossPercent: null,
            updatedInDb: false,
            error: `Error processing pair ${pair}: ${pairError instanceof Error ? pairError.message : String(pairError)}`
          });
        });
      }
    }
    
    // Calculate execution time
    result.executionTime = Date.now() - startTime;
    
    return result;
  } catch (error) {
    result.executionTime = Date.now() - startTime;
    console.error('Error in grouped signal check:', error);
    throw error;
  }
}

/**
 * Get statistics on active signals
 */
export async function getSignalStats(): Promise<{
  totalActive: number;
  byTimeframe: Record<string, number>;
  byPair: Record<string, number>;
  byType: Record<string, number>;
  entryHitCount: number;
  entryHitRate: number;
  avgSignalAge: number;
}> {
  if (!supabase) {
    throw new Error('Supabase client not available');
  }
  
  // Get all active signals
  const { data: signals, error } = await supabase
    .from('generated_signals')
    .select('*')
    .eq('status', 'active');
    
  if (error) {
    throw new Error(`Error fetching signals: ${error.message}`);
  }
  
  const stats = {
    totalActive: signals?.length || 0,
    byTimeframe: {} as Record<string, number>,
    byPair: {} as Record<string, number>,
    byType: {
      long: 0,
      short: 0
    } as Record<string, number>,
    entryHitCount: 0,
    entryHitRate: 0,
    avgSignalAge: 0
  };
  
  if (!signals || signals.length === 0) {
    return stats;
  }
  
  // Calculate signal ages
  const now = Date.now();
  let totalAgeMs = 0;
  
  signals.forEach(signal => {
    // Count by timeframe
    const timeframe = signal.timeframe;
    stats.byTimeframe[timeframe] = (stats.byTimeframe[timeframe] || 0) + 1;
    
    // Count by pair
    const pair = signal.pair;
    stats.byPair[pair] = (stats.byPair[pair] || 0) + 1;
    
    // Count by type
    const type = signal.signal_type;
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    
    // Count entry hits
    if (signal.entry_hit) {
      stats.entryHitCount++;
    }
    
    // Calculate age
    const createdAt = new Date(signal.created_at).getTime();
    const ageMs = now - createdAt;
    totalAgeMs += ageMs;
  });
  
  // Calculate averages
  stats.entryHitRate = stats.totalActive > 0 ? (stats.entryHitCount / stats.totalActive) * 100 : 0;
  stats.avgSignalAge = stats.totalActive > 0 ? totalAgeMs / stats.totalActive / (1000 * 60 * 60 * 24) : 0; // in days
  
  return stats;
}
