import { supabase } from './supabase-client';
import type { CandleData } from './binance-api';
import { fetchHistoricalCandles } from './binance-api';

/**
 * Initializes historical data for a specific pair and all timeframes
 * @param pair Trading pair symbol
 * @param timeframes Array of timeframes to fetch
 * @returns Promise resolving to true if successful
 */
export async function initializeHistoricalData(
  pair: string, 
  timeframes: string[]
): Promise<boolean> {
  console.log(`Initializing historical data for ${pair} across ${timeframes.join(', ')} timeframes`);
  
  // Initialize historical data for each timeframe
  for (const timeframe of timeframes) {
    try {
      console.log(`Fetching ${timeframe} candles for ${pair}...`);
      const candles = await fetchHistoricalCandles(pair, timeframe, 1000);
      console.log(`Received ${candles.length} candles, storing to database...`);
      await storeCandles(pair, timeframe, candles);
      console.log(`Successfully stored ${timeframe} candles for ${pair}`);
    } catch (error) {
      console.error(`Error initializing ${timeframe} data for ${pair}:`, error);
      // Continue with other timeframes even if one fails
    }
  }
  return true;
}

/**
 * Helper function to break array into chunks for batch processing
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Stores candle data in the database
 * @param pair Trading pair symbol
 * @param timeframe Timeframe of the candles
 * @param candles Array of candle data to store
 */
export async function storeCandles(
  pair: string,
  timeframe: string,
  candles: CandleData[]
): Promise<void> {
  if (!candles.length) return;
  
  // Process in batches to avoid exceeding request limits
  for (const batch of chunkArray(candles, 100)) {
    const { error } = await supabase.from('ohlc_candles').upsert(
      batch.map(candle => ({
        pair,
        timeframe,
        timestamp: new Date(candle.time * 1000).toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      })),
      { onConflict: 'pair,timeframe,timestamp' }
    );
    
    if (error) {
      console.error(`Error storing candles for ${pair} ${timeframe}:`, error);
    }
  }
}

/**
 * Retrieves recent candles from database
 * @param pair Trading pair symbol
 * @param timeframe Timeframe to retrieve
 * @param limit Maximum number of candles to return
 * @returns Array of candle data
 */
export async function getRecentCandles(
  pair: string,
  timeframe: string,
  limit: number = 100
): Promise<CandleData[]> {
  console.log(`Retrieving ${limit} ${timeframe} candles for ${pair} from database`);
  
  const { data, error } = await supabase
    .from('ohlc_candles')
    .select('*')
    .eq('pair', pair)
    .eq('timeframe', timeframe)
    .order('timestamp', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error(`Error fetching candles for ${pair} ${timeframe}:`, error);
    return [];
  }
  
  // Convert database format to CandleData format
  // Reverse to return in chronological order (oldest first)
  return data.map(row => ({
    time: new Date(row.timestamp).getTime() / 1000,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume
  })).reverse();
}

/**
 * Retrieves candles between a specific date range
 * @param pair Trading pair symbol
 * @param timeframe Timeframe to retrieve
 * @param startTime Start time in milliseconds 
 * @param endTime End time in milliseconds
 */
export async function getCandlesInRange(
  pair: string,
  timeframe: string,
  startTime: number,
  endTime: number
): Promise<CandleData[]> {
  const startIso = new Date(startTime).toISOString();
  const endIso = new Date(endTime).toISOString();
  
  console.log(`Retrieving ${timeframe} candles for ${pair} from ${startIso} to ${endIso}`);
  
  const { data, error } = await supabase
    .from('ohlc_candles')
    .select('*')
    .eq('pair', pair)
    .eq('timeframe', timeframe)
    .gte('timestamp', startIso)
    .lte('timestamp', endIso)
    .order('timestamp', { ascending: true });
    
  if (error) {
    console.error(`Error fetching candles in range for ${pair} ${timeframe}:`, error);
    return [];
  }
  
  return data.map(row => ({
    time: new Date(row.timestamp).getTime() / 1000,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume
  }));
}

/**
 * Gets most recent candle for a pair and timeframe
 */
export async function getLatestCandle(
  pair: string,
  timeframe: string
): Promise<CandleData | null> {
  const { data, error } = await supabase
    .from('ohlc_candles')
    .select('*')
    .eq('pair', pair)
    .eq('timeframe', timeframe)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !data) {
    return null;
  }
  
  return {
    time: new Date(data.timestamp).getTime() / 1000,
    open: data.open,
    high: data.high,
    low: data.low,
    close: data.close,
    volume: data.volume
  };
}
