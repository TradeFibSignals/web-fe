import { binanceWebSocket } from './websocket-service';
import { storeCandles, getLatestCandle } from './candle-store';
import { supabase } from './supabase-client';

// List of timeframes to monitor
export const TIMEFRAMES = ['5m', '15m', '30m', '1h'];

// List of pairs to monitor
export const PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BNBUSDT', 'SOLUSDT',
  'DOGEUSDT', 'TROUSDT', 'ADAUSDT', 'LEOUSDT', 'LINKUSDT'
];

/**
 * Get timeframe duration in milliseconds
 * @param timeframe Timeframe string (e.g., '5m', '1h')
 */
export function getTimeframeMs(timeframe: string): number {
  switch (timeframe) {
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '30m': return 30 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000; // Default to 1h
  }
}

/**
 * Interface for candle data
 */
export interface CandleData {
  time: number;    // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Class to build candles from WebSocket ticker data
 */
export class CandleBuilder {
  private currentCandles: Map<string, Map<string, CandleData>> = new Map();
  private lastProcessedTime: Map<string, Map<string, number>> = new Map();
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  /**
   * Constructor
   * @param pairs Array of trading pairs to monitor
   * @param timeframes Array of timeframes to build candles for
   */
  constructor(
    private pairs: string[] = PAIRS,
    private timeframes: string[] = TIMEFRAMES
  ) {
    this.initializeCandles();
  }
  
  /**
   * Initialize the candle tracking structures
   */
  private async initializeCandles() {
    console.log('Initializing candle tracking structures...');
    
    for (const pair of this.pairs) {
      this.currentCandles.set(pair, new Map());
      this.lastProcessedTime.set(pair, new Map());
      
      for (const timeframe of this.timeframes) {
        // Initialize with empty candle
        const emptyCandle = this.createEmptyCandle();
        this.currentCandles.get(pair)!.set(timeframe, emptyCandle);
        this.lastProcessedTime.get(pair)!.set(timeframe, 0);
        
        // Try to load the most recent candle from the database
        try {
          const latestCandle = await getLatestCandle(pair, timeframe);
          if (latestCandle) {
            console.log(`Found latest ${timeframe} candle for ${pair} at ${new Date(latestCandle.time * 1000).toISOString()}`);
            
            // Determine if we should start a new candle or continue with this one
            const timeframeMs = getTimeframeMs(timeframe);
            const currentCandleStart = Math.floor(Date.now() / timeframeMs) * timeframeMs;
            
            if (latestCandle.time * 1000 >= currentCandleStart) {
              // Latest candle is still the current one, use it
              this.currentCandles.get(pair)!.set(timeframe, latestCandle);
            } else {
              // Start a new candle
              const newCandle = this.createEmptyCandle();
              newCandle.time = currentCandleStart / 1000;
              // We'll set OHLC when we get the first tick
              this.currentCandles.get(pair)!.set(timeframe, newCandle);
            }
          }
        } catch (error) {
          console.error(`Error loading latest candle for ${pair} ${timeframe}:`, error);
        }
      }
    }
    
    console.log('Candle tracking structures initialized');
  }
  
  /**
   * Start the candle builder
   */
  public start() {
    if (this.isRunning) {
      console.warn('Candle builder is already running');
      return;
    }
    
    console.log('Starting candle builder...');
    this.isRunning = true;
    
    for (const pair of this.pairs) {
      // Connect to WebSocket for this pair
      console.log(`Connecting to WebSocket for ${pair}...`);
      binanceWebSocket.connect(pair.toLowerCase());
      
      // Subscribe to ticker events
      binanceWebSocket.subscribe('ticker', (data) => {
        if (data.s === pair) {
          this.processTick(pair, Number(data.c), Number(data.v));
        }
      });
      
      // Also subscribe to trade events for more accurate volume
      binanceWebSocket.subscribe('trade', (data) => {
        if (data.s === pair) {
          this.processTrade(pair, Number(data.p), Number(data.q));
        }
      });
    }
    
    // Start interval for checking candle closures
    this.intervalId = setInterval(() => this.checkCandleClosures(), 1000);
    
    console.log('Candle builder started');
  }
  
  /**
   * Stop the candle builder
   */
  public stop() {
    if (!this.isRunning) {
      console.warn('Candle builder is not running');
      return;
    }
    
    console.log('Stopping candle builder...');
    this.isRunning = false;
    
    // Stop the interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Close websocket connections
    for (const pair of this.pairs) {
      binanceWebSocket.disconnect();
    }
    
    console.log('Candle builder stopped');
  }
  
