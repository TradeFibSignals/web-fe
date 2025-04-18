import { NextRequest, NextResponse } from "next/server";
import { getRecentCandles, getCandlesInRange } from "@/lib/candle-store";
import { PAIRS, TIMEFRAMES } from "@/lib/websocket-candle-builder";
import { supabase } from "@/lib/supabase-client";

/**
 * GET endpoint for retrieving OHLC data
 * 
 * Accepts query parameters:
 * - pair: Trading pair (e.g., BTCUSDT)
 * - timeframe: Candle timeframe (e.g., 5m, 15m, 1h)
 * - limit: Maximum number of candles to return (default: 100)
 * - start: Start timestamp in ISO format or milliseconds
 * - end: End timestamp in ISO format or milliseconds
 * - stats: Set to "true" to return stats instead of candles
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const pair = searchParams.get("pair");
    const timeframe = searchParams.get("timeframe");
    const limit = parseInt(searchParams.get("limit") || "100");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const stats = searchParams.get("stats") === "true";
    
    // Validate required parameters
    if (stats) {
      // Return stats for all pairs and timeframes
      return await getStats();
    }
    
    if (!pair) {
      return NextResponse.json({
        error: "Missing required parameter: pair",
        validPairs: PAIRS
      }, { status: 400 });
    }
    
    if (!timeframe) {
      return NextResponse.json({
        error: "Missing required parameter: timeframe",
        validTimeframes: TIMEFRAMES
      }, { status: 400 });
    }
    
    // Validate pair and timeframe
    if (!PAIRS.includes(pair)) {
      return NextResponse.json({
        error: `Invalid pair: ${pair}`,
        validPairs: PAIRS
      }, { status: 400 });
    }
    
    if (!TIMEFRAMES.includes(timeframe)) {
      return NextResponse.json({
        error: `Invalid timeframe: ${timeframe}`,
        validTimeframes: TIMEFRAMES
      }, { status: 400 });
    }
    
    // Fetch data based on parameters
    let candles;
    
    if (start && end) {
      // Convert timestamps to numbers
      const startTime = typeof start === "string" && start.includes("-") 
        ? new Date(start).getTime() 
        : parseInt(start);
        
      const endTime = typeof end === "string" && end.includes("-") 
        ? new Date(end).getTime() 
        : parseInt(end);
      
      candles = await getCandlesInRange(pair, timeframe, startTime, endTime);
    } else {
      // Get most recent candles
      candles = await getRecentCandles(pair, timeframe, limit);
    }
    
    // Return the data
    return NextResponse.json({
      pair,
      timeframe,
      count: candles.length,
      candles
    });
  } catch (error) {
    console.error("Error fetching OHLC data:", error);
    return NextResponse.json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * Get statistics about available OHLC data
 */
async function getStats() {
  try {
    // Check if the stats function exists
    const { data, error } = await supabase.rpc("get_candle_stats");
    
    if (error) {
      // If RPC fails, query directly
      console.error("Error using RPC for stats:", error);
      
      // Get stats for each pair and timeframe
      const stats = [];
      
      for (const pair of PAIRS) {
        for (const timeframe of TIMEFRAMES) {
          const { data: countData, error: countError } = await supabase
            .from("ohlc_candles")
            .select("timestamp", { count: "exact" })
            .eq("pair", pair)
            .eq("timeframe", timeframe)
            .limit(1);
            
          if (!countError) {
            const count = countData?.length || 0;
            
            // Only include if we have data
            if (count > 0) {
              // Get oldest and newest candle
              const { data: oldestData } = await supabase
                .from("ohlc_candles")
                .select("timestamp")
                .eq("pair", pair)
                .eq("timeframe", timeframe)
                .order("timestamp", { ascending: true })
                .limit(1)
                .single();
                
              const { data: newestData } = await supabase
                .from("ohlc_candles")
                .select("timestamp")
                .eq("pair", pair)
                .eq("timeframe", timeframe)
                .order("timestamp", { ascending: false })
                .limit(1)
                .single();
                
              stats.push({
                pair,
                timeframe,
                oldest_candle: oldestData?.timestamp || null,
                newest_candle: newestData?.timestamp || null,
                candle_count: count
              });
            }
          }
        }
      }
      
      return NextResponse.json({ stats });
    }
    
    return NextResponse.json({ stats: data });
  } catch (error) {
    console.error("Error getting OHLC stats:", error);
    return NextResponse.json({
      error: "Failed to get OHLC stats",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
