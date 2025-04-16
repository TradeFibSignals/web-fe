// API endpoint for generating trading signals
// This should be placed in your Vercel project at app/api/signals/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { CandleData, fetchKlines, timeframeToInterval } from '@/lib/binance-api';

// Symbols we'll process
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'LTC'];

// Define the structure of a trading signal
interface Signal {
  symbol: string;
  timeframe: string;
  time: number;
  type: 'buy' | 'sell' | 'strong_buy' | 'strong_sell' | 'neutral';
  price: number;
  strength: 'weak' | 'medium' | 'strong';
  indicator: string;
  message?: string;
}

// GET handler for the API route
export async function GET(request: NextRequest) {
  // Record start time to measure execution time
  const startTime = Date.now();
  
  try {
    // Get URL parameters
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || '30m';
    const symbol = searchParams.get('symbol');
    
    // Validate timeframe
    if (!['5m', '15m', '30m', '1h', '4h', '1d'].includes(timeframe)) {
      return NextResponse.json({ 
        error: 'Invalid timeframe',
        validTimeframes: ['5m', '15m', '30m', '1h', '4h', '1d']
      }, { status: 400 });
    }
    
    // Process all symbols or just one if specified
    let symbolsToProcess = [...SYMBOLS];
    if (symbol) {
      const normalizedSymbol = symbol.toUpperCase();
      if (SYMBOLS.includes(normalizedSymbol)) {
        symbolsToProcess = [normalizedSymbol];
      } else {
        return NextResponse.json({ 
          error: 'Invalid symbol',
          validSymbols: SYMBOLS
        }, { status: 400 });
      }
    }
    
    console.log(`Generating signals for ${timeframe}, symbols: ${symbolsToProcess.join(', ')}`);
    
    // Generate signals for all requested symbols
    const signals: Signal[] = [];
    const interval = timeframeToInterval(timeframe);
    
    // Process symbols with controlled concurrency
    // Vercel has a 60s execution limit so we need to be cautious
    for (const sym of symbolsToProcess) {
      try {
        // Check if we're getting close to the time limit
        if (Date.now() - startTime > 40000) { // 40 seconds
          console.warn('Approaching execution time limit, stopping processing');
          break;
        }
        
        // Fetch candle data for this symbol
        const candles = await fetchKlines(interval, 100, undefined, `${sym}USDT`);
        
        if (candles && candles.length > 0) {
          // Generate signals from the candle data
          const symbolSignals = generateSignals(candles, sym, timeframe);
          signals.push(...symbolSignals);
        }
      } catch (error) {
        console.error(`Error processing ${sym}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other symbols even if one fails
      }
    }
    
    // Calculate execution time for monitoring
    const executionTime = Date.now() - startTime;
    
    // Return the result
    return NextResponse.json({
      timeframe,
      symbols: symbolsToProcess,
      signalsCount: signals.length,
      executionTime,
      signals,
      timestamp: Date.now()
    });
  } catch (error) {
    // Handle unexpected errors
    console.error('Error generating signals:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Function to generate trading signals from candle data
function generateSignals(candles: CandleData[], symbol: string, timeframe: string): Signal[] {
  const signals: Signal[] = [];
  
  // Skip if we don't have enough candles
  if (candles.length < 10) {
    return signals;
  }
  
  // Get the most recent candles
  const recentCandles = candles.slice(-5);
  const lastCandle = recentCandles[recentCandles.length - 1];
  const prevCandle = recentCandles[recentCandles.length - 2];
  
  // Simple bull/bear pattern detection
  if (lastCandle.close > lastCandle.open && prevCandle.close < prevCandle.open) {
    signals.push({
      symbol,
      timeframe,
      time: lastCandle.time,
      type: 'buy',
      price: lastCandle.close,
      strength: 'medium',
      indicator: 'candlestick_pattern',
      message: 'Bullish candle after bearish candle'
    });
  }
  
  // Bearish pattern detection
  if (lastCandle.close < lastCandle.open && prevCandle.close > prevCandle.open) {
    signals.push({
      symbol,
      timeframe,
      time: lastCandle.time,
      type: 'sell',
      price: lastCandle.close,
      strength: 'medium',
      indicator: 'candlestick_pattern',
      message: 'Bearish candle after bullish candle'
    });
  }
  
  // Price breakout detection
  if (candles.length >= 20) {
    const last20Candles = candles.slice(-20);
    const highs = last20Candles.map(c => c.high);
    const lows = last20Candles.map(c => c.low);
    
    // Remove current candle for comparison
    highs.pop();
    lows.pop();
    
    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);
    
    // Breakout signal
    if (lastCandle.close > highestHigh) {
      signals.push({
        symbol,
        timeframe,
        time: lastCandle.time,
        type: 'strong_buy',
        price: lastCandle.close,
        strength: 'strong',
        indicator: 'breakout',
        message: 'Price broke above previous high'
      });
    }
    
    // Breakdown signal
    if (lastCandle.close < lowestLow) {
      signals.push({
        symbol,
        timeframe,
        time: lastCandle.time,
        type: 'strong_sell',
        price: lastCandle.close,
        strength: 'strong',
        indicator: 'breakdown',
        message: 'Price broke below previous low'
      });
    }
  }
  
  // Calculate simple moving average
  if (candles.length >= 50) {
    const prices = candles.map(c => c.close);
    const sma20 = calculateSMA(prices.slice(-20));
    const sma50 = calculateSMA(prices.slice(-50));
    
    // SMA crossover (bullish)
    if (sma20 > sma50 && lastCandle.close > sma20) {
      signals.push({
        symbol,
        timeframe,
        time: lastCandle.time,
        type: 'buy',
        price: lastCandle.close,
        strength: 'medium',
        indicator: 'moving_average',
        message: 'Price above SMA20, SMA20 above SMA50'
      });
    }
    
    // SMA crossover (bearish)
    if (sma20 < sma50 && lastCandle.close < sma20) {
      signals.push({
        symbol,
        timeframe,
        time: lastCandle.time,
        type: 'sell',
        price: lastCandle.close,
        strength: 'medium',
        indicator: 'moving_average',
        message: 'Price below SMA20, SMA20 below SMA50'
      });
    }
  }
  
  // RSI calculation and signals
  if (candles.length >= 14) {
    const rsi = calculateRSI(candles.slice(-14).map(c => c.close));
    
    // Oversold condition
    if (rsi < 30) {
      signals.push({
        symbol,
        timeframe,
        time: lastCandle.time,
        type: 'buy',
        price: lastCandle.close,
        strength: 'medium',
        indicator: 'rsi',
        message: `RSI oversold (${rsi.toFixed(2)})`
      });
    }
    
    // Overbought condition
    if (rsi > 70) {
      signals.push({
        symbol,
        timeframe,
        time: lastCandle.time,
        type: 'sell',
        price: lastCandle.close,
        strength: 'medium',
        indicator: 'rsi',
        message: `RSI overbought (${rsi.toFixed(2)})`
      });
    }
  }
  
  return signals;
}

// Helper function to calculate Simple Moving Average
function calculateSMA(prices: number[]): number {
  const sum = prices.reduce((total, price) => total + price, 0);
  return sum / prices.length;
}

// Helper function to calculate RSI (Relative Strength Index)
function calculateRSI(prices: number[]): number {
  let gains = 0;
  let losses = 0;
  
  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change; // Make positive
    }
  }
  
  // Average gains and losses
  const avgGain = gains / (prices.length - 1);
  const avgLoss = losses / (prices.length - 1);
  
  // Calculate RSI
  if (avgLoss === 0) return 100; // Prevent division by zero
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
