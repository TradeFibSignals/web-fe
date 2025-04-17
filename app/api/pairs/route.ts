import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { fetchAvailablePairs } from "@/lib/binance-api";

export async function GET(request: NextRequest) {
  try {
    // Get available trading pairs from Binance API
    const pairs = await fetchAvailablePairs();

    // Return the pairs as JSON
    return NextResponse.json({
      success: true,
      pairs,
      count: pairs.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Error fetching available pairs:", error);
    
    // Fallback to default pairs in case of error
    const fallbackPairs = [
      "BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "SOLUSDT", 
      "DOTUSDT", "DOGEUSDT", "MATICUSDT", "LINKUSDT", "AVAXUSDT"
    ];
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      pairs: fallbackPairs,
      count: fallbackPairs.length,
      message: "Using fallback pairs due to API error"
    });
  }
}
