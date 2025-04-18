import { NextRequest, NextResponse } from 'next/server';
import { generateSignalsForTimeframe } from '@/lib/signal-generator-service';
import { supabase } from '@/lib/supabase-client';
import { getMonthlyPositiveProb } from '@/lib/seasonality-cache';

// Symbols we'll process by default
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'LTC'];

// Helper function to prime the seasonality data
async function ensureSeasonalityDataLoaded() {
  try {
    if (!supabase) return;
    
    // First check if seasonality_temp table has data for current month
    const currentMonth = new Date().getMonth();
    const { data, error } = await supabase
      .from("seasonality_temp")
      .select("probability")
      .eq("month", currentMonth)
      .single();
    
    // If data exists, we're good
    if (!error && data) {
      console.log(`Seasonality data for month ${currentMonth} exists in database: ${data.probability}%`);
      return;
    }
    
    // If not, try to get it from seasonality-data.ts via seasonality-cache.ts
    console.log(`Seasonality data for month ${currentMonth} not found, attempting to load from cache...`);
    const monthlyProbs = await getMonthlyPositiveProb();
    
    if (monthlyProbs && monthlyProbs[currentMonth] !== undefined) {
      const probability = monthlyProbs[currentMonth];
      
      // Insert or update the value in seasonality_temp
      const { error: upsertError } = await supabase
        .from("seasonality_temp")
        .upsert({
          month: currentMonth,
          probability: probability,
          created_at: new Date().toISOString()
        });
      
      if (upsertError) {
        console.error(`Error upserting seasonality data:`, upsertError);
      } else {
        console.log(`Successfully updated seasonality_temp for month ${currentMonth} with probability ${probability}%`);
      }
    }
  } catch (error) {
    console.error(`Error ensuring seasonality data:`, error);
  }
}

// GET handler for the API route
export async function GET(request: NextRequest) {
  // Record start time to measure execution time
  const startTime = Date.now();
  
  try {
    // Verify the Supabase client is available
    if (!supabase) {
      return NextResponse.json({ 
        error: 'Supabase client not available. Check your environment variables.' 
      }, { status: 500 });
    }
    
    // Ensure seasonality data is loaded
    await ensureSeasonalityDataLoaded();
    
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
    
    // Get generated signals for the given timeframe
    let signals = [];
    
    try {
      // Query the database for recently generated signals
      const { data: signalData, error } = await supabase
        .from("generated_signals")
        .select("*")
        .eq("timeframe", timeframe)
        .eq("status", "active")
        .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching generated signals:", error);
      } else {
        signals = signalData || [];
      }
    } catch (dbError) {
      console.error("Error querying signals:", dbError);
    }
    
    // Return the result with the "signals" array that the EC2 script expects
    return NextResponse.json({
      timeframe,
      symbols: symbol ? [symbol] : SYMBOLS,
      signalsCount: results.length,
      executionTime,
      signals, // This is required by the EC2 client
      results,
      timestamp: Date.now()
    });
  } catch (error) {
    // Handle unexpected errors
    console.error('Error generating signals:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      signals: [] // Include empty signals array even in error case
    }, { status: 500 });
  }
}