  /**
   * Process a ticker update
   * @param pair Trading pair symbol
   * @param price Current price
   * @param volume Optional volume
   */
  private processTick(pair: string, price: number, volume?: number) {
    if (!this.isRunning) return;
    
    const now = Date.now();
    const pairCandles = this.currentCandles.get(pair);
    
    if (!pairCandles) return;
    
    // Update candles for all timeframes
    for (const [timeframe, candle] of pairCandles.entries()) {
      const timeframeMs = getTimeframeMs(timeframe);
      const currentCandleStart = Math.floor(now / timeframeMs) * timeframeMs;
      
      // If a new candle period has started
      if (candle.time * 1000 < currentCandleStart) {
        // Store the completed candle if it has data
        if (candle.high > 0) {
          const completedCandle = { ...candle };
          storeCandles(pair, timeframe, [completedCandle])
            .catch(err => console.error(`Error storing completed candle for ${pair} ${timeframe}:`, err));
        }
        
        // Create new candle
        const newCandle = this.createEmptyCandle();
        newCandle.time = currentCandleStart / 1000;
        newCandle.open = price;
        newCandle.high = price;
        newCandle.low = price;
        newCandle.close = price;
        if (volume) newCandle.volume = volume;
        
        pairCandles.set(timeframe, newCandle);
      } else {
        // Update existing candle
        if (candle.open === 0) candle.open = price; // Set open price if not set yet
        candle.high = Math.max(candle.high, price);
        candle.low = candle.low > 0 ? Math.min(candle.low, price) : price;
        candle.close = price;
        // Volume is better updated from trade events, but we can use ticker volume as fallback
        if (volume && volume > candle.volume) candle.volume = volume;
      }
    }
  }
  
  /**
   * Process an individual trade
   * @param pair Trading pair symbol
   * @param price Trade price
   * @param quantity Trade quantity
   */
  private processTrade(pair: string, price: number, quantity: number) {
    if (!this.isRunning) return;
    
    const pairCandles = this.currentCandles.get(pair);
    if (!pairCandles) return;
    
    // Update all timeframes
    for (const [timeframe, candle] of pairCandles.entries()) {
      // Only update if we have a valid candle
      if (candle.time > 0) {
        // Update the price data
        if (candle.open === 0) candle.open = price;
        candle.high = Math.max(candle.high, price);
        candle.low = candle.low > 0 ? Math.min(candle.low, price) : price;
        candle.close = price;
        
        // Add to volume
        candle.volume += quantity;
      }
    }
  }
  
  /**
   * Check for and handle candle closures
   */
  private async checkCandleClosures() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    
    for (const pair of this.pairs) {
      const pairCandles = this.currentCandles.get(pair);
      const pairLastProcessed = this.lastProcessedTime.get(pair);
      
      if (!pairCandles || !pairLastProcessed) continue;
      
      for (const timeframe of this.timeframes) {
        const timeframeMs = getTimeframeMs(timeframe);
        const lastProcessed = pairLastProcessed.get(timeframe) || 0;
        
        // Get the start of the current candle period
        const currentCandleStart = Math.floor(now / timeframeMs) * timeframeMs;
        const candle = pairCandles.get(timeframe);
        
        // If candle is for previous period and we haven't processed it recently
        if (candle && candle.time * 1000 < currentCandleStart && (now - lastProcessed >= timeframeMs / 2)) {
          // Only store if candle has valid data
          if (candle.high > 0) {
            // Close out the current candle and store it
            try {
              await storeCandles(pair, timeframe, [candle]);
              pairLastProcessed.set(timeframe, now);
              
              // Start a new candle
              const newCandle = this.createEmptyCandle();
              newCandle.time = currentCandleStart / 1000;
              // We'll set OHLC when we get the first tick
              pairCandles.set(timeframe, newCandle);
              
              console.log(`Stored and started new ${timeframe} candle for ${pair}`);
            } catch (error) {
              console.error(`Error processing candle closure for ${pair} ${timeframe}:`, error);
            }
          }
        }
      }
    }
  }
  
  /**
   * Create an empty candle data object
   */
  private createEmptyCandle(): CandleData {
    return {
      time: 0,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0
    };
  }
}
