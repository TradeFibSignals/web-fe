import { supabase } from './supabase-client';
import { getRecentCandles, getCandlesInRange } from './candle-store';
import type { CandleData } from './websocket-candle-builder';

/**
 * Types for signal checking
 */
export interface SignalCheckResult {
  hit: boolean;
  exitType: 'tp' | 'sl' | null;
  exitPrice: number | null;
  exitTime: Date | null;
}

/**
 * Check if a signal has been hit
 * @param signalId ID of the signal to check
 * @returns Result of the check with hit status and exit details
 */
export async function checkActiveSignal(signalId: string): Promise<SignalCheckResult> {
  console.log(`Checking active signal: ${signalId}`);
  
  // Default result
  const defaultResult: SignalCheckResult = { 
    hit: false, 
    exitType: null, 
    exitPrice: null, 
    exitTime: null 
  };
  
  try {
    // Fetch signal details from database
    const { data: signal, error } = await supabase
      .from('generated_signals')
      .select('*')
      .eq('signal_id', signalId)
      .single();
      
    if (error || !signal) {
      console.error(`Signal not found: ${signalId}`);
      return defaultResult;
    }
    
    // Get signal creation time
    const signalCreationTime = new Date(signal.created_at).getTime();
    
    // Determine if we need to check for entry hit first
    if (!signal.entry_hit) {
      // Signal hasn't been activated yet, check if entry was hit
      const entryCheckResult = await checkEntryHit(signal);
      
      // If entry wasn't hit, signal is still waiting for activation
      if (!entryCheckResult.hit) {
        return defaultResult;
      }
      
      // If we got here, entry was hit - update the signal
      const { error: updateError } = await supabase
        .from('generated_signals')
        .update({
          entry_hit: true,
          entry_hit_time: entryCheckResult.hitTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('signal_id', signalId);
        
      if (updateError) {
        console.error(`Error updating entry hit status for signal ${signalId}:`, updateError);
      }
      
      // Check if TP/SL was hit in the same candle or subsequent candles
      return checkExitConditions(signal, entryCheckResult.hitTime.getTime());
    } else {
      // Signal has already been activated, check if TP/SL was hit
      const entryHitTime = signal.entry_hit_time ? new Date(signal.entry_hit_time).getTime() : signalCreationTime;
      return checkExitConditions(signal, entryHitTime);
    }
  } catch (error) {
    console.error(`Error checking signal ${signalId}:`, error);
    return defaultResult;
  }
}

/**
 * Check if a signal's entry price has been hit
 * @param signal Signal data from database
 * @returns Whether entry was hit and when
 */
async function checkEntryHit(signal: any): Promise<{ hit: boolean; hitTime: Date }> {
  try {
    // Get signal creation time
    const signalCreationTime = new Date(signal.created_at).getTime();
    const now = Date.now();
    
    // Get candles since signal creation
    const candles = await getCandlesInRange(
      signal.pair,
      signal.timeframe,
      signalCreationTime,
      now
    );
    
    if (!candles.length) {
      console.log(`No candles found for ${signal.pair} ${signal.timeframe} since signal creation`);
      return { hit: false, hitTime: new Date() };
    }
    
    console.log(`Checking ${candles.length} candles for entry hit`);
    
    // Check each candle to see if entry price was hit
    for (const candle of candles) {
      const candleTime = new Date(candle.time * 1000);
      
      if (signal.signal_type === 'long') {
        // For long positions, price needs to go down to entry
        if (candle.low <= signal.entry_price) {
          console.log(`Long entry hit at ${signal.entry_price} in candle at ${candleTime.toISOString()}`);
          return { hit: true, hitTime: candleTime };
        }
      } else {
        // For short positions, price needs to go up to entry
        if (candle.high >= signal.entry_price) {
          console.log(`Short entry hit at ${signal.entry_price} in candle at ${candleTime.toISOString()}`);
          return { hit: true, hitTime: candleTime };
        }
      }
    }
    
    // No hit found
    return { hit: false, hitTime: new Date() };
  } catch (error) {
    console.error(`Error checking entry hit:`, error);
    return { hit: false, hitTime: new Date() };
  }
}

/**
 * Check if a signal's exit conditions (TP or SL) have been hit
 * @param signal Signal data from database
 * @param startTime Time to start checking from (usually entry hit time)
 * @returns Result with hit status and exit details
 */
async function checkExitConditions(signal: any, startTime: number): Promise<SignalCheckResult> {
  try {
    const now = Date.now();
    
    // Get candles since entry was hit
    const candles = await getCandlesInRange(
      signal.pair,
      signal.timeframe,
      startTime,
      now
    );
    
    if (!candles.length) {
      console.log(`No candles found for ${signal.pair} ${signal.timeframe} since entry hit`);
      return { hit: false, exitType: null, exitPrice: null, exitTime: null };
    }
    
    console.log(`Checking ${candles.length} candles for TP/SL hit`);
    
    // Check each candle to see if TP or SL was hit
    for (const candle of candles) {
      const candleTime = new Date(candle.time * 1000);
      
      if (signal.signal_type === 'long') {
        // For long positions
        if (candle.high >= signal.take_profit) {
          // Take profit hit
          console.log(`Long TP hit at ${signal.take_profit} in candle at ${candleTime.toISOString()}`);
          return { 
            hit: true, 
            exitType: 'tp', 
            exitPrice: signal.take_profit,
            exitTime: candleTime
          };
        }
        
        if (candle.low <= signal.stop_loss) {
          // Stop loss hit
          console.log(`Long SL hit at ${signal.stop_loss} in candle at ${candleTime.toISOString()}`);
          return { 
            hit: true, 
            exitType: 'sl', 
            exitPrice: signal.stop_loss,
            exitTime: candleTime
          };
        }
      } else {
        // For short positions
        if (candle.low <= signal.take_profit) {
          // Take profit hit
          console.log(`Short TP hit at ${signal.take_profit} in candle at ${candleTime.toISOString()}`);
          return { 
            hit: true, 
            exitType: 'tp', 
            exitPrice: signal.take_profit,
            exitTime: candleTime
          };
        }
        
        if (candle.high >= signal.stop_loss) {
          // Stop loss hit
          console.log(`Short SL hit at ${signal.stop_loss} in candle at ${candleTime.toISOString()}`);
          return { 
            hit: true, 
            exitType: 'sl', 
            exitPrice: signal.stop_loss,
            exitTime: candleTime
          };
        }
      }
    }
    
    // No exit conditions hit
    return { hit: false, exitType: null, exitPrice: null, exitTime: null };
  } catch (error) {
    console.error(`Error checking exit conditions:`, error);
    return { hit: false, exitType: null, exitPrice: null, exitTime: null };
  }
}

/**
 * Check all active signals
 * @returns Summary of signals checked and updated
 */
export async function checkAllActiveSignals(): Promise<{
  checked: number;
  updated: number;
  completed: number;
  errors: number;
}> {
  console.log('Checking all active signals...');
  
  // Initialize counters
  const result = {
    checked: 0,
    updated: 0,
    completed: 0,
    errors: 0
  };
  
  try {
    // Get all active signals
    const { data: activeSignals, error } = await supabase
      .from('generated_signals')
      .select('*')
      .eq('status', 'active');
      
    if (error) {
      console.error('Error fetching active signals:', error);
      return result;
    }
    
    result.checked = activeSignals?.length || 0;
    console.log(`Found ${result.checked} active signals`);
    
    // Process each signal
    for (const signal of activeSignals || []) {
      try {
        // Check if signal has been hit
        const checkResult = await checkActiveSignal(signal.signal_id);
        
        // If signal has been hit, update it
        if (checkResult.hit && checkResult.exitType && checkResult.exitPrice && checkResult.exitTime) {
          console.log(`Signal ${signal.signal_id} hit ${checkResult.exitType} at ${checkResult.exitPrice}`);
          
          // Calculate profit/loss
          let profitLoss = 0;
          let profitLossPercent = 0;
          
          if (signal.signal_type === 'long') {
            profitLoss = checkResult.exitPrice - signal.entry_price;
          } else {
            profitLoss = signal.entry_price - checkResult.exitPrice;
          }
          
          profitLossPercent = (profitLoss / signal.entry_price) * 100;
          
          // Update the signal
          const { error: updateError } = await supabase
            .from('generated_signals')
            .update({
              status: 'completed',
              exit_price: checkResult.exitPrice,
              exit_time: checkResult.exitTime.toISOString(),
              exit_type: checkResult.exitType,
              profit_loss: profitLoss,
              profit_loss_percent: profitLossPercent,
              updated_at: new Date().toISOString()
            })
            .eq('signal_id', signal.signal_id);
            
          if (updateError) {
            console.error(`Error updating signal ${signal.signal_id}:`, updateError);
            result.errors++;
          } else {
            result.updated++;
            result.completed++;
          }
          
          // Also store in completed_signals table
          try {
            await storeCompletedSignal({
              ...signal,
              exit_price: checkResult.exitPrice,
              exit_time: checkResult.exitTime,
              exit_type: checkResult.exitType,
              profit_loss: profitLoss,
              profit_loss_percent: profitLossPercent
            });
          } catch (storeError) {
            console.error(`Error storing completed signal ${signal.signal_id}:`, storeError);
          }
        }
      } catch (signalError) {
        console.error(`Error processing signal ${signal.signal_id}:`, signalError);
        result.errors++;
      }
    }
    
    console.log(`Completed signal check: ${result.updated} signals updated, ${result.completed} completed, ${result.errors} errors`);
    return result;
  } catch (error) {
    console.error('Error checking active signals:', error);
    return result;
  }
}

/**
 * Store a signal in the completed_signals table
 * @param signal The completed signal data
 */
async function storeCompletedSignal(signal: any): Promise<void> {
  try {
    const { error } = await supabase.from('completed_signals').insert({
      signal_id: signal.signal_id,
      signal_type: signal.signal_type,
      entry_price: signal.entry_price,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      exit_price: signal.exit_price,
      exit_type: signal.exit_type,
      entry_time: signal.entry_hit_time || signal.created_at,
      exit_time: signal.exit_time.toISOString(),
      pair: signal.pair,
      timeframe: signal.timeframe,
      profit_loss: signal.profit_loss,
      profit_loss_percent: signal.profit_loss_percent,
      risk_reward_ratio: signal.risk_reward_ratio,
      signal_source: signal.signal_source || 'unknown',
      notes: signal.notes || null,
    });

    if (error) {
      console.error(`Error storing completed signal ${signal.signal_id}:`, error);
    }
  } catch (error) {
    console.error(`Error storing completed signal:`, error);
  }
}
