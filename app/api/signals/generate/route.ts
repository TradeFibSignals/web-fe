// API endpoint for generating trading signals
// This should be placed in your Vercel project at app/api/signals/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateSignalsForTimeframe } from '@/lib/signal-generator-service';

// Symbols we'll process
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'LTC'];

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
    
    console.log(`Generating signals for ${timeframe}, symbols: ${symbol || SYMBOLS.join(', ')}`);
    
    // Call the service function that handles database operations
    const results = await generateSignalsForTimeframe(timeframe, symbol);
    
    // Calculate execution time for monitoring
    const executionTime = Date.now() - startTime;
    
    // Return the result
    return NextResponse.json({
      timeframe,
      symbols: symbol ? [symbol] : SYMBOLS,
      signalsCount: results.length,
      executionTime,
      results,
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
