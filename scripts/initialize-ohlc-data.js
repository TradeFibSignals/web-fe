// scripts/initialize-ohlc-data.js
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT', 'SOLUSDT',
  'DOGEUSDT', 'TROUSDT', 'ADAUSDT', 'LEOUSDT', 'LINKUSDT'
];
const TIMEFRAMES = ['5m', '15m', '30m', '1h'];

// Create Supabase client
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

if (!supabase) {
  console.error('ERROR: Supabase client could not be created. Check your environment variables.');
  process.exit(1);
}

// Helper function to fetch historical candles
async function fetchHistoricalCandles(pair, timeframe, limit = 1000) {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: pair,
        interval: timeframe,
        limit
      },
      timeout: 10000
    });
    
    if (response.status === 200 && Array.isArray(response.data)) {
      return response.data.map(candle => ({
        time: Math.floor(candle[0] / 1000),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));
    }
    
    throw new Error(`Invalid response from Binance: ${response.status}`);
  } catch (error) {
    console.error(`Error fetching historical candles for ${pair} ${timeframe}: ${error.message}`);
    return [];
  }
}

// Helper function to store candles in the database
async function storeCandles(pair, timeframe, candles) {
  if (!candles.length) return;
  
  try {
    // Process in batches to avoid exceeding request limits
    const batchSize = 100;
    for (let i = 0; i < candles.length; i += batchSize) {
      const batch = candles.slice(i, i + batchSize);
      
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
        console.error(`Error storing candles batch for ${pair} ${timeframe}: ${error.message}`);
      }
    }
    
    console.log(`Successfully stored ${candles.length} candles for ${pair} ${timeframe}`);
  } catch (error) {
    console.error(`Error storing candles for ${pair} ${timeframe}: ${error.message}`);
  }
}

// Main initialization function
async function initialize() {
  console.log('=== OHLC Data Initialization ===');
  console.log(`Pairs: ${PAIRS.join(', ')}`);
  console.log(`Timeframes: ${TIMEFRAMES.join(', ')}`);
  console.log('================================');
  
  try {
    // Initialize data for all pairs and timeframes
    for (const pair of PAIRS) {
      console.log(`\nInitializing historical data for ${pair}...`);
      
      for (const timeframe of TIMEFRAMES) {
        try {
          console.log(`Fetching ${timeframe} candles for ${pair}...`);
          const candles = await fetchHistoricalCandles(pair, timeframe);
          
          if (candles.length > 0) {
            console.log(`Retrieved ${candles.length} candles, storing to database...`);
            await storeCandles(pair, timeframe, candles);
          } else {
            console.log(`No candles retrieved for ${pair} ${timeframe}`);
          }
        } catch (error) {
          console.error(`Error processing ${pair} ${timeframe}: ${error.message}`);
        }
      }
    }
    
    console.log('\n=== Historical data initialization complete ===');
  } catch (error) {
    console.error('Critical error during initialization:', error);
    process.exit(1);
  }
}

// Run the initialization
initialize().then(() => {
  console.log('Initialization completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Failed to complete initialization:', error);
  process.exit(1);
});
